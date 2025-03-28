import { FileSystemRepository } from './repository';
import { SimpleTextSummarizer } from './summarizer';
import { 
  ContextData, 
  ContextSummary, 
  MCPConfig, 
  Message, 
  SummarizerService,
  HierarchicalSummary,
  MetaSummary,
  ContextImportance,
  ContextRelationshipType,
  SimilarContext
} from './types';
import { VectorRepositoryInterface, createVectorRepository } from './vector-repository';
import { GraphRepositoryInterface, createGraphRepository } from './graph-repository';

/**
 * Default MCP configuration
 */
const DEFAULT_CONFIG: MCPConfig = {
  messageLimitThreshold: 10,
  tokenLimitPercentage: 80,
  contextDir: '.prompt-context',
  useGit: true,
  ignorePatterns: [],
  autoSummarize: true,
  hierarchicalContext: true,
  metaSummaryThreshold: 5,
  maxHierarchyDepth: 3,
  useVectorDb: true,
  useGraphDb: true,
  similarityThreshold: 0.6,
  autoCleanupContexts: true
};

/**
 * Memory Context Protocol (MCP) class
 * Context memory protocol for AI agents
 */
export class MemoryContextProtocol {
  private config: MCPConfig;
  private repository: FileSystemRepository;
  private summarizer: SummarizerService;
  private contexts: Map<string, ContextData> = new Map();
  private hierarchyMap: Map<string, string[]> = new Map(); // parent -> children
  private vectorRepository: VectorRepositoryInterface | null = null;
  private graphRepository: GraphRepositoryInterface | null = null;
  
  /**
   * MCP constructor
   * @param config Configuration options
   * @param summarizer Summary service instance (optional)
   */
  constructor(
    config: Partial<MCPConfig> = {}, 
    summarizer?: SummarizerService
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.repository = new FileSystemRepository(this.config);
    this.summarizer = summarizer || new SimpleTextSummarizer();
    
    // Initialize repositories
    this.initRepositories();
    
    // Load existing hierarchical structures
    if (this.config.hierarchicalContext) {
      this.loadHierarchicalStructures();
    }
  }
  
  /**
   * Initialize vector and graph repositories
   */
  private async initRepositories(): Promise<void> {
    try {
      // Initialize vector repository if enabled
      if (this.config.useVectorDb) {
        this.vectorRepository = await createVectorRepository(this.config.contextDir);
        console.log('Vector repository initialized');
      }
      
      // Initialize graph repository if enabled
      if (this.config.useGraphDb) {
        this.graphRepository = await createGraphRepository(this.config.contextDir);
        console.log('Graph repository initialized');
      }
    } catch (error) {
      console.error('Error initializing repositories:', error);
    }
  }
  
