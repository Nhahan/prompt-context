/**
 * MCP 구성 옵션
 */
export interface MCPConfig {
  /** 요약을 트리거할 메시지 수 임계값 */
  messageLimitThreshold: number;
  /** 요약을 트리거할 토큰 수 임계값 (모델 한계의 백분율) */
  tokenLimitPercentage: number;
  /** 컨텍스트 저장 디렉토리 */
  contextDir: string;
  /** Git 저장소 사용 여부 */
  useGit: boolean;
  /** 무시할 파일 및 디렉토리 패턴 */
  ignorePatterns: string[];
  /** 자동 요약 활성화 여부 */
  autoSummarize: boolean;
}

/**
 * 대화 메시지 구조
 */
export interface Message {
  /** 메시지 역할 (사용자 또는 어시스턴트) */
  role: 'user' | 'assistant';
  /** 메시지 내용 */
  content: string;
  /** 메시지 생성 타임스탬프 */
  timestamp: number;
}

/**
 * 컨텍스트 요약 객체
 */
export interface ContextSummary {
  /** 컨텍스트 ID (일반적으로 파일 경로) */
  contextId: string;
  /** 요약 생성 타임스탬프 */
  lastUpdated: number;
  /** 요약 내용 */
  summary: string;
  /** 컨텍스트에 포함된 코드 블록 */
  codeBlocks: CodeBlock[];
  /** 요약에 포함된 메시지 수 */
  messageCount: number;
  /** 요약 버전 */
  version: number;
}

/**
 * 코드 블록 구조
 */
export interface CodeBlock {
  /** 코드 블록 언어 */
  language?: string;
  /** 코드 내용 */
  code: string;
  /** 코드 블록의 중요도 (0-1 사이의 값, 높을수록 중요) */
  importance?: number;
}

/**
 * 컨텍스트 데이터
 */
export interface ContextData {
  /** 컨텍스트 ID */
  contextId: string;
  /** 메시지 기록 */
  messages: Message[];
  /** 현재 토큰 수 */
  tokenCount: number;
  /** 마지막 요약 이후 메시지 수 */
  messagesSinceLastSummary: number;
  /** 요약 여부 */
  hasSummary: boolean;
  /** 마지막 요약 시간 */
  lastSummarizedAt?: number;
}

/**
 * 문맥 요약 결과
 */
export interface SummaryResult {
  /** 요약 성공 여부 */
  success: boolean;
  /** 생성된 요약 */
  summary?: ContextSummary;
  /** 오류 메시지 */
  error?: string;
}

/**
 * AI 요약 서비스 인터페이스
 */
export interface SummarizerService {
  /** 
   * 컨텍스트 요약 생성
   * @param messages 요약할 메시지 배열
   * @param contextId 컨텍스트 ID
   * @returns 요약 결과
   */
  summarize(messages: Message[], contextId: string): Promise<SummaryResult>;
}

/**
 * 저장소 인터페이스
 */
export interface Repository {
  /**
   * 요약 저장
   * @param summary 저장할 요약
   */
  saveSummary(summary: ContextSummary): Promise<void>;
  
  /**
   * 요약 로드
   * @param contextId 컨텍스트 ID
   * @returns 저장된 요약 또는 undefined (존재하지 않는 경우)
   */
  loadSummary(contextId: string): Promise<ContextSummary | undefined>;
  
  /**
   * Git 변경사항 커밋
   * @param message 커밋 메시지
   */
  commit(message: string): Promise<void>;
  
  /**
   * 컨텍스트 ID 해당 여부 검사
   * @param filePath 검사할 파일 경로
   * @returns 무시 여부
   */
  shouldIgnore(filePath: string): boolean;
} 