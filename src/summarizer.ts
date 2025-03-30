import { 
  CodeBlock, 
  ContextSummary, 
  Message, 
  SummaryResult,
  HierarchicalSummary,
  MetaSummary,
  ContextImportance,
  SummarizerService,
  ApiCallType
} from './types';
import { ApiAnalytics } from './analytics';
import { VectorRepository } from './vector-repository';
import { GraphRepository } from './graph-repository';
import { calculateTokens } from './tokenizer';

/**
 * Base summarizer service implementation
 * Users must implement their own integration with actual AI models
 */
export abstract class BaseSummarizer implements SummarizerService {
  protected tokenPercentage: number;

  constructor(tokenPercentage: number = 80) {
    this.tokenPercentage = Math.max(0, Math.min(100, tokenPercentage));
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
      while ((match = codeBlockRegex.exec(message.content)) !== null) {
        const language = match[1] || undefined;
        const code = match[2].trim();
        
        codeBlocks.push({
          language,
          code,
          importance: message.importance ? Number(message.importance) : 1.0 // Use message importance if available
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
    // In a real implementation, this would use more sophisticated analysis
    const insights: string[] = [];
    const patternRegex = /[^.!?]*[!?]+/g;
    
    for (const message of messages) {
      if (message.role === 'user') {
        let match;
        while ((match = patternRegex.exec(message.content)) !== null) {
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
      m => m.importance && m.importance >= ContextImportance.HIGH
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
      tokenLimit
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
        .filter(block => block.importance && block.importance >= 0.7)
        .map(block => ({
          ...block,
          sourceContextId: childSummary.contextId
        }));
      
      allCodeBlocks.push(...importantBlocks);
    }
    
    // Calculate average importance score
    const avgImportance = childSummaries.reduce(
      (sum, summary) => sum + (summary.importanceScore || 0.5), 
      0
    ) / childSummaries.length;
    
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
      importanceScore: avgImportance
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
    
    hierarchicalSummaries.forEach(summary => {
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
      hierarchyLevel
    };
  }
  
  /**
   * Generate summary (abstract method)
   * @param messages Array of messages to summarize
   * @param contextId Context ID
   * @returns Summary result
   */
  abstract summarize(messages: Message[], contextId: string): Promise<SummaryResult>;
  
  /**
   * Generate hierarchical summary from multiple context summaries
   * @param summaries Array of context summaries
   * @param parentId Parent context ID
   * @returns Hierarchical summary
   */
  async createHierarchicalSummary(
    summaries: ContextSummary[], 
    parentId: string
  ): Promise<HierarchicalSummary> {
    try {
      if (!summaries || summaries.length === 0) {
        throw new Error('No summaries provided for hierarchical summary creation');
      }
      
      if (!parentId) {
        throw new Error('Parent ID is required for hierarchical summary');
      }
      
      // Default implementation: combine summaries with a simple header
      const combinedText = summaries
        .map(s => `Context ${s.contextId}: ${s.summary}`)
        .join('\n\n');
      
      const hierarchySummary = `Hierarchical summary for ${summaries.length} related contexts: ${combinedText.substring(0, 200)}...`;
      
      return this.createHierarchicalSummaryObject(parentId, hierarchySummary, summaries);
    } catch (error) {
      console.error('Error creating hierarchical summary:', error);
      // Return a basic fallback summary
      return {
        contextId: parentId,
        createdAt: Date.now(),
        summary: `Failed to create detailed hierarchical summary for ${summaries.length} contexts.`,
        codeBlocks: [],
        messageCount: summaries.reduce((sum, s) => sum + s.messageCount, 0),
        version: 1,
        hierarchyLevel: 1,
        childContextIds: summaries.map(s => s.contextId)
      };
    }
  }
  
  /**
   * Create a meta-summary across contexts
   * @param contexts Array of context IDs
   * @returns Meta-summary
   */
  async createMetaSummary(contexts: string[]): Promise<MetaSummary> {
    try {
      // 최소 2개 이상의 컨텍스트가 필요
      if (contexts.length < 2) {
        return {
          id: `meta-${Date.now()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          summary: `Failed to create detailed meta-summary for ${contexts.length} contexts.`,
          contextIds: contexts,
          sharedCodeBlocks: [],
          hierarchyLevel: 2
        };
      }
      
      // 계층적 요약 로드
      const hierarchicalSummaries: HierarchicalSummary[] = [];
      
      for (const contextId of contexts) {
        try {
          // 요약을 계층적 요약으로 변환
          const summary = {
            contextId,
            createdAt: Date.now(),
            summary: `Context for ${contextId}`,
            codeBlocks: [],
            messageCount: 0,
            version: 1,
            hierarchyLevel: 1,
            childContextIds: []
          } as HierarchicalSummary;
          
          hierarchicalSummaries.push(summary);
        } catch (error) {
          console.warn(`Failed to load hierarchical summary for ${contextId}:`, error);
        }
      }
      
      if (hierarchicalSummaries.length < 2) {
        return {
          id: `meta-${Date.now()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          summary: `Failed to create meta-summary due to insufficient hierarchical summaries.`,
          contextIds: contexts,
          sharedCodeBlocks: [],
          hierarchyLevel: 2
        };
      }
      
      // 메타 요약 생성
      const metaSummary = `Meta-summary for ${hierarchicalSummaries.length} contexts: \n\n` + 
        hierarchicalSummaries.map(s => s.summary).join('\n\n');
      
      const metaId = `meta-${Date.now()}`;
      
      return this.createMetaSummaryObject(
        metaId,
        metaSummary,
        hierarchicalSummaries
      );
    } catch (error) {
      console.error('Error creating meta-summary:', error);
      
      // 기본 메타 요약 반환
      return {
        id: `meta-fallback-${Date.now()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        summary: `Failed to create detailed meta-summary for ${contexts.length} contexts.`,
        contextIds: contexts,
        sharedCodeBlocks: [],
        hierarchyLevel: 2
      };
    }
  }
  
  /**
   * Analyze message importance
   * @param message Message to analyze
   * @param contextId Context ID
   * @returns Context importance level
   */
  async analyzeMessageImportance(
    message: Message, 
    contextId: string
  ): Promise<ContextImportance> {
    // Simple heuristic implementation
    const content = message.content.toLowerCase();
    
    // Check for indicators of high importance
    if (
      content.includes('critical') || 
      content.includes('urgent') || 
      content.includes('important') ||
      content.includes('crucial') ||
      content.match(/\![^!]/)  // Contains exclamation marks
    ) {
      return ContextImportance.HIGH;
    }
    
    // Check for questions (medium importance)
    if (
      content.includes('?') ||
      content.includes('how') ||
      content.includes('what') ||
      content.includes('why') ||
      content.includes('when')
    ) {
      return ContextImportance.MEDIUM;
    }
    
    // Check for very short messages (lower importance)
    if (content.length < 20) {
      return ContextImportance.LOW;
    }
    
    // Default
    return ContextImportance.MEDIUM;
  }

  protected calculateTokenLimit(modelTokenCapacity: number): number {
    return Math.floor(modelTokenCapacity * (this.tokenPercentage / 100));
  }
}

/**
 * Simple text summarizer service
 * Creates a basic summary without using an actual AI model
 */
export class SimpleTextSummarizer extends BaseSummarizer {
  /**
   * Generate a simple summary
   * @param messages Array of messages to summarize
   * @param contextId Context ID
   * @returns Summary result
   */
  async summarize(messages: Message[], contextId: string): Promise<SummaryResult> {
    let success = false;
    let summary: ContextSummary | undefined;
    let errorMsg: string | undefined;
    let tokensUsed: number | undefined;
    try {
      if (!messages || messages.length === 0) { throw new Error('No messages to summarize'); }
      const lastUserMessage = messages.filter(m => m.role === 'user').slice(-3).map(m => m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '')).join(' | ');
      const summaryText = `Summary of ${messages.length} messages for context ${contextId}. Recent topics: ${lastUserMessage}`;
      tokensUsed = calculateTokens(summaryText);
      const tokenLimit = undefined;
      summary = this.createSummaryObject(contextId, summaryText, messages, 1, tokensUsed, tokenLimit);
      success = true;
    } catch (error) {
      errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error summarizing context ${contextId}:`, errorMsg);
      success = false;
    }
    // Return without fallback
    return { success, summary, error: errorMsg, tokensUsed }; 
  }
  
  /**
   * Enhanced hierarchical summary implementation
   * @param summaries Array of context summaries
   * @param parentId Parent context ID
   * @returns Hierarchical summary
   */
  async createHierarchicalSummary(
    summaries: ContextSummary[], 
    parentId: string
  ): Promise<HierarchicalSummary> {
    try {
      if (!summaries || summaries.length === 0) {
        throw new Error('No summaries provided for hierarchical summary creation');
      }
      
      if (!parentId) {
        throw new Error('Parent ID is required for hierarchical summary');
      }
      
      // Enhanced version of the hierarchical summary for SimpleTextSummarizer
      
      // Identify the most important contexts
      const sortedSummaries = [...summaries].sort(
        (a, b) => (b.importanceScore || 0.5) - (a.importanceScore || 0.5)
      );
      
      const topSummaries = sortedSummaries.slice(0, 3);
      const topSummaryTexts = topSummaries
        .map(s => `Context ${s.contextId}: ${s.summary}`)
        .join('\n');
      
      const hierarchySummary = `Hierarchical summary for ${summaries.length} related contexts.\n\nMost important topics:\n${topSummaryTexts}\n\nThis hierarchy contains a total of ${summaries.reduce((sum, s) => sum + s.messageCount, 0)} messages.`;
      
      return this.createHierarchicalSummaryObject(parentId, hierarchySummary, summaries);
    } catch (error) {
      console.error('Error creating hierarchical summary:', error);
      // Return a basic fallback summary
      return {
        contextId: parentId,
        createdAt: Date.now(),
        summary: `Failed to create detailed hierarchical summary for ${summaries.length} contexts.`,
        codeBlocks: [],
        messageCount: summaries.reduce((sum, s) => sum + s.messageCount, 0),
        version: 1,
        hierarchyLevel: 1,
        childContextIds: summaries.map(s => s.contextId)
      };
    }
  }
  
  /**
   * Enhanced meta-summary implementation
   * @param contextIds Array of context IDs to include
   * @returns Meta-summary
   */
  async createMetaSummary(contextIds: string[]): Promise<MetaSummary> {
    try {
      if (!contextIds || contextIds.length === 0) {
        throw new Error('No context IDs provided for meta-summary creation');
      }
      
      const metaId = `meta_${Date.now()}`;
      const hierarchyCount = contextIds.length;
      
      const metaSummary = `Project-wide meta-summary covering ${hierarchyCount} hierarchical contexts. This automatically generated meta-summary provides an overview of all related conversations in this project.`;
      
      // In a real implementation, we would load the hierarchical summaries here
      // For simplicity, we're creating dummy hierarchies
      const dummyHierarchies: HierarchicalSummary[] = contextIds.map((id, index) => ({
        contextId: id,
        createdAt: Date.now(),
        summary: `Dummy summary for hierarchy ${index + 1}`,
        codeBlocks: [],
        messageCount: 0,
        version: 1,
        hierarchyLevel: 1,
        childContextIds: []
      }));
      
      return this.createMetaSummaryObject(metaId, metaSummary, dummyHierarchies);
    } catch (error) {
      console.error('Error creating meta-summary:', error);
      // Return a basic fallback meta-summary
      return {
        id: `meta_fallback_${Date.now()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        summary: `Failed to create detailed meta-summary for ${contextIds.length} contexts.`,
        contextIds,
        sharedCodeBlocks: [],
        hierarchyLevel: 2
      };
    }
  }
}

/**
 * AI Model-based summarizer
 * Integrates with external AI models for summarization
 */
export class AIModelSummarizer extends BaseSummarizer {
  // Custom summarization callback function type
  private summarizeWithAI: (
    messages: Message[], 
    contextId: string
  ) => Promise<string>;
  
  /**
   * Constructor
   * @param summarizeCallback Callback function that implements the AI summarization logic
   */
  constructor(
    summarizeCallback: (messages: Message[], contextId: string) => Promise<string>
  ) {
    super();
    this.summarizeWithAI = summarizeCallback;
  }
  
  /**
   * Generate summary using the provided AI model
   * @param messages Array of messages to summarize
   * @param contextId Context ID
   * @returns Summary result
   */
  async summarize(messages: Message[], contextId: string): Promise<SummaryResult> {
    let summary: ContextSummary | undefined;
    let errorMsg: string | undefined;
    let success = false;
    let tokensUsed: number | undefined;
    try {
      if (!messages || messages.length === 0) { throw new Error('No messages to summarize'); }
      const summaryText = await this.summarizeWithAI(messages, contextId);
      if (!summaryText) { throw new Error('AI model returned empty summary'); }
      const tokenLimit = this.calculateTokenLimit(16385);
      summary = this.createSummaryObject(contextId, summaryText, messages, 1, tokensUsed, tokenLimit);
      success = true;
    } catch (error) {
      errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error in AI summarization for context ${contextId}:`, errorMsg);
      success = false;
    }
    // Return result without fallback property
    return { success, summary, error: errorMsg, tokensUsed }; 
  }
  
  /**
   * Create a fallback summary when AI summarization fails
   * @param messages Array of messages
   * @param contextId Context ID
   * @returns Simple summary object
   */
  private async createFallbackSummary(
    messages: Message[], 
    contextId: string
  ): Promise<ContextSummary> {
    // Use a simple approach as fallback
    const lastUserMessage = messages
      .filter(m => m.role === 'user')
      .slice(-3)
      .map(m => m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''))
      .join(' | ');
      
    const summary = `[Fallback] Summary of ${messages.length} messages for context ${contextId}. Recent topics: ${lastUserMessage}`;
    return this.createSummaryObject(contextId, summary, messages);
  }
}

/**
 * Custom AI Summarizer that can be configured with specific prompts and behaviors
 * This class provides a flexible way to integrate with any LLM API
 */
export class CustomAISummarizer extends BaseSummarizer {
  // LLM API callback function
  private llmApiCallback: (prompt: string, options?: any) => Promise<string>;
  
  // Template for summarization prompt
  private summaryTemplate: string;
  
  // Template for hierarchical summary prompt
  private hierarchicalTemplate: string;
  
  /**
   * Constructor
   * @param llmApiCallback Function that calls the LLM API with a prompt
   * @param options Configuration options
   */
  constructor(
    llmApiCallback: (prompt: string, options?: any) => Promise<string>,
    options: {
      summaryTemplate?: string;
      hierarchicalTemplate?: string;
    } = {}
  ) {
    super();
    this.llmApiCallback = llmApiCallback;
    
    // Default or custom template for regular summarization
    this.summaryTemplate = options.summaryTemplate || 
      `Summarize the following conversation about {contextId}:\n\n{messages}\n\nSummary:`;
    
    // Default or custom template for hierarchical summarization
    this.hierarchicalTemplate = options.hierarchicalTemplate ||
      `Create a hierarchical summary for these related contexts:\n\n{summaries}\n\nHierarchical summary:`;
  }
  
  /**
   * Generate summary using the LLM API
   * @param messages Array of messages to summarize
   * @param contextId Context ID
   * @returns Summary result
   */
  async summarize(messages: Message[], contextId: string): Promise<SummaryResult> {
    let summary: ContextSummary | undefined;
    let errorMsg: string | undefined;
    let success = false;
    let tokensUsed: number | undefined;
    let summaryText: string | null = null;
    let lastError: Error | null = null;
    try {
      if (!messages || messages.length === 0) { throw new Error('No messages to summarize'); }
      const formattedMessages = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      const prompt = this.summaryTemplate.replace('{contextId}', contextId).replace('{messages}', formattedMessages);
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Calling LLM API for summary (attempt ${attempt}/3)...`);
          summaryText = await this.llmApiCallback(prompt);
          
          // 응답 검증
          if (!summaryText || summaryText.trim().length === 0) {
            console.warn(`LLM API returned empty summary on attempt ${attempt}`);
            lastError = new Error('LLM API returned empty summary');
            // 빈 응답일 경우 재시도
            continue;
          }
          
          // 응답이 너무 짧은 경우 검증
          if (summaryText.trim().length < 10) {
            console.warn(`LLM API returned too short summary on attempt ${attempt}: "${summaryText}"`);
            lastError = new Error('LLM API returned too short summary');
            // 짧은 응답일 경우 재시도
            continue;
          }
          
          // 유효한 응답을 받으면 성공
          break;
        } catch (apiError) {
          console.warn(`API call failed on attempt ${attempt}:`, apiError);
          lastError = apiError instanceof Error ? apiError : new Error(String(apiError));
          
          // 마지막 시도가 아닌 경우 짧은 대기 후 재시도
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }
      
      // 모든 시도가 실패한 경우
      if (!summaryText) {
        console.error(`All ${3} attempts to get summary from LLM API failed`);
        
        // 폴백 요약기 사용
        const fallbackSummarizer = new SimpleTextSummarizer();
        const fallbackResult = await fallbackSummarizer.summarize(messages, contextId);
        
        return { 
          success: false, 
          error: lastError?.message || 'LLM API failed to generate summary', 
          summary: fallbackResult.summary
        };
      }
      
      // 성공했을 경우 요약 객체 생성
      const tokenLimit = this.calculateTokenLimit(16385);
      summary = this.createSummaryObject(contextId, summaryText, messages, 1, tokensUsed, tokenLimit);
      success = true;
    } catch (error) {
      errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error in custom AI summarization for context ${contextId}:`, errorMsg);
      
      // 폴백 요약기 사용
      const fallbackSummarizer = new SimpleTextSummarizer();
      const fallbackResult = await fallbackSummarizer.summarize(messages, contextId);
      
      return { 
        success: false, 
        error: errorMsg,
        summary: fallbackResult.summary
      };
    }
    // Return result without fallback property
    return { success, summary, error: errorMsg, tokensUsed };
  }
  
  /**
   * Create hierarchical summary using the LLM API
   * @param summaries Array of summaries to combine
   * @param parentId Parent context ID
   * @returns Hierarchical summary
   */
  async createHierarchicalSummary(
    summaries: ContextSummary[],
    parentId: string
  ): Promise<HierarchicalSummary> {
    try {
      // 적어도 하나의 요약이 있어야 함
      if (summaries.length === 0) {
        throw new Error('Cannot create hierarchical summary: No summaries provided');
      }
      
      const formattedSummaries = summaries
        .map(s => `Context ${s.contextId} (${s.messageCount} messages):\n${s.summary}`)
        .join('\n\n');
      
      // Create prompt from template
      const prompt = this.hierarchicalTemplate
        .replace('{summaries}', formattedSummaries);
      
      // Call LLM API
      let hierarchySummary: string | null = null;
      try {
        hierarchySummary = await this.llmApiCallback(prompt);
      } catch (apiError: unknown) {
        console.warn('Error calling LLM API:', apiError);
        const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
        throw new Error(`LLM API call failed: ${errorMessage}`);
      }
      
      // 응답 확인
      if (!hierarchySummary || hierarchySummary.trim().length === 0) {
        console.warn('LLM API returned empty hierarchical summary, falling back to simple summarizer');
        throw new Error('LLM API returned empty hierarchical summary');
      }
      
      // 너무 짧은 응답도 유효하지 않다고 간주
      if (hierarchySummary.trim().length < 10) {
        console.warn(`LLM API returned too short hierarchical summary: "${hierarchySummary}"`);
        throw new Error('LLM API returned too short hierarchical summary');
      }
      
      return this.createHierarchicalSummaryObject(parentId, hierarchySummary, summaries);
    } catch (error) {
      console.error('Error creating custom AI hierarchical summary:', error);
      
      // Fallback to simple hierarchical summary
      console.log('Falling back to SimpleTextSummarizer for hierarchical summary');
      const fallbackSummarizer = new SimpleTextSummarizer();
      return await fallbackSummarizer.createHierarchicalSummary(summaries, parentId);
    }
  }
}

/**
 * Default Summarizer (Placeholder)
 */
export class Summarizer extends BaseSummarizer { 
    private analytics?: ApiAnalytics | null;
    private vectorRepository?: VectorRepository | null;
    private graphRepository?: GraphRepository | null;

    constructor(
        tokenPercentage: number = 80, 
        analytics?: ApiAnalytics | null, 
        vectorRepository?: VectorRepository | null,
        graphRepository?: GraphRepository | null
    ) {
        super(tokenPercentage);
        this.analytics = analytics;
        this.vectorRepository = vectorRepository;
        this.graphRepository = graphRepository;
        console.error(`[Summarizer] Initialized with token limit: ${tokenPercentage}%`);
    }

    async summarize(messages: Message[], contextId: string): Promise<SummaryResult> {
        console.warn(`[Summarizer] Placeholder summarize called for ${contextId}. Using SimpleTextSummarizer.`);
        const stopTracking = this.analytics?.trackCall(ApiCallType.LLM_SUMMARIZE, { contextId, messagesCount: messages.length });
        // Initialize result before try block
        let result: SummaryResult = { success: false }; 
        try {
            // Delegate to SimpleTextSummarizer for placeholder behavior
            const simpleSummarizer = new SimpleTextSummarizer(this.tokenPercentage);
            result = await simpleSummarizer.summarize(messages, contextId);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[Summarizer] Error during simple summarization delegation:`, errorMsg);
            // Update result with error information in case of catch
            result = { success: false, error: errorMsg }; 
        }
        finally {
             // Stop analytics tracking correctly
             if (stopTracking) {
                 stopTracking(); 
             }
            // Now result is guaranteed to be assigned
            console.log(`[Summarizer] Analytics tracking stopped for summarize (${result.success ? 'success' : 'failure'})`);
        }
        return result; 
    }

    // --- Methods below likely belong in MCP class or Repository --- 
    // These were part of the old MemoryContextProtocol class structure
    // They rely on repository access and trigger conditions, better handled elsewhere.

    /* 
    async summarizeContextIfNeeded(contextId: string, repository: FileSystemRepository): Promise<boolean> {
      const context = await repository.loadContextData(contextId);
      if (!context || context.messagesSinceLastSummary < this.messageLimitThreshold) {
        return false;
      }
      
      const tokenLimit = 8192 * (this.tokenLimitPercentage / 100); // Example token limit
      if (context.tokenCount < tokenLimit && context.messagesSinceLastSummary < this.messageLimitThreshold) {
           return false;
      }

      console.error(`[Summarizer] Triggering summarization for ${contextId}`);
      const messages = await repository.loadMessages(contextId);
      if (!messages || messages.length === 0) {
          console.error(`[Summarizer] No messages found for ${contextId}, skipping summarization.`);
          return false;
      }

      const result = await this.summarize(messages, contextId);
      
      if (result.success && result.summary) {
          await repository.saveSummary(contextId, result.summary);
          await repository.updateContextData(contextId, { 
              messagesSinceLastSummary: 0, 
              hasSummary: true,
              lastSummarizedAt: Date.now(),
              // Optionally update importance score based on summary
              importanceScore: result.summary.importanceScore 
          });
          console.error(`[Summarizer] Summary saved successfully for ${contextId}`);
          return true;
      } else {
          console.error(`[Summarizer] Summarization failed for ${contextId}: ${result.error}`);
          return false;
      }
    }
    */

    // Other methods like createHierarchicalSummary, createMetaSummary, analyzeMessageImportance
    // would also need concrete implementations here if this class were to handle them.
}

// Keep BaseSummarizer export if it's intended to be used elsewhere
// export { BaseSummarizer };