import {
  Message,
  SummaryResult,
  ContextSummary,
  CodeBlock,
  ContextImportance,
  ApiCallType,
} from '../domain/types';
import { VectorRepository } from '../repositories/vector.repository';
import { GraphRepository } from '../repositories/graph.repository';
import { ApiAnalytics } from '../utils/analytics';
import { calculateTokens } from '../utils/tokenizer';
import { EmbeddingUtil } from '../utils/embedding';

/**
 * Base summarizer service implementation
 * Users can extend this to implement their own integration with actual AI models
 */
export abstract class BaseSummarizer {
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
}

export class Summarizer extends BaseSummarizer {
  private vectorRepository: VectorRepository | null;
  private graphRepository: GraphRepository | null;
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
    vectorRepository: VectorRepository | null = null,
    graphRepository: GraphRepository | null = null
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
}
