import {
  Message,
  ContextData,
  ContextMetadata,
  ContextRelationshipType,
  SummaryResult,
  ApiCallType,
} from '../domain/types';
import { RelatedContext } from '../types/related-context';
import { Summarizer } from './summarizer.service';
import { FileSystemRepository } from '../repositories/file-system.repository';
import { VectorRepository } from '../repositories/vector.repository';
import { GraphRepository } from '../repositories/graph.repository';
import { MCPConfig } from '../config/config';
import { ApiAnalytics } from '../utils/analytics';
import crypto from 'crypto';

/**
 * Repository dependencies for the Context Service
 */
interface Repositories {
  fs: FileSystemRepository;
  vector?: VectorRepository | null;
  graph?: GraphRepository | null;
}

/**
 * Service layer for handling core context management logic
 */
export class ContextService {
  private repositories: Repositories;
  private summarizer?: Summarizer;
  private config: Omit<MCPConfig, 'ignorePatterns'>;
  private analytics: ApiAnalytics | null;

  /**
   * Create a new ContextService
   */
  constructor(
    repositories: Repositories,
    summarizer: Summarizer | undefined,
    config: Omit<MCPConfig, 'ignorePatterns'>,
    analytics: ApiAnalytics | null = null
  ) {
    this.repositories = repositories;
    this.summarizer = summarizer;
    this.config = config;
    this.analytics = analytics;
  }

