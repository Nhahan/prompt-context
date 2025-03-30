import fs from 'fs-extra';
import path from 'path';
import { ContextSummary, SimilarContext } from './types';
import { ApiAnalytics, ApiCallType, apiAnalytics } from './analytics';

// 타입 정의를 실제 라이브러리 구조에 맞게 조정
type FeatureExtractionPipeline = {
  (text: string, options?: { pooling?: string; normalize?: boolean }): Promise<{ data: Float32Array }>;
};

// 동적 임포트를 위한 인터페이스 - 라이브러리의 실제 타입에 맞게 조정
type HNSWIndex = {
  initIndex(maxElements: number): void;
  readIndex(filename: string, allowReplaceDeleted?: boolean): Promise<boolean> | void;
  writeIndex(filename: string): void;
  addPoint(point: Float32Array | number[], label: number): void;
  markDelete(label: number): void;
  searchKnn(query: Float32Array | number[], k: number): {
    neighbors: number[];
    distances: number[];
  };
};

// Type definitions adjusted to match the actual library structure
export interface HNSWLib {
  HierarchicalNSW: new (space: string, dim: number) => HierarchicalNSWIndex;
}

// Define the correct interface based on library expectations
export interface HierarchicalNSWIndex {
  initIndex(maxElements: number, M?: number, efConstruction?: number, randomSeed?: number, allowReplaceDeleted?: boolean): void;
  resizeIndex(newSize: number): void;
  addPoint(point: Float32Array, idx: number, replaceDeleted?: boolean): void; // Expect Float32Array
  markDelete(idx: number): void;
  getIdsList(): number[]; 
  searchKnn(query: Float32Array, k: number, filter?: ((label: number) => boolean) | number[]): { distances: number[]; neighbors: number[] }; // Expect Float32Array
  setEf(ef: number): void;
  saveIndex(path: string): void;
  loadIndex(path: string, maxElements?: number, allowReplaceDeleted?: boolean): void;
  getMaxElements(): number;
  getCurrentCount(): number;
}

/**
 * Interface for handling interactions with the vector database
 */
export interface VectorRepositoryInterface {
  /**
   * Add or update a summary in the vector index
   * @param summary Summary to add or update
   */
  addSummary(summary: ContextSummary): Promise<void>;
  
  /**
   * Find contexts similar to the given text
   * @param text Text to find similar contexts for
   * @param limit Maximum number of results to return
   * @returns Array of context IDs with similarity scores
   */
  findSimilarContexts(text: string, limit?: number): Promise<SimilarContext[]>;
  
  /**
   * Delete a context from the vector index
   * @param contextId Context ID to delete
   */
  deleteContext(contextId: string): Promise<void>;
  
  /**
   * Check if a context exists in the vector index
   * @param contextId Context ID to check
   */
  hasContext(contextId: string): Promise<boolean>;
}

/**
 * Vector repository for semantic similarity search using HNSWLib
 * Handles embedding generation and vector search
 */
export class VectorRepository implements VectorRepositoryInterface {
  private contextDir: string;
  private dimensions: number;
  private embeddingModel: FeatureExtractionPipeline | null = null;
  private vectorIndex: HierarchicalNSWIndex | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private contextMap: Map<string, number> = new Map(); // Maps contextId to vector index
  private nextIndex: number = 0;
  private fallbackMode: boolean = false;
  private fallbackStorage: Map<string, ContextSummary> = new Map(); // 폴백 저장소
  private contextIdToIndex: Map<string, number> = new Map(); // 컨텍스트 ID에서 인덱스로의 매핑
  private indexToContextId: Map<number, string> = new Map(); // 인덱스에서 컨텍스트 ID로의 매핑
  private contextToEmbedding: Map<string, Float32Array | null> = new Map(); // 컨텍스트 ID에서 임베딩으로의 매핑
  
  /**
   * Constructor
   * @param contextDir Directory to store vector data
   * @param dimensions Embedding dimensions (default: 384 for MiniLM models)
   */
  constructor(contextDir: string, dimensions: number = 384) {
    this.contextDir = contextDir;
    this.dimensions = dimensions;
    
    // Start initialization
    this.initPromise = this.init().catch(error => {
      console.error('Failed to initialize vector repository, falling back to basic mode:', error);
      this.fallbackMode = true;
    });
  }
  
