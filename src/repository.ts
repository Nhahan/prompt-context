import fs from 'fs-extra';
import path from 'path';
import {
  ContextSummary,
  MCPConfig,
  Repository,
  HierarchicalSummary,
  MetaSummary,
  Message,
  ContextData,
} from './types';
import { VectorRepository } from './vector-repository';
import { GraphRepository } from './graph-repository';

// Define the Repositories interface here
export interface Repositories {
  fs: FileSystemRepository;
  vector?: VectorRepository;
  graph?: GraphRepository;
}

// Define the structure for context metadata
export interface ContextMetadata {
  contextId: string;
  createdAt: number;
  lastActivityAt: number;
  messagesSinceLastSummary?: number;
  hasSummary?: boolean;
  lastSummarizedAt?: number;
  // Add other relevant metadata fields
  [key: string]: any; // Allow flexible metadata
}

/**
 * Context repository implementation
 */
export class FileSystemRepository implements Repository {
  private config: Omit<MCPConfig, 'ignorePatterns'>;

  /**
   * Repository constructor
   * @param config MCP configuration object
   */
  constructor(config: Omit<MCPConfig, 'ignorePatterns'>) {
    this.config = config;

    // Create context directory
    this.ensureContextDirectory();
  }

  /**
   * Ensure context directory exists
   */
  private ensureContextDirectory(): void {
    const contextDir = this.config.contextDir;
    fs.ensureDirSync(contextDir);

    if (this.config.hierarchicalContext) {
      fs.ensureDirSync(path.join(contextDir, 'hierarchical-summaries'));
      fs.ensureDirSync(path.join(contextDir, 'meta-summaries'));
    }
  }

