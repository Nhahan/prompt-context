/**
 * MCP configuration options
 */
export interface MCPConfig {
  /** Message count threshold to trigger summarization */
  messageLimitThreshold?: number;
  /** Token count threshold to trigger summarization (percentage of model limit) */
  tokenLimitPercentage?: number;
  /** Directory to store context data */
  contextDir: string;
  /** Patterns for files and directories to ignore */
  ignorePatterns: string[];
  /** Whether to enable automatic summarization */
  autoSummarize?: boolean;
  /** Enable hierarchical context management */
  hierarchicalContext?: boolean;
  /** Number of contexts before creating a meta-summary */
  metaSummaryThreshold?: number;
  /** Maximum hierarchical depth for meta-summaries */
  maxHierarchyDepth?: number;
  /** Whether to use vector database for similarity search */
  useVectorDb?: boolean;
  /** Whether to use graph database for context relationships */
  useGraphDb?: boolean;
  /** Similarity threshold for automatic relationship detection */
  similarityThreshold?: number;
  /** Whether to automatically clean up irrelevant contexts */
  autoCleanupContexts?: boolean;
  /** Whether to track API calls for analytics */
  trackApiCalls?: boolean;
  /** Number of days to retain API call data */
  apiAnalyticsRetention?: number;
  /** Port for HTTP server */
  port?: number;
  /** Vector DB configuration */
  vectorDb?: VectorDbConfig;
  /** Summarizer configuration */
  summarizer?: SummarizerConfig;
  /** Debug flag */
  debug?: boolean;
  /** Whether to fallback to keyword match when primary summarization fails */
  fallbackToKeywordMatch?: boolean;
}

/**
 * Context importance level
 */
export enum ContextImportance {
  LOW = 0.25,
  MEDIUM = 0.5,
  HIGH = 0.75,
  CRITICAL = 1.0,
}

/**
 * Relationship types between contexts
 */
export enum ContextRelationshipType {
  SIMILAR = 'similar',
  CONTINUES = 'continues',
  REFERENCES = 'references',
  PARENT = 'parent',
  CHILD = 'child',
}

/**
 * API call type definition
 */