  /**
   * Initialize the vector repository
   * Load model and vector index
   */
  private async init(): Promise<void> {
    if (this.initialized) return;
    // If fallback mode was somehow set before init, respect it
    if (this.fallbackMode) return; 

    try {
      const vectorDir = path.join(this.contextDir, 'vectors');
      await fs.ensureDir(vectorDir);

      if (process.env.NODE_ENV === 'test') {
        console.error('Test environment detected, using fallback mode for vector repository');
        this.fallbackMode = true;
        this.initialized = true; // Mark as initialized in test fallback mode
        return;
      }

      // Import dependencies dynamically
      try {
        const hnswlib = await import('hnswlib-node');
        this.vectorIndex = new hnswlib.HierarchicalNSW('cosine', this.dimensions) as unknown as HierarchicalNSWIndex;
        
        const indexPath = path.join(vectorDir, 'vector-index.bin');
        const mapPath = path.join(vectorDir, 'context-map.json');

        if (await fs.pathExists(indexPath) && await fs.pathExists(mapPath)) {
          try {
            const contextMapData = await fs.readJson(mapPath);
            this.contextMap = new Map(Object.entries(contextMapData));
            const indices = Array.from(this.contextMap.values());
            this.nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 0;
             // Populate index<->contextId maps from loaded data
            this.contextMap.forEach((index, contextId) => {
                this.contextIdToIndex.set(contextId, index);
                this.indexToContextId.set(index, contextId);
            });
            this.vectorIndex.loadIndex(indexPath, this.contextIdToIndex.size, false);
            console.error(`Loaded vector index with ${this.vectorIndex.getCurrentCount()} elements (max: ${this.vectorIndex.getMaxElements()}). Next label: ${this.nextIndex}`);
          } catch (loadError) {
            console.error('Error loading vector index/map, creating a new one:', loadError);
            await this.createNewIndex(vectorDir); 
          }
        } else {
          await this.createNewIndex(vectorDir); 
        }
      } catch (hnswError) {
        console.error('Error initializing HNSW library:', hnswError);
        this.fallbackMode = true;
        // Re-add the throw statement
        throw hnswError; 
      }

      // Load embedding model
      try {
        const { pipeline } = await import('@xenova/transformers');
        this.embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as FeatureExtractionPipeline;
      } catch (modelError) {
        console.error('Error loading embedding model:', modelError);
        this.fallbackMode = true; 
        console.warn('Switching to fallback mode due to embedding model loading failure');
        // Original code did not throw here, keep it that way
      }
      
      // Mark as initialized only if no error was thrown before this point
      this.initialized = true; 
      console.error('Vector repository initialization attempt finished.'); // Log completion

    } catch (error) {
      // This catch block handles the thrown hnswError or other unexpected errors
      this.initialized = false;
      this.fallbackMode = true;
      console.error('Vector repository initialization failed:', error);
      // Re-add the throw statement as per original logic before the optionalDeps change
      throw error; 
    }
  }
  
  /**
   * Create a new vector index
   */
  private async createNewIndex(vectorDir: string): Promise<void> {
    // Reset context map and index
    this.contextMap = new Map();
    this.nextIndex = 0;
    
    try {
      if (!this.vectorIndex) {
        console.warn('Vector index is not initialized, switching to fallback mode');
        this.fallbackMode = true;
        return;
      }
      
      // Initialize with default capacity
      console.error('Initializing vector index with default capacity (1000)');
      
      try {
        // 다양한 hnswlib-node 버전 호환성을 위한 처리
        if (typeof this.vectorIndex.initIndex === 'function') {
          this.vectorIndex.initIndex(1000);
        } else if (typeof (this.vectorIndex as any).init === 'function') {
          (this.vectorIndex as any).init(1000);
        } else if (typeof (this.vectorIndex as any).constructor.init === 'function') {
          (this.vectorIndex as any).constructor.init(1000);
        } else {
          // 마지막 시도: HierarchicalNSW 인터페이스의 initIndex 시도
          try {
            (this.vectorIndex as unknown as HierarchicalNSWIndex).initIndex(1000, 16, 200);
          } catch (initIndexError) {
            console.error('Failed all attempts to initialize vector index:', initIndexError);
            this.fallbackMode = true;
            return;
          }
        }
        console.error('Created new vector index');
      } catch (initError) {
        console.error('Failed to initialize vector index:', initError);
        this.fallbackMode = true;
        return;
      }
    } catch (error) {
      console.error('Error creating new index:', error);
      this.fallbackMode = true;
      // 에러 발생 시 폴백 모드로 전환하고 에러를 다시 던지지 않음
      return;
    }
  }
  
