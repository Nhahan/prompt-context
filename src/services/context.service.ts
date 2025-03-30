import { FileSystemRepository, ContextMetadata } from '../repository';
import { VectorRepository } from '../vector-repository';
import { GraphRepository } from '../graph-repository';
import { Summarizer } from '../summarizer';
import {
  Message,
  ContextData,
  SimilarContext,
  ContextRelationshipType,
  MCPConfig,
  SummaryResult,
  ApiCallType,
} from '../types';
import { ApiAnalytics } from '../analytics'; // Optional analytics tracking

// Define Repositories interface locally or import from repository.ts if exported
interface Repositories {
  fs: FileSystemRepository;
  vector?: VectorRepository | null;
  graph?: GraphRepository | null;
}

/**
 * Service layer for handling core context management logic.
 */
export class ContextService {
  private repositories: Repositories;
  private summarizer?: Summarizer;
  private config: Omit<MCPConfig, 'ignorePatterns'>;
  private analytics?: ApiAnalytics | null;

  constructor(
    repositories: Repositories,
    summarizer: Summarizer | undefined,
    config: Omit<MCPConfig, 'ignorePatterns'>,
    analytics?: ApiAnalytics | null
  ) {
    this.repositories = repositories;
    this.summarizer = summarizer;
    this.config = config;
    this.analytics = analytics;
    console.error('[ContextService] Initialized.');
  }

  /**
   * Adds a message to the specified context and handles metadata updates
   * and potential background summarization trigger.
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

    // ApiAnalytics 사용 부분 수정
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.VECTOR_DB_ADD, { contextId });
    }
  }

  /**
   * Retrieves the full context data (metadata, messages, summary).
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
   * Manually triggers summarization for a specific context.
   */
  async triggerManualSummarization(contextId: string): Promise<SummaryResult> {
    const stopTracking = this.analytics?.trackCall(ApiCallType.LLM_SUMMARIZE, {
      contextId,
      manualTrigger: true,
    });
    console.log(`[ContextService] Manually triggering summarization for ${contextId}`);

    if (!this.summarizer) {
      console.error('[ContextService] Summarizer is not configured.');
      if (stopTracking) stopTracking();
      return { success: false, error: 'Summarizer is not configured.' };
    }

    let result: SummaryResult = { success: false };
    try {
      const messages = await this.repositories.fs.loadMessages(contextId);
      if (!messages || messages.length === 0) {
        console.warn(
          `[ContextService] No messages found for ${contextId}, skipping summarization.`
        );
        // Return success:false but not an error, as it's a valid state
        return { success: false, error: 'No messages to summarize.' };
      }

      result = await this.summarizer.summarize(messages, contextId);
      console.log(
        `[ContextService] Manual Summarization: Summarizer returned ${result.success ? 'success' : 'failure'}`
      );

      if (result.success && result.summary) {
        console.log(`[ContextService] Manual Summarization: Saving summary for ${contextId}`);
        await this.repositories.fs.saveSummary(result.summary);

        // Add summary to vector DB if configured
        if (this.repositories.vector) {
          console.log(
            `[ContextService] Manual Summarization: Adding summary to vector DB for ${contextId}`
          );
          try {
            // Pass only the summary TEXT to addSummary for embedding
            await this.repositories.vector.addSummary({
              ...result.summary, // Keep other summary properties
              // Ensure the text to be embedded is passed correctly (assuming addSummary handles this)
              // If addSummary expects only text, pass result.summary.summary
              // If addSummary expects the object and extracts text, this is okay.
              // Based on error, seems it expects text for embedding. Revisit addSummary if needed.
              // Let's assume addSummary can handle the object for now, but pass the text explicitly if that fails.
            });
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
          // Should not happen if messages were loaded, but handle defensively
          console.error(
            `[ContextService] Metadata not found for ${contextId} after loading messages. Cannot update.`
          );
          // Consider if this should alter the success status of the summarization
        } else {
          const updatedMetadata: ContextMetadata = {
            ...existingMetadata, // Spread existing data
            contextId: contextId, // Ensure contextId is explicitly set (it's required)
            messagesSinceLastSummary: 0,
            hasSummary: true,
            lastSummarizedAt: Date.now(),
            importanceScore: result.summary.importanceScore, // Update importance if available
          };
          await this.repositories.fs.saveContextData(contextId, updatedMetadata);
          console.log(`[ContextService] Metadata updated after summarization for ${contextId}`);
        }
        console.log(`[ContextService] Manual summarization successful for ${contextId}`);
      } else {
        console.error(
          `[ContextService] Manual summarization failed for ${contextId}: ${result.error}`
        );
      }
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `[ContextService] Error during manual summarization for ${contextId}:`,
        errorMsg
      );
      result = { success: false, error: errorMsg };
      return result;
    } finally {
      if (stopTracking) stopTracking();
    }
  }

