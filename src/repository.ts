import * as fs from 'fs-extra';
import * as path from 'path';
import * as git from 'isomorphic-git';
import { ContextSummary, MCPConfig, Repository } from './types';
import IgnoreClass from 'ignore';

/**
 * 컨텍스트 저장소 구현
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
   * 저장소 생성자
   * @param config MCP 설정 객체
   */
  constructor(config: MCPConfig) {
    this.config = config;
    this.ignoreInstance = IgnoreClass().add(this.defaultIgnorePatterns);
    
    if (config.ignorePatterns && config.ignorePatterns.length > 0) {
      this.ignoreInstance.add(config.ignorePatterns);
    }
    
    // .gitignore 파일이 있으면 읽어서 무시 패턴 추가
    this.loadGitIgnorePatterns();
    
    // 컨텍스트 디렉토리 생성
    this.ensureContextDirectory();
  }

  /**
   * .gitignore 파일에서 무시 패턴 로드
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
   * 컨텍스트 디렉토리 존재 확인 및 생성
   */
  private ensureContextDirectory(): void {
    const contextDir = path.resolve(process.cwd(), this.config.contextDir);
    fs.ensureDirSync(contextDir);
  }

  /**
   * 컨텍스트 ID에 대한 요약 파일 경로 반환
   * @param contextId 컨텍스트 ID
   * @returns 요약 파일 경로
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
   * 요약 저장
   * @param summary 저장할 요약
   */
  async saveSummary(summary: ContextSummary): Promise<void> {
    const summaryPath = this.getSummaryPath(summary.contextId);
    await fs.writeJson(summaryPath, summary, { spaces: 2 });
    
    if (this.config.useGit) {
      await this.commitFile(summaryPath, `Update summary for ${summary.contextId}`);
    }
  }

  /**
   * 요약 로드
   * @param contextId 컨텍스트 ID
   * @returns 저장된 요약 또는 undefined (존재하지 않는 경우)
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
   * Git에 파일 커밋
   * @param filePath 커밋할 파일 경로
   * @param message 커밋 메시지
   */
  private async commitFile(filePath: string, message: string): Promise<void> {
    const dir = process.cwd();
    const relativePath = path.relative(dir, filePath);
    
    try {
      // Git 저장소 확인
      const isRepo = await this.isGitRepository();
      
      // Git 저장소가 아니면 초기화
      if (!isRepo) {
        await git.init({ fs, dir });
      }
      
      // 파일 스테이징
      await git.add({ fs, dir, filepath: relativePath });
      
      // 커밋
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
   * Git 저장소 여부 확인
   * @returns 저장소 여부
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
   * Git 변경사항 커밋
   * @param message 커밋 메시지
   */
  async commit(message: string): Promise<void> {
    if (!this.config.useGit) return;
    
    const dir = process.cwd();
    const contextDir = path.join(dir, this.config.contextDir);
    
    try {
      // Git 저장소 확인
      const isRepo = await this.isGitRepository();
      
      // Git 저장소가 아니면 초기화
      if (!isRepo) {
        await git.init({ fs, dir });
      }
      
      // 컨텍스트 디렉토리의 모든 변경사항 스테이징
      const files = await fs.readdir(contextDir);
      for (const file of files) {
        const filePath = path.relative(dir, path.join(contextDir, file));
        await git.add({ fs, dir, filepath: filePath });
      }
      
      // 커밋
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
   * 파일이 무시 패턴에 해당하는지 확인
   * @param filePath 검사할 파일 경로
   * @returns 무시 여부
   */
  shouldIgnore(filePath: string): boolean {
    // 상대 경로로 변환
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(process.cwd(), filePath)
      : filePath;
    
    return this.ignoreInstance.ignores(relativePath);
  }
} 