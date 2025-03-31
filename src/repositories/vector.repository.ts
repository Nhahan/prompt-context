import fs from 'fs-extra';
import path from 'path';
import { VectorRepositoryInterface } from './repository.interface';
import { ContextSummary, SimilarContext, ApiCallType } from '../domain/types';
import { ApiAnalytics } from '../utils/analytics';

/**
 * Vector repository for similarity search
 * This is a simplified implementation that relies on keyword matching
 */
export class VectorRepository implements VectorRepositoryInterface {
  private baseDir: string;
  private summaries: Map<string, { terms: Set<string>; summary: ContextSummary }> = new Map();
  private initialized: boolean = false;
  private analytics: ApiAnalytics | null = null;

  /**
   * Constructor
   * @param baseDir Base directory for storing vector data
   * @param analytics Optional analytics service
   */
  constructor(baseDir: string, analytics: ApiAnalytics | null = null) {
    this.baseDir = baseDir;
    this.analytics = analytics;
  }

  /**
   * Initialize the repository
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      const vectorDir = path.join(this.baseDir, 'vectors');
      await fs.ensureDir(vectorDir);

      // Load existing summaries
      const storageFile = path.join(vectorDir, 'keyword-summaries.json');
      if (await fs.pathExists(storageFile)) {
        const data = await fs.readJson(storageFile);
        for (const [id, summary] of Object.entries(data)) {
          const terms = this.extractTerms((summary as ContextSummary).summary);
          this.summaries.set(id, {
            terms,
            summary: summary as ContextSummary,
          });
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize vector repository:', error);
      throw error;
    }
  }

  /**
   * Extract meaningful terms from text
   * @param text Text to extract terms from
   * @returns Set of terms
   */
  private extractTerms(text: string): Set<string> {
    const terms = new Set<string>();

    // Simple tokenization - can be improved with NLP libraries
    const words = text
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !this.isStopWord(word));

    for (const word of words) {
      terms.add(word);
    }

    return terms;
  }

  /**
   * Check if a word is a stop word (common, low-information word)
   * @param word Word to check
   * @returns Whether the word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the',
      'be',
      'to',
      'of',
      'and',
      'a',
      'in',
      'that',
      'have',
      'it',
      'for',
      'not',
      'on',
      'with',
      'he',
      'as',
      'you',
      'do',
      'at',
      'this',
      'but',
      'his',
      'by',
      'from',
      'they',
      'we',
      'say',
      'her',
      'she',
      'or',
      'an',
      'will',
      'my',
      'one',
      'all',
      'would',
      'there',
      'their',
      'what',
      'so',
      'up',
      'out',
      'if',
      'about',
      'who',
      'get',
      'which',
      'go',
      'me',
      'when',
      'make',
      'can',
      'like',
      'time',
      'no',
      'just',
      'him',
      'know',
      'take',
      'people',
      'into',
      'year',
      'your',
      'good',
      'some',
      'could',
      'them',
      'see',
      'other',
      'than',
      'then',
      'now',
      'look',
      'only',
      'come',
      'its',
      'over',
      'think',
      'also',
      'back',
      'after',
      'use',
      'two',
      'how',
      'our',
      'work',
      'first',
      'well',
      'way',
      'even',
      'new',
      'want',
      'because',
      'any',
      'these',
      'give',
      'day',
      'most',
      'us',
      'was',
      'is',
      'are',
      'been',
    ]);

    return stopWords.has(word);
  }

  /**
   * Calculate similarity using Jaccard index
   * @param termsA First set of terms
   * @param termsB Second set of terms
   * @returns Similarity score (0-1)
   */
  private calculateSimilarity(termsA: Set<string>, termsB: Set<string>): number {
    if (termsA.size === 0 || termsB.size === 0) return 0;

    const intersection = new Set([...termsA].filter((x) => termsB.has(x)));
    const union = new Set([...termsA, ...termsB]);

    return intersection.size / union.size;
  }

  /**
   * Add or update a summary in the vector index
   * @param summary Summary to add or update
   */
  async addSummary(summary: ContextSummary): Promise<void> {
    await this.ensureInitialized();

    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.VECTOR_DB_ADD);
    }

    const terms = this.extractTerms(summary.summary);
    this.summaries.set(summary.contextId, { terms, summary });

    // Save to disk
    await this.saveSummaries();
  }

  /**
   * Save summaries to disk
   */
  private async saveSummaries(): Promise<void> {
    const vectorDir = path.join(this.baseDir, 'vectors');
    await fs.ensureDir(vectorDir);

    const storageFile = path.join(vectorDir, 'keyword-summaries.json');
    const data: Record<string, ContextSummary> = {};

    for (const [id, { summary }] of this.summaries.entries()) {
      data[id] = summary;
    }

    await fs.writeJson(storageFile, data, { spaces: 2 });
  }

  /**
   * Find contexts similar to the given text
   * @param text Text to find similar contexts for
   * @param limit Maximum number of results to return
   * @returns Array of context IDs with similarity scores
   */
  async findSimilarContexts(text: string, limit: number = 5): Promise<SimilarContext[]> {
    await this.ensureInitialized();

    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.VECTOR_DB_SEARCH);
    }

    const queryTerms = this.extractTerms(text);
    const results: SimilarContext[] = [];

    for (const [contextId, { terms }] of this.summaries.entries()) {
      const similarity = this.calculateSimilarity(queryTerms, terms);

      if (similarity > 0) {
        results.push({
          contextId,
          similarity,
        });
      }
    }

    // Sort by similarity (descending) and limit results
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  /**
   * Delete a context from the vector index
   * @param contextId Context ID to delete
   */
  async deleteContext(contextId: string): Promise<void> {
    await this.ensureInitialized();

    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.VECTOR_DB_DELETE);
    }

    this.summaries.delete(contextId);
    await this.saveSummaries();
  }

  /**
   * Check if a context exists in the vector index
   * @param contextId Context ID to check
   */
  async hasContext(contextId: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.summaries.has(contextId);
  }
}
