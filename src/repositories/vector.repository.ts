import fs from 'fs-extra';
import { RelatedContext } from '../types/related-context';
import { ContextSummary } from '../domain/types';
import { EmbeddingUtil } from '../utils/embedding';

// Vector DB Context 내부 타입 정의
interface VectorContext {
  id: string;
  text: string;
  summary: string;
  embedding: number[];
  relationships?: Array<{
    contextId: string;
    type: string;
    weight: number;
  }>;
  metadata?: Record<string, unknown>;
}

interface VectorSearchResult {
  contextId: string;
  similarity: number;
}

interface HNSWIndex {
  initIndex(maxElements: number, efConstruction: number, M: number): void;
  addPoint(point: number[], label: number): void;
  markDelete(label: number): void;
  setEf(ef: number): void;
  searchKnn(queryPoint: number[], k: number): { neighbors: number[]; distances: number[] };
}

/**
 * Vector repository for similarity search
 */
export class VectorRepository {
  private readonly dbPath: string;
  private readonly embeddingUtil: EmbeddingUtil;
  private contexts: Map<string, VectorContext>;
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
      try {
        const hnswlib = await import('hnswlib-node');
        this.index = new hnswlib.HierarchicalNSW('cosine', 384);
        this.index.initIndex(1000, 16, 200);

        await this.loadState();
      } catch (error) {
        console.error('[VectorRepository] Error initializing index:', error);
        throw error;
      }
    }
  }

  /**
   * Safely convert embedding array to Float32Array
   */
  private prepareEmbeddingForIndex(embedding: number[]): number[] {
    if (!Array.isArray(embedding)) {
      throw new Error('Embedding must be an array');
    }

    if (embedding.length === 0) {
      throw new Error('Embedding cannot be empty');
    }

    return embedding;
  }

  /**
   * Loads context data from storage
   */
  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      const state = JSON.parse(data);

      this.contexts = new Map(
        state.contexts.map((context: VectorContext) => [
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
          // 안전하게 Float32Array 변환
          const point = this.prepareEmbeddingForIndex(context.embedding);
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
              // 안전하게 Float32Array 변환
              const point = this.prepareEmbeddingForIndex(existingContext.embedding);
              this.index.addPoint(point, idx);
            }
          }
        } else {
          // Add new context with placeholder text
          const newIndex = this.contexts.size;
          const context: VectorContext = {
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
    const context: VectorContext = {
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
      // 안전하게 Float32Array 변환
      const point = this.prepareEmbeddingForIndex(embedding);
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
   * Retrieves a context by ID
   */
  public async getContext(id: string): Promise<VectorContext | undefined> {
    await this.ensureInitialized();
    return this.contexts.get(id);
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
   * Find contexts similar to the given text
   */
  public async findSimilarContexts(text: string, limit = 5): Promise<RelatedContext[]> {
    await this.ensureInitialized();

    // Preprocess the query to enhance matching
    const processedText = text;
    const queryEmbedding = await this.embeddingUtil.getEmbedding(processedText);

    if (!this.index || !queryEmbedding || queryEmbedding.length === 0) {
      throw new Error('Cannot perform similarity search: Index or embedding not available');
    }

    // Set search parameters
    this.index.setEf(100); // Higher ef value improves recall at cost of performance

    // 안전하게 변환
    const point = this.prepareEmbeddingForIndex(queryEmbedding);
    const searchResults = this.index.searchKnn(point, Math.min(limit * 2, this.contexts.size || 1));

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

    // Convert to RelatedContext array
    return results.slice(0, limit).map((result) => {
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
}