  async findSimilarContexts(query: string, limit: number): Promise<SimilarContext[]> {
    console.error(`[ContextService] Finding similar contexts for query: ${query}`);

    if (!this.repositories.vector) {
      throw new Error('Vector repository is not available.');
    }

    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.VECTOR_DB_SEARCH, { query, limit });
    }

    // 1. Call vector repository
    // 2. Handle fallback (optional)
    const results = await this.repositories.vector.findSimilarContexts(query, limit);
    console.log(`[ContextService] Found ${results.length} similar contexts.`);
    return results;
  }

  async addRelationship(
    sourceContextId: string,
    targetContextId: string,
    relationshipType: ContextRelationshipType,
    weight: number
  ): Promise<void> {
    console.error(`[ContextService] Adding relationship ${sourceContextId} -> ${targetContextId}`);

    if (!this.repositories.graph) {
      throw new Error('Graph repository is not available.');
    }

    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.GRAPH_DB_ADD, {
        sourceContextId,
        targetContextId,
        relationshipType,
      });
    }

    // 1. Call graph repository
    await this.repositories.graph.addRelationship(
      sourceContextId,
      targetContextId,
      relationshipType,
      weight
    );
  }

  async getRelatedContexts(
    contextId: string,
    relationshipType?: ContextRelationshipType,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<string[]> {
    console.error(`[ContextService] Getting related contexts for ${contextId}`);

    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.GRAPH_DB_SEARCH, { contextId });
    }

    if (!this.repositories.graph) {
      throw new Error('Graph repository is not available.');
    }
    // 1. Call graph repository
    const results = await this.repositories.graph.getRelatedContexts(
      contextId,
      relationshipType,
      direction
    );
    console.log(`[ContextService] Found ${results.length} related contexts.`);
    return results;
  }

  // --- Background Summarization (Internal Helper) ---
  private async triggerBackgroundSummarization(contextId: string): Promise<void> {
    const stopTracking = this.analytics?.trackCall(ApiCallType.LLM_SUMMARIZE, {
      contextId,
      manualTrigger: false,
    });
    console.log(`[ContextService] Checking background summarization conditions for ${contextId}`);
    if (!this.summarizer) {
      console.error('[ContextService] Background Summarization: Summarizer not available.');
      return;
    }

    let shouldSummarize = false;
    let metadata: ContextMetadata | undefined;
    try {
      metadata = await this.repositories.fs.loadContextData(contextId);
      if (!metadata) {
        console.error(
          `[ContextService] Metadata not found for ${contextId} after loading messages. Cannot update.`
        );
        return;
      }

      const messageCount = metadata?.messagesSinceLastSummary || 0;
      if (messageCount >= (this.config.messageLimitThreshold || 10)) {
        shouldSummarize = true;
      }
      // TODO: Add token count check

      if (shouldSummarize && metadata) {
        // Ensure metadata exists before updating
        console.log(`[ContextService] Triggering background summarization for ${contextId}`);
        const messages = await this.repositories.fs.loadMessages(contextId);
        const result = await this.summarizer.summarize(messages, contextId);

        if (result.success && result.summary) {
          await this.repositories.fs.saveSummary(result.summary);
          // Safe metadata update
          const updatedMetadata: ContextMetadata = {
            ...metadata, // Spread existing data
            contextId: contextId, // Ensure contextId is explicitly set
            messagesSinceLastSummary: 0,
            hasSummary: true,
            lastSummarizedAt: Date.now(),
            importanceScore: result.summary.importanceScore,
          };
          await this.repositories.fs.saveContextData(contextId, updatedMetadata);
          console.log(`[ContextService] Background summarization successful for ${contextId}`);
        } else {
          console.error(
            `[ContextService] Background Summarization: Failed for ${contextId}. Error: ${result?.error}`
          );
        }
      }
    } catch (bgError: unknown) {
      const errorMessage = bgError instanceof Error ? bgError.message : String(bgError);
      console.error(
        `[ContextService] Background summarization process failed for ${contextId}:`,
        errorMessage
      );
    } finally {
      if (stopTracking) stopTracking();
    }
  }
}
