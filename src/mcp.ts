import { FileSystemRepository } from './repository';
import { SimpleTextSummarizer } from './summarizer';
import { 
  ContextData, 
  ContextSummary, 
  MCPConfig, 
  Message, 
  SummarizerService
} from './types';

/**
 * 기본 MCP 설정
 */
const DEFAULT_CONFIG: MCPConfig = {
  messageLimitThreshold: 10,
  tokenLimitPercentage: 80,
  contextDir: '.prompt-context',
  useGit: true,
  ignorePatterns: [],
  autoSummarize: true
};

/**
 * Memory Context Protocol (MCP) 클래스
 * AI 에이전트를 위한 문맥 기억 프로토콜
 */
export class MemoryContextProtocol {
  private config: MCPConfig;
  private repository: FileSystemRepository;
  private summarizer: SummarizerService;
  private contexts: Map<string, ContextData> = new Map();
  
  /**
   * MCP 생성자
   * @param config 구성 옵션
   * @param summarizer 요약 서비스 인스턴스 (선택적)
   */
  constructor(
    config: Partial<MCPConfig> = {}, 
    summarizer?: SummarizerService
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.repository = new FileSystemRepository(this.config);
    this.summarizer = summarizer || new SimpleTextSummarizer();
  }
  
  /**
   * 메시지 토큰 수 추정 (간단한 휴리스틱 사용)
   * @param message 메시지 객체
   * @returns 추정 토큰 수
   */
  private estimateTokenCount(message: Message): number {
    // 간단한 휴리스틱: 평균적으로 단어 당 1.3 토큰
    return Math.ceil(message.content.split(/\s+/).length * 1.3);
  }
  
  /**
   * 컨텍스트 데이터 초기화
   * @param contextId 컨텍스트 ID
   * @returns 초기화된 컨텍스트 데이터
   */
  private async initializeContext(contextId: string): Promise<ContextData> {
    // 컨텍스트 ID가 무시 패턴에 해당하는지 확인
    if (this.repository.shouldIgnore(contextId)) {
      throw new Error(`Context ID "${contextId}" matches ignore pattern`);
    }
    
    // 저장된 요약 로드
    const savedSummary = await this.repository.loadSummary(contextId);
    
    const contextData: ContextData = {
      contextId,
      messages: [],
      tokenCount: 0,
      messagesSinceLastSummary: 0,
      hasSummary: !!savedSummary,
      lastSummarizedAt: savedSummary?.lastUpdated
    };
    
    this.contexts.set(contextId, contextData);
    return contextData;
  }
  
  /**
   * 컨텍스트 데이터 가져오기
   * @param contextId 컨텍스트 ID
   * @param createIfNotExists 존재하지 않을 경우 생성 여부
   * @returns 컨텍스트 데이터
   */
  private async getContext(
    contextId: string, 
    createIfNotExists = true
  ): Promise<ContextData | undefined> {
    let context = this.contexts.get(contextId);
    
    if (!context && createIfNotExists) {
      context = await this.initializeContext(contextId);
    }
    
    return context;
  }
  
  /**
   * 컨텍스트에 메시지 추가
   * @param contextId 컨텍스트 ID
   * @param message 추가할 메시지
   * @returns 업데이트된 컨텍스트 데이터
   */
  async addMessage(contextId: string, message: Message): Promise<ContextData> {
    const context = await this.getContext(contextId);
    if (!context) {
      throw new Error(`Failed to get or create context: ${contextId}`);
    }
    
    // 토큰 수 추정
    const tokenCount = this.estimateTokenCount(message);
    
    // 메시지 및 관련 정보 추가
    context.messages.push(message);
    context.tokenCount += tokenCount;
    context.messagesSinceLastSummary += 1;
    
    // 자동 요약 활성화 상태이면 요약 필요 여부 확인
    if (this.config.autoSummarize && this.shouldSummarize(context)) {
      await this.summarizeContext(contextId);
    }
    
    return context;
  }
  
  /**
   * 요약 필요 여부 확인
   * @param context 컨텍스트 데이터
   * @returns 요약 필요 여부
   */
  private shouldSummarize(context: ContextData): boolean {
    // 메시지 수 기준
    if (context.messagesSinceLastSummary >= this.config.messageLimitThreshold) {
      return true;
    }
    
    // 토큰 한계 기준 (대략적인 구현)
    const tokenLimit = 4096; // 일반적인 모델 한계
    const thresholdTokens = tokenLimit * (this.config.tokenLimitPercentage / 100);
    
    return context.tokenCount >= thresholdTokens;
  }
  
  /**
   * 컨텍스트 요약
   * @param contextId 컨텍스트 ID
   * @returns 요약 성공 여부
   */
  async summarizeContext(contextId: string): Promise<boolean> {
    const context = await this.getContext(contextId, false);
    if (!context || context.messages.length === 0) {
      return false;
    }
    
    // 요약 생성
    const result = await this.summarizer.summarize(context.messages, contextId);
    
    if (result.success && result.summary) {
      // 요약 저장
      await this.repository.saveSummary(result.summary);
      
      // 컨텍스트 데이터 업데이트
      context.hasSummary = true;
      context.messagesSinceLastSummary = 0;
      context.lastSummarizedAt = Date.now();
      
      // Git 저장소 커밋
      if (this.config.useGit) {
        await this.repository.commit(`Summarize context: ${contextId}`);
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * 저장된 요약 로드
   * @param contextId 컨텍스트 ID
   * @returns 요약 객체 또는 undefined
   */
  async loadSummary(contextId: string): Promise<ContextSummary | undefined> {
    return this.repository.loadSummary(contextId);
  }
  
  /**
   * 컨텍스트 메시지 가져오기
   * @param contextId 컨텍스트 ID
   * @returns 메시지 배열 또는 undefined
   */
  async getMessages(contextId: string): Promise<Message[] | undefined> {
    const context = await this.getContext(contextId, false);
    return context?.messages;
  }
  
  /**
   * 모든 컨텍스트 요약
   * @returns 성공한 요약 수
   */
  async summarizeAllContexts(): Promise<number> {
    let successCount = 0;
    
    for (const contextId of this.contexts.keys()) {
      const success = await this.summarizeContext(contextId);
      if (success) {
        successCount++;
      }
    }
    
    return successCount;
  }
  
  /**
   * 요약 서비스 설정
   * @param summarizer 새 요약 서비스
   */
  setSummarizer(summarizer: SummarizerService): void {
    this.summarizer = summarizer;
  }
  
  /**
   * MCP 설정 업데이트
   * @param config 새 설정 객체
   */
  updateConfig(config: Partial<MCPConfig>): void {
    this.config = { ...this.config, ...config };
    this.repository = new FileSystemRepository(this.config);
  }
  
  /**
   * 현재 MCP 설정 가져오기
   * @returns 현재 설정
   */
  getConfig(): MCPConfig {
    return { ...this.config };
  }
} 