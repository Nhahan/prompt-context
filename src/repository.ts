import fs from 'fs-extra';
import path from 'path';
import * as git from 'isomorphic-git';
import { ContextSummary, MCPConfig, Repository, HierarchicalSummary, MetaSummary } from './types';
import IgnoreClass from 'ignore';

/**
 * Context repository implementation
 */
export class FileSystemRepository implements Repository {
  private config: MCPConfig;
  private ignoreInstance: ReturnType<typeof IgnoreClass>;
  private defaultIgnorePatterns = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    'tmp',
    '*.log',
    '*.lock',
    '*.min.*',
    '*.map'
  ];

  /**
   * Repository constructor
   * @param config MCP configuration object
   */
  constructor(config: MCPConfig) {
    this.config = config;
    this.ignoreInstance = IgnoreClass().add(this.defaultIgnorePatterns);
    
    if (config.ignorePatterns && config.ignorePatterns.length > 0) {
      this.ignoreInstance.add(config.ignorePatterns);
    }
    
    // Load patterns from .gitignore if it exists
    this.loadGitIgnorePatterns();
    
    // Create context directory
    this.ensureContextDirectory();
  }

  /**
   * Load ignore patterns from .gitignore file
   */
  private loadGitIgnorePatterns(): void {
    try {
      const gitIgnorePath = path.resolve(process.cwd(), '.gitignore');
      if (fs.existsSync(gitIgnorePath)) {
        const gitIgnoreContent = fs.readFileSync(gitIgnorePath, 'utf-8');
        const patterns = gitIgnoreContent
          .split('\n')
          .filter(line => line.trim() !== '' && !line.startsWith('#'));
        
        this.ignoreInstance.add(patterns);
      }
    } catch (error) {
      console.warn('Failed to load .gitignore patterns:', error);
    }
  }

  /**
   * Ensure context directory exists
   */
  private ensureContextDirectory(): void {
    const contextDir = path.resolve(process.cwd(), this.config.contextDir);
    fs.ensureDirSync(contextDir);
    
    // Create subdirectories for hierarchical summaries and meta-summaries
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
    return path.join(
      process.cwd(),
      this.config.contextDir,
      `${sanitizedId}.summary.json`
    );
  }

  /**
   * Get path to hierarchical summary file
   * @param contextId Context identifier
   * @returns Path to hierarchical summary file
   */
  private getHierarchicalSummaryPath(contextId: string): string {
    // Ensure directory exists
    const hierarchicalDir = path.join(process.cwd(), this.config.contextDir, 'hierarchical-summaries');
    fs.ensureDirSync(hierarchicalDir);
    
    return path.join(hierarchicalDir, `${contextId}.hierarchical.json`);
  }

  /**
   * Get path to meta-summary file
   * @param id Meta-summary identifier
   * @returns Path to meta-summary file
   */
  private getMetaSummaryPath(id: string): string {
    // Ensure directory exists
    const metaDir = path.join(process.cwd(), this.config.contextDir, 'meta-summaries');
    fs.ensureDirSync(metaDir);
    
    return path.join(metaDir, `${id}.meta.json`);
  }

  /**
   * Save a context summary
   * @param summary Summary to save
   */
  async saveSummary(summary: ContextSummary): Promise<void> {
    const summaryPath = this.getSummaryPath(summary.contextId);
    await fs.writeJson(summaryPath, summary, { spaces: 2 });
    
    if (this.config.useGit) {
      await this.commitFile(summaryPath, `Update summary for ${summary.contextId}`);
    }
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
    
    if (this.config.useGit) {
      await this.commitFile(summaryPath, `Update hierarchical summary for ${summary.contextId}`);
    }
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
    
    if (this.config.useGit) {
      await this.commitFile(summaryPath, `Update meta-summary ${summary.id}`);
    }
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
    const contextDir = path.join(process.cwd(), this.config.contextDir);
    const files = await fs.readdir(contextDir);
    
    return files
      .filter(file => file.endsWith('.summary.json'))
      .map(file => file.replace(/\.summary\.json$/, ''));
  }

  /**
   * Get all available hierarchical summaries
   * @returns Array of context IDs that have hierarchical summaries
   */
  async getAllHierarchicalContextIds(): Promise<string[]> {
    if (!this.config.hierarchicalContext) return [];
    
    const hierarchicalDir = path.join(process.cwd(), this.config.contextDir, 'hierarchical-summaries');
    
    try {
      if (!await fs.pathExists(hierarchicalDir)) {
        return [];
      }
      
      const files = await fs.readdir(hierarchicalDir);
      
      return files
        .filter(file => file.endsWith('.hierarchical.json'))
        .map(file => file.replace(/\.hierarchical\.json$/, ''));
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
    
    const metaDir = path.join(process.cwd(), this.config.contextDir, 'meta-summaries');
    
    try {
      if (!await fs.pathExists(metaDir)) {
        return [];
      }
      
      const files = await fs.readdir(metaDir);
      
      return files
        .filter(file => file.endsWith('.meta.json'))
        .map(file => file.replace(/\.meta\.json$/, ''));
    } catch (error) {
      console.error('Error getting meta-summary IDs:', error);
      return [];
    }
  }

  /**
   * Commit a file to Git
   * @param filePath Path to the file to commit
   * @param message Commit message
   */
  private async commitFile(filePath: string, message: string): Promise<void> {
    const dir = process.cwd();
    const relativePath = path.relative(dir, filePath);
    
    try {
      // Check if Git repository exists
      const isRepo = await this.isGitRepository();
      
      // Initialize if not a Git repository
      if (!isRepo) {
        await git.init({ fs, dir });
      }
      
      // Stage the file
      await git.add({ fs, dir, filepath: relativePath });
      
      // Commit
      await git.commit({
        fs,
        dir,
        message,
        author: {
          name: 'Prompt Context',
          email: 'prompt-context@example.com'
        }
      });
    } catch (error) {
      console.error('Git commit error:', error);
    }
  }

  /**
   * Check if current directory is a Git repository
   * @returns Whether it's a Git repository
   */
  private async isGitRepository(): Promise<boolean> {
    try {
      await git.findRoot({ fs, filepath: process.cwd() });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Commit all changes in the context directory
   * @param message Commit message
   */
  async commit(message: string): Promise<void> {
    if (!this.config.useGit) return;
    
    const dir = process.cwd();
    const contextDir = path.join(dir, this.config.contextDir);
    
    try {
      // Check if Git repository exists
      const isRepo = await this.isGitRepository();
      
      // Initialize if not a Git repository
      if (!isRepo) {
        await git.init({ fs, dir });
      }
      
      // Stage all changes in the context directory
      const files = await this.getAllFilesRecursively(contextDir);
      for (const file of files) {
        const filePath = path.relative(dir, file);
        await git.add({ fs, dir, filepath: filePath });
      }
      
      // Commit
      await git.commit({
        fs,
        dir,
        message,
        author: {
          name: 'Prompt Context',
          email: 'prompt-context@example.com'
        }
      });
    } catch (error) {
      console.error('Git commit error:', error);
    }
  }

  /**
   * Get all files recursively in a directory
   * @param directory Directory to scan
   * @returns Array of file paths
   */
  private async getAllFilesRecursively(directory: string): Promise<string[]> {
    const files: string[] = [];
    
    async function scan(dir: string) {
      const entriesPromise = fs.readdir(dir, { withFileTypes: true });
      const entries = await entriesPromise;
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    }
    
    await scan(directory);
    return files;
  }

  /**
   * Check if a file should be ignored based on patterns
   * @param filePath Path to check
   * @returns Whether the file should be ignored
   */
  shouldIgnore(filePath: string): boolean {
    // Convert to relative path if absolute
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(process.cwd(), filePath)
      : filePath;
    
    return this.ignoreInstance.ignores(relativePath);
  }
} 