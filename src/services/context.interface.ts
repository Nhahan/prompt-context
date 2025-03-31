import {
  Message,
  ContextData,
  SimilarContext,
  ContextRelationshipType,
  SummaryResult,
} from '../domain/types';

/**
 * Interface for context management service
 */
export interface ContextServiceInterface {
  /**
   * Add a message to a context
   * @param contextId Context ID
   * @param messageData Message data without timestamp
   */
  addMessage(contextId: string, messageData: Omit<Message, 'timestamp'>): Promise<void>;

  /**
   * Get a context by ID
   * @param contextId Context ID
   */
  getContext(contextId: string): Promise<ContextData | null>;

  /**
   * Trigger manual summarization for a context
   * @param contextId Context ID
   */
  triggerManualSummarization(contextId: string): Promise<SummaryResult>;

  /**
   * Find contexts similar to a query
   * @param query Search query
   * @param limit Maximum number of results
   */
  findSimilarContexts(query: string, limit: number): Promise<SimilarContext[]>;

  /**
   * Add a relationship between contexts
   * @param sourceContextId Source context ID
   * @param targetContextId Target context ID
   * @param relationshipType Relationship type
   * @param weight Relationship strength
   */
  addRelationship(
    sourceContextId: string,
    targetContextId: string,
    relationshipType: ContextRelationshipType,
    weight: number
  ): Promise<void>;

  /**
   * Get related contexts
   * @param contextId Context ID
   * @param relationshipType Optional relationship type filter
   * @param direction Relationship direction
   */
  getRelatedContexts(
    contextId: string,
    relationshipType?: ContextRelationshipType,
    direction?: 'incoming' | 'outgoing' | 'both'
  ): Promise<string[]>;
}