  /**
   * Ensure the repository is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    // 이미 초기화가 진행 중이면 완료될 때까지 대기
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (error) {
        console.error('Initialization failed, switching to fallback mode:', error);
        this.fallbackMode = true;
      }
    }
    
    // 아직 초기화되지 않았고 폴백 모드가 아니면 초기화 시도
    if (!this.initialized && !this.fallbackMode) {
      try {
        this.initPromise = this.init();
        await this.initPromise;
      } catch (error) {
        console.error('Failed to initialize vector repository:', error);
        this.fallbackMode = true;
      }
    }
    
    // 폴백 모드일 경우 경고 로그 출력
    if (this.fallbackMode) {
      // 디버깅을 위해 로그 레벨 조정 (콘솔에 너무 많은 경고 출력 방지)
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Vector repository is in fallback mode, some operations may not work as expected');
      }
    }
  }
  
  /**
   * Save the current vector index and context map
   */
  private async saveIndexAndMap(vectorDir?: string): Promise<void> {
    if (this.fallbackMode || !this.initialized || !this.vectorIndex) {
      console.warn('Cannot save index: repository not properly initialized');
      return;
    }
    
    const dir = vectorDir || path.join(this.contextDir, 'vectors');
    try {
      await fs.ensureDir(dir);
      const indexPath = path.join(dir, 'vector-index.bin');
      const mapPath = path.join(dir, 'context-map.json');

      // 1. Use saveIndex instead of writeIndex
      this.vectorIndex.saveIndex(indexPath);

      // 2. Save mapping data
      const contextMapData = { /* ... map data ... */ };
      await fs.writeJson(mapPath, contextMapData, { spaces: 2 });

    } catch (error) {
      console.error('Error saving vector index and map:', error);
    }
  }
  
  /**
   * Generate embedding vector for text
   * @param text Text to generate embedding for
   * @returns Embedding vector or null if in fallback mode
   */
  private async generateEmbedding(text: string): Promise<Float32Array | null> {
    await this.ensureInitialized();
    
    if (this.fallbackMode || !this.embeddingModel) {
      return null;
    }
    
    try {
      // Truncate text if too long (most models have token limits)
      const truncatedText = text.length > 8192 ? text.substring(0, 8192) : text;
      
      // Generate embedding
      const result = await this.embeddingModel(truncatedText, {
        pooling: 'mean',
        normalize: true
      });
      
      return result.data;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }
  
  /**
   * Save fallback storage data
   * @returns Promise resolving to boolean indicating success
   */
  private async saveFallbackStorage(): Promise<boolean> {
    if (!this.fallbackMode) return true;
    
    try {
      const vectorDir = path.join(this.contextDir, 'vectors');
      await fs.ensureDir(vectorDir);
      
      const fallbackPath = path.join(vectorDir, 'fallback-storage.json');
      
      const fallbackObject = Array.from(this.fallbackStorage.entries()).reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {} as Record<string, ContextSummary>);
      
      await fs.writeJson(fallbackPath, fallbackObject, { spaces: 2 });
      return true;
    } catch (error) {
      console.error('Error saving fallback storage:', error);
      // 저장 실패 시 최대 3번까지 재시도
      for (let i = 0; i < 3; i++) {
        try {
          console.log(`Retrying fallback storage save (attempt ${i + 1}/3)...`);
          const vectorDir = path.join(this.contextDir, 'vectors');
          await fs.ensureDir(vectorDir);
          
          const fallbackPath = path.join(vectorDir, 'fallback-storage.json');
          
          const fallbackObject = Array.from(this.fallbackStorage.entries()).reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
          }, {} as Record<string, ContextSummary>);
          
          await fs.writeJson(fallbackPath, fallbackObject, { spaces: 2 });
          return true;
        } catch (retryError) {
          console.error(`Retry ${i + 1} failed:`, retryError);
          // 짧은 대기 후 재시도
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      return false;
    }
  }
  
  /**
   * Get the next available index
   */
  private getCurrentIndex(): number {
    let nextIdx = this.nextIndex;
    this.nextIndex++;
    return nextIdx;
  }
  
  /**
   * Save the vector index and associated maps
   */
  private async saveVectorIndex(): Promise<void> {
    return this.saveIndexAndMap();
  }
  
