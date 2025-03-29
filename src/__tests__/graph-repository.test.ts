import { GraphRepository, ContextEdge } from '../graph-repository';
import { ContextRelationshipType } from '../types';
import path from 'path';
import fs from 'fs-extra';

describe('GraphRepository Tests', () => {
  let repository: GraphRepository;
  const testDir = path.join(__dirname, 'test-graph-data');
  
  beforeEach(async () => {
    // Set up a test directory
    await fs.ensureDir(testDir);
    repository = new GraphRepository(testDir);
  });
  
  afterEach(async () => {
    // Clean up test directory
    await fs.remove(testDir);
  });
  
  test('Should add relationship between contexts', async () => {
    // Add relationship
    await repository.addRelationship(
      'context-1',
      'context-2',
      ContextRelationshipType.SIMILAR,
      0.8,
      { timestamp: Date.now() }
    );
    
    // Get relationships for context-1
    const relationships = await repository.getRelationships('context-1');
    
    // Verify relationship was added
    expect(relationships.length).toBeGreaterThan(0);
    expect(relationships.some(rel => 
      rel.source === 'context-1' && 
      rel.target === 'context-2' && 
      rel.type === ContextRelationshipType.SIMILAR
    )).toBe(true);
  });
  
  test('Should automatically add reciprocal parent-child relationships', async () => {
    // Add parent relationship
    await repository.addRelationship(
      'parent',
      'child',
      ContextRelationshipType.PARENT,
      0.7
    );
    
    // Get relationships for parent
    const parentRelationships = await repository.getRelationships('parent');
    
    // Get relationships for child
    const childRelationships = await repository.getRelationships('child');
    
    // Verify parent relationship was added
    expect(parentRelationships.some(rel => 
      rel.source === 'parent' && 
      rel.target === 'child' && 
      rel.type === ContextRelationshipType.PARENT
    )).toBe(true);
    
    // Verify child relationship was automatically added
    expect(childRelationships.some(rel => 
      rel.source === 'child' && 
      rel.target === 'parent' && 
      rel.type === ContextRelationshipType.CHILD
    )).toBe(true);
  });
  
  test('Should remove context and all its relationships', async () => {
    // Add several relationships
    await repository.addRelationship('context-1', 'context-2', ContextRelationshipType.SIMILAR, 0.5);
    await repository.addRelationship('context-1', 'context-3', ContextRelationshipType.REFERENCES, 0.6);
    await repository.addRelationship('context-4', 'context-1', ContextRelationshipType.CONTINUES, 0.7);
    
    // Remove context-1
    await repository.removeContext('context-1');
    
    // Check that all relationships involving context-1 are gone
    const relationships2 = await repository.getRelationships('context-2');
    const relationships3 = await repository.getRelationships('context-3');
    const relationships4 = await repository.getRelationships('context-4');
    
    const hasContext1 = [
      ...relationships2,
      ...relationships3,
      ...relationships4
    ].some(rel => rel.source === 'context-1' || rel.target === 'context-1');
    
    expect(hasContext1).toBe(false);
  });
  
  test('Should find path between contexts', async () => {
    // Create a path: A -> B -> C -> D
    await repository.addRelationship('A', 'B', ContextRelationshipType.CONTINUES, 1.0);
    await repository.addRelationship('B', 'C', ContextRelationshipType.CONTINUES, 1.0);
    await repository.addRelationship('C', 'D', ContextRelationshipType.CONTINUES, 1.0);
    
    // Find path from A to D
    const path = await repository.findPath('A', 'D');
    
    // Verify path exists and contains the expected nodes
    expect(path.length).toBeGreaterThan(0);
    expect(path).toContain('A');
    expect(path).toContain('D');
    
    // Path should be either [A, B, C, D] or [D, C, B, A] depending on implementation
    const validPaths = [
      ['A', 'B', 'C', 'D'],
      ['D', 'C', 'B', 'A']
    ];
    
    const pathMatches = validPaths.some(validPath => 
      validPath.length === path.length && 
      validPath.every((node, index) => node === path[index])
    );
    
    expect(pathMatches).toBe(true);
  });
  
  test('Should get related contexts by type and direction', async () => {
    // Add various relationships
    await repository.addRelationship('context-1', 'context-2', ContextRelationshipType.SIMILAR, 0.5);
    await repository.addRelationship('context-3', 'context-1', ContextRelationshipType.SIMILAR, 0.6);
    await repository.addRelationship('context-1', 'context-4', ContextRelationshipType.REFERENCES, 0.7);
    await repository.addRelationship('context-5', 'context-1', ContextRelationshipType.REFERENCES, 0.8);
    
    // Get outgoing SIMILAR relationships
    const outgoingSimilar = await repository.getRelatedContexts(
      'context-1',
      ContextRelationshipType.SIMILAR,
      'outgoing'
    );
    expect(outgoingSimilar).toContain('context-2');
    expect(outgoingSimilar).not.toContain('context-3');
    
    // Get incoming SIMILAR relationships
    const incomingSimilar = await repository.getRelatedContexts(
      'context-1',
      ContextRelationshipType.SIMILAR,
      'incoming'
    );
    expect(incomingSimilar).toContain('context-3');
    expect(incomingSimilar).not.toContain('context-2');
    
    // Get all REFERENCES relationships (both directions)
    const allReferences = await repository.getRelatedContexts(
      'context-1',
      ContextRelationshipType.REFERENCES,
      'both'
    );
    expect(allReferences).toContain('context-4');
    expect(allReferences).toContain('context-5');
    
    // Get all SIMILAR relationships (both directions)
    const allSimilar = await repository.getRelatedContexts(
      'context-1',
      ContextRelationshipType.SIMILAR,
      'both'
    );
    expect(allSimilar).toContain('context-2');
    expect(allSimilar).toContain('context-3');
  });
}); 