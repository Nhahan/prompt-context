/**
 * Domain types for the Prompt Context MCP Server
 */

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
  /** Context ID this message belongs to */
  contextId: string;
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
  metadata?: Record<string, unknown>;
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
 * Context data structure
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
 * Context metadata structure
 */
export interface ContextMetadata {
  /** Context ID */
  contextId: string;
  /** When the context was created */
  createdAt: number;
  /** Last activity timestamp */
  lastActivityAt: number;
  /** Number of messages since last summary */
  messagesSinceLastSummary: number;
  /** Whether a summary exists */
  hasSummary?: boolean;
  /** Last summarization time */
  lastSummarizedAt?: number;
  /** Importance score (0-1) */
  importanceScore?: number;
  /** Parent context ID if this is part of a hierarchical structure */
  parentContextId?: string;
  /** Total message count */
  totalMessageCount?: number;
  /** Total token count */
  totalTokenCount?: number;
}

/**
 * Summary result structure
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
