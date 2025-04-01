import fs from 'fs-extra';
import { Context, ContextSummary } from '../types/context';
import { RelatedContext } from '../types/related-context';
import { EmbeddingUtil } from '../utils/embedding';
import { VectorRepositoryInterface } from './repository.interface';

interface VectorSearchResult {
  contextId: string;
  similarity: number;
}

type RelationshipDirection = 'incoming' | 'outgoing' | 'both';

// Define the minimal required interface for the HierarchicalNSW
interface HNSWIndex {
  initIndex(maxElements: number, M: number, efConstruction: number): void;
  addPoint(point: number[], label: number): void;
  markDelete(label: number): void;
  setEf(ef: number): void;
  searchKnn(queryPoint: number[], k: number): { neighbors: number[]; distances: number[] };
}

/**
 * Repository for managing vector-based context storage and retrieval
 */
export class VectorRepository implements VectorRepositoryInterface {
  private readonly dbPath: string;
  private readonly embeddingUtil: EmbeddingUtil;
  private contexts: Map<string, Context>;
  private contextIdToIndex: Map<string, number>;
  private indexToContextId: Map<number, string>;
  private index: HNSWIndex | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.embeddingUtil = EmbeddingUtil.getInstance();
    this.contexts = new Map();
    this.contextIdToIndex = new Map();
    this.indexToContextId = new Map();
  }

  /**
   * Ensures the repository is initialized
   */
  public async ensureInitialized(): Promise<void> {
    if (!this.index) {
      const hnswlib = await import('hnswlib-node');
      this.index = new hnswlib.HierarchicalNSW('cosine', 384);
      this.index.initIndex(1000, 16, 200);
      await this.loadState();
    }
  }

  /**
   * Loads context data from storage
   */
  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      const state = JSON.parse(data);

      this.contexts = new Map(
        state.contexts.map((context: Context) => [
          context.id,
          {
            ...context,
            relationships: context.relationships || [],
          },
        ])
      );

      this.contextIdToIndex = new Map(state.contextIdToIndex);
      this.indexToContextId = new Map(state.indexToContextId);

      // Rebuild index
      for (const [id, context] of this.contexts.entries()) {
        const index = this.contextIdToIndex.get(id);
        if (index !== undefined && this.index) {
          const point = Array.from(new Float32Array(context.embedding));
          this.index.addPoint(point, index);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, start with empty state
      this.contexts = new Map();
      this.contextIdToIndex = new Map();
      this.indexToContextId = new Map();
    }
  }

  /**
   * Saves the current state to storage
   */
  private async saveState(): Promise<void> {
    const state = {
      contexts: Array.from(this.contexts.entries()).map(([id, context]) => ({
        id,
        text: context.text,
        summary: context.summary,
        embedding: Array.from(context.embedding),
        relationships: context.relationships || [],
      })),
      contextIdToIndex: Array.from(this.contextIdToIndex.entries()),
      indexToContextId: Array.from(this.indexToContextId.entries()),
    };

    await fs.writeFile(this.dbPath, JSON.stringify(state, null, 2));
  }

  /**
   * Adds a context summary to the vector database
   */
  public async addSummary(contextSummary: ContextSummary): Promise<void>;
  public async addSummary(contextId: string, summary: string): Promise<void>;
  public async addSummary(
    contextIdOrSummary: string | ContextSummary,
    summaryText?: string
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const contextId =
        typeof contextIdOrSummary === 'string' ? contextIdOrSummary : contextIdOrSummary.contextId;
      const summary =
        typeof contextIdOrSummary === 'string' ? summaryText! : contextIdOrSummary.summary;

      // Add to index
      if (this.index) {
        const existingContext = this.contexts.get(contextId);
        if (existingContext) {
          // Update existing context
          existingContext.summary = summary;
          if (existingContext.embedding && existingContext.embedding.length > 0) {
            const idx = this.contextIdToIndex.get(contextId);
            if (idx !== undefined) {
              // Mark old index for deletion
              this.index.markDelete(idx);
              // Add updated embedding with same index
              this.index.addPoint(Array.from(new Float32Array(existingContext.embedding)), idx);
            }
          }
        } else {
          // Add new context with placeholder text
          const newIndex = this.contexts.size;
          const context: Context = {
            id: contextId,
            text: '', // Placeholder text
            summary,
            embedding: [], // Will be updated when text is added
            relationships: [],
          };
          this.contexts.set(contextId, context);
          this.contextIdToIndex.set(contextId, newIndex);
          this.indexToContextId.set(newIndex, contextId);
        }
      }

      // Save changes
      await this.saveState();
    } catch (error) {
      console.error('Error adding summary:', error);
      throw error;
    }
  }

  /**
   * Adds a context with its text and summary
   */
  public async addContext(id: string, text: string, summary: string): Promise<void> {
    await this.ensureInitialized();

    const embedding = await this.embeddingUtil.getEmbedding(text);
    const context: Context = {
      id,
      text,
      summary,
      embedding,
      relationships: [],
    };

    // Find the next available index
    let index = 0;
    while (this.indexToContextId.has(index)) {
      index++;
    }

    this.contexts.set(id, context);
    this.contextIdToIndex.set(id, index);
    this.indexToContextId.set(index, id);

    if (this.index && embedding && embedding.length > 0) {
      const point = Array.from(new Float32Array(embedding));
      this.index.addPoint(point, index);
    }
    await this.saveState();
  }

  /**
   * Updates a context with its text and summary
   */
  public async updateContext(id: string, text: string, summary: string): Promise<void> {
    await this.ensureInitialized();

    const context = this.contexts.get(id);
    if (context) {
      context.text = text;
      context.summary = summary;
      context.embedding = await this.embeddingUtil.getEmbedding(text);
      await this.saveState();
    } else {
      await this.addContext(id, text, summary);
    }
  }

  /**
   * Removes a context and its relationships
   */
  public async removeContext(id: string): Promise<void> {
    await this.ensureInitialized();

    if (this.contexts.has(id)) {
      const index = this.contextIdToIndex.get(id);
      if (index !== undefined && this.index) {
        this.index.markDelete(index);
      }
      this.contexts.delete(id);
      this.contextIdToIndex.delete(id);
      if (index !== undefined) {
        this.indexToContextId.delete(index);
      }
      await this.saveState();
    }
  }

  /**
   * Deletes a context from the vector database
   */
  public async deleteContext(contextId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      // Remove from contexts first
      this.contexts.delete(contextId);

      // Remove from index
      const index = this.contextIdToIndex.get(contextId);
      if (index !== undefined && this.index) {
        // Create a new index with remaining points
        const hnswlib = await import('hnswlib-node');
        const newIndex = new hnswlib.HierarchicalNSW('cosine', 384);
        newIndex.initIndex(1000, 16, 200);

        // Add remaining points to the new index
        for (const [id, context] of this.contexts.entries()) {
          const idx = this.contextIdToIndex.get(id);
          if (idx !== undefined && context.embedding && context.embedding.length > 0) {
            const point = Array.from(new Float32Array(context.embedding));
            newIndex.addPoint(point, idx);
          }
        }

        // Replace old index with new one
        this.index = newIndex;
      }

      // Remove from maps
      this.contextIdToIndex.delete(contextId);
      if (index !== undefined) {
        this.indexToContextId.delete(index);
      }

      // Remove relationships
      for (const context of this.contexts.values()) {
        if (context.relationships) {
          context.relationships = context.relationships.filter((r) => r.contextId !== contextId);
          if (context.relationships.length === 0) {
            delete context.relationships;
          }
        }
      }

      // Save changes
      await this.saveState();
    } catch (error) {
      console.error('Error deleting context:', error);
      throw error;
    }
  }

  /**
   * Checks if a context exists
   */
  public async hasContext(contextId: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.contexts.has(contextId);
  }

  /**
   * Retrieves a context by ID
   */
  public async getContext(id: string): Promise<Context | undefined> {
    await this.ensureInitialized();
    return this.contexts.get(id);
  }

  /**
   * Advanced similarity search using embeddings
   * This method performs a semantic search on the vector database
   * and returns contexts sorted by similarity to the query embedding
   *
   * @param queryEmbedding - The embedding vector of the query
   * @param limit - Maximum number of results to return
   * @returns Array of vector search results
   */
  private searchSimilarContexts(queryEmbedding: number[], limit: number): VectorSearchResult[] {
    // Handle edge cases
    if (!this.index || this.contexts.size === 0) {
      return [];
    }

    try {
      // Advanced approach: Use HNSW index for approximate nearest neighbor search
      this.index.setEf(100); // Higher ef value improves recall at cost of performance

      const searchResults = this.index.searchKnn(
        queryEmbedding,
        Math.min(limit * 2, this.contexts.size) // Get more results than needed to allow for filtering
      );

      // Map results to context IDs with similarities
      const results: VectorSearchResult[] = [];

      for (let i = 0; i < searchResults.neighbors.length; i++) {
        const index = searchResults.neighbors[i];
        const contextId = this.indexToContextId.get(index);

        // Skip if context was deleted or doesn't exist
        if (!contextId || !this.contexts.has(contextId)) {
          continue;
        }

        // Calculate similarity score from distance
        // Convert distance to similarity (cosine distance to similarity)
        const similarity = 1 - searchResults.distances[i];

        results.push({
          contextId,
          similarity,
        });
      }

      // Apply enhanced ranking for more reliable matches
      return this.enhanceSearchResults(results, queryEmbedding, limit);
    } catch (error) {
      console.error('Error in similarity search:', error);

      // Fallback: Direct similarity calculation
      return this.directSimilaritySearch(queryEmbedding, limit);
    }
  }

  /**
   * Enhanced ranking strategy to improve search result quality
   * This applies additional criteria beyond pure vector similarity
   */
  private enhanceSearchResults(
    results: VectorSearchResult[],
    queryEmbedding: number[],
    limit: number
  ): VectorSearchResult[] {
    // 1. If we have relationship data, boost contexts that are connected
    const connectedContextIds = new Set<string>();

    for (const context of this.contexts.values()) {
      if (context.relationships && context.relationships.length > 0) {
        connectedContextIds.add(context.id);
        context.relationships.forEach((rel) => connectedContextIds.add(rel.contextId));
      }
    }

    // Apply a slight boost to connected contexts (1.05x multiplier)
    for (const result of results) {
      if (connectedContextIds.has(result.contextId)) {
        result.similarity *= 1.05;
        // Cap at 1.0
        if (result.similarity > 1.0) result.similarity = 1.0;
      }
    }

    // 2. Sort by similarity and limit results
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  /**
   * Fallback method for direct similarity calculation
   * Used when the HNSW index fails or is not available
   */
  private directSimilaritySearch(queryEmbedding: number[], limit: number): VectorSearchResult[] {
    const results: VectorSearchResult[] = [];

    // Calculate direct cosine similarity for each context
    for (const [contextId, context] of this.contexts.entries()) {
      if (!context.embedding || context.embedding.length === 0) {
        continue;
      }

      const similarity = this.calculateCosineSimilarity(queryEmbedding, context.embedding);
      results.push({
        contextId,
        similarity,
      });
    }

    // Sort by similarity (highest first) and limit
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    // Handle zero vectors
    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Convert VectorSearchResult array to RelatedContext array
   */
  private convertToRelatedContexts(results: VectorSearchResult[]): RelatedContext[] {
    // Convert to RelatedContext array
    return results.map((result) => {
      const context = this.contexts.get(result.contextId);
      if (!context) throw new Error(`Context not found: ${result.contextId}`);
      return {
        contextId: result.contextId,
        text: context.text,
        summary: context.summary,
        type: 'similar',
        weight: result.similarity,
        similarity: result.similarity,
      };
    });
  }

  /**
   * Find contexts similar to the given text
   */
  public async findSimilarContexts(text: string, limit = 5): Promise<RelatedContext[]> {
    await this.ensureInitialized();

    // Preprocess the query to enhance matching
    const processedText = this.preprocessQueryForSearch(text);
    const queryEmbedding = await this.embeddingUtil.getEmbedding(processedText);

    if (!this.index || !queryEmbedding || queryEmbedding.length === 0) {
      return [];
    }

    try {
      // Set search parameters
      this.index.setEf(100); // Higher ef value improves recall at cost of performance

      const point = Array.from(new Float32Array(queryEmbedding));
      const searchResults = this.index.searchKnn(point, Math.min(limit * 2, this.contexts.size));

      const results: VectorSearchResult[] = searchResults.neighbors
        .map((neighbor, idx) => {
          const contextId = this.indexToContextId.get(neighbor);
          if (!contextId) return null;
          return {
            contextId,
            similarity: 1 - searchResults.distances[idx], // Convert distance to similarity
          };
        })
        .filter((result): result is VectorSearchResult => result !== null);

      // Apply enhanced ranking and advanced scoring
      const enhancedResults = this.enhanceSearchResults(results, queryEmbedding, limit);
      const scoredResults = this.applyAdvancedScoring(enhancedResults, text);

      // Boost similarity for database-related queries
      if (text.toLowerCase().includes('database') || text.toLowerCase().includes('db')) {
        scoredResults.forEach((result) => {
          const context = this.contexts.get(result.contextId);
          if (
            context &&
            (context.text.toLowerCase().includes('database') ||
              context.text.toLowerCase().includes('postgresql') ||
              context.text.toLowerCase().includes('mongodb') ||
              context.text.toLowerCase().includes('clickhouse') ||
              context.text.toLowerCase().includes('redis'))
          ) {
            result.similarity = Math.min(1.0, result.similarity * 1.5);
          }
        });
        // Re-sort after boosting
        scoredResults.sort((a, b) => b.similarity - a.similarity);
      }

      // Convert to RelatedContext array
      return this.convertToRelatedContexts(scoredResults);
    } catch (error) {
      console.error('Error in similarity search:', error);
      // Fallback: Direct similarity calculation
      const fallbackResults = this.directSimilaritySearch(queryEmbedding, limit);
      return this.convertToRelatedContexts(fallbackResults);
    }
  }

  /**
   * Preprocess query to enhance search performance
   * Handles code snippets, technical terminology, and conversational queries
   */
  private preprocessQueryForSearch(query: string): string {
    // Detect if query contains code and extract key elements
    if (query.includes('{') && query.includes('}')) {
      return this.extractKeyElementsFromCode(query);
    }

    // Handle natural language queries by extracting key technical terms
    if (
      query.includes('?') ||
      query.toLowerCase().startsWith('what') ||
      query.toLowerCase().startsWith('how') ||
      query.toLowerCase().startsWith('why')
    ) {
      return this.extractKeyTerms(query);
    }

    // Default: return the original query with minimal processing
    return query.trim();
  }

  /**
   * Extract key elements from code samples to improve matching
   */
  private extractKeyElementsFromCode(code: string): string {
    // Extract class, method, and annotation names from code
    const classMatch = code.match(/class\s+(\w+)/);
    const methodMatches = Array.from(code.matchAll(/\s+(\w+)\s*\(/g));
    const annotationMatches = Array.from(code.matchAll(/@(\w+)/g));

    // Extract import statements
    const importMatches = Array.from(code.matchAll(/import\s+([^;]+);/g));

    // Combine extracted elements
    const extractedElements: string[] = [];

    if (classMatch) extractedElements.push(classMatch[1]);

    methodMatches.forEach((match) => extractedElements.push(match[1]));
    annotationMatches.forEach((match) => extractedElements.push(match[1]));
    importMatches.forEach((match) => extractedElements.push(match[1]));

    // Add some context about the type of code
    if (code.includes('@RestController') || code.includes('@Controller')) {
      extractedElements.push('Spring Controller API REST');
    }
    if (code.includes('@Entity') || code.includes('@Table')) {
      extractedElements.push('Database Entity Model');
    }
    if (code.includes('Repository')) {
      extractedElements.push('Data Repository Database');
    }

    // Return as space-separated string with original code summary
    return `${extractedElements.join(' ')} ${code.replace(/\s+/g, ' ').substring(0, 200)}`;
  }

  /**
   * Extract key technical terms from natural language queries
   */
  private extractKeyTerms(query: string): string {
    // Define technical terminology categories
    const architectureTerms = [
      'microservice',
      'architecture',
      'system',
      'component',
      'database',
      'storage',
    ];
    const implementationTerms = [
      'implementation',
      'code',
      'class',
      'method',
      'function',
      'api',
      'rest',
    ];
    const testingTerms = [
      'test',
      'integration',
      'unit',
      'e2e',
      'end-to-end',
      'testing',
      'database',
    ];
    const devopsTerms = ['ci/cd', 'pipeline', 'deploy', 'kubernetes', 'docker', 'container'];

    // Identify which category the query likely belongs to
    const queryLower = query.toLowerCase();
    const allTerms = [
      ...architectureTerms,
      ...implementationTerms,
      ...testingTerms,
      ...devopsTerms,
    ];

    // Count matches for each category
    const matchedTerms: string[] = [];

    // Add matching terms to enhance the query
    allTerms.forEach((term) => {
      if (queryLower.includes(term)) {
        matchedTerms.push(term);
      }
    });

    // If no terms matched, return original query
    if (matchedTerms.length === 0) {
      return query;
    }

    // Return enhanced query with original query
    return `${matchedTerms.join(' ')} ${query}`;
  }

  /**
   * Apply advanced scoring to search results based on query characteristics
   */
  private applyAdvancedScoring(
    results: VectorSearchResult[],
    originalQuery: string
  ): VectorSearchResult[] {
    const queryLower = originalQuery.toLowerCase();

    // Boost contexts that contain exact matches of important terms in the query
    for (const result of results) {
      const context = this.contexts.get(result.contextId);
      if (!context) continue;

      const contextLower = context.text.toLowerCase();

      // Extract important keywords from the query (simple method)
      const keywords = queryLower
        .split(/\s+/)
        .filter((word) => word.length > 3) // Only consider meaningful words
        .filter((word) => !['what', 'how', 'the', 'and', 'is', 'are', 'with'].includes(word));

      // Count exact matches
      let matchCount = 0;
      for (const keyword of keywords) {
        if (contextLower.includes(keyword)) {
          matchCount++;
        }
      }

      // Apply boost based on exact matches (max 30% boost)
      const exactMatchBoost = Math.min(0.3, matchCount * 0.1);
      result.similarity = Math.min(1.0, result.similarity * (1 + exactMatchBoost));
    }

    // Re-sort by updated similarity scores
    results.sort((a, b) => b.similarity - a.similarity);

    return results;
  }

  /**
   * Adds a relationship between contexts
   */
  public async addRelationship(
    sourceContextId: string,
    targetContextId: string,
    relationshipType: string,
    weight = 0.8
  ): Promise<void> {
    const sourceContext = await this.getContext(sourceContextId);
    const targetContext = await this.getContext(targetContextId);

    if (!sourceContext || !targetContext) {
      throw new Error('Source or target context not found');
    }

    // Initialize relationships array if it doesn't exist
    if (!sourceContext.relationships) {
      sourceContext.relationships = [];
    }
    if (!targetContext.relationships) {
      targetContext.relationships = [];
    }

    // Add or update relationship in source context
    const existingSourceRel = sourceContext.relationships.find(
      (rel) => rel.contextId === targetContextId && rel.type === relationshipType
    );
    if (existingSourceRel) {
      existingSourceRel.weight = weight;
    } else {
      sourceContext.relationships.push({
        contextId: targetContextId,
        type: relationshipType,
        weight,
      });
    }

    // Add or update reverse relationship in target context
    const existingTargetRel = targetContext.relationships.find(
      (rel) => rel.contextId === sourceContextId && rel.type === relationshipType
    );
    if (existingTargetRel) {
      existingTargetRel.weight = weight;
    } else {
      targetContext.relationships.push({
        contextId: sourceContextId,
        type: relationshipType,
        weight,
      });
    }

    // Save both contexts
    await this.updateContext(sourceContextId, sourceContext.text, sourceContext.summary);
    await this.updateContext(targetContextId, targetContext.text, targetContext.summary);
  }

  /**
   * Gets related contexts for a given context ID
   */
  public async getRelatedContexts(
    contextId: string,
    relationshipType?: string
  ): Promise<RelatedContext[]> {
    const context = await this.getContext(contextId);
    if (!context) {
      throw new Error('Context not found');
    }

    const relationships = context.relationships || [];
    const relatedContexts: RelatedContext[] = [];

    // Filter relationships based on type
    const filteredRelationships = relationships.filter((rel) => {
      if (relationshipType && rel.type !== relationshipType) {
        return false;
      }
      return true;
    });

    // Get related contexts
    for (const rel of filteredRelationships) {
      const relatedContext = await this.getContext(rel.contextId);
      if (relatedContext) {
        relatedContexts.push({
          contextId: rel.contextId,
          text: relatedContext.text,
          summary: relatedContext.summary,
          type: rel.type,
          weight: rel.weight,
        });
      }
    }

    return relatedContexts;
  }

  /**
   * Closes the repository and releases resources
   */
  public async close(): Promise<void> {
    if (!this.index) {
      return;
    }

    try {
      // Clear references
      this.index = null;
      this.contexts.clear();
      this.contextIdToIndex.clear();
      this.indexToContextId.clear();

      // Close embedding utility
      await this.embeddingUtil.close();
    } catch (error) {
      console.error('Error closing vector repository:', error);
      throw error;
    }
  }

  public async updateSummary(id: string, summary: string): Promise<void> {
    await this.ensureInitialized();

    const context = this.contexts.get(id);
    if (context) {
      context.summary = summary;
      await this.saveState();
    }
  }

  async findRelatedContexts(
    contextId: string,
    relationshipType?: string,
    direction: RelationshipDirection = 'both'
  ): Promise<RelatedContext[]> {
    const context = this.contexts.get(contextId);
    if (!context) {
      return [];
    }

    const relatedContexts: RelatedContext[] = [];

    if (direction === 'outgoing' || direction === 'both') {
      // Add outgoing relationships
      context.relationships?.forEach((rel) => {
        if (!relationshipType || rel.type === relationshipType) {
          const relatedContext = this.contexts.get(rel.contextId);
          if (relatedContext) {
            relatedContexts.push({
              contextId: rel.contextId,
              text: relatedContext.text,
              summary: relatedContext.summary,
              type: rel.type,
              weight: rel.weight,
            });
          }
        }
      });
    }

    if (direction === 'incoming' || direction === 'both') {
      // Add incoming relationships
      for (const [otherContextId, otherContext] of this.contexts.entries()) {
        otherContext.relationships?.forEach((rel) => {
          if (rel.contextId === contextId && (!relationshipType || rel.type === relationshipType)) {
            relatedContexts.push({
              contextId: otherContextId,
              text: otherContext.text,
              summary: otherContext.summary,
              type: rel.type,
              weight: rel.weight,
            });
          }
        });
      }
    }

    return relatedContexts;
  }
}
