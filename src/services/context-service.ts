import {
  ContextRelationshipType,
  SimilarContext,
  Message,
  ContextData,
  SummaryResult,
} from '../domain/types';

import { ContextServiceInterface } from './context.interface';
import { SummarizerService } from './summarizer.interface';
import {
  GraphRepositoryInterface,
  VectorRepositoryInterface,
  Repository,
} from '../repositories/repository.interface';

export class ContextService implements ContextServiceInterface {
  private repositories: {
    graph: GraphRepositoryInterface;
    vector?: VectorRepositoryInterface;
    base: Repository;
  };
  private summarizer: SummarizerService;
  private summarizationQueue: Map<string, Promise<void>>;

  constructor(
    repositories: {
      graph: GraphRepositoryInterface;
      vector?: VectorRepositoryInterface;
      base: Repository;
    },
    summarizer: SummarizerService
  ) {
    this.repositories = repositories;
    this.summarizer = summarizer;
    this.summarizationQueue = new Map();
  }

  async addMessage(contextId: string, messageData: Omit<Message, 'timestamp'>): Promise<void> {
    try {
      const message: Message = {
        ...messageData,
        timestamp: Date.now(),
      };
      await this.repositories.base.addMessage(contextId, message);
    } catch (error) {
      console.error(`[ContextService] Error adding message to context ${contextId}:`, error);
      throw error;
    }
  }

  async getContext(contextId: string): Promise<ContextData | null> {
    try {
      const context = await this.repositories.base.loadContext(contextId);
      return context || null;
    } catch (error) {
      console.error(`[ContextService] Error getting context ${contextId}:`, error);
      return null;
    }
  }

  async triggerManualSummarization(contextId: string): Promise<SummaryResult> {
    try {
      const context = await this.getContext(contextId);
      if (!context) {
        throw new Error(`Context ${contextId} not found`);
      }
      return await this.summarizer.summarize(context.messages, contextId);
    } catch (error) {
      console.error(`[ContextService] Error summarizing context ${contextId}:`, error);
      throw error;
    }
  }

  async addRelationship(
    sourceContextId: string,
    targetContextId: string,
    relationshipType: ContextRelationshipType,
    weight: number
  ): Promise<void> {
    try {
      await this.repositories.graph.addRelationship(
        sourceContextId,
        targetContextId,
        relationshipType,
        weight
      );
    } catch (error) {
      console.error(
        `[ContextService] Error adding relationship between ${sourceContextId} and ${targetContextId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get contexts related to the given context
   * @param contextId The ID of the context to get related contexts for
   * @param relationshipType Optional type of relationship to filter by
   * @param direction Optional direction of relationships to include
   * @returns Array of related context IDs
   */
  async getRelatedContexts(
    contextId: string,
    relationshipType?: ContextRelationshipType,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<string[]> {
    try {
      return await this.repositories.graph.getRelatedContexts(
        contextId,
        relationshipType,
        direction
      );
    } catch (error) {
      console.error(`[ContextService] Error getting related contexts for ${contextId}:`, error);
      return [];
    }
  }

  /**
   * Find contexts similar to the given query
   * @param query The query to find similar contexts for
   * @param limit Maximum number of similar contexts to return
   * @returns Array of similar contexts with their similarity scores
   */
  async findSimilarContexts(query: string, limit = 5): Promise<SimilarContext[]> {
    try {
      if (!this.repositories.vector) {
        console.error('[ContextService] Vector repository not configured for similarity search.');
        return [];
      }
      return await this.repositories.vector.findSimilarContexts(query, limit);
    } catch (error) {
      console.error(`[ContextService] Error finding similar contexts for query "${query}":`, error);
      return [];
    }
  }
}
