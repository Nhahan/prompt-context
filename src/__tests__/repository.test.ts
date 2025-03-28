import fs from 'fs-extra';
import path from 'path';
import { FileSystemRepository } from '../repository';
import { ContextSummary, HierarchicalSummary, MetaSummary, CodeBlock } from '../types';

const TEST_DIR = './.test-repository';

describe('FileSystemRepository Tests', () => {
  let repository: FileSystemRepository;
  
  // Set up test environment before all tests
  beforeAll(async () => {
    await fs.ensureDir(TEST_DIR);
    
    repository = new FileSystemRepository({
      contextDir: TEST_DIR,
      useGit: false,
      messageLimitThreshold: 10,
      tokenLimitPercentage: 80,
      ignorePatterns: ['*.ignore'],
      autoSummarize: true,
      hierarchicalContext: true,
      metaSummaryThreshold: 3,
      maxHierarchyDepth: 2,
      useVectorDb: true,
      useGraphDb: true,
      similarityThreshold: 0.6,
      autoCleanupContexts: true
    });
  });
  
  // Clean up test environment after all tests
  afterAll(async () => {
    try {
      await fs.remove(TEST_DIR);
    } catch (error) {
      console.error('Error cleaning up test directory:', error);
    }
  });
  
  // Test basic summary storage
  test('Should save and load summary', async () => {
    const testSummary: ContextSummary = {
      contextId: 'test-summary',
      lastUpdated: Date.now(),
      summary: 'This is a test summary',
      codeBlocks: [],
      messageCount: 5,
      version: 1
    };
    
    // Save the summary
    await repository.saveSummary(testSummary);
    
    // Check if file exists
    const summaryPath = path.join(TEST_DIR, 'test-summary.summary.json');
    const exists = await fs.pathExists(summaryPath);
    expect(exists).toBe(true);
    
    // Load the summary
    const loadedSummary = await repository.loadSummary('test-summary');
    
    // Verify content
    expect(loadedSummary).toBeDefined();
    expect(loadedSummary?.contextId).toBe(testSummary.contextId);
    expect(loadedSummary?.summary).toBe(testSummary.summary);
    expect(loadedSummary?.messageCount).toBe(testSummary.messageCount);
    expect(loadedSummary?.version).toBe(testSummary.version);
  });
  
  // Test hierarchical summary storage
  test('Should save and load hierarchical summary', async () => {
    const testHierarchicalSummary: HierarchicalSummary = {
      contextId: 'test-hierarchical',
      lastUpdated: Date.now(),
      summary: 'This is a hierarchical summary',
      codeBlocks: [],
      messageCount: 10,
      version: 1,
      hierarchyLevel: 1,
      parentContextId: 'parent-context',
      childContextIds: ['child-1', 'child-2']
    };
    
    // Save the hierarchical summary
    await repository.saveHierarchicalSummary(testHierarchicalSummary);
    
    // Check if file exists in the correct location
    const hierarchicalDir = path.join(TEST_DIR, 'hierarchical-summaries');
    const summaryPath = path.join(hierarchicalDir, 'test-hierarchical.hierarchical.json');
    const exists = await fs.pathExists(summaryPath);
    expect(exists).toBe(true);
    
    // Load the hierarchical summary
    const loadedSummary = await repository.loadHierarchicalSummary('test-hierarchical');
    
    // Verify content
    expect(loadedSummary).toBeDefined();
    expect(loadedSummary?.contextId).toBe(testHierarchicalSummary.contextId);
    expect(loadedSummary?.summary).toBe(testHierarchicalSummary.summary);
    expect(loadedSummary?.hierarchyLevel).toBe(testHierarchicalSummary.hierarchyLevel);
    expect(loadedSummary?.parentContextId).toBe(testHierarchicalSummary.parentContextId);
    expect(loadedSummary?.childContextIds).toEqual(testHierarchicalSummary.childContextIds);
  });
  
  // Test meta-summary storage
  test('Should save and load meta-summary', async () => {
    const codeBlock: CodeBlock = {
      language: 'typescript',
      code: 'const x = 1;',
      importance: 0.8,
      sourceContextId: 'source-ctx',
      description: 'Example code'
    };
    
    const testMetaSummary: MetaSummary = {
      id: 'test-meta-summary',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      summary: 'This is a meta-summary covering multiple contexts',
      contextIds: ['context-1', 'context-2', 'context-3'],
      sharedCodeBlocks: [codeBlock],
      hierarchyLevel: 0
    };
    
    // Save the meta-summary
    await repository.saveMetaSummary(testMetaSummary);
    
    // Check if file exists in the correct location
    const metaDir = path.join(TEST_DIR, 'meta-summaries');
    const metaPath = path.join(metaDir, 'test-meta-summary.meta.json');
    const exists = await fs.pathExists(metaPath);
    expect(exists).toBe(true);
    
    // Load the meta-summary
    const loadedMetaSummary = await repository.loadMetaSummary('test-meta-summary');
    
    // Verify content
    expect(loadedMetaSummary).toBeDefined();
    expect(loadedMetaSummary?.id).toBe(testMetaSummary.id);
    expect(loadedMetaSummary?.summary).toBe(testMetaSummary.summary);
    expect(loadedMetaSummary?.contextIds).toEqual(testMetaSummary.contextIds);
    expect(loadedMetaSummary?.sharedCodeBlocks).toHaveLength(1);
    expect(loadedMetaSummary?.sharedCodeBlocks[0].code).toBe(codeBlock.code);
    expect(loadedMetaSummary?.hierarchyLevel).toBe(testMetaSummary.hierarchyLevel);
  });
  
  // Test getting all context IDs
  test('Should retrieve all context IDs', async () => {
    // Create multiple summaries
    const summaries = [
      { contextId: 'context-a', summary: 'Summary A', lastUpdated: Date.now(), codeBlocks: [], messageCount: 5, version: 1 },
      { contextId: 'context-b', summary: 'Summary B', lastUpdated: Date.now(), codeBlocks: [], messageCount: 5, version: 1 },
      { contextId: 'context-c', summary: 'Summary C', lastUpdated: Date.now(), codeBlocks: [], messageCount: 5, version: 1 }
    ];
    
    // Save all summaries
    for (const summary of summaries) {
      await repository.saveSummary(summary);
    }
    
    // Get all context IDs
    const contextIds = await repository.getAllContextIds();
    
    // Expect to find all the created contexts plus 'test-summary' from previous test
    expect(contextIds).toContain('context-a');
    expect(contextIds).toContain('context-b');
    expect(contextIds).toContain('context-c');
    expect(contextIds).toContain('test-summary');
  });
  
  // Test file ignore patterns
  test('Should correctly identify ignored paths', () => {
    // Test ignore patterns
    expect(repository.shouldIgnore('test.ignore')).toBe(true);
    expect(repository.shouldIgnore('folder/test.ignore')).toBe(true);
    expect(repository.shouldIgnore('valid-file.txt')).toBe(false);
  });
  
  // Test related contexts functionality
  test('Should save and retrieve related contexts', async () => {
    // Create a summary with related contexts
    const testSummary: ContextSummary = {
      contextId: 'related-test',
      lastUpdated: Date.now(),
      summary: 'Summary with related contexts',
      codeBlocks: [],
      messageCount: 5,
      version: 1,
      relatedContexts: ['context-a', 'context-b']
    };
    
    // Save the summary
    await repository.saveSummary(testSummary);
    
    // Get related contexts
    const relatedContexts = await repository.getRelatedContexts('related-test');
    
    // Verify related contexts
    expect(relatedContexts).toEqual(['context-a', 'context-b']);
  });
}); 