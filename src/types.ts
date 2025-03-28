/**
 * MCP configuration options
 */
export interface MCPConfig {
  /** Message count threshold to trigger summarization */
  messageLimitThreshold: number;
  /** Token count threshold to trigger summarization (percentage of model limit) */
  tokenLimitPercentage: number;
  /** Directory to store context data */
  contextDir: string;
  /** Whether to use Git repository integration */
  useGit: boolean;
  /** Patterns for files and directories to ignore */
  ignorePatterns: string[];
  /** Whether to enable automatic summarization */
  autoSummarize: boolean;
  /** Enable hierarchical context management */
  hierarchicalContext: boolean;
  /** Number of contexts before creating a meta-summary */
  metaSummaryThreshold: number;
  /** Maximum hierarchical depth for meta-summaries */
  maxHierarchyDepth: number;
  /** Whether to use vector database for similarity search */
  useVectorDb: boolean;
  /** Whether to use graph database for context relationships */
  useGraphDb: boolean;
  /** Similarity threshold for automatic relationship detection */
  similarityThreshold: number;
  /** Whether to automatically clean up irrelevant contexts */
  autoCleanupContexts: boolean;
}

/**
 * Context importance level
 */
export enum ContextImportance {
  LOW = 0.25,
  MEDIUM = 0.5,
  HIGH = 0.75,
  CRITICAL = 1.0
}

/**
 * Relationship types between contexts
 */
export enum ContextRelationshipType {
  SIMILAR = 'similar',
  CONTINUES = 'continues',
  REFERENCES = 'references',
  PARENT = 'parent',
  CHILD = 'child'
}

/**
 * Conversation message structure
 */
export interface Message {
  /** Message role (user or assistant) */
  role: 'user' | 'assistant';
  /** Message content */
  content: string;
  /** Message creation timestamp */
  timestamp: number;
  /** Message importance level (affects retention during summarization) */
  importance?: ContextImportance;
  /** Tags for message categorization */
  tags?: string[];
}

/**
 * Context summary object
 */
export interface ContextSummary {
  /** Context ID (typically a file path) */
  contextId: string;
  /** Summary generation timestamp */
  lastUpdated: number;
  /** Summary content */
  summary: string;
  /** Code blocks in the context */
  codeBlocks: CodeBlock[];
  /** Number of messages included in the summary */
  messageCount: number;
  /** Summary version */
  version: number;
  /** Key insights extracted from conversation */
  keyInsights?: string[];
  /** Importance score for this context */
  importanceScore?: number;
  /** Related context IDs */
  relatedContexts?: string[];
}

/**
 * Hierarchical context summary
 */
export interface HierarchicalSummary extends ContextSummary {
  /** Parent context ID if this is part of a hierarchical structure */
  parentContextId?: string;
  /** Child context IDs */
  childContextIds?: string[];
  /** Hierarchy level (0 is top level) */
  hierarchyLevel: number;
}

/**
 * Meta-summary for project-wide context
 */
export interface MetaSummary {
  /** Unique ID for the meta-summary */
  id: string;
  /** Timestamp when meta-summary was created */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** High-level project summary */
  summary: string;
  /** List of key context IDs included in this meta-summary */
  contextIds: string[];
  /** Important code blocks across contexts */
  sharedCodeBlocks: CodeBlock[];
  /** Hierarchical level */
  hierarchyLevel: number;
}

/**
 * Context relationship
 */
