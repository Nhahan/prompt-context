import { ApiAnalytics, ApiCallType, apiAnalytics } from '../analytics';
import { VectorRepository } from '../vector-repository';
import { GraphRepository } from '../graph-repository';
import { ContextRelationshipType, ContextSummary } from '../types';
import fs from 'fs-extra';
import path from 'path';

// Use mock functions to simulate file system operations
jest.mock('fs-extra');

// Unit tests
describe('ApiAnalytics - Unit Tests', () => {
  beforeEach(() => {
    // Initialize apiAnalytics before each test
    apiAnalytics.reset();
  });

  test('Tracking new API calls', () => {
    // Start tracking the call
    const endTracking = apiAnalytics.trackCall(ApiCallType.VECTOR_DB_SEARCH, { query: 'test' });
    
    // End tracking the call
    endTracking();
    
    // Verify results
    expect(apiAnalytics.getCallCount(ApiCallType.VECTOR_DB_SEARCH)).toBe(1);
    expect(apiAnalytics.getCallCount(ApiCallType.VECTOR_DB_ADD)).toBe(0);
  });
  
  test('Tracking multiple API call types', () => {
    // Track various API calls
    const endTracking1 = apiAnalytics.trackCall(ApiCallType.VECTOR_DB_SEARCH);
    const endTracking2 = apiAnalytics.trackCall(ApiCallType.GRAPH_DB_ADD);
    const endTracking3 = apiAnalytics.trackCall(ApiCallType.LLM_SUMMARIZE);
    const endTracking4 = apiAnalytics.trackCall(ApiCallType.VECTOR_DB_SEARCH);
    
    // End all tracking
    endTracking1();
    endTracking2();
    endTracking3();
    endTracking4();
    
    // Verify results
    expect(apiAnalytics.getCallCount(ApiCallType.VECTOR_DB_SEARCH)).toBe(2);
    expect(apiAnalytics.getCallCount(ApiCallType.GRAPH_DB_ADD)).toBe(1);
    expect(apiAnalytics.getCallCount(ApiCallType.LLM_SUMMARIZE)).toBe(1);
    
    // Verify overall statistics
    const stats = apiAnalytics.getStats();
    expect(stats.totalCalls).toBe(4);
    expect(stats.callsByType[ApiCallType.VECTOR_DB_SEARCH]).toBe(2);
  });
  
  test('Filtering API calls within a time range', () => {
    // Mock implementation of Date.now to manipulate time data
    const originalNow = Date.now;
    const mockNow = jest.fn();
    
    try {
      // First point in time: 1000ms
      mockNow.mockReturnValue(1000);
      global.Date.now = mockNow;
      const endTracking1 = apiAnalytics.trackCall(ApiCallType.VECTOR_DB_ADD);
      
      // Second point in time: 2000ms
      mockNow.mockReturnValue(2000);
      global.Date.now = mockNow;
      const endTracking2 = apiAnalytics.trackCall(ApiCallType.GRAPH_DB_SEARCH);
      
      // Third point in time: 3000ms
      mockNow.mockReturnValue(3000);
      global.Date.now = mockNow;
      const endTracking3 = apiAnalytics.trackCall(ApiCallType.LLM_SUMMARIZE);
      
      // End calls (timing not important here)
      endTracking1();
      endTracking2();
      endTracking3();
      
      // Filter calls within the 1500ms ~ 2500ms range
      const filteredCalls = apiAnalytics.getCallsInTimeRange(1500, 2500);
      
      // Verify results: only the second call should be within the range
      expect(filteredCalls.length).toBe(1);
      expect(filteredCalls[0].type).toBe(ApiCallType.GRAPH_DB_SEARCH);
      expect(filteredCalls[0].timestamp).toBe(2000);
    } finally {
      // Restore the original Date.now
      global.Date.now = originalNow;
    }
  });
  
  test('Returning API statistics', () => {
    // Fake times for tracking function implementation
    const originalNow = Date.now;
    const mockNow = jest.fn();
    
    try {
      // First call: 100ms duration
      mockNow.mockReturnValueOnce(1000).mockReturnValueOnce(1100);
      global.Date.now = mockNow;
      const endTracking1 = apiAnalytics.trackCall(ApiCallType.VECTOR_DB_SEARCH);
      endTracking1();
      
      // Second call: 200ms duration
      mockNow.mockReturnValueOnce(2000).mockReturnValueOnce(2200);
      global.Date.now = mockNow;
      const endTracking2 = apiAnalytics.trackCall(ApiCallType.VECTOR_DB_SEARCH);
      endTracking2();
      
      // Check statistics
      const stats = apiAnalytics.getStats();
      
      // Verify results
      expect(stats.totalCalls).toBe(2);
      expect(stats.callsByType[ApiCallType.VECTOR_DB_SEARCH]).toBe(2);
      expect(stats.averageDuration?.[ApiCallType.VECTOR_DB_SEARCH]).toBe(150); // (100 + 200) / 2
    } finally {
      global.Date.now = originalNow;
    }
  });
});

