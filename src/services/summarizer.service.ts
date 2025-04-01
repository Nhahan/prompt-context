import {
  Message,
  ContextSummary,
  HierarchicalSummary,
  MetaSummary,
  ContextImportance,
  SummaryResult,
  CodeBlock,
  ApiCallType,
} from '../domain/types';
import { SummarizerService } from './summarizer.interface';
import { ApiAnalytics } from '../utils/analytics';
import { calculateTokens } from '../utils/tokenizer';
import {
  VectorRepositoryInterface,
  GraphRepositoryInterface,
} from '../repositories/repository.interface';
import { EmbeddingUtil } from '../utils/embedding';

/**
 * Base summarizer service implementation
 * Users can extend this to implement their own integration with actual AI models
 */
export abstract class BaseSummarizer implements SummarizerService {
  protected tokenPercentage: number;
  private analytics: ApiAnalytics | null = null;

  /**
   * Constructor
   * @param tokenPercentage Percentage of token limit to utilize (default: 80%)
   * @param analytics Optional analytics service
   */
  constructor(tokenPercentage: number = 80, analytics: ApiAnalytics | null = null) {
    this.tokenPercentage = Math.max(0, Math.min(100, tokenPercentage));
    this.analytics = analytics;
  }

  /**
   * Extract code blocks from messages
   * @param messages Array of messages
   * @returns Array of extracted code blocks
   */
  protected extractCodeBlocks(messages: Message[]): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    const codeBlockRegex = /```(?:([\w-]+)\n)?([\s\S]*?)```/g;

    for (const message of messages) {
      let match;
      const content = message.content || '';

      // Reset lastIndex to ensure we start from the beginning
      codeBlockRegex.lastIndex = 0;

      while ((match = codeBlockRegex.exec(content)) !== null) {
        const language = match[1] || undefined;
        const code = match[2].trim();

        codeBlocks.push({
          language,
          code,
          importance: message.importance ? Number(message.importance) : 0.5,
        });
      }
    }