  /**
   * Find contexts similar to text using basic keyword matching
   * @param text Text to find similar contexts for
   * @param limit Maximum number of results to return
   */
  private findSimilarContextsWithKeywords(text: string, limit: number = 5): SimilarContext[] {
    if (!this.fallbackMode || this.fallbackStorage.size === 0) return [];
    
    // 간단한 유사도 측정: 단어 빈도
    const queryWords = new Set(text.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    
    const similarities: SimilarContext[] = [];
    
    for (const [contextId, summary] of this.fallbackStorage.entries()) {
      const summaryWords = new Set(summary.summary.toLowerCase().split(/\W+/).filter(w => w.length > 2));
      
      // 자카드 유사도 계산
      const intersection = new Set([...queryWords].filter(word => summaryWords.has(word)));
      const union = new Set([...queryWords, ...summaryWords]);
      
      const similarity = intersection.size / union.size;
      
      if (similarity > 0) {
        similarities.push({
          contextId,
          similarity
        });
      }
    }
    
    // 유사도로 정렬하고 제한
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  
  /**
   * Add or update a summary in the vector index
   * @param summary Summary to add or update
   */
  public async addSummary(summary: ContextSummary): Promise<void> {
    await this.ensureInitialized();

    if (this.fallbackMode) {
      this.fallbackStorage.set(summary.contextId, summary);
      await this.saveFallbackStorage();
      return;
    }
    
    if (!this.vectorIndex || !this.embeddingModel) {
      console.error('Vector index or embedding model not initialized, cannot add summary.');
      return;
    }

    try {
      // Extract the summary TEXT from the input object
      const textToEmbed = summary.summary; 
      if (!textToEmbed) {
          console.error(`Summary text is missing for context ${summary.contextId}, cannot generate embedding.`);
          return;
      }
      
      // Generate embedding from the extracted text
      const embedding = await this.generateEmbedding(textToEmbed);
      if (!embedding) {
          console.error(`Failed to generate embedding for context ${summary.contextId}, cannot add to index.`);
          return;
      }
      const hnswIndex = this.vectorIndex as HierarchicalNSWIndex;
      let labelToAdd = this.contextIdToIndex.get(summary.contextId);

      if (labelToAdd === undefined) {
          labelToAdd = this.nextIndex++;
          this.contextIdToIndex.set(summary.contextId, labelToAdd);
          this.indexToContextId.set(labelToAdd, summary.contextId);
          
          if (hnswIndex.getCurrentCount() >= hnswIndex.getMaxElements()) {
              const newSize = Math.max(hnswIndex.getMaxElements() * 2, hnswIndex.getCurrentCount() + 1);
              console.error(`Resizing vector index to ${newSize}`);
              hnswIndex.resizeIndex(newSize);
          }
          
          hnswIndex.addPoint(embedding, labelToAdd);
          console.error(`Added context ${summary.contextId} to vector index with label ${labelToAdd}`);
          
      } else {
          console.error(`Context ${summary.contextId} exists (label ${labelToAdd}). Updating by replacement.`);
          try {
              hnswIndex.markDelete(labelToAdd);
              hnswIndex.addPoint(embedding, labelToAdd);
          } catch(updateError: any) {
              console.error(`Error updating index for ${summary.contextId} (label ${labelToAdd}): ${updateError.message}.`);
          }
      }
      
      this.contextToEmbedding.set(summary.contextId, embedding); 
      await this.saveVectorIndex();

    } catch (error: any) {
      console.error(`Error processing addSummary for context ${summary.contextId}: ${error.message}`, error.stack);
    }
  }
  
  /**
   * Find contexts similar to the given text
   * @param text Text to find similar contexts for
   * @param limit Maximum number of results to return
   * @returns Array of context IDs with similarity scores
   */
  public async findSimilarContexts(text: string, limit: number = 5): Promise<SimilarContext[]> {
    await this.ensureInitialized();

     if (this.fallbackMode) {
      console.error('Vector DB in fallback mode, using keyword matching.'); // Log to stderr
      return this.findSimilarContextsWithKeywords(text, limit);
    }

    if (!this.vectorIndex || !this.embeddingModel || this.contextIdToIndex.size === 0) {
      console.error('Vector index/model not ready or index empty, cannot perform similarity search.'); // Log to stderr
      return [];
    }

    try {
        const queryEmbedding = await this.generateEmbedding(text);
        if (!queryEmbedding) {
            console.error('Failed to generate embedding for query text, cannot search.'); // Log to stderr
            return [];
        }

        const hnswIndex = this.vectorIndex as HierarchicalNSWIndex;
        const actualLimit = Math.min(limit, hnswIndex.getCurrentCount());
        if (actualLimit <= 0) {
            console.warn("No elements in index to search.");
            return [];
        }

        const results = hnswIndex.searchKnn(queryEmbedding, actualLimit);
        const neighbors = results.neighbors;
        const distances = results.distances;

        const similarContexts: SimilarContext[] = [];
        for (let i = 0; i < neighbors.length; i++) {
            const neighborLabel = neighbors[i];
            const distance = distances[i];
            const contextId = this.indexToContextId.get(neighborLabel);

            if (contextId) {
                const similarityScore = 1 - distance;
                 // Use 'similarity' key as defined in SimilarContext interface
                similarContexts.push({ contextId, similarity: similarityScore }); 
            } else {
                 console.warn(`Warning: Found neighbor label ${neighborLabel} with no corresponding contextId.`); // Log to stderr
            }
        }

        similarContexts.sort((a, b) => b.similarity - a.similarity);
        return similarContexts;
    } catch (error: any) {
      console.error(`Error searching in vector index: ${error.message}`, error.stack);
      console.error('Falling back to keyword matching due to vector search error.'); // Log to stderr
      return this.findSimilarContextsWithKeywords(text, limit);
    }
  }
  
  /**
   * Delete a context from the vector index
   * @param contextId Context ID to delete
   */
  public async deleteContext(contextId: string): Promise<void> {
    // Start API call tracking
    const endTracking = apiAnalytics.trackCall(ApiCallType.VECTOR_DB_DELETE, {
      contextId
    });
    
    try {
      await this.ensureInitialized();
      
      // If in fallback mode, remove from basic storage
      if (this.fallbackMode) {
        this.fallbackStorage.delete(contextId);
        const saveResult = await this.saveFallbackStorage();
        if (!saveResult) {
          console.warn(`Failed to update fallback storage after deleting '${contextId}'. Data might be inconsistent on restart.`);
        }
        endTracking(); // End tracking
        return;
      }
      
      // Find the index for this context ID
      const index = this.contextIdToIndex.get(contextId);
      if (index === undefined) {
        // Context doesn't exist, nothing to delete
        endTracking(); // End tracking
        return;
      }
      
      // Mark the point as deleted in the vector index
      if (this.vectorIndex) {
        const hnswIndex = this.vectorIndex as HierarchicalNSWIndex;
        hnswIndex.markDelete(index);
      }
      
      // Remove from the maps
      this.contextIdToIndex.delete(contextId);
      this.indexToContextId.delete(index);
      this.contextToEmbedding.delete(contextId);
      
      // Save updated index
      await this.saveVectorIndex();
      endTracking(); // End tracking
    } catch (error) {
      endTracking(); // End tracking even if an error occurs
      throw error;
    }
  }
  
  /**
   * Check if a context exists in the vector index
   * @param contextId Context ID to check
   */
  public async hasContext(contextId: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      // 폴백 모드일 경우 폴백 저장소에서 확인
      if (this.fallbackMode) {
        return this.fallbackStorage.has(contextId);
      }
      
      // 벡터 모드일 경우 contextIdToIndex 맵에서 확인
      return this.contextIdToIndex.has(contextId);
    } catch (error) {
      console.error(`Error checking if context ${contextId} exists:`, error);
      return false;
    }
  }
  
  /**
   * Get the number of contexts in the vector index
   * @returns Number of contexts
   */
  public async getSize(): Promise<number> {
    try {
      await this.ensureInitialized();
      
      // 폴백 모드일 경우 폴백 저장소 크기 반환
      if (this.fallbackMode) {
        return this.fallbackStorage.size;
      }
      
      // 벡터 모드일 경우 contextIdToIndex 맵 크기 반환
      return this.contextIdToIndex.size;
    } catch (error) {
      console.error('Error getting size of vector index:', error);
      return 0;
    }
  }
  
  /**
   * Clean up resources
   */
  public async dispose(): Promise<void> {
    try {
      if (this.initialized && !this.fallbackMode && this.vectorIndex) {
        await this.saveIndexAndMap();
      }
      
      // Reset state
      this.initialized = false;
      this.vectorIndex = null;
      this.embeddingModel = null;
    } catch (error) {
      console.error('Error disposing vector repository:', error);
    }
  }
  
  /**
   * Explicitly set fallback mode
   * @param fallbackMode Whether to enable fallback mode
   */
  public setFallbackMode(fallbackMode: boolean): void {
    this.fallbackMode = fallbackMode;
  }
}

/**
 * Fallback repository that uses basic keyword matching instead of vector embeddings
 * Used when vector embedding is not available or fails
 */
export class KeywordMatchRepository implements VectorRepositoryInterface {
  private contextDir: string;
  private summaries: Map<string, {terms: Set<string>, summary: ContextSummary}> = new Map();
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  
  /**
   * Constructor
   * @param contextDir Directory to store data
   */
  constructor(contextDir: string) {
    this.contextDir = contextDir;
    this.initPromise = this.init();
  }
  
