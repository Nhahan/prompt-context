import { MemoryContextProtocol, Message } from '../';
import fs from 'fs-extra';

const TEST_CONTEXT_DIR = '.test-prompt-context';

// 테스트 전 임시 디렉토리 생성
beforeAll(async () => {
  await fs.ensureDir(TEST_CONTEXT_DIR);
});

// 테스트 후 임시 디렉토리 삭제
afterAll(async () => {
  await fs.remove(TEST_CONTEXT_DIR);
});

describe('MemoryContextProtocol', () => {
  let mcp: MemoryContextProtocol;
  
  beforeEach(() => {
    // 각 테스트마다 새로운 MCP 인스턴스 생성
    mcp = new MemoryContextProtocol({
      messageLimitThreshold: 3,
      contextDir: TEST_CONTEXT_DIR,
      useGit: false, // 테스트에서는 Git 통합 비활성화
      autoSummarize: false // 자동 요약 비활성화
    });
  });
  
  // 메시지 생성 유틸리티 함수
  const createMessage = (role: 'user' | 'assistant', content: string): Message => ({
    role,
    content,
    timestamp: Date.now()
  });
  
  test('should add message to context', async () => {
    const contextId = 'test-file.ts';
    const message = createMessage('user', 'Test message');
    
    const context = await mcp.addMessage(contextId, message);
    
    expect(context).toBeDefined();
    expect(context.messages).toHaveLength(1);
    expect(context.messages[0]).toEqual(message);
  });
  
  test('should summarize context', async () => {
    const contextId = 'test-summarize.ts';
    
    // 여러 메시지 추가
    await mcp.addMessage(contextId, createMessage('user', 'Hello, can you help with TypeScript?'));
    await mcp.addMessage(contextId, createMessage('assistant', 'Sure, I can help with TypeScript. What do you need help with?'));
    await mcp.addMessage(contextId, createMessage('user', 'How do I create an interface?'));
    await mcp.addMessage(contextId, createMessage('assistant', 
      'You can create an interface like this:\n\n```typescript\ninterface User {\n  name: string;\n  age: number;\n}\n```'
    ));
    
    // 수동으로 요약 요청
    const result = await mcp.summarizeContext(contextId);
    expect(result).toBe(true);
    
    // 요약 로드
    const summary = await mcp.loadSummary(contextId);
    expect(summary).toBeDefined();
    expect(summary?.contextId).toBe(contextId);
    expect(summary?.messageCount).toBe(4);
    expect(summary?.codeBlocks).toHaveLength(1);
    expect(summary?.codeBlocks[0].language).toBe('typescript');
  });
  
  test('should handle multiple contexts separately', async () => {
    const contextId1 = 'file1.ts';
    const contextId2 = 'file2.ts';
    
    await mcp.addMessage(contextId1, createMessage('user', 'Message for file 1'));
    await mcp.addMessage(contextId2, createMessage('user', 'Message for file 2'));
    
    const messages1 = await mcp.getMessages(contextId1);
    const messages2 = await mcp.getMessages(contextId2);
    
    expect(messages1).toHaveLength(1);
    expect(messages2).toHaveLength(1);
    expect(messages1?.[0].content).toBe('Message for file 1');
    expect(messages2?.[0].content).toBe('Message for file 2');
  });
  
  test('should update configuration', () => {
    const initialConfig = mcp.getConfig();
    expect(initialConfig.messageLimitThreshold).toBe(3);
    
    mcp.updateConfig({ messageLimitThreshold: 5 });
    
    const updatedConfig = mcp.getConfig();
    expect(updatedConfig.messageLimitThreshold).toBe(5);
    expect(updatedConfig.contextDir).toBe(TEST_CONTEXT_DIR); // 다른 설정은 유지되어야 함
  });
}); 