    return codeBlocks;
  }

  /**
   * Extract key insights from messages
   * @param messages Array of messages
   * @returns Array of key insights
   */
  protected extractKeyInsights(messages: Message[]): string[] {
    // Simple implementation: Collect sentences with question marks or exclamation marks
    // In a real implementation, this could use more sophisticated analysis
    const insights: string[] = [];
    const patternRegex = /[^.!?]*[!?]+/g;

    for (const message of messages) {
      if (message.role === 'user') {
        const content = message.content || '';

        // Reset lastIndex to ensure we start from the beginning
        patternRegex.lastIndex = 0;

        let match;
        while ((match = patternRegex.exec(content)) !== null) {
          const insight = match[0].trim();
          if (insight.length > 10 && !insights.includes(insight)) {
            insights.push(insight);
          }
        }
      }
    }

    return insights.slice(0, 5); // Limit to 5 insights
  }

  /**
   * Calculate context importance based on message content
   * @param messages Array of messages
   * @returns Importance score between 0 and 1
   */
  protected calculateImportanceScore(messages: Message[]): number {
    if (messages.length === 0) return 0.5;

    // Check for messages with high importance
    const highImportanceCount = messages.filter(
      (m) => m.importance && m.importance >= ContextImportance.HIGH
    ).length;

    if (highImportanceCount > 0) {
      // If we have high importance messages, proportionally increase score
      return Math.min(0.5 + (highImportanceCount / messages.length) * 0.5, 1.0);
    }

    // Default medium importance
    return 0.5;
  }

  /**
   * Create a summary object
   * @param contextId Context ID
   * @param summary Summary text
   * @param messages Original message array
   * @param version Summary version
   * @returns Summary object
   */
  protected createSummaryObject(
    contextId: string,
    summary: string,
    messages: Message[],
    version = 1,
    tokensUsed?: number,
    tokenLimit?: number
  ): ContextSummary {
    const codeBlocks = this.extractCodeBlocks(messages);
    const keyInsights = this.extractKeyInsights(messages);
    const importanceScore = this.calculateImportanceScore(messages);

    return {
      contextId,
      createdAt: Date.now(),
      summary,
      codeBlocks,
      messageCount: messages.length,
      version,
      keyInsights,
      importanceScore,
      tokensUsed,
      tokenLimit,
    };
  }

  /**
   * Create a hierarchical summary object
   * @param parentId Parent context ID
   * @param summary Summary text
   * @param childSummaries Child summaries
   * @param hierarchyLevel Hierarchy level
   * @returns Hierarchical summary object
   */
  protected createHierarchicalSummaryObject(
    parentId: string,
    summary: string,
    childSummaries: ContextSummary[],
    hierarchyLevel = 1
  ): HierarchicalSummary {
    // Collect all code blocks from children
    const allCodeBlocks: CodeBlock[] = [];
    const childContextIds: string[] = [];
    let totalMessageCount = 0;

    for (const childSummary of childSummaries) {
      childContextIds.push(childSummary.contextId);
      totalMessageCount += childSummary.messageCount;

      // Add important code blocks, adding source context information
      const importantBlocks = childSummary.codeBlocks
        .filter((block) => block.importance && block.importance >= 0.7)
        .map((block) => ({
          ...block,
          sourceContextId: childSummary.contextId,
        }));

      allCodeBlocks.push(...importantBlocks);
    }

    // Calculate average importance score
    const avgImportance =
      childSummaries.reduce((sum, summary) => sum + (summary.importanceScore || 0.5), 0) /
      childSummaries.length;

    // Combine key insights from children
    const allKeyInsights: string[] = [];
    for (const childSummary of childSummaries) {
      if (childSummary.keyInsights) {
        allKeyInsights.push(...childSummary.keyInsights);
      }
    }

    // Deduplicate and limit insights
    const uniqueInsights = Array.from(new Set(allKeyInsights)).slice(0, 7);

    return {
      contextId: parentId,
      createdAt: Date.now(),
      summary,
      codeBlocks: allCodeBlocks,
      messageCount: totalMessageCount,
      version: 1,
      parentContextId: undefined, // Top level by default
      childContextIds,
      hierarchyLevel,
      keyInsights: uniqueInsights,
      importanceScore: avgImportance,
    };
  }

  /**
   * Create a meta-summary object
   * @param id Meta-summary ID
   * @param summary Summary text
   * @param hierarchicalSummaries Hierarchical summaries
   * @param hierarchyLevel Hierarchy level
   * @returns Meta-summary object
   */
  protected createMetaSummaryObject(
    id: string,
    summary: string,
    hierarchicalSummaries: HierarchicalSummary[],
    hierarchyLevel = 2
  ): MetaSummary {
    // Extract all code blocks from child summaries
    const sharedCodeBlocks: CodeBlock[] = [];
    const contextIds: string[] = [];

    hierarchicalSummaries.forEach((summary) => {
      // Add code blocks
      if (summary.codeBlocks?.length) {
        sharedCodeBlocks.push(...summary.codeBlocks);
      }

      // Add this context ID
      contextIds.push(summary.contextId);

      // Add child context IDs if available
      if (summary.childContextIds?.length) {
        contextIds.push(...summary.childContextIds);
      }
    });

    // Return meta-summary object
    return {
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      summary,
      contextIds,
      sharedCodeBlocks,
      hierarchyLevel,
    };
  }

  /**
   * Generate summary
   * @param messages Array of messages to summarize
   * @param contextId Context ID
   * @returns Summary result
   */
  async summarize(messages: Message[], contextId: string): Promise<SummaryResult> {
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.LLM_SUMMARIZE);
    }

    try {
      // Calculate token count
      const tokenCount = calculateTokens(messages.map((m) => m.content).join('\n'));

      // Generate summary text using implementation-specific method
      const { summary, tokensUsed } = await this.generateSummary(messages, contextId);

      // Create summary object
      const summaryObj = this.createSummaryObject(
        contextId,
        summary,
        messages,
        1,
        tokensUsed,
        tokenCount
      );

      return {
        success: true,
        summary: summaryObj,
        tokensUsed,
      };
    } catch (error) {
      console.error(`Error summarizing context ${contextId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate hierarchical summary from multiple context summaries
   * @param summaries Array of context summaries to consolidate
   * @param parentId Identifier for the parent context
   * @returns Hierarchical summary result
   */
  async createHierarchicalSummary(
    summaries: ContextSummary[],
    parentId: string
  ): Promise<HierarchicalSummary> {
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.LLM_HIERARCHICAL_SUMMARIZE);
    }

    // Generate hierarchical summary using implementation-specific method
    const summary = await this.generateHierarchicalSummary(summaries, parentId);

    // Create and return the hierarchical summary object
    return this.createHierarchicalSummaryObject(parentId, summary, summaries);
  }

  /**
   * Create a meta-summary across all contexts
   * @param contexts Array of context IDs to include
   * @returns Meta-summary result
   */
  async createMetaSummary(contexts: string[]): Promise<MetaSummary> {
    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.LLM_META_SUMMARIZE);
    }

    // Default implementation - create a placeholder meta-summary
    // In a real implementation, we would fetch the hierarchical summaries related to the contexts
    const metaSummaryId = `meta-${Date.now()}`;
    const dummySummary =
      'This is a placeholder meta-summary. Implement generateMetaSummary for real functionality.';

    // Create and return a basic meta-summary
    return {
      id: metaSummaryId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      summary: dummySummary,
      contextIds: contexts,
      sharedCodeBlocks: [],
      hierarchyLevel: 2,
    };
  }

  /**
   * Analyze message importance
   * @param message Message to analyze
   * @param contextId Context identifier
   * @returns Context importance level
   */
  async analyzeMessageImportance(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _message: Message,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _contextId: string
  ): Promise<ContextImportance> {
    // Default implementation simply returns MEDIUM importance
    // Override this in derived classes for more sophisticated analysis
    return ContextImportance.MEDIUM;
  }

  /**
   * Abstract method to generate summary text
   * Must be implemented by derived classes
   * @param messages Array of messages to summarize
   * @param contextId Context ID
   * @returns Summary text and tokens used
   */
  protected abstract generateSummary(
    messages: Message[],
    contextId: string
  ): Promise<{ summary: string; tokensUsed?: number }>;

  /**
   * Abstract method to generate hierarchical summary text
   * @param summaries Array of context summaries
   * @param parentId Parent context ID
   * @returns Hierarchical summary text
   */
  protected abstract generateHierarchicalSummary(
    summaries: ContextSummary[],
    parentId: string
  ): Promise<string>;

  /**
   * Abstract method to generate meta-summary text
   * @param hierarchicalSummaries Array of hierarchical summaries
   * @param metaSummaryId Meta-summary ID
   * @returns Meta-summary text
   */
  protected abstract generateMetaSummary(
    hierarchicalSummaries: HierarchicalSummary[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metaSummaryId: string
  ): Promise<string>;
}

export class Summarizer extends BaseSummarizer {
  private vectorRepository: VectorRepositoryInterface | null;
  private graphRepository: GraphRepositoryInterface | null;
  private embeddingUtil: EmbeddingUtil;
  private modelInitialized = false;
  private modelInitPromise: Promise<void> | null = null;

  /**
   * Constructor
   * @param tokenPercentage Token percentage limit
   * @param analytics Analytics service
   * @param vectorRepository Vector repository for similarity search
   * @param graphRepository Graph repository for context relationships
   */
  constructor(
    tokenPercentage: number = 80,
    analytics: ApiAnalytics | null = null,
    vectorRepository: VectorRepositoryInterface | null = null,
    graphRepository: GraphRepositoryInterface | null = null
  ) {
    super(tokenPercentage, analytics);
    this.vectorRepository = vectorRepository;
    this.graphRepository = graphRepository;
    this.embeddingUtil = EmbeddingUtil.getInstance();
    this.modelInitialized = false;
    this.modelInitPromise = null;
  }

  /**
   * Initialize the transformer model
   * @returns Promise that resolves when the model is loaded
   */
  private async initializeModel(): Promise<void> {
    if (this.modelInitialized) return;
    if (this.modelInitPromise) return this.modelInitPromise;

    this.modelInitPromise = (async () => {
      try {
        console.error('[Summarizer] Initializing transformer model...');
        await this.embeddingUtil.ensureInitialized();
        this.modelInitialized = true;
        console.error('[Summarizer] Model initialized successfully');
      } catch (error) {
        console.error('[Summarizer] Failed to initialize model:', error);
        console.error('[Summarizer] Will use basic text summarization instead');
      }
    })();

    return this.modelInitPromise;
  }

  /**
   * Prepare text for summarization by formatting messages
   * @param messages Messages to summarize
   * @returns Formatted text
   */
  private prepareTextForSummarization(messages: Message[]): string {
    let result = '';

    // Format as a conversation
    for (const message of messages) {
      const role = message.role === 'user' ? 'User' : 'Assistant';
      result += `${role}: ${message.content}\n\n`;
    }

    return result;
  }

  /**
   * Simple extractive summarization without a model
   * @param text Text to summarize
   * @param maxLength Maximum sentence count
   * @returns Extractive summary
   */
  private extractiveSummarize(text: string, maxLength = 5): string {
    // Split text into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

    if (sentences.length <= maxLength) {
      return text; // If text is already short, return as is
    }

    // Score sentences based on position and content
    const scoredSentences = sentences.map((sentence, index) => {
      const position = 1 - index / sentences.length; // Earlier sentences get higher scores
      const wordCount = sentence.trim().split(/\s+/).length;
      const length = wordCount > 5 && wordCount < 30 ? 1 : 0.5; // Prefer medium-length sentences

      // Keywords check - look for indicators of important content
      const hasKeywords = /important|key|significant|main|critical|crucial/i.test(sentence)
        ? 1.5
        : 1;

      // Score based on content density (approximation)
      const contentScore = sentence.replace(/\s+/g, '').length / wordCount;

      // Final score
      const score = position * length * hasKeywords * contentScore;

      return { sentence: sentence.trim(), score };
    });

    // Sort by score and take the top sentences
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, maxLength)
      .sort((a, b) => {
        // Find the original positions of the sentences to preserve order
        const posA = sentences.findIndex((s) => s.trim() === a.sentence);
        const posB = sentences.findIndex((s) => s.trim() === b.sentence);
        return posA - posB;
      });

    return topSentences.map((item) => item.sentence).join(' ');
  }

  /**
   * Generate a summary of messages
   * @param messages Messages to summarize
   * @param contextId Context ID
   * @returns Generated summary and token count
   */
  protected async generateSummary(
    messages: Message[],
    contextId: string
  ): Promise<{ summary: string; tokensUsed?: number }> {
    // Initialize model if needed
    await this.initializeModel();

    try {
      if (this.vectorRepository) {
        this.vectorRepository.ensureInitialized();
      }

      const text = this.prepareTextForSummarization(messages);
      // 변수 선언만 해두고 사용하지 않음
      // const tokens = calculateTokens(text);

      if (messages.length === 0) {
        return { summary: 'No messages to summarize.', tokensUsed: 0 };
      }

      // If messages are too few, just concatenate them
      if (messages.length <= 3) {
        const simpleSummary = `This conversation contains ${messages.length} message(s). ${
          messages[0].role === 'user' ? 'The user asked: ' : 'The assistant said: '
        }${messages[0].content.slice(0, 200)}${messages[0].content.length > 200 ? '...' : ''}`;
        return { summary: simpleSummary, tokensUsed: calculateTokens(simpleSummary) };
      }

      // Generate a summary using extractive summarization
      const summary = this.extractiveSummarize(text, 7);

      // Add metadata
      const result = `Conversation with ${messages.length} messages. Summary: ${summary}`;

      return { summary: result, tokensUsed: calculateTokens(result) };
    } catch (error) {
      console.error(`[Summarizer] Error generating summary for context ${contextId}:`, error);
      return {
        summary: `Conversation with ${messages.length} messages (summary generation failed).`,
        tokensUsed: 0,
      };
    }
  }

  /**
   * Generate a hierarchical summary from multiple summaries
   * @param summaries Summaries to combine
   * @param parentId Parent context ID
   * @returns Generated hierarchical summary
   */
  protected async generateHierarchicalSummary(
    summaries: ContextSummary[],
    parentId: string
  ): Promise<string> {
    if (summaries.length === 0) {
      return 'No contexts to summarize.';
    }

    try {
      // Collect all summaries
      const allSummaries = summaries.map((s) => s.summary).join('\n\n');

      // Generate an extractive summary of all the summaries
      const combinedSummary = this.extractiveSummarize(allSummaries, 10);

      // Add metadata about the combined contexts
      const totalMessages = summaries.reduce((sum, s) => sum + s.messageCount, 0);
      const result = `Hierarchical summary of ${summaries.length} contexts containing a total of ${totalMessages} messages. ${combinedSummary}`;

      return result;
    } catch (error) {
      console.error(`[Summarizer] Error generating hierarchical summary for ${parentId}:`, error);
      return `Hierarchical summary of ${summaries.length} contexts (summary generation failed).`;
    }
  }

  /**
   * Generate a meta-summary from hierarchical summaries
   * @param hierarchicalSummaries Hierarchical summaries to combine
   * @param metaSummaryId Meta-summary ID
   * @returns Generated meta-summary
   */
  protected async generateMetaSummary(
    hierarchicalSummaries: HierarchicalSummary[],
    metaSummaryId: string
  ): Promise<string> {
    if (hierarchicalSummaries.length === 0) {
      return 'No hierarchical contexts to summarize.';
    }

    try {
      // Collect all summaries
      const allSummaries = hierarchicalSummaries.map((s) => s.summary).join('\n\n');

      // Generate an extractive summary of all the hierarchical summaries
      const combinedSummary = this.extractiveSummarize(allSummaries, 12);

      // Get total message count
      let totalMessages = 0;
      let totalContexts = 0;

      for (const hs of hierarchicalSummaries) {
        totalMessages += hs.messageCount;
        totalContexts += (hs.childContextIds?.length || 0) + 1; // +1 for the hierarchical summary itself
      }

      const result = `Meta-summary of ${hierarchicalSummaries.length} hierarchical contexts containing a total of ${totalContexts} contexts and ${totalMessages} messages. ${combinedSummary}`;

      return result;
    } catch (error) {
      console.error(`[Summarizer] Error generating meta-summary for ${metaSummaryId}:`, error);
      return `Meta-summary of ${hierarchicalSummaries.length} hierarchical contexts (summary generation failed).`;
    }
  }
}
