import fs from 'fs-extra';
import path from 'path';
import { Repository } from './repository.interface';
import {
  Message,
  ContextMetadata,
  ContextData,
  ContextSummary,
  HierarchicalSummary,
  MetaSummary,
} from '../domain/types';

/**
 * Sanitize a file path segment to ensure valid file names
 * @param segment Path segment to sanitize
 * @returns Sanitized path segment
 */
function sanitizePathSegment(segment: string): string {
  // Remove characters that are problematic in file paths
  return segment.replace(/[/:*?"<>|]/g, '_');
}

/**
 * File system based repository implementation
 */
export class FileSystemRepository implements Repository {
  private baseDir: string;

  /**
   * Repository constructor
   * @param baseDir Base directory for context storage
   */
  constructor(baseDir: string) {
    this.baseDir = baseDir;
    // Create context directory
    this.ensureContextDirectory();
  }

  /**
   * Ensure context directory exists
   */
  private ensureContextDirectory(): void {
    fs.ensureDirSync(this.baseDir);
    fs.ensureDirSync(path.join(this.baseDir, 'hierarchical-summaries'));
    fs.ensureDirSync(path.join(this.baseDir, 'meta-summaries'));
  }

  /**
   * Get the file path for a context summary
   * @param contextId Context identifier
   * @returns Path to the summary file
   */
  private getSummaryPath(contextId: string): string {
    const sanitizedId = sanitizePathSegment(contextId);
    return path.join(this.baseDir, `${sanitizedId}.summary.json`);
  }

  /**
   * Get path to hierarchical summary file
   * @param contextId Context identifier
   * @returns Path to hierarchical summary file
   */
  private getHierarchicalSummaryPath(contextId: string): string {
    const hierarchicalDir = path.join(this.baseDir, 'hierarchical-summaries');
    fs.ensureDirSync(hierarchicalDir);
    return path.join(hierarchicalDir, `${contextId}.hierarchical.json`);
  }

  /**
   * Get path to meta-summary file
   * @param id Meta-summary identifier
   * @returns Path to meta-summary file
   */
  private getMetaSummaryPath(id: string): string {
    const metaDir = path.join(this.baseDir, 'meta-summaries');
    fs.ensureDirSync(metaDir);
    return path.join(metaDir, `${id}.meta.json`);
  }

  /**
   * Get the file path for context messages (JSON Lines format)
   */
  private getMessagesPath(contextId: string): string {
    const sanitizedId = sanitizePathSegment(contextId);
    return path.join(
      this.baseDir,
      `${sanitizedId}.messages.jsonl` // Use .jsonl extension
    );
  }

  /**
   * Get the file path for context metadata
   */
  private getMetadataPath(contextId: string): string {
    const sanitizedId = sanitizePathSegment(contextId);
    return path.join(this.baseDir, `${sanitizedId}.metadata.json`);
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
    const summaryPath = this.getHierarchicalSummaryPath(summary.contextId);
    await fs.writeJson(summaryPath, summary, { spaces: 2 });
  }

  /**
   * Load a hierarchical summary
   * @param contextId Context identifier
   * @returns Stored hierarchical summary or undefined
   */
  async loadHierarchicalSummary(contextId: string): Promise<HierarchicalSummary | undefined> {
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
    const summaryPath = this.getMetaSummaryPath(summary.id);
    await fs.writeJson(summaryPath, summary, { spaces: 2 });
  }

  /**
   * Load a meta-summary
   * @param id Meta-summary identifier
   * @returns Stored meta-summary or undefined
   */
  async loadMetaSummary(id: string): Promise<MetaSummary | undefined> {
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
    const files = await fs.readdir(this.baseDir);

    return files
      .filter((file) => file.endsWith('.summary.json'))
      .map((file) => file.replace(/\.summary\.json$/, ''));
  }

  /**
   * Get all available hierarchical summaries
   * @returns Array of context IDs that have hierarchical summaries
   */
  async getAllHierarchicalContextIds(): Promise<string[]> {
    const hierarchicalDir = path.join(this.baseDir, 'hierarchical-summaries');

    try {
      if (!(await fs.pathExists(hierarchicalDir))) {
        return [];
      }

      const files = await fs.readdir(hierarchicalDir);
      return files
        .filter((file) => file.endsWith('.hierarchical.json'))
        .map((file) => file.replace(/\.hierarchical\.json$/, ''));
    } catch (error) {
      console.error('Error getting hierarchical context IDs:', error);
      return [];
    }
  }

  /**
   * Get all available meta-summaries
   * @returns Array of meta-summary IDs
   */
  async getAllMetaSummaryIds(): Promise<string[]> {
    const metaDir = path.join(this.baseDir, 'meta-summaries');

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
   * Delete a summary
   * @param contextId Context identifier
   * @returns Whether the operation was successful
   */
  async deleteSummary(contextId: string): Promise<boolean> {
    const summaryPath = this.getSummaryPath(contextId);
    const hierarchicalPath = this.getHierarchicalSummaryPath(contextId);

    try {
      // Check if summary exists
      if (await fs.pathExists(summaryPath)) {
        await fs.remove(summaryPath);
      }

      // Check if hierarchical summary exists
      if (await fs.pathExists(hierarchicalPath)) {
        await fs.remove(hierarchicalPath);
      }

      return true;
    } catch (error) {
      console.error(`Error deleting summary for ${contextId}:`, error);
      return false;
    }
  }

  /**
   * Initialize the repository
   */
  async initialize(): Promise<void> {
    this.ensureContextDirectory();
  }

  /**
   * Add a message to a context
   * @param contextId Context identifier
   * @param message Message to add
   */
  async addMessage(contextId: string, message: Message): Promise<void> {
    const messagesPath = this.getMessagesPath(contextId);
    const metadataPath = this.getMetadataPath(contextId);

    // Ensure message has a timestamp
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    // Add the message as a single line to the JSONL file
    await fs.appendFile(messagesPath, JSON.stringify(message) + '\n');

    // Update metadata
    let metadata: ContextMetadata;
    try {
      if (await fs.pathExists(metadataPath)) {
        metadata = await fs.readJson(metadataPath);
        metadata.lastActivityAt = Date.now();
        metadata.messagesSinceLastSummary = (metadata.messagesSinceLastSummary || 0) + 1;
        metadata.totalMessageCount = (metadata.totalMessageCount || 0) + 1;
      } else {
        metadata = {
          contextId,
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          messagesSinceLastSummary: 1,
          hasSummary: false,
          totalMessageCount: 1,
        };
      }

      await fs.writeJson(metadataPath, metadata, { spaces: 2 });
    } catch (error) {
      console.error(`Error updating metadata for ${contextId}:`, error);
      throw error;
    }
  }

  /**
   * Load messages for a context
   * @param contextId Context identifier
   * @returns Array of messages
   */
  async loadMessages(contextId: string): Promise<Message[]> {
    const messagesPath = this.getMessagesPath(contextId);

    try {
      if (!(await fs.pathExists(messagesPath))) {
        return [];
      }

      const content = await fs.readFile(messagesPath, 'utf8');
      if (!content.trim()) {
        return [];
      }

      // Parse JSONL format
      return content
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as Message;
          } catch (error) {
            console.error(`Error parsing message line: ${line}`, error);
            return null;
          }
        })
        .filter((message): message is Message => message !== null);
    } catch (error) {
      console.error(`Error loading messages for ${contextId}:`, error);
      return [];
    }
  }

  /**
   * Load context metadata
   * @param contextId Context identifier
   * @returns Context metadata or undefined if it doesn't exist
   */
  async loadContextData(contextId: string): Promise<ContextMetadata | undefined> {
    const metadataPath = this.getMetadataPath(contextId);

    try {
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJson(metadataPath);

        // Ensure all required fields
        return {
          contextId: metadata.contextId || contextId,
          createdAt: metadata.createdAt || 0,
          lastActivityAt: metadata.lastActivityAt || 0,
          messagesSinceLastSummary: metadata.messagesSinceLastSummary || 0,
          hasSummary: metadata.hasSummary || false,
          lastSummarizedAt: metadata.lastSummarizedAt,
          importanceScore: metadata.importanceScore,
          parentContextId: metadata.parentContextId,
          totalMessageCount: metadata.totalMessageCount,
          totalTokenCount: metadata.totalTokenCount,
        };
      }
    } catch (error) {
      console.error(`Error loading metadata for ${contextId}:`, error);
    }

    return undefined;
  }

  /**
   * Save context metadata
   * @param contextId Context identifier
   * @param metadata Metadata to save
   */
  async saveContextData(contextId: string, metadata: ContextMetadata): Promise<void> {
    const metadataPath = this.getMetadataPath(contextId);
    await fs.writeJson(metadataPath, metadata, { spaces: 2 });
  }

  /**
   * Load a full context including metadata, messages, and summary
   * @param contextId Context identifier
   * @returns Context data or undefined if it doesn't exist
   */
  async loadContext(contextId: string): Promise<ContextData | undefined> {
    try {
      const metadata = await this.loadContextData(contextId);
      if (!metadata) {
        return undefined;
      }

      const messages = await this.loadMessages(contextId);
      const summary = await this.loadSummary(contextId);

      const hasSummary = Boolean(summary);
      metadata.hasSummary = hasSummary;

      // Create and return the context data
      return {
        contextId,
        metadata,
        messages,
        summary,
        messagesSinceLastSummary: metadata.messagesSinceLastSummary || 0,
        hasSummary,
        lastSummarizedAt: metadata.lastSummarizedAt,
        importanceScore: metadata.importanceScore,
        relatedContexts: summary?.relatedContexts,
        parentContextId: metadata.parentContextId,
      };
    } catch (error) {
      console.error(`Error loading context ${contextId}:`, error);
      return undefined;
    }
  }

  /**
   * Delete a context
   * @param contextId Context identifier
   * @returns Whether the operation was successful
   */
  async deleteContext(contextId: string): Promise<boolean> {
    const messagesPath = this.getMessagesPath(contextId);
    const metadataPath = this.getMetadataPath(contextId);
    const summaryPath = this.getSummaryPath(contextId);
    const hierarchicalPath = this.getHierarchicalSummaryPath(contextId);

    try {
      if (await fs.pathExists(messagesPath)) {
        await fs.unlink(messagesPath);
      }

      if (await fs.pathExists(metadataPath)) {
        await fs.unlink(metadataPath);
      }

      if (await fs.pathExists(summaryPath)) {
        await fs.unlink(summaryPath);
      }

      if (await fs.pathExists(hierarchicalPath)) {
        await fs.unlink(hierarchicalPath);
      }

      return true;
    } catch (error) {
      console.error(`Error deleting context ${contextId}:`, error);
      return false;
    }
  }
}
