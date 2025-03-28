import { 
  CodeBlock, 
  ContextSummary, 
  Message, 
  SummarizerService, 
  SummaryResult, 
  HierarchicalSummary,
  MetaSummary,
  ContextImportance
} from './types';

/**
 * Base summarizer service implementation
 * Users must implement their own integration with actual AI models
 */
export abstract class BaseSummarizer implements SummarizerService {
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
    version = 1
  ): ContextSummary {
    const codeBlocks = this.extractCodeBlocks(messages);
    const keyInsights = this.extractKeyInsights(messages);
    const importanceScore = this.calculateImportanceScore(messages);
    
    return {
      contextId,
      lastUpdated: Date.now(),
      summary,
      codeBlocks,
      messageCount: messages.length,
      version,
      keyInsights,
      importanceScore
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
      lastUpdated: Date.now(),
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
    const contextIds = hierarchicalSummaries.map(s => s.contextId);
    const now = Date.now();
    
    // Collect the most important code blocks across all hierarchical summaries
    const allCodeBlocks = hierarchicalSummaries.flatMap(s => s.codeBlocks);
    const sortedBlocks = allCodeBlocks
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 10); // Keep only the top 10 most important blocks
    
    return {
      id,
      createdAt: now,
      updatedAt: now,
      summary,
      contextIds,
      sharedCodeBlocks: sortedBlocks,
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
    // Default implementation: combine summaries with a simple header
    const combinedText = summaries
      .map(s => `Context ${s.contextId}: ${s.summary}`)
      .join('\n\n');
    
    const hierarchySummary = `Hierarchical summary for ${summaries.length} related contexts: ${combinedText.substring(0, 200)}...`;
    
    return this.createHierarchicalSummaryObject(parentId, hierarchySummary, summaries);
  }
  
  /**
   * Create a meta-summary across contexts
   * @param contexts Array of context IDs
   * @returns Meta-summary
   */
  async createMetaSummary(contexts: string[]): Promise<MetaSummary> {
    // Create a simple meta-summary
    const metaId = `meta_${Date.now()}`;
    const summary = `Meta-summary covering ${contexts.length} hierarchical contexts`;
    
    // This is a placeholder - a real implementation would load the hierarchical summaries
    // and analyze them. Here we're creating a simplified version.
    const dummyHierarchies: HierarchicalSummary[] = contexts.map(contextId => ({
      contextId,
      lastUpdated: Date.now(),
      summary: `Dummy summary for ${contextId}`,
      codeBlocks: [],
      messageCount: 0,
      version: 1,
      hierarchyLevel: 1,
      childContextIds: []
    }));
    
    return this.createMetaSummaryObject(metaId, summary, dummyHierarchies);
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
    try {
      if (!messages || messages.length === 0) {
        return { success: false, error: 'No messages to summarize' };
      }

      // Simple summary: string containing message count and recent topics
      const lastUserMessage = messages
        .filter(m => m.role === 'user')
        .slice(-3)
        .map(m => m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''))
        .join(' | ');

      const summary = `Summary of ${messages.length} messages for context ${contextId}. Recent topics: ${lastUserMessage}`;
      const summaryObject = this.createSummaryObject(contextId, summary, messages);
      
      return { success: true, summary: summaryObject };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
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
  }
  
  /**
   * Enhanced meta-summary implementation
   * @param contextIds Array of context IDs to include
   * @returns Meta-summary
   */
  async createMetaSummary(contextIds: string[]): Promise<MetaSummary> {
    const metaId = `meta_${Date.now()}`;
    const hierarchyCount = contextIds.length;
    
    const metaSummary = `Project-wide meta-summary covering ${hierarchyCount} hierarchical contexts. This automatically generated meta-summary provides an overview of all related conversations in this project.`;
    
    // In a real implementation, we would load the hierarchical summaries here
    // For simplicity, we're creating dummy hierarchies
    const dummyHierarchies: HierarchicalSummary[] = contextIds.map((id, index) => ({
      contextId: id,
      lastUpdated: Date.now(),
      summary: `Dummy summary for hierarchy ${index + 1}`,
      codeBlocks: [],
      messageCount: 100 * (index + 1),
      version: 1,
      hierarchyLevel: 1,
      childContextIds: []
    }));
    
    return this.createMetaSummaryObject(metaId, metaSummary, dummyHierarchies);
  }
}

/**
 * Abstract class for integration with external AI models
 */
export abstract class AIModelSummarizer extends BaseSummarizer {
  /**
   * Abstract method to send summarization requests to an AI model
   * @param messages Array of messages to summarize
   * @returns Summary text generated by the AI model
   */
  protected abstract generateSummaryWithAI(messages: Message[]): Promise<string>;
  
  /**
   * Abstract method to send hierarchical summarization requests to an AI model
   * @param summaries Array of context summaries
   * @returns Summary text generated by the AI model
   */
  protected abstract generateHierarchicalSummaryWithAI(summaries: ContextSummary[]): Promise<string>;
  