export enum ApiCallType {
  VECTOR_DB_ADD = 'vector_db_add',
  VECTOR_DB_SEARCH = 'vector_db_search',
  VECTOR_DB_DELETE = 'vector_db_delete',
  GRAPH_DB_ADD = 'graph_db_add',
  GRAPH_DB_SEARCH = 'graph_db_search',
  GRAPH_DB_DELETE = 'graph_db_delete',
  LLM_SUMMARIZE = 'llm_summarize',
  LLM_HIERARCHICAL_SUMMARIZE = 'llm_hierarchical_summarize',
  LLM_META_SUMMARIZE = 'llm_meta_summarize',
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
  createdAt: number;
  /** Summary content */
  summary: string;
  /** Code blocks in the context */
  codeBlocks: CodeBlock[];
  /** Number of messages included in the summary */
  messageCount: number;
  /** Summary version */
  version?: number;
  /** Key insights extracted from conversation */
  keyInsights?: string[];
  /** Importance score for this context */
  importanceScore?: number;
  /** Related context IDs */
  relatedContexts?: string[];
  /** Tokens used to generate the summary */
  tokensUsed?: number;
  /** Token limit assumed for the model during generation */
  tokenLimit?: number;
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
  contextId: string;
  /** Similarity score (0-1) */
  similarity: number;
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
  /** Complete context metadata */
  metadata: ContextMetadata;
  /** Message history */
  messages: Message[];
  /** Optional context summary */
  summary?: ContextSummary | null;
  /** Current token count */
  tokenCount?: number;
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
  /** Tokens used by the summarization model */
  tokensUsed?: number;
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
  getRelatedContexts(
    contextId: string,
    type: ContextRelationshipType,
    direction: 'outgoing' | 'incoming' | 'both'
  ): Promise<string[]>;
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
  createHierarchicalSummary?(
    summaries: ContextSummary[],
    parentId: string
  ): Promise<HierarchicalSummary>;

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
 * Interface defining the contract for context storage and retrieval.
 */
export interface Repository {
  initialize(): Promise<void>;
  addMessage(contextId: string, message: Message): Promise<void>;
  loadMessages(contextId: string): Promise<Message[]>;
  loadContextData(contextId: string): Promise<ContextMetadata | undefined>;
  saveContextData(contextId: string, metadata: ContextMetadata): Promise<void>;
  loadContext(contextId: string): Promise<ContextData | undefined>;
  deleteContext(contextId: string): Promise<boolean>;
  saveSummary(summary: ContextSummary): Promise<void>;
  loadSummary(contextId: string): Promise<ContextSummary | undefined>;
  deleteSummary(contextId: string): Promise<boolean>;
  saveHierarchicalSummary(summary: HierarchicalSummary): Promise<void>;
  loadHierarchicalSummary(contextId: string): Promise<HierarchicalSummary | undefined>;
  saveMetaSummary(summary: MetaSummary): Promise<void>;
  loadMetaSummary(id: string): Promise<MetaSummary | undefined>;
  getRelatedContexts(contextId: string): Promise<string[]>;
  getAllContextIds(): Promise<string[]>;
  getAllHierarchicalContextIds(): Promise<string[]>;
  getAllMetaSummaryIds(): Promise<string[]>;
}

/**
 * Configuration for Vector DB
 */
export interface VectorDbConfig {
  dimensions?: number;
  maxElements?: number;
  // Add other vector DB specific settings if needed
}

/**
 * Configuration for Summarizer
 */
export interface SummarizerConfig {
  model?: string; // Example: Name or ID of the summarization model
  apiKey?: string; // Example: API key if needed
  maxOutputTokens?: number;
  // Add other summarizer specific settings
}

/**
 * Default Configuration Values
 */
export const DEFAULT_CONFIG: MCPConfig = {
  messageLimitThreshold: 10,
  tokenLimitPercentage: 80,
  contextDir: '.prompt-context',
  ignorePatterns: [],
  autoSummarize: true,
  hierarchicalContext: true,
  metaSummaryThreshold: 5,
  maxHierarchyDepth: 3,
  useVectorDb: false,
  useGraphDb: false,
  similarityThreshold: 0.6,
  autoCleanupContexts: false,
  debug: false,
  port: 6789, // Default HTTP port
  vectorDb: {
    dimensions: 1536, // Example default dimension (e.g., text-embedding-ada-002)
    maxElements: 10000,
  },
  summarizer: {
    // Default summarizer settings can go here
    maxOutputTokens: 256,
  },
};

// Function to get the repository path (might depend on config.contextDir)
// Moved this logic into repository.ts (getBasePathFromConfig)
// export function getRepositoryPath(): string {
//     const config = loadConfig(); // This creates a dependency cycle or needs careful handling
//     const repoPath = path.join(process.cwd(), config.contextDir || '.prompt-context');
//     if (!fs.existsSync(repoPath)) {
//         fs.mkdirSync(repoPath, { recursive: true });
//     }
//     return repoPath;
// }

// Functions for loading/saving config (might need refinement)
// It's often better to handle config loading/saving closer to the CLI/entry point
// export function loadConfig(): MCPConfig {
//     const repoPath = path.join(process.cwd(), DEFAULT_CONFIG.contextDir); // Use default temporarily
//     const configPath = path.join(repoPath, 'config.json');
//     try {
//         if (fs.existsSync(configPath)) {
//             const configContent = fs.readFileSync(configPath, 'utf-8');
//             const loadedConfig = JSON.parse(configContent);
//             return { ...DEFAULT_CONFIG, ...loadedConfig };
//         }
//     } catch (error) {
//         console.error(`Error loading config from ${configPath}:`, error);
//     }
//     return DEFAULT_CONFIG;
// }

// export function saveConfig(config: MCPConfig): void {
//     const repoPath = path.join(process.cwd(), config.contextDir || '.prompt-context');
//     const configPath = path.join(repoPath, 'config.json');
//     try {
//         if (!fs.existsSync(repoPath)) {
//             fs.mkdirSync(repoPath, { recursive: true });
//         }
//         fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
//     } catch (error) {
//         console.error(`Error saving config to ${configPath}:`, error);
//     }
// }

import { z } from 'zod';
// Import ContextMetadata from repository.ts
import { ContextMetadata } from './repository';

// Zod Schemas for MCP Tool Inputs

export const pingSchema = z.object({}).describe('No arguments needed for ping.');

export const addMessageSchema = z.object({
  contextId: z.string().min(1).describe('Unique identifier for the context'),
  message: z.string().min(1).describe('Message content to add'),
  role: z.enum(['user', 'assistant']).describe('Role of the message sender'),
  importance: z
    .nativeEnum(ContextImportance)
    .optional()
    .default(ContextImportance.MEDIUM)
    .describe('Importance level (default: medium)'),
  tags: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Tags associated with the message (optional)'),
});

export const retrieveContextSchema = z.object({
  contextId: z.string().min(1).describe('Unique identifier for the context to retrieve'),
});

// Schema for finding similar contexts - maps to SimilarContext interface for output, but input needs query/limit
export const similarContextSchema = z.object({
  query: z.string().min(1).describe('Text to find similar contexts for'),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(5)
    .describe('Maximum number of contexts to return (default: 5)'),
});

export const addRelationshipSchema = z.object({
  sourceContextId: z.string().min(1).describe('Source context ID'),
  targetContextId: z.string().min(1).describe('Target context ID'),
  relationshipType: z
    .nativeEnum(ContextRelationshipType)
    .describe('Type of relationship (similar, continues, references, parent, child)'),
  weight: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.8)
    .describe('Weight of the relationship (0.0 to 1.0, default: 0.8)'),
});

export const getRelatedContextsSchema = z.object({
  contextId: z.string().min(1).describe('Context ID to find related contexts for'),
  relationshipType: z
    .nativeEnum(ContextRelationshipType)
    .optional()
    .describe('Optional: filter by relationship type'),
  direction: z
    .enum(['incoming', 'outgoing', 'both'])
    .optional()
    .default('both')
    .describe('Direction of relationships to get (default: both)'),
});

export const summarizeContextSchema = z.object({
  contextId: z.string().min(1).describe('Context ID to generate summary for'),
});

// Define the MCPTools type based on the schemas
export type MCPTools = {
  ping: typeof pingSchema;
  add_message: typeof addMessageSchema;
  retrieve_context: typeof retrieveContextSchema;
  get_similar_contexts: typeof similarContextSchema;
  add_relationship: typeof addRelationshipSchema;
  get_related_contexts: typeof getRelatedContextsSchema;
  summarize_context: typeof summarizeContextSchema;
};
