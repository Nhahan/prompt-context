import { CodeBlock, ContextSummary, Message, SummarizerService, SummaryResult } from './types';

/**
 * 기본 요약 서비스 구현
 * 실제 AI 모델과 통합하는 방법은 사용자가 구현해야 함
 */
export abstract class BaseSummarizer implements SummarizerService {
  /**
   * 메시지에서 코드 블록 추출
   * @param messages 메시지 배열
   * @returns 추출된 코드 블록 배열
   */
  protected extractCodeBlocks(messages: Message[]): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    const codeBlockRegex = /```(?:([\w-]+)\n)?([\s\S]*?)```/g;
    
    for (const message of messages) {
      let match;
      while ((match = codeBlockRegex.exec(message.content)) !== null) {
        const language = match[1] || undefined;
        const code = match[2].trim();
        
        codeBlocks.push({
          language,
          code,
          importance: 1.0 // 기본적으로 모든 코드 블록은 중요하다고 가정
        });
      }
    }
    
    return codeBlocks;
  }

  /**
   * 요약 객체 생성
   * @param contextId 컨텍스트 ID
   * @param summary 요약 텍스트
   * @param messages 원본 메시지 배열
   * @param version
   * @returns 요약 객체
   */
  protected createSummaryObject(
    contextId: string,
    summary: string,
    messages: Message[],
    version = 1
  ): ContextSummary {
    return {
      contextId,
      lastUpdated: Date.now(),
      summary,
      codeBlocks: this.extractCodeBlocks(messages),
      messageCount: messages.length,
      version
    };
  }
  
  /**
   * 요약 생성 (추상 메소드)
   * @param messages 요약할 메시지 배열
   * @param contextId 컨텍스트 ID
   * @returns 요약 결과
   */
  abstract summarize(messages: Message[], contextId: string): Promise<SummaryResult>;
}

/**
 * 기본 텍스트 요약 서비스
 * 실제 AI 모델을 사용하지 않고 간단한 요약 생성
 */
export class SimpleTextSummarizer extends BaseSummarizer {
  /**
   * 간단한 요약 생성
   * @param messages 요약할 메시지 배열
   * @param contextId 컨텍스트 ID
   * @returns 요약 결과
   */
  async summarize(messages: Message[], contextId: string): Promise<SummaryResult> {
    try {
      if (!messages || messages.length === 0) {
        return { success: false, error: 'No messages to summarize' };
      }

      // 간단한 요약: 메시지 수와 최근 주제를 포함한 문자열
      const lastUserMessage = messages
        .filter(m => m.role === 'user')
        .slice(-3)
        .map(m => m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''))
        .join(' | ');

      const summary = `컨텍스트 ${contextId}에 대한 ${messages.length}개 메시지 요약. 최근 주제: ${lastUserMessage}`;
      const summaryObject = this.createSummaryObject(contextId, summary, messages);
      
      return { success: true, summary: summaryObject };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }
}

/**
 * 외부 AI 모델과 통합할 수 있는 추상 클래스
 */
export abstract class AIModelSummarizer extends BaseSummarizer {
  /**
   * AI 모델에 요약 요청을 보내는 추상 메소드
   * @param messages 요약할 메시지 배열
   * @returns AI 모델에서 생성된 요약 텍스트
   */
  protected abstract generateSummaryWithAI(messages: Message[]): Promise<string>;
  
  /**
   * AI 모델을 사용한 요약 생성
   * @param messages 요약할 메시지 배열
   * @param contextId 컨텍스트 ID
   * @returns 요약 결과
   */
  async summarize(messages: Message[], contextId: string): Promise<SummaryResult> {
    try {
      if (!messages || messages.length === 0) {
        return { success: false, error: 'No messages to summarize' };
      }
      
      // AI 모델을 사용하여 요약 생성
      const summaryText = await this.generateSummaryWithAI(messages);
      const summaryObject = this.createSummaryObject(contextId, summaryText, messages);
      
      return { success: true, summary: summaryObject };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * 사용자 정의 외부 AI 서비스와 통합하기 위한 예제 구현
 */
export class CustomAISummarizer extends AIModelSummarizer {
  private summarizerFunction: (messages: Message[]) => Promise<string>;
  
  /**
   * 생성자
   * @param summarizerFunction 외부 AI 모델과 통신하는 함수
   */
  constructor(summarizerFunction: (messages: Message[]) => Promise<string>) {
    super();
    this.summarizerFunction = summarizerFunction;
  }
  
  /**
   * 외부 AI 모델을 사용한 요약 생성
   * @param messages 요약할 메시지 배열
   * @returns AI 모델에서 생성된 요약 텍스트
   */
  protected async generateSummaryWithAI(messages: Message[]): Promise<string> {
    return this.summarizerFunction(messages);
  }
} 