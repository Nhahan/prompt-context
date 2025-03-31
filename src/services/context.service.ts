import {
  Message,
  ContextData,
  SimilarContext,
  ContextRelationshipType,
  SummaryResult,
  ContextMetadata,
  ApiCallType,
} from '../domain/types';
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
   * @param repositories Repository dependencies
   * @param summarizer Optional summarizer service
   * @param config MCP configuration
   * @param analytics Optional analytics service
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
    console.error('[ContextService] Initialized.');
  }

  /**
   * Add a message to the specified context and handle metadata updates
   * and potential background summarization trigger.
   * @param contextId Context ID
   * @param messageData Message data without timestamp
   */
  async addMessage(contextId: string, messageData: Omit<Message, 'timestamp'>): Promise<void> {
    console.error(`[ContextService] Adding message to ${contextId}`);
    const timestamp = Date.now();
    const message: Message = {
      ...messageData,
      timestamp,
    };

    try {
      // 1. Add message using fs repository
      await this.repositories.fs.addMessage(contextId, message);

      // 2. Update metadata using fs repository
      const currentData = await this.repositories.fs.loadContextData(contextId);
      // If metadata doesn't exist after addMessage (shouldn't happen normally as addMessage creates it),
      // something is wrong, but we create a default one to proceed cautiously.
      const baseMetadata = currentData || {
        contextId,
        createdAt: timestamp, // Use message timestamp if created now
        messagesSinceLastSummary: 0,
        lastActivityAt: timestamp,
      };
      const newMsgCount = (baseMetadata.messagesSinceLastSummary || 0) + 1;
      const metadataToSave: ContextMetadata = {
        ...baseMetadata,
        contextId: contextId, // Ensure contextId is present
        messagesSinceLastSummary: newMsgCount,
        lastActivityAt: timestamp,
      };
      await this.repositories.fs.saveContextData(contextId, metadataToSave);

      // 3. Trigger background summarization if needed
      if (
        this.config.autoSummarize &&
        this.summarizer &&
        newMsgCount >= (this.config.messageLimitThreshold || 10)
      ) {
        // Call the private background summarization method (non-blocking)
        this.triggerBackgroundSummarization(contextId).catch((err) => {
          // Log error from the background task initiation if needed, but don't block addMessage
          console.error(
            `[ContextService] Error initiating background summarization for ${contextId}:`,
            err
          );
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ContextService] Error adding message for ${contextId}: ${errorMessage}`);
      // Re-throw the error to be caught by the MCP server handler
      throw new Error(`Failed to add message to ${contextId}: ${errorMessage}`);
    }

    // Track API call if analytics is enabled
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.VECTOR_DB_ADD, { contextId });
    }
  }

  /**
   * Retrieve the full context data (metadata, messages, summary)
   * @param contextId Context ID
   */
  async getContext(contextId: string): Promise<ContextData | null> {
    console.error(`[ContextService] Getting context for ${contextId}`);

    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.VECTOR_DB_SEARCH, { contextId });
    }

    try {
      const context = await this.repositories.fs.loadContext(contextId);
      if (!context) {
        // Context not found is not necessarily an error in the service layer,
        // can be handled by the controller. Return null.
        return null;
      }
      return context;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ContextService] Error retrieving context ${contextId}: ${errorMessage}`);
      throw new Error(`Failed to retrieve context ${contextId}: ${errorMessage}`);
    }
  }

  /**
   * Manually trigger summarization for a specific context
   * @param contextId Context ID
   */
  async triggerManualSummarization(contextId: string): Promise<SummaryResult> {
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.LLM_SUMMARIZE, {
        contextId,
        manualTrigger: true,
      });
    }

    console.error(`[ContextService] Manually triggering summarization for ${contextId}`);

    if (!this.summarizer) {
      console.error('[ContextService] Summarizer is not configured.');
      return { success: false, error: 'Summarizer is not configured.' };
    }

    let result: SummaryResult = { success: false };
    try {
      const messages = await this.repositories.fs.loadMessages(contextId);
      if (!messages || messages.length === 0) {
        console.error(
          `[ContextService] No messages found for ${contextId}, skipping summarization.`
        );
        // Return success:false but not an error, as it's a valid state
        return { success: false, error: 'No messages to summarize.' };
      }

      result = await this.summarizer.summarize(messages, contextId);
      console.error(
        `[ContextService] Manual Summarization: Summarizer returned ${
          result.success ? 'success' : 'failure'
        }`
      );

      if (result.success && result.summary) {
        console.error(`[ContextService] Manual Summarization: Saving summary for ${contextId}`);
        await this.repositories.fs.saveSummary(result.summary);

        // Add summary to vector DB if configured
        if (this.repositories.vector) {
          console.error(
            `[ContextService] Manual Summarization: Adding summary to vector DB for ${contextId}`
          );
          try {
            await this.repositories.vector.addSummary(result.summary);
          } catch (vectorError) {
            console.error(
              `[ContextService] Error adding summary to vector DB for ${contextId}:`,
              vectorError
            );
            // Decide if this should cause the whole operation to fail
          }
        }

        // Update metadata safely
        const existingMetadata = await this.repositories.fs.loadContextData(contextId);
        if (!existingMetadata) {
          console.error(
            `[ContextService] Metadata not found for ${contextId} after loading messages. Cannot update.`
          );
        } else {
          const updatedMetadata: ContextMetadata = {
            ...existingMetadata,
            messagesSinceLastSummary: 0, // Reset counter
            hasSummary: true,
            lastSummarizedAt: Date.now(),
          };
          await this.repositories.fs.saveContextData(contextId, updatedMetadata);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[ContextService] Error during summarization for ${contextId}: ${errorMessage}`
      );
      result = { success: false, error: errorMessage };
    }

    return result;
  }

  /**
   * Find contexts similar to a query text
   * @param query Search query
   * @param limit Maximum number of results
   */
  async findSimilarContexts(query: string, limit: number): Promise<SimilarContext[]> {
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.VECTOR_DB_SEARCH, { query, limit });
    }

    if (!this.repositories.vector) {
      console.error('[ContextService] Vector repository not configured for similarity search.');
      return [];
    }

    try {
      return await this.repositories.vector.findSimilarContexts(query, limit);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ContextService] Error finding similar contexts: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Add a relationship between contexts
   * @param sourceContextId Source context ID
   * @param targetContextId Target context ID
   * @param relationshipType Relationship type
   * @param weight Relationship strength
   */
  async addRelationship(
    sourceContextId: string,
    targetContextId: string,
    relationshipType: ContextRelationshipType,
    weight: number
  ): Promise<void> {
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.GRAPH_DB_ADD, {
        sourceContextId,
        targetContextId,
        relationshipType,
      });
    }

    if (!this.repositories.graph) {
      console.error('[ContextService] Graph repository not configured for relationship tracking.');
      throw new Error('Graph repository not configured.');
    }

    // Validate that both contexts exist
    const sourceExists =
      (await this.repositories.fs.loadContextData(sourceContextId)) !== undefined;
    const targetExists =
      (await this.repositories.fs.loadContextData(targetContextId)) !== undefined;

    if (!sourceExists || !targetExists) {
      throw new Error(
        `Cannot create relationship: ${!sourceExists ? 'Source' : 'Target'} context does not exist.`
      );
    }

    try {
      await this.repositories.graph.addRelationship(
        sourceContextId,
        targetContextId,
        relationshipType,
        weight
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ContextService] Error adding relationship: ${errorMessage}`);
      throw new Error(`Failed to add relationship: ${errorMessage}`);
    }
  }

  /**
   * Get related contexts
   * @param contextId Context ID
   * @param relationshipType Optional relationship type filter
   * @param direction Relationship direction
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
      console.error('[ContextService] Graph repository not configured for relationship queries.');
      return [];
    }

    try {
      return await this.repositories.graph.getRelatedContexts(
        contextId,
        relationshipType,
        direction
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ContextService] Error getting related contexts: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Trigger background summarization process
   * @param contextId Context ID to summarize
   */
  private async triggerBackgroundSummarization(contextId: string): Promise<void> {
    if (!this.summarizer) {
      console.error('[ContextService] Summarizer not configured for background summarization.');
      return;
    }

    console.error(`[ContextService] Background summarization for ${contextId} started.`);

    try {
      const result = await this.triggerManualSummarization(contextId);
      console.error(
        `[ContextService] Background summarization for ${contextId} completed. Success: ${result.success}`
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ContextService] Background summarization error: ${errorMessage}`);
    }
  }
}