  /**
   * Add a message to the specified context
   */
  async addMessage(message: Message): Promise<void> {
    // 요청 ID 생성 (로깅 및 추적용)
    const requestId = crypto.randomUUID();
    
    console.error(`[DEBUG] ContextService.addMessage [${requestId}] Starting: ${message.contextId}`);
    
    if (!message.contextId) {
      const error = new Error("Context ID cannot be undefined or empty");
      console.error(`[ERROR] ContextService.addMessage [${requestId}] Failed:`, error);
      throw error;
    }

    const timestamp = Date.now();
    const messageToAdd: Message = {
      ...message,
      timestamp,
    };

    try {
      console.error(`[DEBUG] ContextService.addMessage [${requestId}] Adding message to storage`);
      // Add message using repository
      await this.repositories.fs.addMessage(message.contextId, messageToAdd);

      // Update metadata
      console.error(`[DEBUG] ContextService.addMessage [${requestId}] Updating metadata`);
      const currentData = await this.repositories.fs.loadContextData(message.contextId);
      const baseMetadata = currentData || {
        contextId: message.contextId,
        createdAt: timestamp,
        messagesSinceLastSummary: 0,
        lastActivityAt: timestamp,
      };
      const newMsgCount = (baseMetadata.messagesSinceLastSummary || 0) + 1;
      const metadataToSave: ContextMetadata = {
        ...baseMetadata,
        contextId: message.contextId,
        messagesSinceLastSummary: newMsgCount,
        lastActivityAt: timestamp,
      };
      await this.repositories.fs.saveContextData(message.contextId, metadataToSave);

      // Ensure we add to the vector database if it's enabled
      if (this.repositories.vector) {
        console.error(`[DEBUG] ContextService.addMessage [${requestId}] Updating vector database`);
        
        try {
          // Load the full context to get all messages
          const fullContext = await this.repositories.fs.loadContext(message.contextId);
          if (fullContext) {
            // Combine all messages into a coherent text for vector embedding
            let fullContextText = fullContext.messages
              .map((msg) => `${msg.role}: ${msg.content}`)
              .join('\n');

            // When a summary is available and it's not a string, use its content
            if (fullContext.summary && typeof fullContext.summary !== 'string') {
              fullContextText += '\nSummary: \n';
              fullContextText +=
                fullContext.summary.summary +
                '\n' +
                (fullContext.summary.codeBlocks || [])
                  .map((block) => `Language: ${block.language || 'unknown'}\n${block.code}`)
                  .join('\n\n');
            }

            // Add or update the vector context
            if (
              fullContext.summary &&
              typeof fullContext.summary !== 'string' &&
              fullContext.summary.summary
            ) {
              // If we have a summary, use both the full text and summary for better embedding
              await this.repositories.vector.updateContext(
                message.contextId,
                fullContextText,
                fullContext.summary.summary
              );
            } else {
              // Otherwise just use the message text
              await this.repositories.vector.addContext(
                message.contextId,
                fullContextText,
                fullContextText.substring(0, 200) + '...' // Simple placeholder summary
              );
            }

            // Find similar contexts for automatic relationship building
            if (this.repositories.graph && this.config.useGraphDb) {
              console.error(`[DEBUG] ContextService.addMessage [${requestId}] Building context relationships`);
              
              try {
                const similarContexts = await this.repositories.vector.findSimilarContexts(
                  fullContextText,
                  5
                );

                // Create relationships with similar contexts
                for (const context of similarContexts) {
                  if (
                    context.contextId !== message.contextId &&
                    context.similarity &&
                    context.similarity > (this.config.similarityThreshold || 0.6)
                  ) {
                    // Create bidirectional relationships for better graph traversal
                    await this.repositories.graph.addRelationship(
                      message.contextId,
                      context.contextId,
                      ContextRelationshipType.SIMILAR,
                      context.similarity
                    );
                  }
                }
              } catch (graphError) {
                console.error(`[ERROR] ContextService.addMessage [${requestId}] Failed to build relationships:`, graphError);
                // Continue execution even if relationship building fails
              }
            }
          }
        } catch (vectorError) {
          console.error(`[ERROR] ContextService.addMessage [${requestId}] Vector database update failed:`, vectorError);
          // Continue execution even if vector update fails
        }
      }

      // Trigger background summarization if needed
      if (
        this.config.autoSummarize &&
        this.summarizer &&
        newMsgCount >= (this.config.messageLimitThreshold || 10)
      ) {
        console.error(`[DEBUG] ContextService.addMessage [${requestId}] Triggering background summarization`);
        this.triggerBackgroundSummarization(message.contextId).catch((summaryError) => {
          console.error(`[ERROR] ContextService.addMessage [${requestId}] Background summarization failed:`, summaryError);
          // Ignore errors in background task
        });
      }
      
      console.error(`[DEBUG] ContextService.addMessage [${requestId}] Completed successfully`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ERROR] ContextService.addMessage [${requestId}] Failed:`, error);
      throw new Error(`Failed to add message to ${message.contextId}: ${errorMessage}`);
    }

    // Track API call
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.VECTOR_DB_ADD, { contextId: message.contextId });
    }
  }

  /**
   * Find similar contexts based on text
   */
  public async findSimilarContexts(text: string, limit = 5): Promise<RelatedContext[]> {
    // 요청 ID 생성 (로깅 및 추적용)
    const requestId = crypto.randomUUID();
    
    console.error(`[DEBUG] ContextService.findSimilarContexts [${requestId}] Starting with query length: ${text.length}, limit: ${limit}`);
    
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.VECTOR_DB_SEARCH, { query: text, limit });
    }

    if (!this.repositories.vector) {
      console.error(`[DEBUG] ContextService.findSimilarContexts [${requestId}] Vector database not configured, returning empty array`);
      return [];
    }

    try {
      console.error(`[DEBUG] ContextService.findSimilarContexts [${requestId}] Searching vector database`);
      const results = await this.repositories.vector.findSimilarContexts(text, limit);
      console.error(`[DEBUG] ContextService.findSimilarContexts [${requestId}] Found ${results.length} results`);
      return results;
    } catch (error: unknown) {
      console.error(`[ERROR] ContextService.findSimilarContexts [${requestId}] Failed:`, error);
      return [];
    }
  }

  /**
   * Load full context including metadata, messages, and summary
   */
  async getContext(contextId: string): Promise<ContextData | undefined> {
    // 요청 ID 생성 (로깅 및 추적용)
    const requestId = crypto.randomUUID();
    
    if (!contextId) {
      console.error(`[ERROR] ContextService.getContext [${requestId}] Invalid contextId: ${contextId}`);
      return undefined;
    }
    
    console.error(`[DEBUG] ContextService.getContext [${requestId}] Loading context: ${contextId}`);
    
    try {
      const result = await this.repositories.fs.loadContext(contextId);
      
      if (!result) {
        console.error(`[DEBUG] ContextService.getContext [${requestId}] Context not found: ${contextId}`);
      } else {
        console.error(`[DEBUG] ContextService.getContext [${requestId}] Context loaded with ${result.messages?.length || 0} messages`);
      }
      
      return result;
    } catch (error) {
      console.error(`[ERROR] ContextService.getContext [${requestId}] Failed to load context:`, error);
      return undefined;
    }
  }

  /**
   * Trigger background summarization process
   */
  private async triggerBackgroundSummarization(contextId: string): Promise<void> {
    if (!this.summarizer) {
      return;
    }

    try {
      await this.triggerManualSummarization(contextId);
    } catch (error) {
      // Ignore errors in background process
    }
  }

  /**
   * Trigger manual summarization for a specific context
   */
  private async triggerManualSummarization(contextId: string): Promise<SummaryResult> {
    if (!this.summarizer) {
      throw new Error('Summarizer not available');
    }

    try {
      // Track API call
      if (this.analytics) {
        this.analytics.trackCall(ApiCallType.LLM_SUMMARIZE, {
          contextId,
          manualTrigger: true,
        });
      }

      const context = await this.repositories.fs.loadContext(contextId);
      if (!context) {
        throw new Error(`Context not found: ${contextId}`);
      }

      return await this.summarizeContext(contextId, context.messages);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to manually summarize context ${contextId}: ${errorMessage}`);
      throw new Error(`Summarization failed: ${errorMessage}`);
    }
  }

  /**
   * Summarize a context with messages
   * @param contextId Context ID
   * @param messages Messages to summarize
   * @returns Summary result
   */
  private async summarizeContext(contextId: string, messages: Message[]): Promise<SummaryResult> {
    if (!this.summarizer) {
      return { success: false, error: 'Summarizer is not configured' };
    }

    if (!messages || messages.length === 0) {
      return { success: false, error: 'No messages to summarize' };
    }

    const result = await this.summarizer.summarize(messages, contextId);

    if (result.success && result.summary) {
      await this.repositories.fs.saveSummary(result.summary);

      // Add summary to vector DB if configured
      if (this.repositories.vector) {
        try {
          await this.repositories.vector.addSummary(result.summary);
        } catch (vectorError) {
          // Ignore vector errors
        }
      }

      // Update metadata
      const existingMetadata = await this.repositories.fs.loadContextData(contextId);
      if (existingMetadata) {
        const updatedMetadata: ContextMetadata = {
          ...existingMetadata,
          messagesSinceLastSummary: 0,
          hasSummary: true,
          lastSummarizedAt: Date.now(),
        };
        await this.repositories.fs.saveContextData(contextId, updatedMetadata);
      }
    }

    return result;
  }
}