  /**
   * Load existing hierarchical structures
   */
  private async loadHierarchicalStructures(): Promise<void> {
    try {
      const contextIds = await this.repository.getAllContextIds();
      
      for (const contextId of contextIds) {
        const hierarchicalSummary = await this.repository.loadHierarchicalSummary(contextId);
        
        if (hierarchicalSummary && hierarchicalSummary.parentContextId) {
          // Add to hierarchy map
          const parent = hierarchicalSummary.parentContextId;
          const children = this.hierarchyMap.get(parent) || [];
          
          if (!children.includes(contextId)) {
            children.push(contextId);
            this.hierarchyMap.set(parent, children);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load hierarchical structures:', error);
    }
  }
  
  /**
   * Estimate message token count (using simple heuristic)
   * @param message Message object
   * @returns Estimated token count
   */
  private estimateTokenCount(message: Message): number {
    // Simple heuristic: average of 1.3 tokens per word
    return Math.ceil(message.content.split(/\s+/).length * 1.3);
  }
  
  /**
   * Initialize context data
   * @param contextId Context ID
   * @returns Initialized context data
   */
  private async initializeContext(contextId: string): Promise<ContextData> {
    // Check if context ID matches ignore pattern
    if (this.repository.shouldIgnore(contextId)) {
      throw new Error(`Context ID "${contextId}" matches ignore pattern`);
    }
    
    // Load saved summary
    const savedSummary = await this.repository.loadSummary(contextId);
    
    // Try to find related contexts
    let relatedContexts: string[] = [];
    let parentContextId: string | undefined = undefined;
    
    if (this.config.hierarchicalContext && savedSummary?.relatedContexts) {
      relatedContexts = savedSummary.relatedContexts;
    }
    
    // Check if this context has a parent in the hierarchy
    if (this.config.hierarchicalContext) {
      const hierarchicalSummary = await this.repository.loadHierarchicalSummary(contextId);
      if (hierarchicalSummary?.parentContextId) {
        parentContextId = hierarchicalSummary.parentContextId;
      }
    }
    
    const contextData: ContextData = {
      contextId,
      messages: [],
      tokenCount: 0,
      messagesSinceLastSummary: 0,
      hasSummary: !!savedSummary,
      lastSummarizedAt: savedSummary?.lastUpdated,
      importanceScore: savedSummary?.importanceScore || 0.5, // Default importance
      relatedContexts,
      parentContextId
    };
    
    this.contexts.set(contextId, contextData);
    return contextData;
  }
  
  /**
   * Get context data
   * @param contextId Context ID
   * @param createIfNotExists Whether to create if it doesn't exist
   * @returns Context data
   */
  private async getContext(
    contextId: string, 
    createIfNotExists = true
  ): Promise<ContextData | undefined> {
    let context = this.contexts.get(contextId);
    
    if (!context && createIfNotExists) {
      context = await this.initializeContext(contextId);
    }
    
    return context;
  }
  
  /**
   * Add message to context
   * @param contextId Context ID
   * @param message Message to add
   * @returns Updated context data
   */
  async addMessage(contextId: string, message: Message): Promise<ContextData> {
    const context = await this.getContext(contextId);
    if (!context) {
      throw new Error(`Failed to get or create context: ${contextId}`);
    }
    
    // Analyze message importance if not already provided
    if (this.config.hierarchicalContext && !message.importance && this.summarizer.analyzeMessageImportance) {
      try {
        message.importance = await this.summarizer.analyzeMessageImportance(message, contextId);
      } catch (error) {
        console.warn('Failed to analyze message importance:', error);
        message.importance = ContextImportance.MEDIUM; // Default
      }
    }
    
    // Estimate token count
    const tokenCount = this.estimateTokenCount(message);
    
    // Add message and related information
    context.messages.push(message);
    context.tokenCount += tokenCount;
    context.messagesSinceLastSummary += 1;
    
    // Check if summarization is needed if auto-summarize is enabled
    if (this.config.autoSummarize && this.shouldSummarize(context)) {
      await this.summarizeContext(contextId);
    }
    
    // If we have vector and graph repositories enabled, look for semantic similarities
    // and establish relationships
    if (
      this.config.useVectorDb && 
      this.vectorRepository && 
      context.messages.length >= 3 && 
      context.hasSummary
    ) {
      const summary = await this.repository.loadSummary(contextId);
      if (summary) {
        // Add to vector index
        await this.vectorRepository.addSummary(summary);
        
        // Find similar contexts
        const similarContexts = await this.findSimilarContexts(message.content);
        
        // Add relationships for highly similar contexts
        if (this.config.useGraphDb && this.graphRepository && similarContexts.length > 0) {
          for (const similar of similarContexts) {
            if (similar.id !== contextId && similar.score >= this.config.similarityThreshold) {
              await this.addRelationship(
                contextId,
                similar.id,
                ContextRelationshipType.SIMILAR,
                similar.score
              );
            }
          }
        }
      }
    }
    
    // Automatically clean up irrelevant contexts if enabled
    if (this.config.autoCleanupContexts && context.messages.length % 10 === 0) {
      await this.cleanupIrrelevantContexts(contextId);
    }
    
    return context;
  }
  
  /**
   * Find contexts similar to the given text
   * @param text Text to find similar contexts for
   * @param limit Maximum number of results to return
   * @returns Array of similar contexts with scores
   */
  async findSimilarContexts(text: string, limit: number = 5): Promise<SimilarContext[]> {
    if (!this.config.useVectorDb || !this.vectorRepository) {
      return [];
    }
    
    try {
      return await this.vectorRepository.findSimilarContexts(text, limit);
    } catch (error) {
      console.error('Error finding similar contexts:', error);
      return [];
    }
  }
  
  /**
   * Add a relationship between contexts
   * @param sourceId Source context ID
   * @param targetId Target context ID
   * @param type Relationship type
   * @param strength Relationship strength (0-1)
   */
  async addRelationship(
    sourceId: string, 
    targetId: string, 
    type: ContextRelationshipType, 
    strength: number
  ): Promise<void> {
    if (!this.config.useGraphDb || !this.graphRepository) {
      return;
    }
    
    try {
      await this.graphRepository.addRelationship(sourceId, targetId, type, strength, {
        createdAt: new Date().toISOString()
      });
      
      // Update related contexts in the source context
      const sourceContext = await this.getContext(sourceId, false);
      if (sourceContext) {
        if (!sourceContext.relatedContexts) {
          sourceContext.relatedContexts = [];
        }
        
        if (!sourceContext.relatedContexts.includes(targetId)) {
          sourceContext.relatedContexts.push(targetId);
        }
      }
      
      // If it's a parent-child relationship, update hierarchy map
      if (type === ContextRelationshipType.PARENT) {
        let children = this.hierarchyMap.get(sourceId) || [];
        if (!children.includes(targetId)) {
          children.push(targetId);
          this.hierarchyMap.set(sourceId, children);
        }
        
        // Update the child context's parent reference
        const targetContext = await this.getContext(targetId, false);
        if (targetContext) {
          targetContext.parentContextId = sourceId;
        }
      } else if (type === ContextRelationshipType.CHILD) {
        let children = this.hierarchyMap.get(targetId) || [];
        if (!children.includes(sourceId)) {
          children.push(sourceId);
          this.hierarchyMap.set(targetId, children);
        }
        
        // Update the source context's parent reference
        if (sourceContext) {
          sourceContext.parentContextId = targetId;
        }
      }
    } catch (error) {
      console.error(`Error adding relationship from ${sourceId} to ${targetId}:`, error);
    }
  }
  
  /**
   * Find a path between contexts
   * @param sourceId Source context ID
   * @param targetId Target context ID
   * @returns Array of context IDs forming a path
   */
  async findPath(sourceId: string, targetId: string): Promise<string[]> {
    if (!this.config.useGraphDb || !this.graphRepository) {
      return [];
    }
    
    try {
      return await this.graphRepository.findPath(sourceId, targetId);
    } catch (error) {
      console.error(`Error finding path from ${sourceId} to ${targetId}:`, error);
      return [];
    }
  }
  
  /**
   * Get related contexts by relationship type
   * @param contextId Context ID
   * @param type Relationship type
   * @param direction Direction of relationship
   * @returns Array of related context IDs
   */
  async getRelatedContextsByType(
    contextId: string, 
    type: ContextRelationshipType, 
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): Promise<string[]> {
    if (!this.config.useGraphDb || !this.graphRepository) {
      return this.getRelatedContexts(contextId);
    }
    
    try {
      return await this.graphRepository.getRelatedContexts(contextId, type, direction);
    } catch (error) {
      console.error(`Error getting related contexts by type for ${contextId}:`, error);
      return [];
    }
  }
  
  /**
   * Clean up irrelevant contexts
   * @param currentContextId Current context ID to preserve
   * @returns Array of cleaned up context IDs
   */
  async cleanupIrrelevantContexts(currentContextId: string): Promise<string[]> {
    if (!this.config.autoCleanupContexts || !this.config.useVectorDb || !this.vectorRepository) {
      return [];
    }
    
    try {
      // Get current context
      const context = await this.getContext(currentContextId, false);
      if (!context || !context.hasSummary) return [];
      
      // Find contexts that are similar to current context
      const currentSummary = await this.repository.loadSummary(currentContextId);
      if (!currentSummary) return [];
      
      // Find similar contexts
      const similarContexts = await this.findSimilarContexts(currentSummary.summary, 10);
      
      // Get all contexts
      const allContextIds = await this.repository.getAllContextIds();
      
      // Filter out contexts that are:
      // 1. Not the current context
      // 2. Not related to the current context (based on vector similarity)
      // 3. Not part of the current context's hierarchical structure
      const relevantContextIds = new Set<string>([currentContextId]);
      
      // Add similar contexts to relevant set
      similarContexts.forEach(similar => {
        if (similar.score >= 0.3) { // Keep contexts with at least moderate similarity
          relevantContextIds.add(similar.id);
        }
      });
      
      // Add directly related contexts
      const relatedContexts = context.relatedContexts || [];
      relatedContexts.forEach(id => relevantContextIds.add(id));
      
      // Add parent and children in hierarchy
      if (context.parentContextId) {
        relevantContextIds.add(context.parentContextId);
        
        // Add siblings (other children of the same parent)
        const siblings = this.hierarchyMap.get(context.parentContextId) || [];
        siblings.forEach(id => relevantContextIds.add(id));
      }
      
      // Add children
      const children = this.hierarchyMap.get(currentContextId) || [];
      children.forEach(id => relevantContextIds.add(id));
      
      // Identify contexts to clean up
      const contextsToCleanup = allContextIds.filter(id => !relevantContextIds.has(id));
      
      // Perform cleanup
      const cleanedContexts: string[] = [];
      for (const id of contextsToCleanup) {
        // Remove from vector repository
        if (this.vectorRepository) {
          await this.vectorRepository.deleteContext(id);
        }
        
        // Remove from graph repository
        if (this.config.useGraphDb && this.graphRepository) {
          await this.graphRepository.removeContext(id);
        }
        
        // Remove from hierarchy map
        this.hierarchyMap.delete(id);
        
        // Remove from contexts map
        this.contexts.delete(id);
        
        cleanedContexts.push(id);
      }
      
      return cleanedContexts;
    } catch (error) {
      console.error(`Error cleaning up irrelevant contexts:`, error);
      return [];
    }
  }
  
  /**
   * Check if summarization is needed
   * @param context Context data
   * @returns Whether summarization is needed
   */
  private shouldSummarize(context: ContextData): boolean {
    // Check for high importance messages
    const highImportanceMessages = context.messages.filter(m => 
      m.importance === ContextImportance.HIGH || 
      m.importance === ContextImportance.CRITICAL
    );
    
    // If we have multiple critical messages, prioritize summarizing
    if (highImportanceMessages.length >= 2) {
      return true;
    }
    
    // Based on message count
    if (context.messagesSinceLastSummary >= this.config.messageLimitThreshold) {
      return true;
    }
    
    // Based on token limit (approximate implementation)
    const tokenLimit = 4096; // Typical model limit
    const thresholdTokens = tokenLimit * (this.config.tokenLimitPercentage / 100);
    
    return context.tokenCount >= thresholdTokens;
  }
  
  /**
   * Summarize context
   * @param contextId Context ID
   * @returns Whether summarization was successful
   */
  async summarizeContext(contextId: string): Promise<boolean> {
    const context = await this.getContext(contextId, false);
    if (!context || context.messages.length === 0) {
      return false;
    }
    
    // Generate summary
    const result = await this.summarizer.summarize(context.messages, contextId);
    
    if (result.success && result.summary) {
      // Save summary
      await this.repository.saveSummary(result.summary);
      
      // Add to vector repository if enabled
      if (this.config.useVectorDb && this.vectorRepository) {
        await this.vectorRepository.addSummary(result.summary);
      }
      
      // Update context data
      context.hasSummary = true;
      context.messagesSinceLastSummary = 0;
      context.lastSummarizedAt = Date.now();
      
      // Update importance score if available
      if (result.summary.importanceScore !== undefined) {
        context.importanceScore = result.summary.importanceScore;
      }
      
      // Update related contexts if available
      if (result.summary.relatedContexts) {
        context.relatedContexts = result.summary.relatedContexts;
      }
      
      // Commit to Git repository
      if (this.config.useGit) {
        await this.repository.commit(`Summarize context: ${contextId}`);
      }
      
      // If hierarchical context is enabled and parent exists, update hierarchical summary
      if (this.config.hierarchicalContext && context.parentContextId) {
        await this.updateHierarchicalSummary(context.parentContextId);
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Update hierarchical summary
   * @param parentId Parent context ID
   */
  private async updateHierarchicalSummary(parentId: string): Promise<void> {
    if (!this.config.hierarchicalContext || !this.summarizer.createHierarchicalSummary) return;
    
    try {
      // Get child contexts
      const childContextIds = this.hierarchyMap.get(parentId) || [];
      
      if (childContextIds.length === 0) {
        return;
      }
      
      // Load summaries for all children
      const summaries: ContextSummary[] = [];
      
      for (const childId of childContextIds) {
        const summary = await this.repository.loadSummary(childId);
        if (summary) {
          summaries.push(summary);
        }
      }
      
      if (summaries.length === 0) {
        return;
      }
      
      // Create updated hierarchical summary
      const hierarchicalSummary = await this.summarizer.createHierarchicalSummary(summaries, parentId);
      
      if (hierarchicalSummary) {
        await this.repository.saveHierarchicalSummary(hierarchicalSummary);
        
        // Check if we need to create/update a meta-summary
        await this.checkForMetaSummary();
      }
    } catch (error) {
      console.error(`Error updating hierarchical summary for ${parentId}:`, error);
    }
  }
  
  /**
   * Check if a meta-summary should be created
   */
  private async checkForMetaSummary(): Promise<void> {
    if (!this.config.hierarchicalContext || !this.summarizer.createMetaSummary) return;
    
    try {
      // Get all hierarchical summaries
      const hierarchicalIds = await this.repository.getAllHierarchicalContextIds();
      
      // If we have enough hierarchical summaries, create a meta-summary
      if (hierarchicalIds.length >= this.config.metaSummaryThreshold) {
        const metaId = `meta_${Date.now()}`;
        const metaSummary = await this.summarizer.createMetaSummary(hierarchicalIds);
        
        if (metaSummary) {
          // Ensure the metaSummary has the generated ID if it doesn't have one
          if (!metaSummary.id) {
            metaSummary.id = metaId;
          }
          await this.repository.saveMetaSummary(metaSummary);
        }
      }
    } catch (error) {
      console.error('Error creating meta-summary:', error);
    }
  }
  
  /**
   * Load saved summary
   * @param contextId Context ID
   * @returns Summary object or undefined
   */
  async loadSummary(contextId: string): Promise<ContextSummary | undefined> {
    return this.repository.loadSummary(contextId);
  }
  
  /**
   * Load hierarchical summary
   * @param contextId Context ID
   * @returns Hierarchical summary or undefined
   */
  async loadHierarchicalSummary(contextId: string): Promise<HierarchicalSummary | undefined> {
    if (!this.config.hierarchicalContext) return undefined;
    return this.repository.loadHierarchicalSummary(contextId);
  }
  
  /**
   * Load meta-summary
   * @param id Meta-summary ID
   * @returns Meta-summary or undefined
   */
  async loadMetaSummary(id: string): Promise<MetaSummary | undefined> {
    if (!this.config.hierarchicalContext) return undefined;
    return this.repository.loadMetaSummary(id);
  }
  
  /**
   * Get all meta-summary IDs
   * @returns Array of meta-summary IDs
   */
  async getMetaSummaryIds(): Promise<string[]> {
    if (!this.config.hierarchicalContext) return [];
    return this.repository.getAllMetaSummaryIds();
  }
  
  /**
   * Get all context IDs
   * @returns Array of context IDs
   */
  async getAllContextIds(): Promise<string[]> {
    return this.repository.getAllContextIds();
  }
  
  /**
   * Get all hierarchical context IDs
   * @returns Array of hierarchical context IDs
   */
  async getAllHierarchicalContextIds(): Promise<string[]> {
    if (!this.config.hierarchicalContext) return [];
    return this.repository.getAllHierarchicalContextIds();
  }
  
  /**
   * Get context messages
   * @param contextId Context ID
   * @returns Array of messages or undefined
   */
  async getMessages(contextId: string): Promise<Message[] | undefined> {
    const context = await this.getContext(contextId, false);
    return context?.messages;
  }
  
  /**
   * Get related contexts
   * @param contextId Context ID
   * @returns Array of related context IDs
   */
  async getRelatedContexts(contextId: string): Promise<string[]> {
    if (!this.config.hierarchicalContext) return [];
    
    const context = await this.getContext(contextId, false);
    return context?.relatedContexts || [];
  }
  
  /**
   * Get hierarchical structure
   * @param contextId Context ID
   * @returns Object with parent and children IDs
   */
  async getHierarchicalStructure(contextId: string): Promise<{ parent?: string, children: string[] }> {
    if (!this.config.hierarchicalContext) {
      return { children: [] };
    }
    
    const context = await this.getContext(contextId, false);
    const parent = context?.parentContextId;
    const children = this.hierarchyMap.get(contextId) || [];
    
    return { parent, children };
  }
  
  /**
   * Summarize all contexts
   * @returns Number of successful summarizations
   */
  async summarizeAllContexts(): Promise<number> {
    let successCount = 0;
    
    for (const contextId of this.contexts.keys()) {
      const success = await this.summarizeContext(contextId);
      if (success) {
        successCount++;
      }
    }
    
    // If hierarchical context is enabled, update hierarchical summaries
    if (this.config.hierarchicalContext && this.summarizer.createHierarchicalSummary) {
      for (const parentId of this.hierarchyMap.keys()) {
        await this.updateHierarchicalSummary(parentId);
      }
      
      // Check if we need to create a meta-summary
      await this.checkForMetaSummary();
    }
    
    return successCount;
  }
  
  /**
   * Set summarizer service
   * @param summarizer New summarizer service
   */
  setSummarizer(summarizer: SummarizerService): void {
    this.summarizer = summarizer;
  }
  
  /**
   * Update MCP configuration
   * @param config New configuration object
   */
  updateConfig(config: Partial<MCPConfig>): void {
    const previousConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    this.repository = new FileSystemRepository(this.config);
    
    // Check if vector or graph repositories need to be initialized
    if ((!previousConfig.useVectorDb && this.config.useVectorDb) ||
        (!previousConfig.useGraphDb && this.config.useGraphDb)) {
      this.initRepositories();
    }
    
    // If hierarchical context was enabled, load hierarchical structures
    if (config.hierarchicalContext && !previousConfig.hierarchicalContext) {
      this.loadHierarchicalStructures();
    }
  }
  
  /**
   * Get current MCP configuration
   * @returns Current configuration
   */
  getConfig(): MCPConfig {
    return { ...this.config };
  }
} 