/**
 * Domain types for the Prompt Context MCP Server
 */

/**
 * Message importance level
 */
export enum ContextImportance {
  LOW = 0.25,
  MEDIUM = 0.5,
  HIGH = 0.75,
  CRITICAL = 1.0,
}

/**
 * Message object
 */
export interface Message {
  contextId: string;
  role: 'user' | 'assistant' | string;
  content: string;
  timestamp?: number;
  importance?: number;
  tags?: string[];
}

/**
 * Context metadata
 */
export interface ContextMetadata {
  contextId: string;
  createdAt: number;
  lastActivityAt: number;
  messagesSinceLastSummary: number;
  hasSummary?: boolean;
  lastSummarizedAt?: number;
  importanceScore?: number;
  totalMessageCount?: number;
  totalTokenCount?: number;
  parentContextId?: string;
}

/**
 * Code block with language and importance
 */
export interface CodeBlock {
  code: string;
  language?: string;
  importance?: number;
  sourceContextId?: string;
}

/**
 * Context summary
 */
export interface ContextSummary {
  contextId: string;
  createdAt: number;
  summary: string;
  codeBlocks: CodeBlock[];
  messageCount: number;
  version: number;
  keyInsights?: string[];
  importanceScore?: number;
  relatedContexts?: string[];
  tokensUsed?: number;
  tokenLimit?: number;
}

/**
 * Context data
 */
export interface ContextData {
  contextId: string;
  metadata: ContextMetadata;
  messages: Message[];
  summary?: string | ContextSummary;
  messagesSinceLastSummary: number;
  hasSummary: boolean;
  lastSummarizedAt?: number;
  importanceScore?: number;
  relatedContexts?: string[];
  parentContextId?: string;
}

/**
 * Summary result
 */
export interface SummaryResult {
  success: boolean;
  summary?: ContextSummary;
  tokensUsed?: number;
  error?: string;
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
 * API call types for analytics
 */
export enum ApiCallType {
  VECTOR_DB_ADD = 'vector_db.add',
  VECTOR_DB_SEARCH = 'vector_db.search',
  VECTOR_DB_DELETE = 'vector_db.delete',
  GRAPH_DB_ADD = 'graph_db.add',
  GRAPH_DB_SEARCH = 'graph_db.search',
  GRAPH_DB_DELETE = 'graph_db.delete',
  LLM_SUMMARIZE = 'llm.summarize',
}

/**
 * Tool names as constants to avoid typos
 */
export const TOOL_NAMES = {
  ADD_CONTEXT: 'add_context',
  GET_CONTEXT: 'get_context',
} as const;

/**
 * Tool name type based on the constants
 */
export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

/**
 * Add Context tool parameters
 */
export interface AddContextParams {
  contextId: string;
  message: string;
  role: 'user' | 'assistant';
  importance?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tags?: string[];
}

/**
 * Get Context tool parameters
 */
export interface GetContextParams {
  contextId?: string;
  query?: string;
  limit?: number;
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