  /**
   * Get the file path for a context summary
   * @param contextId Context identifier
   * @returns Path to the summary file
   */
  private getSummaryPath(contextId: string): string {
    const sanitizedId = contextId.replace(/[\/\\:*?"<>|]/g, '_');
    return path.join(this.config.contextDir, `${sanitizedId}.summary.json`);
  }

  /**
   * Get path to hierarchical summary file
   * @param contextId Context identifier
   * @returns Path to hierarchical summary file
   */
  private getHierarchicalSummaryPath(contextId: string): string {
    const hierarchicalDir = path.join(this.config.contextDir, 'hierarchical-summaries');
    fs.ensureDirSync(hierarchicalDir);

    return path.join(hierarchicalDir, `${contextId}.hierarchical.json`);
  }

  /**
   * Get path to meta-summary file
   * @param id Meta-summary identifier
   * @returns Path to meta-summary file
   */
  private getMetaSummaryPath(id: string): string {
    const metaDir = path.join(this.config.contextDir, 'meta-summaries');
    fs.ensureDirSync(metaDir);

    return path.join(metaDir, `${id}.meta.json`);
  }

  /**
   * Get the file path for context messages (JSON Lines format)
   */
  private getMessagesPath(contextId: string): string {
    const sanitizedId = contextId.replace(/[\/\\:*?"<>|]/g, '_');
    return path.join(
      this.config.contextDir,
      `${sanitizedId}.messages.jsonl` // Use .jsonl extension
    );
  }

  /**
   * Get the file path for context metadata
   */
  private getMetadataPath(contextId: string): string {
    const sanitizedId = contextId.replace(/[\/\\:*?"<>|]/g, '_');
    return path.join(this.config.contextDir, `${sanitizedId}.metadata.json`);
  }

  /**
   * Save a context summary
   * @param summary Summary to save
   */
  async saveSummary(summary: ContextSummary): Promise<void> {
    const summaryPath = this.getSummaryPath(summary.contextId);
    await fs.writeJson(summaryPath, summary, { spaces: 2 });
  }

  /**
   * Load a context summary
   * @param contextId Context identifier
   * @returns Stored summary or undefined if it doesn't exist
   */
  async loadSummary(contextId: string): Promise<ContextSummary | undefined> {
    const summaryPath = this.getSummaryPath(contextId);

    try {
      if (await fs.pathExists(summaryPath)) {
        return await fs.readJson(summaryPath);
      }
    } catch (error) {
      console.error(`Error loading summary for ${contextId}:`, error);
    }

    return undefined;
  }

  /**
   * Save a hierarchical summary
   * @param summary Hierarchical summary to save
   */
  async saveHierarchicalSummary(summary: HierarchicalSummary): Promise<void> {
    if (!this.config.hierarchicalContext) return;

    const summaryPath = this.getHierarchicalSummaryPath(summary.contextId);
    await fs.writeJson(summaryPath, summary, { spaces: 2 });
  }

  /**
   * Load a hierarchical summary
   * @param contextId Context identifier
   * @returns Stored hierarchical summary or undefined
   */
  async loadHierarchicalSummary(contextId: string): Promise<HierarchicalSummary | undefined> {
    if (!this.config.hierarchicalContext) return undefined;

    const summaryPath = this.getHierarchicalSummaryPath(contextId);

    try {
      if (await fs.pathExists(summaryPath)) {
        return await fs.readJson(summaryPath);
      }
    } catch (error) {
      console.error(`Error loading hierarchical summary for ${contextId}:`, error);
    }

    return undefined;
  }

  /**
   * Save a meta-summary
   * @param summary Meta-summary to save
   */
  async saveMetaSummary(summary: MetaSummary): Promise<void> {
    if (!this.config.hierarchicalContext) return;

    const summaryPath = this.getMetaSummaryPath(summary.id);
    await fs.writeJson(summaryPath, summary, { spaces: 2 });
  }

  /**
   * Load a meta-summary
   * @param id Meta-summary identifier
   * @returns Stored meta-summary or undefined
   */
  async loadMetaSummary(id: string): Promise<MetaSummary | undefined> {
    if (!this.config.hierarchicalContext) return undefined;

    const summaryPath = this.getMetaSummaryPath(id);

    try {
      if (await fs.pathExists(summaryPath)) {
        return await fs.readJson(summaryPath);
      }
    } catch (error) {
      console.error(`Error loading meta-summary ${id}:`, error);
    }

    return undefined;
  }

  /**
   * Get all related contexts
   * @param contextId Context identifier
   * @returns Array of related context IDs
   */
  async getRelatedContexts(contextId: string): Promise<string[]> {
    const summary = await this.loadSummary(contextId);
    if (!summary || !summary.relatedContexts) {
      return [];
    }

    return summary.relatedContexts;
  }

  /**
   * Get all available context summaries
   * @returns Array of context IDs
   */
  async getAllContextIds(): Promise<string[]> {
    const contextDir = this.config.contextDir;
    const files = await fs.readdir(contextDir);

    return files
      .filter((file) => file.endsWith('.summary.json'))
      .map((file) => file.replace(/\.summary\.json$/, ''));
  }

  /**
   * Get all available hierarchical summaries
   * @returns Array of context IDs that have hierarchical summaries
   */
  async getAllHierarchicalContextIds(): Promise<string[]> {
    if (!this.config.hierarchicalContext) return [];

    const hierarchicalDir = path.join(this.config.contextDir, 'hierarchical-summaries');

    try {
      if (!(await fs.pathExists(hierarchicalDir))) {
        return [];
      }

      const files = await fs.readdir(hierarchicalDir);

      return files
        .filter((file) => file.endsWith('.hierarchical.json'))
        .map((file) => file.replace(/\.hierarchical\.json$/, ''));
    } catch (error) {
      console.error('Error getting hierarchical contexts:', error);
      return [];
    }
  }

  /**
   * Get all available meta-summaries
   * @returns Array of meta-summary IDs
   */
  async getAllMetaSummaryIds(): Promise<string[]> {
    if (!this.config.hierarchicalContext) return [];

    const metaDir = path.join(this.config.contextDir, 'meta-summaries');

    try {
      if (!(await fs.pathExists(metaDir))) {
        return [];
      }

      const files = await fs.readdir(metaDir);

      return files
        .filter((file) => file.endsWith('.meta.json'))
        .map((file) => file.replace(/\.meta\.json$/, ''));
    } catch (error) {
      console.error('Error getting meta-summary IDs:', error);
      return [];
    }
  }

  /**
   * Delete summary
   * @param contextId Context ID
   * @returns Whether the operation was successful
   */
  async deleteSummary(contextId: string): Promise<boolean> {
    try {
      const summaryPath = this.getSummaryPath(contextId);

      if (await fs.pathExists(summaryPath)) {
        await fs.remove(summaryPath);

        // Also delete hierarchical summary if exists
        const hierarchicalPath = this.getHierarchicalSummaryPath(contextId);
        if (await fs.pathExists(hierarchicalPath)) {
          await fs.remove(hierarchicalPath);
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error deleting summary for ${contextId}:`, error);
      return false;
    }
  }

  async initialize(): Promise<void> {
    // ... initialization logic ...
    console.error('[FS REPO] Initialized FileSystemRepository'); // Add log
  }

  /**
   * Add a message to a context
   * Appends the message to the .messages.jsonl file
   */
  async addMessage(contextId: string, message: Message): Promise<void> {
    const messagesPath = this.getMessagesPath(contextId);
    const metadataPath = this.getMetadataPath(contextId);
    const messageLine = JSON.stringify(message) + '\n';

    try {
      await fs.ensureDir(path.dirname(messagesPath));
      await fs.ensureDir(path.dirname(metadataPath));

      let metadata: ContextMetadata | undefined;
      await fs.ensureFile(metadataPath);
      metadata = await this.loadContextData(contextId);

      if (!metadata) {
        metadata = {
          contextId,
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          messagesSinceLastSummary: 0,
        };
        await this.saveContextData(contextId, metadata);
      }

      metadata.lastActivityAt = Date.now();

      await fs.ensureFile(messagesPath);
      await fs.appendFile(messagesPath, messageLine);

      await this.saveContextData(contextId, metadata);
    } catch (error: unknown) {
      console.error(`[FileSystemRepository] Error adding message to ${contextId}:`, error);
      throw new Error(`Failed to add message to ${contextId}: ${(error as Error).message}`);
    }
  }

  /**
   * Load all messages for a context
   * Reads the .messages.jsonl file line by line
   */
  async loadMessages(contextId: string): Promise<Message[]> {
    const messagesPath = this.getMessagesPath(contextId);
    const messages: Message[] = [];

    if (!(await fs.pathExists(messagesPath))) {
      return []; // No messages file, return empty array
    }

    try {
      const fileContent = await fs.readFile(messagesPath, 'utf-8');
      const lines = fileContent.trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            messages.push(JSON.parse(line));
          } catch (parseError: unknown) {
            console.error(
              `[FileSystemRepository] Error parsing message line for ${contextId}: ${line}`,
              parseError
            );
            // Optionally skip corrupted lines or throw an error
          }
        }
      }
      return messages;
    } catch (error: unknown) {
      console.error(`[FileSystemRepository] Error loading messages for ${contextId}:`, error);
      throw new Error(`Failed to load messages for ${contextId}: ${(error as Error).message}`);
    }
  }

  /**
   * Load metadata for a specific context
   * @param contextId Context identifier
   * @returns Context metadata or undefined if not found or invalid
   */
  async loadContextData(contextId: string): Promise<ContextMetadata | undefined> {
    const metadataPath = this.getMetadataPath(contextId);
    try {
      if (!(await fs.pathExists(metadataPath))) {
        return undefined; // File doesn't exist
      }
      // Read the file content first to check if it's empty
      const content = await fs.readFile(metadataPath, 'utf-8');
      if (content.trim() === '') {
        console.warn(
          `[FileSystemRepository] Metadata file for ${contextId} is empty. Treating as non-existent.`
        );
        // Optionally, delete the empty file?
        // await fs.remove(metadataPath);
        return undefined; // Empty file, treat as non-existent
      }
      // If not empty, try parsing
      return await fs.readJson(metadataPath);
    } catch (error: unknown) {
      // Handle JSON parsing errors specifically
      if (error instanceof SyntaxError) {
        console.error(
          `[FileSystemRepository] Error parsing JSON in metadata file ${metadataPath}:`,
          error
        );
        // Decide how to handle corrupted metadata (e.g., delete, backup, return undefined)
        // For now, return undefined to indicate failure to load valid metadata
        return undefined;
      } else {
        // Handle other file system errors
        console.error(
          `[FileSystemRepository] Error loading metadata for ${contextId} from ${metadataPath}:`,
          error
        );
        return undefined;
      }
    }
  }

  /**
   * Save context metadata
   */
  async saveContextData(contextId: string, metadata: ContextMetadata): Promise<void> {
    const metadataPath = this.getMetadataPath(contextId);
    try {
      await fs.ensureDir(path.dirname(metadataPath));
      await fs.writeJson(metadataPath, metadata, { spaces: 2 });
    } catch (error: unknown) {
      console.error(`[FileSystemRepository] Error saving metadata for ${contextId}:`, error);
      throw new Error(`Failed to save metadata for ${contextId}: ${(error as Error).message}`);
    }
  }

  /**
   * Load the full context data (metadata, messages, summary)
   * Ensure return type matches the imported ContextData from types.ts
   */
  async loadContext(contextId: string): Promise<ContextData | undefined> {
    const metadata = await this.loadContextData(contextId);
    if (!metadata) {
      return undefined;
    }

    const messages = await this.loadMessages(contextId);
    const summary = await this.loadSummary(contextId);

    // Construct the object matching the imported ContextData type from types.ts
    // Make sure all required fields from types.ts->ContextData are present
    const contextData: ContextData = {
      contextId: metadata.contextId, // Get from metadata
      metadata,
      messages,
      summary: summary || null,
      // Add other properties required by ContextData from types.ts, using metadata values
      messagesSinceLastSummary: metadata.messagesSinceLastSummary || 0,
      hasSummary: metadata.hasSummary || false,
      lastSummarizedAt: metadata.lastSummarizedAt,
      // tokenCount, importanceScore, relatedContexts, parentContextId are optional or potentially derived elsewhere
      // Initialize them as undefined or with default values if appropriate based on types.ts definition
      tokenCount: undefined, // Placeholder - calculate if needed
      importanceScore: metadata.importanceScore, // Assuming importanceScore might be in metadata
      relatedContexts: metadata.relatedContexts, // Assuming relatedContexts might be in metadata
      parentContextId: metadata.parentContextId, // Assuming parentContextId might be in metadata
    };

    // Type check: Ensure the constructed object satisfies the imported ContextData interface
    const check: ContextData = contextData;

    return contextData;
  }

  /**
   * Delete all data associated with a context (metadata, messages, summaries)
   */
  async deleteContext(contextId: string): Promise<boolean> {
    const metadataPath = this.getMetadataPath(contextId);
    const messagesPath = this.getMessagesPath(contextId);
    const summaryPath = this.getSummaryPath(contextId);
    const hierarchicalPath = this.getHierarchicalSummaryPath(contextId);

    let deletedSomething = false;
    const errors: Error[] = [];

    for (const filePath of [metadataPath, messagesPath, summaryPath, hierarchicalPath]) {
      try {
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
          console.log(`[FileSystemRepository] Deleted file: ${filePath}`);
          deletedSomething = true;
        }
      } catch (error: unknown) {
        console.error(`[FileSystemRepository] Error deleting file ${filePath}:`, error);
        errors.push(error as Error);
      }
    }

    if (errors.length > 0) {
      console.error(
        `[FileSystemRepository] Encountered ${errors.length} error(s) during context deletion for ${contextId}.`
      );
    }

    return deletedSomething;
  }
}

function getBasePathFromConfig(config: MCPConfig): string {
  const defaultPath = path.join(process.cwd(), config.contextDir || '.prompt-context');
  if (!fs.existsSync(defaultPath)) {
    fs.mkdirSync(defaultPath, { recursive: true });
  }
  return defaultPath;
}

export async function initializeRepositories(config: MCPConfig): Promise<Repositories> {
  console.error('[REPO INIT] Starting repository initialization...');
  const fsRepo = new FileSystemRepository(config);
  await fsRepo.initialize();
  console.error('[REPO INIT] FileSystemRepository initialized.');

  let vectorRepo: VectorRepository | undefined = undefined;
  const repoPath = getBasePathFromConfig(config);
  const vectorDataDir = path.join(repoPath, 'vectors'); // Directory for vector data
  // const vectorDbPath = path.join(vectorDataDir, 'vector_index.bin'); // Path is handled internally now?
  // const idMapPath = path.join(vectorDataDir, 'vector_id_map.json'); // Path is handled internally now?

  if (config.useVectorDb) {
    console.error('[REPO INIT] Initializing VectorRepository with dir:', vectorDataDir);
    try {
      // Pass the directory path and dimensions
      vectorRepo = new VectorRepository(
        vectorDataDir,
        config.vectorDb?.dimensions // Pass optional dimension (defaults to 384 in constructor)
      );
      console.error('[REPO INIT] VectorRepository instantiated.');
    } catch (err) {
      console.error('[REPO INIT] Failed to instantiate VectorRepository:', err);
      vectorRepo = undefined;
    }
  } else {
    console.error('[REPO INIT] VectorRepository instantiation skipped (useVectorDb=false).');
  }

  let graphRepo: GraphRepository | undefined = undefined;
  const graphDbPath = path.join(repoPath, 'graph_data.json'); // Path for GraphRepository

  if (config.useGraphDb) {
    console.error('[REPO INIT] Initializing GraphRepository...');
    try {
      // Pass the file path string to the constructor
      graphRepo = new GraphRepository(graphDbPath);
      console.error('[REPO INIT] GraphRepository instantiated with path:', graphDbPath);
    } catch (err) {
      console.error('[REPO INIT] Failed to instantiate GraphRepository:', err);
      graphRepo = undefined;
    }
  } else {
    console.error('[REPO INIT] GraphRepository instantiation skipped (useGraphDb=false).');
  }

  console.error('[REPO INIT] Repository initialization complete.');
  return {
    fs: fsRepo,
    vector: vectorRepo,
    graph: graphRepo,
  };
}