  /**
   * Initialize the repository
   */
  private async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing keyword match repository:', error);
    }
  }
  
  /**
   * Extract meaningful terms from text
   * @param text Text to extract terms from
   * @returns Set of meaningful terms
   */
  private extractTerms(text: string): Set<string> {
    const terms = text.toLowerCase()
      .split(/\W+/)
      .filter(term => term.length > 3) // Only consider terms longer than 3 characters
      .filter(term => !this.isStopWord(term)); // Filter out stop words
    
    return new Set(terms);
  }
  
  /**
   * Check if a word is a stop word
   * @param word Word to check
   * @returns Whether the word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this',
      'but', 'his', 'from', 'they', 'she', 'will', 'would', 'there',
      'their', 'what', 'about', 'which', 'when', 'make', 'like', 'time',
      'just', 'know', 'take', 'into', 'year', 'your', 'good', 'some'
    ]);
    
    return stopWords.has(word);
  }
  
  /**
   * Calculate similarity between two sets of terms
   * @param termsA First set of terms
   * @param termsB Second set of terms
   * @returns Similarity score between 0 and 1
   */
  private calculateSimilarity(termsA: Set<string>, termsB: Set<string>): number {
    if (termsA.size === 0 || termsB.size === 0) return 0;
    
    let matchCount = 0;
    for (const term of termsA) {
      if (termsB.has(term)) {
        matchCount++;
      }
    }
    
    // Jaccard similarity
    const union = new Set([...termsA, ...termsB]);
    return matchCount / union.size;
  }
  
  /**
   * Add or update a summary
   * @param summary Summary to add or update
   */
  public async addSummary(summary: ContextSummary): Promise<void> {
    await this.initPromise;
    
    const terms = this.extractTerms(summary.summary);
    this.summaries.set(summary.contextId, { terms, summary });
  }
  
  /**
   * Find contexts similar to the given text
   * @param text Text to find similar contexts for
   * @param limit Maximum number of results to return
   * @returns Array of context IDs with similarity scores
   */
  public async findSimilarContexts(text: string, limit: number = 5): Promise<SimilarContext[]> {
    await this.initPromise;
    
    if (this.summaries.size === 0) return [];
    
    const queryTerms = this.extractTerms(text);
    const similarities: SimilarContext[] = [];
    
    for (const [contextId, { terms }] of this.summaries.entries()) {
      const similarity = this.calculateSimilarity(queryTerms, terms);
      if (similarity > 0) {
        similarities.push({ contextId, similarity });
      }
    }
    
    // Sort by similarity score descending
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // Return top results
    return similarities.slice(0, limit);
  }
  
  /**
   * Delete a context
   * @param contextId Context ID to delete
   */
  public async deleteContext(contextId: string): Promise<void> {
    await this.initPromise;
    this.summaries.delete(contextId);
  }
  
  /**
   * Check if a context exists
   * @param contextId Context ID to check
   */
  public async hasContext(contextId: string): Promise<boolean> {
    await this.initPromise;
    return this.summaries.has(contextId);
  }
}

/**
 * Create a vector repository instance
 * @param contextDir Directory to store vector data
 * @param forceFallback Force fallback mode for testing
 * @returns Vector repository instance
 */
export async function createVectorRepository(
  contextDir: string,
  forceFallback?: boolean
): Promise<VectorRepositoryInterface> {
  try {
    if (forceFallback) {
      console.log('Forcing fallback mode for vector repository');
      const repo = new VectorRepository(contextDir);
      repo.setFallbackMode(true);
      return repo;
    }
    
    return new VectorRepository(contextDir);
  } catch (error) {
    console.error('Error creating vector repository:', error);
    
    // Create repository in fallback mode
    const fallbackRepo = new VectorRepository(contextDir);
    fallbackRepo.setFallbackMode(true);
    return fallbackRepo;
  }
} 