export interface ContextRelationship {
  /** Source context ID */
  sourceId: string;
  /** Target context ID */
  targetId: string;
  /** Relationship type */
  type: ContextRelationshipType;
  /** Relationship strength (0-1) */
  strength: number;
  /** When the relationship was created */
  createdAt: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Context with vector embedding
 */
export interface VectorContext {
  /** Context ID */
  contextId: string;
  /** Vector embedding */
  embedding: number[];
  /** Last updated timestamp */
  updatedAt: number;
}

/**
 * Similar context result
 */
export interface SimilarContext {
  /** Context ID */
  id: string;
  /** Similarity score (0-1) */
  score: number;
}

/**
 * Code block structure
 */
export interface CodeBlock {
  /** Code block language */
  language?: string;
  /** Code content */
  code: string;
  /** Code block importance (value between 0-1, higher means more important) */
  importance?: number;
  /** Source context ID */
  sourceContextId?: string;
  /** Original file path if known */
  filePath?: string;
  /** Description of what this code does */
  description?: string;
}

/**
 * Context data
 */
export interface ContextData {
  /** Context ID */
  contextId: string;
  /** Message history */
  messages: Message[];
  /** Current token count */
  tokenCount: number;
  /** Message count since last summary */
  messagesSinceLastSummary: number;
  /** Whether a summary exists */
  hasSummary: boolean;
  /** Last summarization time */
  lastSummarizedAt?: number;
  /** Overall context importance score */
  importanceScore?: number;
  /** Related context IDs */
  relatedContexts?: string[];
  /** Parent context ID if this is part of a hierarchical structure */
  parentContextId?: string;
}

/**
 * Context summarization result
 */
export interface SummaryResult {
  /** Whether summarization was successful */
  success: boolean;
  /** Generated summary */
  summary?: ContextSummary;
  /** Error message */
  error?: string;
}

/**
 * Vector repository interface
 */
export interface VectorRepositoryInterface {
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
 * Graph repository interface
 */
export interface GraphRepositoryInterface {
  /**
   * Add a relationship between contexts
   * @param source Source context ID
   * @param target Target context ID
   * @param type Relationship type
   * @param weight Relationship weight/strength (0-1)
   * @param metadata Additional metadata
   */
  addRelationship(source: string, target: string, type: ContextRelationshipType, weight: number, metadata?: any): Promise<void>;
  
  /**
   * Get all relationships for a context
   * @param contextId Context ID
   * @returns Array of edges connected to the context
   */
  getRelationships(contextId: string): Promise<ContextRelationship[]>;
  
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
  getRelatedContexts(contextId: string, type: ContextRelationshipType, direction: 'outgoing' | 'incoming' | 'both'): Promise<string[]>;
}

/**
 * AI summarization service interface
 */
export interface SummarizerService {
  /** 
   * Generate context summary
   * @param messages Array of messages to summarize
   * @param contextId Context identifier
   * @returns Summarization result
   */
  summarize(messages: Message[], contextId: string): Promise<SummaryResult>;
  
  /**
   * Generate hierarchical summary from multiple context summaries
   * @param summaries Array of context summaries to consolidate
   * @param parentId Identifier for the parent context
   * @returns Hierarchical summary result
   */
  createHierarchicalSummary?(summaries: ContextSummary[], parentId: string): Promise<HierarchicalSummary>;
  
  /**
   * Create a meta-summary across all contexts
   * @param contexts Array of context IDs to include
   * @returns Meta-summary result
   */
  createMetaSummary?(contexts: string[]): Promise<MetaSummary>;
  
  /**
   * Analyze message importance
   * @param message Message to analyze
   * @param contextId Context identifier
   * @returns Context importance level
   */
  analyzeMessageImportance?(message: Message, contextId: string): Promise<ContextImportance>;
}

/**
 * Repository interface
 */
export interface Repository {
  /**
   * Save a summary
   * @param summary Summary to save
   */
  saveSummary(summary: ContextSummary): Promise<void>;
  
  /**
   * Load a summary
   * @param contextId Context identifier
   * @returns Stored summary or undefined if it doesn't exist
   */
  loadSummary(contextId: string): Promise<ContextSummary | undefined>;
  
  /**
   * Save a hierarchical summary
   * @param summary Hierarchical summary to save
   */
  saveHierarchicalSummary?(summary: HierarchicalSummary): Promise<void>;
  
  /**
   * Load a hierarchical summary
   * @param contextId Context identifier
   * @returns Stored hierarchical summary or undefined
   */
  loadHierarchicalSummary?(contextId: string): Promise<HierarchicalSummary | undefined>;
  
  /**
   * Save a meta-summary
   * @param summary Meta-summary to save
   */
  saveMetaSummary?(summary: MetaSummary): Promise<void>;
  
  /**
   * Load a meta-summary
   * @param id Meta-summary identifier
   * @returns Stored meta-summary or undefined
   */
  loadMetaSummary?(id: string): Promise<MetaSummary | undefined>;
  
  /**
   * Get all related contexts
   * @param contextId Context identifier
   * @returns Array of related context IDs
   */
  getRelatedContexts?(contextId: string): Promise<string[]>;
  
  /**
   * Commit Git changes
   * @param message Commit message
   */
  commit(message: string): Promise<void>;
  
  /**
   * Check if a path should be ignored
   * @param filePath Path to check
   * @returns Whether the file should be ignored
   */
  shouldIgnore(filePath: string): boolean;
} 