import path from 'path';
import fs from 'fs';
import * as ort from 'onnxruntime-node';

interface EmbeddingOptions {
  modelPath?: string;
  quantized?: boolean;
  useFallback?: boolean;
  tokenizerModelId?: string;
  maxSeqLength?: number;
}

interface EmbeddingResult {
  data: number[];
}

interface EmbeddingModel {
  generate: (
    text: string,
    options: { pooling: 'mean' | 'none' | 'cls'; normalize: boolean }
  ) => Promise<EmbeddingResult>;
}

/**
 * Utility class for generating and managing embeddings using ONNX Runtime
 */
export class EmbeddingUtil {
  private static _instance: EmbeddingUtil;
  private readonly _options: EmbeddingOptions;
  private readonly _maxSeqLength: number;
  private _model: EmbeddingModel | null = null;
  private _session: ort.InferenceSession | null = null;
  private _initialized: boolean = false;
  private _isInitializing: boolean = false;
  private _vocabCache: Map<string, number> = new Map();
  private _nextTokenId = 1; // Start from 1, reserve 0 for padding
  private SPECIAL_TOKENS_REGEX = /[^a-zA-Z0-9\s]/g;

  /**
   * Creates a new EmbeddingUtil instance
   */
  private constructor(options: EmbeddingOptions) {
    this._options = {
      modelPath: options.modelPath || './models/model.onnx',
      quantized: options.quantized !== false,
      useFallback: options.useFallback !== false,
      tokenizerModelId:
        options.tokenizerModelId || 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      maxSeqLength: options.maxSeqLength || 128,
    };
    this._maxSeqLength = this._options.maxSeqLength || 128;
  }

  /**
   * Returns singleton instance of EmbeddingUtil
   */
  public static getInstance(options?: EmbeddingOptions): EmbeddingUtil {
    if (!EmbeddingUtil._instance) {
      EmbeddingUtil._instance = new EmbeddingUtil(
        options || {
          modelPath: './models/model.onnx',
          quantized: true,
          useFallback: true,
          tokenizerModelId: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
          maxSeqLength: 128,
        }
      );
    }
    return EmbeddingUtil._instance;
  }

  /**
   * Returns whether the embedding model is initialized
   */
  public get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Ensures the embedding model is initialized
   */
  public async ensureInitialized(): Promise<void> {
    if (!this._initialized) {
      await this.initialize();
    }
  }

  /**
   * Returns the embedding model
   */
  public async getModel(): Promise<EmbeddingModel | null> {
    await this.ensureInitialized();
    return this._model;
  }

