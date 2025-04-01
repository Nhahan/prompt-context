import {
  Message,
  ContextData,
  ContextMetadata,
  ContextRelationshipType,
  SummaryResult,
  ApiCallType,
} from '../domain/types';
import { RelatedContext } from '../types/related-context';
import { ContextServiceInterface } from './context.interface';
import {
  Repository,
  VectorRepositoryInterface,
  GraphRepositoryInterface,
} from '../repositories/repository.interface';
import { SummarizerService } from './summarizer.interface';
import { MCPConfig } from '../config/config';
import { ApiAnalytics } from '../utils/analytics';

/**
 * Repository dependencies for the Context Service
 */
interface Repositories {
  fs: Repository;
  vector?: VectorRepositoryInterface | null;
  graph?: GraphRepositoryInterface | null;
}

/**
 * Service layer for handling core context management logic
 */
export class ContextService implements ContextServiceInterface {
  private repositories: Repositories;
  private summarizer?: SummarizerService;
  private config: Omit<MCPConfig, 'ignorePatterns'>;
  private analytics: ApiAnalytics | null;

  /**
   * Create a new ContextService
   */
  constructor(
    repositories: Repositories,
    summarizer: SummarizerService | undefined,
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
    const timestamp = Date.now();
    const messageToAdd: Message = {
      ...message,
      timestamp,
    };

    try {
      // Add message using repository
      await this.repositories.fs.addMessage(message.contextId, messageToAdd);

      // Update metadata
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

      // Trigger background summarization if needed
      if (
        this.config.autoSummarize &&
        this.summarizer &&
        newMsgCount >= (this.config.messageLimitThreshold || 10)
      ) {
        this.triggerBackgroundSummarization(message.contextId).catch(() => {
          // Ignore errors in background task
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.VECTOR_DB_SEARCH, { query: text, limit });
    }

    if (!this.repositories.vector) {
      return [];
    }

    try {
      return await this.repositories.vector.findSimilarContexts(text, limit);
    } catch (error: unknown) {
      return [];
    }
  }

  /**
   * Add a relationship between contexts
   */
  async addRelationship(
    sourceId: string,
    targetId: string,
    type: ContextRelationshipType
  ): Promise<void> {
    try {
      if (this.analytics) {
        this.analytics.trackCall(ApiCallType.GRAPH_DB_ADD);
      }
      await this.repositories.graph?.addRelationship(sourceId, targetId, type, 1);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to add relationship: ${errorMessage}`);
    }
  }

  /**
   * Delete a context
   */
  async deleteContext(contextId: string): Promise<void> {
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.VECTOR_DB_DELETE);
    }
    await this.repositories.vector?.deleteContext(contextId);
    await this.repositories.graph?.removeContext(contextId);
    await this.repositories.fs.deleteContext(contextId);
  }

  /**
   * Load context metadata
   */
  async loadContextData(contextId: string): Promise<ContextMetadata | undefined> {
    return await this.repositories.fs.loadContextData(contextId);
  }

  /**
   * Save context metadata
   */
  async saveContextData(contextId: string, metadata: ContextMetadata): Promise<void> {
    await this.repositories.fs.saveContextData(contextId, metadata);
  }

  /**
   * Load full context including metadata, messages, and summary
   */
  async loadContext(contextId: string): Promise<ContextData | undefined> {
    return await this.repositories.fs.loadContext(contextId);
  }

  /**
   * Get all context IDs
   */
  async getAllContextIds(): Promise<string[]> {
    return await this.repositories.fs.getAllContextIds();
  }

  /**
   * Get all hierarchical context IDs
   */
  async getAllHierarchicalContextIds(): Promise<string[]> {
    return await this.repositories.fs.getAllHierarchicalContextIds();
  }

  /**
   * Get all meta-summary IDs
   */
  async getAllMetaSummaryIds(): Promise<string[]> {
    return await this.repositories.fs.getAllMetaSummaryIds();
  }

  /**
   * Get related contexts
   */
  async getRelatedContexts(
    contextId: string,
    relationshipType?: ContextRelationshipType,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<string[]> {
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.GRAPH_DB_SEARCH, {
        contextId,
        relationshipType,
        direction,
      });
    }

    if (!this.repositories.graph) {
      return [];
    }

    try {
      return await this.repositories.graph.getRelatedContexts(
        contextId,
        relationshipType,
        direction
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Get context (alias for loadContext for backward compatibility)
   */
  async getContext(contextId: string): Promise<ContextData | undefined> {
    return this.loadContext(contextId);
  }

  /**
   * Trigger manual summarization for a specific context
   */
  async triggerManualSummarization(contextId: string): Promise<SummaryResult> {
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
}
