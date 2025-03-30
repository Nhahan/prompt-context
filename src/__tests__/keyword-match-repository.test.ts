import { KeywordMatchRepository } from '../keyword-match-repository';
import { ContextSummary, Message } from '../types';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';

// Helper function to create dummy summaries
const createDummySummary = (id: string, text: string): ContextSummary => ({
  contextId: id,
  createdAt: Date.now(), // Use createdAt
  summary: text,
  codeBlocks: [],
  messageCount: 5 // Example count
});

describe('KeywordMatchRepository', () => {
  let repo: KeywordMatchRepository;
  const testDir = path.join(os.tmpdir(), `keyword-test-${Date.now()}`);
  const summary1 = createDummySummary('ctx-1', 'This context talks about apples and oranges.');
  const summary2 = createDummySummary('ctx-2', 'A different context discussing bananas and apples.');
  const summary3 = createDummySummary('ctx-3', 'Completely different topic about grapes.');

  beforeAll(async () => {
    await fs.ensureDir(testDir);
    repo = new KeywordMatchRepository(testDir);
    // Add summaries to the repo (simulating saving them)
    await repo.addSummary(summary1);
    await repo.addSummary(summary2);
    await repo.addSummary(summary3);
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  test('should find contexts matching keywords', async () => {
    const results = await repo.findSimilarContexts('apples', 2);
    expect(results).toHaveLength(2);
    // Check if the correct contexts are returned (order might vary)
    const contextIds = results.map(r => r.contextId);
    expect(contextIds).toContain('ctx-1');
    expect(contextIds).toContain('ctx-2');
    // Similarity score should be greater than 0
    expect(results[0].similarity).toBeGreaterThan(0);
  });

  test('should limit results correctly', async () => {
    const results = await repo.findSimilarContexts('apples', 1);
    expect(results).toHaveLength(1);
  });

  test('should return empty array if no match', async () => {
    const results = await repo.findSimilarContexts('kiwi', 5);
    expect(results).toHaveLength(0);
  });

  test('should handle deletion of contexts', async () => {
    await repo.deleteContext('ctx-1');
    const results = await repo.findSimilarContexts('apples', 5);
    expect(results).toHaveLength(1);
    expect(results[0].contextId).toBe('ctx-2');
  });

  test('hasContext should return true for existing context', async () => {
    // Add ctx-1 back for this test
    await repo.addSummary(summary1); 
    expect(await repo.hasContext('ctx-1')).toBe(true);
  });

  test('hasContext should return false for non-existent context', async () => {
    expect(await repo.hasContext('non-existent-ctx')).toBe(false);
  });
}); 