import {
  Message,
  ContextData,
  ContextMetadata,
  ContextRelationshipType,
  SummaryResult,
} from '../domain/types';
import { RelatedContext } from '../types/related-context';

/**
 * Context service interface
 */
export interface ContextServiceInterface {
  /**
   * Add a message to a context
   */
  addMessage(message: Message): Promise<void>;

  /**
   * Load context metadata
   */
  loadContextData(contextId: string): Promise<ContextMetadata | undefined>;

  /**
   * Save context metadata
   */
  saveContextData(contextId: string, metadata: ContextMetadata): Promise<void>;

  /**
   * Load full context including metadata, messages, and summary
   */
  loadContext(contextId: string): Promise<ContextData | undefined>;

  /**
   * Delete a context
   */
  deleteContext(contextId: string): Promise<void>;

  /**
   * Find similar contexts based on text
   */
  findSimilarContexts(text: string, limit?: number): Promise<RelatedContext[]>;

  /**
   * Add a relationship between contexts
   */
  addRelationship(sourceId: string, targetId: string, type: ContextRelationshipType): Promise<void>;

  /**
   * Get all context IDs
   */
  getAllContextIds(): Promise<string[]>;

  /**
   * Get all hierarchical context IDs
   */
  getAllHierarchicalContextIds(): Promise<string[]>;

  /**
   * Get all meta-summary IDs
   */
  getAllMetaSummaryIds(): Promise<string[]>;

  /**
   * Get context (alias for loadContext for backward compatibility)
   */
  getContext(contextId: string): Promise<ContextData | undefined>;

  /**
   * Get related contexts
   */
  getRelatedContexts(
    contextId: string,
    relationshipType?: ContextRelationshipType,
    direction?: 'incoming' | 'outgoing' | 'both'
  ): Promise<string[]>;

  /**
   * Trigger manual summarization for a context
   */
  triggerManualSummarization(contextId: string): Promise<SummaryResult>;
}