  /**
   * Enhanced tokenization that uses subword segmentation
   */
  private tokenizeText(text: string): { ids: number[]; mask: number[]; typeIds: number[] } {
    // Preprocess text
    const normalizedText = text.toLowerCase().trim();

    // Split into words and punctuation
    const words = normalizedText
      .split(/(\s+|[,.!?;:'"(){}[\]-])/g)
      .filter((s) => s.trim().length > 0);

    // Apply subword tokenization
    const tokens = this.applySubwordTokenization(words);

    // Convert tokens to IDs
    const ids = this.convertTokensToIds(tokens);

    // Create attention mask and token type IDs
    const mask = Array(ids.length).fill(1);
    const typeIds = Array(ids.length).fill(0);

    // Pad sequences if necessary
    return this.padSequence(ids, mask, typeIds);
  }

  /**
   * Apply subword tokenization to words
   */
  private applySubwordTokenization(words: string[]): string[] {
    const tokens: string[] = [];
    for (const word of words) {
      if (word.length > 4) {
        // Split longer words into subwords
        for (let i = 0; i <= word.length - 3; i += 3) {
          const end = Math.min(i + 3, word.length);
          tokens.push(word.substring(i, end));
        }
      } else {
        tokens.push(word);
      }
    }
    return tokens;
  }

  /**
   * Convert tokens to IDs using vocabulary cache
   */
  private convertTokensToIds(tokens: string[]): number[] {
    const ids: number[] = [];
    for (const token of tokens) {
      if (!this._vocabCache.has(token)) {
        this._vocabCache.set(token, this._nextTokenId++);
      }
      ids.push(this._vocabCache.get(token) as number);
    }
    return ids;
  }

  /**
   * Pad sequence to fixed length
   */
  private padSequence(
    ids: number[],
    mask: number[],
    typeIds: number[]
  ): { ids: number[]; mask: number[]; typeIds: number[] } {
    // Truncate if too long
    if (ids.length > this._maxSeqLength) {
      ids.length = this._maxSeqLength;
      mask.length = this._maxSeqLength;
      typeIds.length = this._maxSeqLength;
    }

    // Pad if necessary
    const padLength = this._maxSeqLength - ids.length;
    if (padLength > 0) {
      ids.push(...Array(padLength).fill(0));
      mask.push(...Array(padLength).fill(0));
      typeIds.push(...Array(padLength).fill(0));
    }

    return { ids, mask, typeIds };
  }

  /**
   * Normalize vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map((val) => val / (norm || 1));
  }

  /**
   * Initializes the embedding model
   */
  public async initialize(): Promise<void> {
    if (this._initialized || this._isInitializing) {
      return;
    }

    this._isInitializing = true;

    try {
      const modelPath = this._options.modelPath || './models/model.onnx';
      const absolutePath = path.resolve(modelPath);

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Model file not found at: ${absolutePath}`);
      }

      console.log(`Loading ONNX model from: ${absolutePath}`);

      // Create ONNX Runtime session
      this._session = await ort.InferenceSession.create(absolutePath);

      // Create embedding model interface
      this._model = {
        generate: async (
          text: string,
          options: { pooling: 'mean' | 'none' | 'cls'; normalize: boolean }
        ) => {
          if (!this._session) {
            throw new Error('ONNX session not initialized');
          }

          try {
            // Tokenize input text
            const { ids, mask, typeIds } = this.tokenizeText(text);

            // Prepare input tensors
            const feeds = this.prepareInputTensors(ids, mask, typeIds);

            // Run inference
            const results = await this._session.run(feeds);

            // Process results based on pooling option
            let embeddingData = this.processResults(results, options.pooling);

            // Normalize if requested
            if (options.normalize) {
              embeddingData = this.normalizeVector(embeddingData);
            }

            return { data: embeddingData };
          } catch (error) {
            console.error('Error generating embedding:', error);
            throw error;
          }
        },
      };

      this._initialized = true;
      console.log('Embedding model initialized successfully');
    } catch (error) {
      console.error('Error initializing embedding model:', error);
      throw error;
    } finally {
      this._isInitializing = false;
    }
  }

  /**
   * Prepare input tensors for ONNX Runtime
   */
  private prepareInputTensors(
    ids: number[],
    mask: number[],
    typeIds: number[]
  ): Record<string, ort.Tensor> {
    return {
      input_ids: new ort.Tensor('int64', new BigInt64Array(ids.map((id) => BigInt(id))), [
        1,
        ids.length,
      ]),
      attention_mask: new ort.Tensor('int64', new BigInt64Array(mask.map((m) => BigInt(m))), [
        1,
        mask.length,
      ]),
      token_type_ids: new ort.Tensor('int64', new BigInt64Array(typeIds.map((id) => BigInt(id))), [
        1,
        typeIds.length,
      ]),
    };
  }

  /**
   * Process model results based on pooling option
   */
  private processResults(
    results: Record<string, ort.Tensor>,
    pooling: 'mean' | 'none' | 'cls'
  ): number[] {
    if (pooling === 'cls') {
      // Use CLS token embedding (first token)
      const tokenEmbeddings = results['token_embeddings'];
      return Array.from(tokenEmbeddings.data as Float32Array).slice(0, tokenEmbeddings.dims[2]);
    } else if (pooling === 'mean') {
      // Use sentence embedding which is already mean-pooled
      return Array.from(results['sentence_embedding'].data as Float32Array);
    } else {
      // Return all token embeddings (no pooling)
      return Array.from(results['token_embeddings'].data as Float32Array);
    }
  }

  /**
   * Generates an embedding for the given text
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    await this.ensureInitialized();

    if (!this._model) {
      throw new Error('Embedding model not initialized');
    }

    try {
      const result = await this._model.generate(text, {
        pooling: 'mean',
        normalize: true,
      });

      if (!result?.data) {
        throw new Error('Invalid embedding result format');
      }

      return Array.from(result.data);
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Alias for generateEmbedding
   */
  public async getEmbedding(text: string): Promise<number[]> {
    return this.generateEmbedding(text);
  }

  /**
   * Close the session and release resources
   */
  public async close(): Promise<void> {
    if (this._session) {
      try {
        // Clear references
        this._model = null;
        this._session = null;
        this._vocabCache.clear();
        this._initialized = false;
        this._isInitializing = false;
      } catch (error) {
        console.error('Error closing embedding model session:', error);
        throw error;
      }
    }
  }
}

export default EmbeddingUtil;
