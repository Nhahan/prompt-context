import {
  Message,
  ContextMetadata,
  ContextData,
  ContextSummary,
  HierarchicalSummary,
  MetaSummary,
  SimilarContext,
  ContextRelationshipType,
} from '../domain/types';

/**
 * Base repository interface for context data persistence
 */
export interface Repository {
  /**
   * Initialize the repository
   */
  initialize(): Promise<void>;

  /**
   * Add a message to a context
   * @param contextId Context ID
   * @param message Message to add
   */
  addMessage(contextId: string, message: Message): Promise<void>;

  /**
   * Load messages for a context
   * @param contextId Context ID
   */
  loadMessages(contextId: string): Promise<Message[]>;

  /**
   * Load context metadata
   * @param contextId Context ID
   */
  loadContextData(contextId: string): Promise<ContextMetadata | undefined>;

  /**
   * Save context metadata
   * @param contextId Context ID
   * @param metadata Metadata to save
   */
  saveContextData(contextId: string, metadata: ContextMetadata): Promise<void>;

  /**
   * Load full context including metadata, messages, and summary
   * @param contextId Context ID
   */
  loadContext(contextId: string): Promise<ContextData | undefined>;

  /**
   * Delete a context
   * @param contextId Context ID
   */
  deleteContext(contextId: string): Promise<boolean>;

  /**
   * Save a summary
   * @param summary Summary to save
   */
  saveSummary(summary: ContextSummary): Promise<void>;

  /**
   * Load a summary
   * @param contextId Context ID
   */
  loadSummary(contextId: string): Promise<ContextSummary | undefined>;

  /**
   * Delete a summary
   * @param contextId Context ID
   */
  deleteSummary(contextId: string): Promise<boolean>;

  /**
   * Save a hierarchical summary
   * @param summary Hierarchical summary to save
   */
  saveHierarchicalSummary(summary: HierarchicalSummary): Promise<void>;

  /**
   * Load a hierarchical summary
   * @param contextId Context ID
   */
  loadHierarchicalSummary(contextId: string): Promise<HierarchicalSummary | undefined>;

  /**
   * Save a meta-summary
   * @param summary Meta-summary to save
   */
  saveMetaSummary(summary: MetaSummary): Promise<void>;

  /**
   * Load a meta-summary
   * @param id Meta-summary ID
   */
  loadMetaSummary(id: string): Promise<MetaSummary | undefined>;

  /**
   * Get related contexts
   * @param contextId Context ID
   */
  getRelatedContexts(contextId: string): Promise<string[]>;

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
}

/**
 * Vector repository interface for similarity search
 */
export interface VectorRepositoryInterface {
  /**
   * Ensure the repository is initialized
   */
  ensureInitialized(): Promise<void>;

  /**
   * Add or update a summary in the vector index
   * @param summary Summary to add or update
   */
  addSummary(summary: ContextSummary): Promise<void>;

  /**
   * Find contexts similar to the given text
   * @param text Text to find similar contexts for
   * @param limit Maximum number of results to return
   * @returns Array of context IDs with similarity scores
   */
  findSimilarContexts(text: string, limit?: number): Promise<SimilarContext[]>;

  /**
   * Delete a context from the vector index
   * @param contextId Context ID to delete
   */
  deleteContext(contextId: string): Promise<void>;

  /**
   * Check if a context exists in the vector index
   * @param contextId Context ID to check
   */
  hasContext(contextId: string): Promise<boolean>;
}

/**
 * Graph repository interface for context relationships
 */
export interface GraphRepositoryInterface {
  /**
   * Ensure the repository is initialized
   */
  ensureInitialized(): Promise<void>;

  /**
   * Add a relationship between contexts
   * @param source Source context ID
   * @param target Target context ID
   * @param type Relationship type
   * @param weight Relationship weight/strength (0-1)
   * @param metadata Additional metadata
   */
  addRelationship(
    source: string,
    target: string,
    type: ContextRelationshipType,
    weight: number,
    metadata?: any
  ): Promise<void>;

  /**
   * Get all relationships for a context
   * @param contextId Context ID
   * @returns Array of edges connected to the context
   */
  getRelationships(contextId: string): Promise<any[]>;

  /**
   * Remove all relationships for a context
   * @param contextId Context ID
   */
  removeContext(contextId: string): Promise<void>;

  /**
   * Find a path between two contexts
   * @param sourceId Source context ID
   * @param targetId Target context ID
   * @returns Array of context IDs forming a path, or empty array if no path exists
   */
  findPath(sourceId: string, targetId: string): Promise<string[]>;

  /**
   * Get all contexts that have a specific relationship with the given context
   * @param contextId Context ID
   * @param type Relationship type
   * @param direction 'outgoing' for edges where contextId is the source, 'incoming' for edges where contextId is the target, 'both' for both directions
   * @returns Array of context IDs
   */
  getRelatedContexts(
    contextId: string,
    type?: ContextRelationshipType,
    direction?: 'outgoing' | 'incoming' | 'both'
  ): Promise<string[]>;
}
