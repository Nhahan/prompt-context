import { ContextSummary, SimilarContext, VectorRepositoryInterface } from './types';

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