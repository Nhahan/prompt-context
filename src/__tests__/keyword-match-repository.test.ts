import { KeywordMatchRepository } from '../keyword-match-repository';
import { ContextSummary } from '../types';
import path from 'path';
import fs from 'fs-extra';

describe('KeywordMatchRepository Tests', () => {
  let repository: KeywordMatchRepository;
  const testDir = path.join(__dirname, 'test-data');
  
  beforeEach(async () => {
    // Set up a test directory
    await fs.ensureDir(testDir);
    repository = new KeywordMatchRepository(testDir);
  });
  
  afterEach(async () => {
    // Clean up test directory
    await fs.remove(testDir);
  });
  
  // Test data
  const testSummaries: ContextSummary[] = [
    {
      contextId: 'context-1',
      lastUpdated: Date.now(),
      summary: 'The Memory Context Protocol implementation handles efficient summarization',
      codeBlocks: [],
      messageCount: 10,
      version: 1
    },
    {
      contextId: 'context-2',
      lastUpdated: Date.now(),
      summary: 'Vector databases are used for semantic similarity search in the MCP system',
      codeBlocks: [],
      messageCount: 5,
      version: 1
    },
    {
      contextId: 'context-3',
      lastUpdated: Date.now(),
      summary: 'Graph relationships help connect related conversation contexts',
      codeBlocks: [],
      messageCount: 8,
      version: 1
    }
  ];
  
  test('Should add and retrieve summaries', async () => {
    // Add test summaries
    for (const summary of testSummaries) {
      await repository.addSummary(summary);
    }
    
    // Check that contexts exist
    for (const summary of testSummaries) {
      const exists = await repository.hasContext(summary.contextId);
      expect(exists).toBe(true);
    }
    
    // Check that non-existent context doesn't exist
    const exists = await repository.hasContext('nonexistent');
    expect(exists).toBe(false);
  });
  
  test('Should find similar contexts based on keywords', async () => {
    // Add test summaries
    for (const summary of testSummaries) {
      await repository.addSummary(summary);
    }
    
    // Find contexts similar to "memory summarization"
    const results1 = await repository.findSimilarContexts('memory summarization protocol');
    expect(results1.length).toBeGreaterThan(0);
    // First result should be context-1 which mentions "Memory" and "summarization"
    expect(results1[0].contextId).toBe('context-1');
    
    // Find contexts similar to "vector semantic search"
    const results2 = await repository.findSimilarContexts('vector semantic search');
    expect(results2.length).toBeGreaterThan(0);
    // First result should be context-2 which mentions "vector" and "semantic"
    expect(results2[0].contextId).toBe('context-2');
    
    // Find contexts similar to "graph connections between contexts"
    const results3 = await repository.findSimilarContexts('graph connections between contexts');
    expect(results3.length).toBeGreaterThan(0);
    // First result should be context-3 which mentions "graph" and "contexts"
    expect(results3[0].contextId).toBe('context-3');
  });
  
  test('Should delete contexts', async () => {
    // Add test summaries
    for (const summary of testSummaries) {
      await repository.addSummary(summary);
    }
    
    // Delete one context
    await repository.deleteContext('context-2');
    
    // Check that it no longer exists
    const exists = await repository.hasContext('context-2');
    expect(exists).toBe(false);
    
    // Check that others still exist
    const exists1 = await repository.hasContext('context-1');
    const exists3 = await repository.hasContext('context-3');
    expect(exists1).toBe(true);
    expect(exists3).toBe(true);
    
    // Check that deleted context is not returned in search results
    const results = await repository.findSimilarContexts('vector database');
    const hasDeletedContext = results.some(result => result.contextId === 'context-2');
    expect(hasDeletedContext).toBe(false);
  });
  
  test('Should handle empty search query', async () => {
    // Add test summaries
    for (const summary of testSummaries) {
      await repository.addSummary(summary);
    }
    
    // Search with empty query
    const results = await repository.findSimilarContexts('');
    expect(results.length).toBe(0);
  });
  
  test('Should handle limit parameter in search', async () => {
    // Add test summaries
    for (const summary of testSummaries) {
      await repository.addSummary(summary);
    }
    
    // Search with a limit of 1
    const results = await repository.findSimilarContexts('context', 1);
    expect(results.length).toBeLessThanOrEqual(1);
    
    // Search with a limit of 10 (more than available)
    const results2 = await repository.findSimilarContexts('context', 10);
    expect(results2.length).toBeLessThanOrEqual(testSummaries.length);
  });
}); 