import fs from 'fs-extra';
import path from 'path';
import { ContextSummary, SimilarContext } from './types';

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
  private embeddingModel: any;
  private vectorIndex: any;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private contextMap: Map<string, number> = new Map(); // Maps contextId to vector index
  private nextIndex: number = 0;
  private fallbackMode: boolean = false;
  
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
    
    try {
      // Create vector directory if it doesn't exist
      const vectorDir = path.join(this.contextDir, 'vectors');
      await fs.ensureDir(vectorDir);
      
      // Import dependencies dynamically to handle environments where they might not be available
      const hnswlib = await import('hnswlib-node');
      
      // Initialize vector index
      this.vectorIndex = new hnswlib.HierarchicalNSW('cosine', this.dimensions);
      
      // Try to load existing index
      const indexPath = path.join(vectorDir, 'vector-index.bin');
      const mapPath = path.join(vectorDir, 'context-map.json');
      
      if (await fs.pathExists(indexPath) && await fs.pathExists(mapPath)) {
        try {
          // Load context map
          const contextMapData = await fs.readJson(mapPath);
          this.contextMap = new Map(Object.entries(contextMapData));
          this.nextIndex = Math.max(...Array.from(this.contextMap.values()), -1) + 1;
          
          // Load vector index
          const maxElements = Math.max(1000, this.nextIndex * 2); // Ensure enough capacity
          this.vectorIndex.readIndex(indexPath, maxElements);
          console.log(`Loaded vector index with ${this.contextMap.size} contexts`);
        } catch (loadError) {
          console.error('Error loading vector index, creating a new one:', loadError);
          await this.createNewIndex();
        }
      } else {
        await this.createNewIndex();
      }
      
      // Load embedding model
      try {
        const { pipeline } = await import('@xenova/transformers');
        this.embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      } catch (modelError) {
        console.error('Error loading embedding model:', modelError);
        this.fallbackMode = true; // Enable fallback mode instead of throwing
        console.warn('Switching to fallback mode due to embedding model loading failure');
      }
      
      this.initialized = true;
    } catch (error) {
      this.initialized = false;
      this.fallbackMode = true;
      throw error;
    }
  }
  
  /**
   * Create a new vector index
   */
  private async createNewIndex(): Promise<void> {
    // Reset context map and index
    this.contextMap = new Map();
    this.nextIndex = 0;
    
    try {
      // Initialize with default capacity
      console.log('Initializing vector index with default capacity (1000)');
      this.vectorIndex.initIndex(1000);
      
      console.log('Created new vector index');
    } catch (error) {
      console.error('Error creating new index:', error);
      throw error;
    }
  }
  
  /**
   * Ensure the repository is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    
    if (!this.initialized && !this.fallbackMode) {
      this.initPromise = this.init();
      await this.initPromise;
    }
  }
  
  /**
   * Save the current vector index and context map
   */
  private async saveIndex(): Promise<void> {
    if (this.fallbackMode || !this.initialized) return;
    
    try {
      const vectorDir = path.join(this.contextDir, 'vectors');
      await fs.ensureDir(vectorDir);
      
      const indexPath = path.join(vectorDir, 'vector-index.bin');
      const mapPath = path.join(vectorDir, 'context-map.json');
      
      // Save index
      this.vectorIndex.writeIndex(indexPath);
      
      // Save context map
      const contextMapObject = Object.fromEntries(this.contextMap);
      await fs.writeJson(mapPath, contextMapObject, { spaces: 2 });
    } catch (error) {
      console.error('Error saving vector index:', error);
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
   * Add or update a summary in the vector index
   * @param summary Summary to add or update
   */
  public async addSummary(summary: ContextSummary): Promise<void> {
    await this.ensureInitialized();
    
    if (this.fallbackMode) {
      console.log(`Fallback mode active, skipping vector addition for ${summary.contextId}`);
      return;
    }
    
    try {
      const { contextId } = summary;
      console.log(`Generating embedding for context ${contextId}`);
      const embedding = await this.generateEmbedding(summary.summary);
      
      if (!embedding) {
        console.log(`Failed to generate embedding for ${contextId}`);
        return;
      }
      
      console.log(`Generated embedding for ${contextId}, embedding size: ${embedding.length}`);
      
      // Convert Float32Array to regular array for HNSWLib
      const embeddingArray = Array.from(embedding);
      console.log(`Converted embedding to Array for ${contextId}`);
      
      // Check if context already exists
      if (this.contextMap.has(contextId)) {
        // Update existing vector - first remove old one
        const index = this.contextMap.get(contextId)!;
        console.log(`Updating existing vector for ${contextId} at index ${index}`);
        
        // Note: HNSWLib doesn't have direct "replace" functionality
        // Add the new point with the same index, which will update the vector
        this.vectorIndex.addPoint(embeddingArray, index);
        console.log(`Updated vector for ${contextId}`);
      } else {
        // Add new vector
        const index = this.nextIndex++;
        console.log(`Adding new vector for ${contextId} at index ${index}`);
        this.vectorIndex.addPoint(embeddingArray, index);
        this.contextMap.set(contextId, index);
        console.log(`Added vector for ${contextId}, new map size: ${this.contextMap.size}`);
      }
      
      // Save index periodically
      await this.saveIndex();
    } catch (error) {
      console.error(`Error adding summary for context ${summary.contextId}:`, error);
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
    
    if (this.fallbackMode || this.contextMap.size === 0) {
      console.log(`Cannot search: ${this.fallbackMode ? 'in fallback mode' : 'context map is empty'}`);
      return [];
    }
    
    try {
      console.log(`Generating embedding for search query: "${text.substring(0, 50)}..."`);
      const embedding = await this.generateEmbedding(text);
      
      if (!embedding) {
        console.log('Failed to generate embedding for search query');
        return [];
      }
      
      // Convert Float32Array to regular array for HNSWLib
      const embeddingArray = Array.from(embedding);
      console.log(`Converted search embedding to Array, length: ${embeddingArray.length}`);
      
      // Adjust limit if we have fewer contexts
      const actualLimit = Math.min(limit, this.contextMap.size);
      console.log(`Searching for ${actualLimit} similar contexts among ${this.contextMap.size} total contexts`);
      
      // Perform search
      const result = this.vectorIndex.searchKnn(embeddingArray, actualLimit);
      console.log(`Search completed, found ${result.neighbors ? result.neighbors.length : 0} results`);
      
      // Map labels (indices) back to context IDs
      const contextEntries = Array.from(this.contextMap.entries());
      console.log(`Context map entries: ${JSON.stringify(contextEntries.map(([id, idx]) => `${id}:${idx}`))}`);
      
      const mappedResults = result.neighbors.map((index: number, i: number) => {
        const entry = contextEntries.find(([_, idx]) => idx === index);
        const contextId = entry ? entry[0] : `unknown-${index}`;
        
        // Convert distance to similarity score (cosine distance to similarity)
        const distance = result.distances[i];
        const similarity = 1 - distance; // Cosine distance is in [0,2], so 1-distance gives a score in [-1,1]
        
        console.log(`Result ${i}: Index ${index} maps to context "${contextId}" with score ${similarity.toFixed(4)}`);
        
        return {
          id: contextId,
          score: similarity
        };
      }).filter((item: SimilarContext) => item.score > 0); // Filter out negative similarities
      
      console.log(`Returning ${mappedResults.length} results after filtering`);
      return mappedResults;
    } catch (error) {
      console.error('Error finding similar contexts:', error);
      return [];
    }
  }
  
  /**
   * Delete a context from the vector index
   * @param contextId Context ID to delete
   */
  public async deleteContext(contextId: string): Promise<void> {
    await this.ensureInitialized();
    
    if (this.fallbackMode) return;
    
    try {
      if (this.contextMap.has(contextId)) {
        // Mark the vector as deleted in the map
        this.contextMap.delete(contextId);
        
        // Note: HNSWLib doesn't support direct deletion, 
        // so we just remove from our map. The vector remains in the index 
        // but will be unreachable through our API.
        // When the index grows too large, we can rebuild it.
        
        // Save index after deletion
        await this.saveIndex();
      }
    } catch (error) {
      console.error(`Error deleting context ${contextId}:`, error);
    }
  }
  
  /**
   * Check if a context exists in the vector index
   * @param contextId Context ID to check
   */
  public async hasContext(contextId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    if (this.fallbackMode) return false;
    
    return this.contextMap.has(contextId);
  }
  
  /**
   * Get the size of the vector index
   * @returns Number of contexts in the index
   */
  public async getSize(): Promise<number> {
    await this.ensureInitialized();
    
    if (this.fallbackMode) return 0;
    
    return this.contextMap.size;
  }
  
  /**
   * Clean up resources
   */
  public async dispose(): Promise<void> {
    if (this.initialized && !this.fallbackMode) {
      await this.saveIndex();
      this.initialized = false;
    }
  }
  
  /**
   * Set the fallback mode
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
      const score = this.calculateSimilarity(queryTerms, terms);
      if (score > 0) {
        similarities.push({ id: contextId, score });
      }
    }
    
    // Sort by similarity score descending
    similarities.sort((a, b) => b.score - a.score);
    
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