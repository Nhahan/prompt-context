import fs from 'fs-extra';
import path from 'path';
import { Message, ContextMetadata, ContextData, ContextSummary } from '../domain/types';

/**
 * Sanitize a file path segment to ensure valid file names
 * @param segment Path segment to sanitize
 * @returns Sanitized path segment
 */
function sanitizePathSegment(segment: string | undefined | null): string {
  // 입력 검증: undefined나 null 처리
  if (segment === undefined || segment === null) {
    console.error('[WARNING] sanitizePathSegment received undefined or null value');
    return 'undefined_segment';
  }
  
  // 문자열이 아닌 경우 문자열로 변환
  if (typeof segment !== 'string') {
    console.error(`[WARNING] sanitizePathSegment received non-string value: ${typeof segment}`);
    segment = String(segment);
  }
  
  // 빈 문자열 처리
  if (segment.trim().length === 0) {
    console.error('[WARNING] sanitizePathSegment received empty string');
    return 'empty_segment';
  }
  
  // 경로 조작 방지 - 경로 구분자 및 상위 디렉토리 참조 제거
  segment = segment.replace(/\.\./g, '_').replace(/[\/\\]/g, '_');
  
  // 파일 시스템에서 문제를 일으킬 수 있는 문자 제거
  return segment.replace(/[/:*?"<>|]/g, '_');
}

/**
 * File system based repository for persistent storage
 */
export class FileSystemRepository {
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
}
