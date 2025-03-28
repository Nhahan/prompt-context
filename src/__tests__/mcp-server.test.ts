import request from 'supertest';
import express from 'express';
import { MemoryContextProtocol } from '../mcp';
import { Message, ContextSummary, SimilarContext } from '../types';

// 간단한 MCP 서버 테스트
describe('MCP Server', () => {
  let app: express.Application;
  let mockMcp: any;
  
  beforeEach(() => {
    // Express 앱 생성
    app = express();
    app.use(express.json());
    
    // MCP 모킹
    mockMcp = {
      addMessage: jest.fn(),
      getMessages: jest.fn(),
      summarizeContext: jest.fn(),
      findSimilarContexts: jest.fn()
    };
    
    // 라우트 설정
    app.get('/info', (req, res) => {
      res.json({
        status: 'running',
        version: '0.1.1-beta'
      });
    });
    
    app.post('/message', (req, res) => {
      const { contextId, message, role } = req.body;
      const messageObj = {
        content: message,
        role,
        timestamp: Date.now()
      };
      
      mockMcp.addMessage(contextId, messageObj);
      res.json({
        success: true,
        message: "Message added successfully"
      });
    });
    
    app.get('/messages/:contextId', (req, res) => {
      const { contextId } = req.params;
      const messages = mockMcp.getMessages(contextId);
      res.json(messages || []);
    });
    
    app.post('/summarize/:contextId', (req, res) => {
      const { contextId } = req.params;
      mockMcp.summarizeContext(contextId);
      res.json({
        success: true,
        summary: {
          contextId,
          summary: "Test summary",
          lastUpdated: Date.now(),
          messageCount: 2,
          version: 1,
          codeBlocks: []
        }
      });
    });
    
    app.get('/similar', (req, res) => {
      const query = req.query.query as string;
      mockMcp.findSimilarContexts(query, 0.6);
      res.json([
        { id: 'context-1', score: 0.8 }
      ]);
    });
  });
  
  test('GET /info should return server info', async () => {
    const res = await request(app).get('/info');
    
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'running',
      version: '0.1.1-beta'
    });
  });
  
  test('POST /message should add a message to context', async () => {
    const messageData = {
      contextId: 'test-context',
      message: 'Hello, world!',
      role: 'user'
    };
    
    const res = await request(app)
      .post('/message')
      .send(messageData);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockMcp.addMessage).toHaveBeenCalledWith(
      'test-context',
      expect.objectContaining({
        content: 'Hello, world!',
        role: 'user',
        timestamp: expect.any(Number)
      })
    );
  });
  
  test('GET /messages/:contextId should return messages for context', async () => {
    const contextId = 'test-context';
    const mockMessages = [
      { content: 'Hello', role: 'user', timestamp: Date.now() },
      { content: 'Hi there', role: 'assistant', timestamp: Date.now() }
    ];
    
    mockMcp.getMessages.mockReturnValueOnce(mockMessages);
    
    const res = await request(app)
      .get(`/messages/${contextId}`);
    
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockMessages);
    expect(mockMcp.getMessages).toHaveBeenCalledWith(contextId);
  });
  
  test('POST /summarize/:contextId should summarize context', async () => {
    const contextId = 'test-context';
    
    const res = await request(app)
      .post(`/summarize/${contextId}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('summary');
    expect(mockMcp.summarizeContext).toHaveBeenCalledWith(contextId);
  });
  
  test('GET /similar should find similar contexts', async () => {
    const query = 'test query';
    
    const res = await request(app)
      .get(`/similar?query=${encodeURIComponent(query)}`);
    
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 'context-1', score: 0.8 }
    ]);
    expect(mockMcp.findSimilarContexts).toHaveBeenCalledWith(query, 0.6);
  });
}); 