  /**
   * Abstract method to send meta-summary requests to an AI model
   * @param hierarchicalSummaries Array of hierarchical summaries
   * @returns Summary text generated by the AI model
   */
  protected abstract generateMetaSummaryWithAI(hierarchicalSummaries: HierarchicalSummary[]): Promise<string>;
  
  /**
   * Generate summary using an AI model
   * @param messages Array of messages to summarize
   * @param contextId Context ID
   * @returns Summary result
   */
  async summarize(messages: Message[], contextId: string): Promise<SummaryResult> {
    try {
      if (!messages || messages.length === 0) {
        return { success: false, error: 'No messages to summarize' };
      }
      
      // Generate summary using AI model
      const summaryText = await this.generateSummaryWithAI(messages);
      const summaryObject = this.createSummaryObject(contextId, summaryText, messages);
      
      return { success: true, summary: summaryObject };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Generate hierarchical summary using an AI model
   * @param summaries Array of context summaries
   * @param parentId Parent context ID
   * @returns Hierarchical summary
   */
  async createHierarchicalSummary(
    summaries: ContextSummary[], 
    parentId: string
  ): Promise<HierarchicalSummary> {
    try {
      const summaryText = await this.generateHierarchicalSummaryWithAI(summaries);
      return this.createHierarchicalSummaryObject(parentId, summaryText, summaries);
    } catch (error) {
      console.error('Error generating hierarchical summary:', error);
      // Fall back to base implementation
      return super.createHierarchicalSummary(summaries, parentId);
    }
  }
  
  /**
   * Generate meta-summary using an AI model
   * @param contextIds Array of context IDs to include
   * @returns Meta-summary
   */
  async createMetaSummary(contextIds: string[]): Promise<MetaSummary> {
    try {
      // In a real implementation, we would load the hierarchical summaries here
      // For simplicity, we're creating dummy hierarchies
      const dummyHierarchies: HierarchicalSummary[] = contextIds.map((id, index) => ({
        contextId: id,
        lastUpdated: Date.now(),
        summary: `Hierarchy ${index + 1}`,
        codeBlocks: [],
        messageCount: 100 * (index + 1),
        version: 1,
        hierarchyLevel: 1,
        childContextIds: []
      }));
      
      const metaId = `meta_${Date.now()}`;
      const summaryText = await this.generateMetaSummaryWithAI(dummyHierarchies);
      
      return this.createMetaSummaryObject(metaId, summaryText, dummyHierarchies);
    } catch (error) {
      console.error('Error generating meta-summary:', error);
      // Fall back to base implementation
      return super.createMetaSummary(contextIds);
    }
  }
}

/**
 * Example implementation for integration with custom external AI services
 */
export class CustomAISummarizer extends AIModelSummarizer {
  private summarizerFunction: (messages: Message[]) => Promise<string>;
  private hierarchicalSummarizerFunction?: (summaries: ContextSummary[]) => Promise<string>;
  private metaSummarizerFunction?: (hierarchies: HierarchicalSummary[]) => Promise<string>;
  
  /**
   * Constructor
   * @param summarizerFunction Function to communicate with external AI model for regular summarization
   * @param hierarchicalSummarizerFunction Optional function for hierarchical summarization
   * @param metaSummarizerFunction Optional function for meta-summarization
   */
  constructor(
    summarizerFunction: (messages: Message[]) => Promise<string>,
    hierarchicalSummarizerFunction?: (summaries: ContextSummary[]) => Promise<string>,
    metaSummarizerFunction?: (hierarchies: HierarchicalSummary[]) => Promise<string>
  ) {
    super();
    this.summarizerFunction = summarizerFunction;
    this.hierarchicalSummarizerFunction = hierarchicalSummarizerFunction;
    this.metaSummarizerFunction = metaSummarizerFunction;
  }
  
  /**
   * Generate summary using external AI model
   * @param messages Array of messages to summarize
   * @returns Summary text generated by the AI model
   */
  protected async generateSummaryWithAI(messages: Message[]): Promise<string> {
    return this.summarizerFunction(messages);
  }
  
  /**
   * Generate hierarchical summary using external AI model
   * @param summaries Array of context summaries
   * @returns Summary text generated by the AI model
   */
  protected async generateHierarchicalSummaryWithAI(summaries: ContextSummary[]): Promise<string> {
    if (this.hierarchicalSummarizerFunction) {
      return this.hierarchicalSummarizerFunction(summaries);
    }
    
    // Default fallback implementation
    const combinedText = summaries
      .map(s => `Context ${s.contextId}: ${s.summary}`)
      .join('\n\n');
    
    return `Hierarchical summary for ${summaries.length} related contexts: ${combinedText.substring(0, 200)}...`;
  }
  
  /**
   * Generate meta-summary using external AI model
   * @param hierarchies Array of hierarchical summaries
   * @returns Summary text generated by the AI model
   */
  protected async generateMetaSummaryWithAI(hierarchies: HierarchicalSummary[]): Promise<string> {
    if (this.metaSummarizerFunction) {
      return this.metaSummarizerFunction(hierarchies);
    }
    
    // Default fallback implementation
    return `Meta-summary covering ${hierarchies.length} hierarchical contexts`;
  }
} 