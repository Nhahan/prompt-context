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
      if (this.config.useVectorDb) {
        this.vectorRepository = await createVectorRepository(this.config.contextDir);
        console.error('Vector repository initialized'); // Log to stderr
      }
      
      if (this.config.useGraphDb) {
        this.graphRepository = await createGraphRepository(this.config.contextDir);
        console.error('Graph repository initialized'); // Log to stderr
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
    try {
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
      
      // Auto-summarize check
      if (this.config.autoSummarize && this.shouldSummarize(context)) {
        try {
          await this.summarizeContext(contextId);
        } catch (error) {
          console.error(`Failed to auto-summarize context ${contextId}:`, error);
        }
      }
      
      // Vector/Graph integration
      if (
        this.config.useVectorDb && 
        this.vectorRepository && 
        context.messages.length >= 3 // Only after a few messages
      ) {
        try {
           let summary = await this.repository.loadSummary(contextId);
           if (!summary && context.messages.length > 0) { 
              console.error(`Attempting to generate summary for ${contextId} before vector operations.`);
              await this.summarizeContext(contextId); 
              summary = await this.repository.loadSummary(contextId);
           }

          if (summary) {
            await this.vectorRepository.addSummary(summary); 
            
            // Find contexts similar to the *new message content*
            const similarContexts = await this.vectorRepository.findSimilarContexts(message.content, 5); 
            
            if (this.config.useGraphDb && this.graphRepository) {
              for (const similar of similarContexts) {
                if (similar.contextId !== contextId && similar.similarity > this.config.similarityThreshold) { 
                   console.error(`Adding SIMILAR relationship: ${contextId} -> ${similar.contextId} (Score: ${similar.similarity})`);
                   await this.addRelationship(
                     contextId, 
                     similar.contextId, 
                     ContextRelationshipType.SIMILAR, 
                     similar.similarity
                   );
                }
              }
            }
          } else {
              console.error(`Summary for ${contextId} still not available after generation attempt.`);
          }
        } catch (vectorOrGraphError) {
          console.error(`Error during vector/graph processing for context ${contextId}:`, vectorOrGraphError);
        }
      }
      
      return context;
    } catch (error) {
      console.error(`Error adding message to context ${contextId}:`, error);
      throw error;
    }
  }
  
  /**
   * Find contexts similar to the given text
   * @param text Text to find similar contexts for
   * @param limit Maximum number of results to return
   * @returns Array of similar contexts with scores
   */
  async findSimilarContexts(text: string, limit: number = 5): Promise<SimilarContext[]> {
    if (!this.config.useVectorDb || !this.vectorRepository) {
      console.warn("Vector DB is not enabled or initialized. Cannot find similar contexts.");
      return [];
    }
    try {
      const results = await this.vectorRepository.findSimilarContexts(text, limit);
      return results; 
    } catch (error) {
      console.error(`Error finding similar contexts for query "${text}":`, error);
      return [];
    }
  }
  
  /**
   * Add a relationship between contexts
   * @param sourceContextId Source context ID
   * @param targetContextId Target context ID
   * @param type Relationship type
   * @param weight Relationship strength (0-1)
   */
  async addRelationship(
    sourceContextId: string, 
    targetContextId: string, 
    type: ContextRelationshipType, 
    weight: number,
    metadata?: any 
  ): Promise<void> {
      if (!this.config.useGraphDb || !this.graphRepository) {
          console.warn("Graph DB is not enabled or initialized. Cannot add relationship.");
          return;
      }
      try {
          await this.graphRepository.addRelationship(sourceContextId, targetContextId, type, weight, metadata);
          console.error(`Added relationship ${sourceContextId} -> ${targetContextId} (${type})`);

          const sourceContext = this.contexts.get(sourceContextId);
           if (sourceContext) {
               // Initialize relatedContexts if it doesn't exist or is undefined
               if (!Array.isArray(sourceContext.relatedContexts)) {
                   sourceContext.relatedContexts = [];
               }
               // Add target if not already present
               if (!sourceContext.relatedContexts.includes(targetContextId)) {
                  sourceContext.relatedContexts.push(targetContextId);
               }
           }
      } catch (error) {
           console.error(`Error adding relationship ${sourceContextId} -> ${targetContextId}:`, error);
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
      // Validate inputs
      if (!sourceId || !targetId) {
        throw new Error('Source and target IDs must be provided');
      }
      
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
      // Validate inputs
      if (!contextId) {
        throw new Error('Context ID must be provided');
      }
      
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
      // Get all context IDs
      const allContextIds = await this.getAllContextIds();
      if (allContextIds.length <= 10) {
        // Don't clean up if there are only a few contexts
        return [];
      }
      
      console.log(`Starting context cleanup process for ${currentContextId}. ${allContextIds.length} total contexts found.`);
      
      // Get summary for current context
      const currentSummary = await this.repository.loadSummary(currentContextId);
      if (!currentSummary) {
        console.warn(`No summary found for current context ${currentContextId}, skipping cleanup`);
        return [];
      }
      
      // 1. 관련 컨텍스트 식별
      // Create a set of relevant context IDs with preservation reasons
      const relevantContexts = new Map<string, {
        reason: string, 
        importance: number
      }>();
      
      // 현재 컨텍스트는 무조건 보존
      relevantContexts.set(currentContextId, {
        reason: 'current context',
        importance: 1.0
      });
      
      // 2. 유사한 컨텍스트 보존 (벡터 유사도 기반)
      // Find similar contexts
      const similarContexts = await this.findSimilarContexts(currentSummary.summary, 20);
      
      // Add similar contexts with their similarity as importance
      for (const similar of similarContexts) {
        if (similar.similarity >= this.config.similarityThreshold * 0.5) { // 임계값의 절반 이상이면 유지
          relevantContexts.set(similar.contextId, {
            reason: 'semantic similarity',
            importance: similar.similarity
          });
        }
      }
      
      // 3. 직접 관련된 컨텍스트 보존 (그래프 관계 기반)
      if (this.config.useGraphDb && this.graphRepository) {
        const relatedContexts = await this.getRelatedContexts(currentContextId);
        
        for (const id of relatedContexts) {
          // 이미 포함된 컨텍스트의 중요도 증가
          if (relevantContexts.has(id)) {
            const existingEntry = relevantContexts.get(id);
            if (existingEntry) {
              existingEntry.importance = Math.min(1.0, existingEntry.importance + 0.2);
              existingEntry.reason += ', explicit relationship';
            }
          } else {
            relevantContexts.set(id, {
              reason: 'explicit relationship',
              importance: 0.7 // 직접 관계는 중요도 0.7 기본값
            });
          }
        }
        
        // 추가: 양방향 관계 고려 (현재 컨텍스트를 참조하는 컨텍스트도 보존)
        // 각 관계 타입에 대해 개별적으로 조회하여 결과 합치기
        const incomingContextIds = new Set<string>();
        
        // 모든 관계 타입에 대해 조회
        const relationshipTypes = [
          ContextRelationshipType.SIMILAR,
          ContextRelationshipType.CONTINUES,
          ContextRelationshipType.REFERENCES,
          ContextRelationshipType.PARENT,
          ContextRelationshipType.CHILD
        ];
        
        for (const relType of relationshipTypes) {
          const contexts = await this.graphRepository.getRelatedContexts(
            currentContextId,
            relType,
            'incoming'
          );
          
          for (const id of contexts) {
            incomingContextIds.add(id);
          }
        }
        
        // 결과 처리
        for (const id of incomingContextIds) {
          if (relevantContexts.has(id)) {
            const existingEntry = relevantContexts.get(id);
            if (existingEntry) {
              existingEntry.importance = Math.min(1.0, existingEntry.importance + 0.2);
              existingEntry.reason += ', references current';
            }
          } else {
            relevantContexts.set(id, {
              reason: 'references current context',
              importance: 0.6
            });
          }
        }
      }
      
      // 4. 계층 구조 보존
      if (this.config.hierarchicalContext) {
        // Add parent context
        const parentId = await this.getParentContextId(currentContextId);
        if (parentId) {
          relevantContexts.set(parentId, {
            reason: 'parent context',
            importance: 0.8
          });
          
          // Add siblings (other children of the same parent)
          const siblings = this.hierarchyMap.get(parentId) || [];
          for (const siblingId of siblings) {
            if (!relevantContexts.has(siblingId)) {
              relevantContexts.set(siblingId, {
                reason: 'sibling context',
                importance: 0.5
              });
            }
          }
        }
        
        // Add child contexts
        const childIds = this.hierarchyMap.get(currentContextId) || [];
        for (const childId of childIds) {
          relevantContexts.set(childId, {
            reason: 'child context',
            importance: 0.7
          });
        }
      }
      
      // 5. 중요도 기반 보존
      // 각 컨텍스트의 중요도 점수를 기반으로 추가 보존
      for (const contextId of allContextIds) {
        if (relevantContexts.has(contextId)) continue; // 이미 처리된 컨텍스트는 건너뜀
        
        const summary = await this.repository.loadSummary(contextId);
        if (summary && summary.importanceScore && summary.importanceScore >= 0.8) {
          // 높은 중요도 점수를 가진 컨텍스트는 보존
          relevantContexts.set(contextId, {
            reason: 'high importance score',
            importance: summary.importanceScore
          });
        }
      }
      
      // 6. 최근 액세스된 컨텍스트 보존
      const recentThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7일 이내
      for (const contextId of allContextIds) {
        if (relevantContexts.has(contextId)) continue; // 이미 처리된 컨텍스트는 건너뜀
        
        const context = await this.getContext(contextId, false);
        const summary = await this.repository.loadSummary(contextId);
        
        // 최근에 업데이트된 요약이나 메시지가 있는 컨텍스트는 보존
        if (
          (summary && summary.lastUpdated > recentThreshold) || 
          (context && context.lastSummarizedAt && context.lastSummarizedAt > recentThreshold)
        ) {
          relevantContexts.set(contextId, {
            reason: 'recently active',
            importance: 0.6
          });
        }
      }
      
      // 7. 정리 대상 식별
      const relevantContextIds = new Set(relevantContexts.keys());
      const contextsToCleanup = allContextIds.filter(id => !relevantContextIds.has(id));
      
      console.log(`Found ${relevantContextIds.size} relevant contexts to preserve and ${contextsToCleanup.length} candidates for cleanup`);
      
      // 8. 실제 정리 수행
      const cleanedContexts: string[] = [];
      for (const id of contextsToCleanup) {
        try {
          console.log(`Cleaning up context: ${id}`);
          
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
          
          // Delete summary from repository
          await this.repository.deleteSummary(id);
          
          cleanedContexts.push(id);
        } catch (cleanupError) {
          console.error(`Error cleaning up context ${id}:`, cleanupError);
        }
      }
      
      console.log(`Successfully cleaned up ${cleanedContexts.length} irrelevant contexts`);
      return cleanedContexts;
    } catch (error) {
      console.error(`Error cleaning up irrelevant contexts:`, error);
      return [];
    }
  }
  
  /**
   * Helper method to get parent context ID
   * @param contextId Context ID
   * @returns Parent context ID or undefined
   */
  private async getParentContextId(contextId: string): Promise<string | undefined> {
    try {
      const context = await this.getContext(contextId, false);
      if (context && context.parentContextId) {
        return context.parentContextId;
      }
      
      // 백업: 계층적 요약에서 부모 ID 가져오기
      const hierarchicalSummary = await this.repository.loadHierarchicalSummary(contextId);
      if (hierarchicalSummary && hierarchicalSummary.parentContextId) {
        return hierarchicalSummary.parentContextId;
      }
      
      // 백업: 그래프 관계에서 부모 ID 가져오기
      if (this.config.useGraphDb && this.graphRepository) {
        const parents = await this.graphRepository.getRelatedContexts(
          contextId,
          ContextRelationshipType.PARENT,
          'outgoing'
        );
        
        if (parents.length > 0) {
          return parents[0]; // 첫 번째 부모 반환
        }
      }
      
      return undefined;
    } catch (error) {
      console.error(`Error getting parent context ID for ${contextId}:`, error);
      return undefined;
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
      console.error(`Context ${contextId} not found or has no messages to summarize.`);
      return false;
    }
    
    try {
      // Expect SummarizerService to return SummaryResult object
      // Assuming SummaryResult has { success: boolean, summary?: ContextSummary }
      const result = await this.summarizer.summarize(context.messages, contextId);

      if (result && result.success && result.summary) { 
        const summaryText = result.summary.summary;
        if (!summaryText) {
             console.error(`Summarization result object exists but summary text is empty for context ${contextId}`);
             return false;
        }
        const returnedSummary = result.summary;

        // Construct the final summary object, without tokenCount
        const summary: ContextSummary = {
            contextId,
            summary: summaryText,
            lastUpdated: returnedSummary.lastUpdated || Date.now(), 
            messageCount: returnedSummary.messageCount || context.messages.length, 
            codeBlocks: returnedSummary.codeBlocks || [], 
            keyInsights: returnedSummary.keyInsights || [], 
            version: (returnedSummary.version || 0) + 1, 
            relatedContexts: returnedSummary.relatedContexts || context.relatedContexts || [], 
            importanceScore: returnedSummary.importanceScore || context.importanceScore 
        };

        if (this.config.useVectorDb && this.vectorRepository) {
           try {
               await this.vectorRepository.addSummary(summary);
               console.error(`Added/Updated summary for ${contextId} in vector index.`);
           } catch (vectorError) {
               console.error(`Failed to add summary ${contextId} to vector index:`, vectorError);
           }
        }

        await this.repository.saveSummary(summary); 
        context.hasSummary = true;
        context.messagesSinceLastSummary = 0;
        context.lastSummarizedAt = summary.lastUpdated;
        context.importanceScore = summary.importanceScore;
        context.relatedContexts = summary.relatedContexts || []; 

        console.error(`Successfully summarized context ${contextId}`);
        return true;
      } else {
        // Log the actual result if summarization failed
        console.error(`Summarization failed or returned empty for context ${contextId}. Result: ${JSON.stringify(result)}`);
        return false;
      }
    } catch (error) {
      console.error(`Error summarizing context ${contextId}:`, error);
      return false; 
    }
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