// Integration tests
describe('ApiAnalytics - Integration Tests', () => {
  // Test paths and data
  const testDir = '/tmp/mcp-test';
  const testFile = path.join(testDir, 'test-file.json');
  const testSummary: ContextSummary = {
    contextId: 'test-context-1',
    lastUpdated: Date.now(),
    summary: 'This is a test context',
    codeBlocks: [],
    messageCount: 5,
    version: 1,
    importanceScore: 0.8
  };
  
  beforeEach(() => {
    // Initialize apiAnalytics before each test
    apiAnalytics.reset();
    
    // Set up file system mock functions
    (fs.existsSync as jest.Mock).mockResolvedValue(true);
    (fs.ensureDir as jest.Mock).mockResolvedValue(undefined);
    (fs.readJson as jest.Mock).mockResolvedValue({ nodes: [], edges: [] });
    (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('Tracking VectorRepository API calls', async () => {
    // Set up for VectorRepository mock implementation
    const vectorRepository = new VectorRepository(testDir);
    
    // Set up mock file reading results
    (fs.readJson as jest.Mock).mockResolvedValue({
      vectors: []
    });
    
    // Test API calls
    await vectorRepository.addSummary(testSummary);
    await vectorRepository.findSimilarContexts('test query', 5);
    await vectorRepository.deleteContext('test-context-1');
    
    // Check statistics
    const stats = apiAnalytics.getStats();
    
    // Verify results
    expect(stats.callsByType[ApiCallType.VECTOR_DB_ADD]).toBe(1);
    expect(stats.callsByType[ApiCallType.VECTOR_DB_SEARCH]).toBe(1);
    expect(stats.callsByType[ApiCallType.VECTOR_DB_DELETE]).toBe(1);
    expect(stats.totalCalls).toBe(3);
  });
  
  test('Tracking GraphRepository API calls', async () => {
    // Set up for GraphRepository mock implementation
    const graphRepository = new GraphRepository(testDir);
    
    // Test API calls
    await graphRepository.addRelationship(
      'source-context',
      'target-context',
      ContextRelationshipType.REFERENCES,
      0.8
    );
    await graphRepository.getRelationships('source-context');
    await graphRepository.findPath('source-context', 'target-context');
    await graphRepository.removeContext('source-context');
    
    // Check statistics
    const stats = apiAnalytics.getStats();
    
    // Verify results 
    // Note: Adding a PARENT relationship automatically adds a CHILD relationship,
    // so if the relationship type is not REFERENCES, addRelationship may be recorded twice
    expect(stats.callsByType[ApiCallType.GRAPH_DB_ADD]).toBeGreaterThanOrEqual(1);
    expect(stats.callsByType[ApiCallType.GRAPH_DB_SEARCH]).toBeGreaterThanOrEqual(2); // getRelationships + findPath
    expect(stats.callsByType[ApiCallType.GRAPH_DB_DELETE]).toBe(1);
  });
  
  test('Tracking API calls in complex workflows', async () => {
    // Initialize repositories for complex workflow simulation
    const vectorRepository = new VectorRepository(testDir);
    const graphRepository = new GraphRepository(testDir);
    
    // Workflow with multiple API calls
    await vectorRepository.addSummary(testSummary);
    
    await graphRepository.addRelationship(
      testSummary.contextId,
      'parent-context',
      ContextRelationshipType.CHILD,
      0.9
    );
    
    await vectorRepository.findSimilarContexts('test query', 3);
    
    await graphRepository.getRelatedContexts(
      testSummary.contextId,
      ContextRelationshipType.PARENT,
      'outgoing'
    );
    
    // Check statistics
    const stats = apiAnalytics.getStats();
    
    // Verify results
    expect(stats.totalCalls).toBeGreaterThanOrEqual(4);
    expect(stats.callsByType[ApiCallType.VECTOR_DB_ADD]).toBe(1);
    expect(stats.callsByType[ApiCallType.VECTOR_DB_SEARCH]).toBe(1);
    expect(stats.callsByType[ApiCallType.GRAPH_DB_ADD]).toBeGreaterThanOrEqual(1);
    expect(stats.callsByType[ApiCallType.GRAPH_DB_SEARCH]).toBeGreaterThanOrEqual(1);
  });
  
  test('Ensuring API call tracking completes even with errors', async () => {
    // GraphRepository mock implementation
    const graphRepository = new GraphRepository(testDir);
    
    // Set up mock to simulate an error
    (fs.writeJson as jest.Mock).mockRejectedValue(new Error('Test error'));
    
    // API call that will cause an error
    try {
      await graphRepository.addRelationship(
        'source-context',
        'target-context',
        ContextRelationshipType.REFERENCES,
        0.8
      );
    } catch (error) {
      // Error is expected
    }
    
    // Check statistics
    const stats = apiAnalytics.getStats();
    
    // Verify results: API call should be recorded even if an error occurs
    expect(stats.callsByType[ApiCallType.GRAPH_DB_ADD]).toBe(1);
    expect(stats.totalCalls).toBe(1);
  });
}); 