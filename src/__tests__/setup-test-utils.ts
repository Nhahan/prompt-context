import { VectorRepository } from '../vector-repository';
import { ContextSummary, HierarchicalSummary, Message, CodeBlock, ContextImportance } from '../types';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { FileSystemRepository } from '../repository';

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
      createdAt: Date.now(),
      summary: 'This is a test summary for testing',
      codeBlocks: [],
      messageCount: 5,
      version: 1
    };
    
    const testSummary2: ContextSummary = {
      contextId: 'test-context-2',
      createdAt: Date.now(),
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

// Centralized test data creation functions

export function createMockMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Test message ${i + 1}. Importance: ${i % 3 === 0 ? 'high' : 'medium'}?`,
    timestamp: Date.now() - (count - i) * 1000,
    importance: i % 3 === 0 ? ContextImportance.HIGH : ContextImportance.MEDIUM
  }));
}

export function createMockSummary(contextId: string, messageCount: number, suffix: string = ''): ContextSummary {
  return {
    contextId,
    createdAt: Date.now() - 1000, // Use createdAt
    summary: `This is a mock summary for ${contextId}${suffix}. It includes ${messageCount} messages.`,
    codeBlocks: [
      { language: 'typescript', code: `console.log('test ${contextId}');`, importance: 0.8 }
    ],
    messageCount,
    version: 1,
    keyInsights: [`Insight for ${contextId}`],
    importanceScore: 0.75
  };
}

export function createMockHierarchicalSummary(contextId: string, childCount: number): HierarchicalSummary {
  const childIds = Array.from({ length: childCount }, (_, i) => `${contextId}-child${i + 1}`);
  return {
    contextId,
    createdAt: Date.now() - 2000, // Use createdAt
    summary: `Hierarchical mock summary for ${contextId} with ${childCount} children.`,
    codeBlocks: [],
    messageCount: childCount * 5, // Assuming 5 messages per child
    version: 1,
    hierarchyLevel: 1,
    childContextIds: childIds,
    importanceScore: 0.8
  };
}

// Setup and teardown helpers

let testRepoInstance: FileSystemRepository | null = null;
let testDir: string | null = null;

export async function setupTestRepository(): Promise<FileSystemRepository> {
  if (!testRepoInstance) {
    testDir = path.join(os.tmpdir(), `prompt-context-shared-tests-${Date.now()}`);
    await fs.ensureDir(testDir);
    const config = {
      contextDir: testDir,
      autoSummarize: false,
      hierarchicalContext: true,
      messageLimitThreshold: 10,
      tokenLimitPercentage: 80,
      metaSummaryThreshold: 5,
      maxHierarchyDepth: 3,
      useVectorDb: false,
      useGraphDb: false,
      debug: false,
      similarityThreshold: 0.6,
      autoCleanupContexts: false,
      trackApiCalls: false,
      apiAnalyticsRetention: 30,
      fallbackToKeywordMatch: false,
      port: 6789,
      vectorDb: {},
      summarizer: {}
    };
    testRepoInstance = new FileSystemRepository(config);
    await testRepoInstance.initialize();
  }
  return testRepoInstance;
}

export async function cleanupTestRepository() {
  if (testDir) {
    await fs.remove(testDir);
    testDir = null;
    testRepoInstance = null;
  }
} 