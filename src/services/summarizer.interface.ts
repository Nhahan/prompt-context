import {
  Message,
  ContextSummary,
  HierarchicalSummary,
  MetaSummary,
  ContextImportance,
  SummaryResult,
} from '../domain/types';

/**
 * Interface for summarizer services
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
