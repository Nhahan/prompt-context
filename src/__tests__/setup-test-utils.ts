import { VectorRepository } from '../vector-repository';
import { ContextSummary } from '../types';

/**
 * 테스트에서 사용하기 위한 VectorRepository 확장 클래스
 * 테스트 환경에서 문제가 발생하는 부분을 오버라이드
 */
export class TestVectorRepository extends VectorRepository {
  constructor(contextDir: string) {
    super(contextDir);
    
    // 테스트 데이터로 초기화
    this.initTestData();
  }
  
  /**
   * 테스트 데이터로 내부 맵을 초기화
   */
  private initTestData() {
    // 강제로 폴백 모드 설정
    this.setFallbackMode(true);
    
    // 초기 데이터 추가
    const testSummary: ContextSummary = {
      contextId: 'test-context-1',
      lastUpdated: Date.now(),
      summary: 'This is a test summary for testing',
      codeBlocks: [],
      messageCount: 5,
      version: 1
    };
    
    const testSummary2: ContextSummary = {
      contextId: 'test-context-2',
      lastUpdated: Date.now(),
      summary: 'This is another test summary',
      codeBlocks: [],
      messageCount: 3,
      version: 1
    };
    
    // 폴백 스토리지 초기화 (private이지만 테스트 용도로 직접 접근)
    (this as any).fallbackStorage.set(testSummary.contextId, testSummary);
    (this as any).fallbackStorage.set(testSummary2.contextId, testSummary2);
    
    // IndexMap 초기화
    (this as any).contextIdToIndex.set(testSummary.contextId, 0);
    (this as any).contextIdToIndex.set(testSummary2.contextId, 1);
    (this as any).indexToContextId.set(0, testSummary.contextId);
    (this as any).indexToContextId.set(1, testSummary2.contextId);
  }
}

/**
 * 테스트 벡터 리포지토리를 생성
 */
export function createTestVectorRepository(contextDir: string): TestVectorRepository {
  return new TestVectorRepository(contextDir);
} 