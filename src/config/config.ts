/**
 * Configuration types for the Prompt Context MCP Server
 */

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
  ignorePatterns?: string[];
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
  /** Whether to enable HTTP server */
  enableHttpServer?: boolean;
  /** Port for HTTP server */
  httpPort?: number;
  /** Legacy port for backward compatibility */
  port?: number;
  /** API key for authentication */
  apiKey?: string;
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
 * Vector database configuration
 */
export interface VectorDbConfig {
  dimensions?: number;
  maxElements?: number;
  // Add other vector DB specific settings if needed
}

/**
 * Summarizer configuration
 */
export interface SummarizerConfig {
  model?: string; // Example: Name or ID of the summarization model
  apiKey?: string; // Example: API key if needed
  maxOutputTokens?: number;
  // Add other summarizer specific settings
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Omit<Required<MCPConfig>, 'ignorePatterns'> &
  Pick<MCPConfig, 'contextDir'> = {
  messageLimitThreshold: 10,
  tokenLimitPercentage: 80,
  contextDir: '', // Will be set at runtime
  autoSummarize: true,
  hierarchicalContext: true,
  metaSummaryThreshold: 5,
  maxHierarchyDepth: 3,
  useVectorDb: true,
  useGraphDb: true,
  vectorDb: {},
  summarizer: {},
  debug: false,
  similarityThreshold: 0.6,
  autoCleanupContexts: true,
  trackApiCalls: true,
  apiAnalyticsRetention: 30,
  fallbackToKeywordMatch: true,
  enableHttpServer: false,
  httpPort: 3000,
  port: 6789,
  apiKey: '',
};
