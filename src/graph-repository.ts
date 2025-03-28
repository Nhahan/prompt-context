import fs from 'fs-extra';
import path from 'path';
import { ContextSummary, ContextRelationshipType } from './types';

/**
 * Represents an edge in the context graph
 */
export interface ContextEdge {
  source: string;            // Source context ID
  target: string;            // Target context ID
  type: ContextRelationshipType;    // Type of relationship
  weight: number;            // Strength of relationship (0-1)
  metadata?: any;            // Additional metadata
}

/**
 * Interface for the graph repository
 */
export interface GraphRepositoryInterface {
  /**
   * Add a relationship between contexts
   * @param source Source context ID
   * @param target Target context ID
   * @param type Relationship type
   * @param weight Relationship weight/strength (0-1)
   * @param metadata Additional metadata
   */
  addRelationship(source: string, target: string, type: ContextRelationshipType, weight: number, metadata?: any): Promise<void>;
  
  /**
   * Get all relationships for a context
   * @param contextId Context ID
   * @returns Array of edges connected to the context
   */
  getRelationships(contextId: string): Promise<ContextEdge[]>;
  
  /**
   * Remove all relationships for a context
   * @param contextId Context ID
   */
  removeContext(contextId: string): Promise<void>;
  
  /**
   * Find a path between two contexts
   * @param sourceId Source context ID
   * @param targetId Target context ID
   * @returns Array of context IDs forming a path, or empty array if no path exists
   */
  findPath(sourceId: string, targetId: string): Promise<string[]>;
  
  /**
   * Get all contexts that have a specific relationship with the given context
   * @param contextId Context ID
   * @param type Relationship type
   * @param direction 'outgoing' for edges where contextId is the source, 'incoming' for edges where contextId is the target, 'both' for both directions
   * @returns Array of context IDs
   */
  getRelatedContexts(contextId: string, type: ContextRelationshipType, direction: 'outgoing' | 'incoming' | 'both'): Promise<string[]>;
}

/**
 * Repository for managing relationships between contexts using a graph structure
 */
export class GraphRepository implements GraphRepositoryInterface {
  private contextDir: string;
  private graphPath: string;
  private edges: ContextEdge[] = [];
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private fallbackMode: boolean = false;
  
  /**
   * Constructor
   * @param contextDir Directory to store graph data
   */
  constructor(contextDir: string) {
    this.contextDir = contextDir;
    this.graphPath = path.join(contextDir, 'graph', 'context-graph.json');
    
    // Start initialization
    this.initPromise = this.init().catch(error => {
      console.error('Failed to initialize graph repository, falling back to basic mode:', error);
      this.fallbackMode = true;
    });
  }
  
  /**
   * Initialize the graph repository
   */
  private async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Create graph directory if it doesn't exist
      const graphDir = path.join(this.contextDir, 'graph');
      await fs.ensureDir(graphDir);
      
      // Load existing graph if it exists
      if (await fs.pathExists(this.graphPath)) {
        try {
          const data = await fs.readJson(this.graphPath);
          this.edges = data.edges || [];
          console.log(`Loaded graph with ${this.edges.length} edges`);
        } catch (loadError) {
          console.error('Error loading graph, creating a new one:', loadError);
          this.edges = [];
        }
      } else {
        this.edges = [];
      }
      
      // Try to load graphology (but handle the case where it's not available)
      try {
        await import('graphology');
        await import('graphology-shortest-path');
      } catch (error) {
        console.warn('Graphology not available, using basic graph operations:', error);
      }
      
      this.initialized = true;
    } catch (error) {
      this.initialized = false;
      this.fallbackMode = true;
      throw error;
    }
  }
  
  /**
   * Ensure the repository is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    
    if (!this.initialized && !this.fallbackMode) {
      this.initPromise = this.init();
      await this.initPromise;
    }
  }
  
  /**
   * Save the current graph
   */
  private async saveGraph(): Promise<void> {
    if (this.fallbackMode || !this.initialized) return;
    
    try {
      const graphDir = path.join(this.contextDir, 'graph');
      await fs.ensureDir(graphDir);
      
      await fs.writeJson(this.graphPath, { edges: this.edges }, { spaces: 2 });
    } catch (error) {
      console.error('Error saving graph:', error);
    }
  }
  
  /**
   * Add a relationship between contexts
   * @param source Source context ID
   * @param target Target context ID
   * @param type Relationship type
   * @param weight Relationship weight/strength (0-1)
   * @param metadata Additional metadata
   */
  public async addRelationship(
    source: string, 
    target: string, 
    type: ContextRelationshipType, 
    weight: number,
    metadata?: any
  ): Promise<void> {
    await this.ensureInitialized();
    
    if (this.fallbackMode) return;
    
    try {
      // Don't allow self-loops
      if (source === target) return;
      
      // Validate weight
      const validWeight = Math.max(0, Math.min(1, weight));
      
      // Check if relationship already exists
      const existingEdgeIndex = this.edges.findIndex(edge => 
        edge.source === source && 
        edge.target === target && 
        edge.type === type
      );
      
      if (existingEdgeIndex >= 0) {
        // Update existing relationship
        this.edges[existingEdgeIndex].weight = validWeight;
        if (metadata) {
          this.edges[existingEdgeIndex].metadata = metadata;
        }
      } else {
        // Add new relationship
        this.edges.push({
          source,
          target,
          type,
          weight: validWeight,
          metadata
        });
        
        // If adding a parent relationship, automatically add the corresponding child relationship
        if (type === ContextRelationshipType.PARENT) {
          await this.addRelationship(target, source, ContextRelationshipType.CHILD, validWeight, metadata);
        }
        // If adding a child relationship, automatically add the corresponding parent relationship
        else if (type === ContextRelationshipType.CHILD) {
          await this.addRelationship(target, source, ContextRelationshipType.PARENT, validWeight, metadata);
        }
      }
      
      // Save the updated graph
      await this.saveGraph();
    } catch (error) {
      console.error(`Error adding relationship from ${source} to ${target}:`, error);
    }
  }
  
  /**
   * Get all relationships for a context
   * @param contextId Context ID
   * @returns Array of edges connected to the context
   */
  public async getRelationships(contextId: string): Promise<ContextEdge[]> {
    await this.ensureInitialized();
    
    if (this.fallbackMode) return [];
    
    return this.edges.filter(edge => 
      edge.source === contextId || edge.target === contextId
    );
  }
  
  /**
   * Remove all relationships for a context
   * @param contextId Context ID
   */
  public async removeContext(contextId: string): Promise<void> {
    await this.ensureInitialized();
    
    if (this.fallbackMode) return;
    
    try {
      // Remove all edges that involve this context
      this.edges = this.edges.filter(edge => 
        edge.source !== contextId && edge.target !== contextId
      );
      
      // Save the updated graph
      await this.saveGraph();
    } catch (error) {
      console.error(`Error removing context ${contextId} from graph:`, error);
    }
  }
  
  /**
   * Find a path between two contexts using basic BFS algorithm
   * Falls back to this if graphology is not available
   * @param sourceId Source context ID
   * @param targetId Target context ID
   * @returns Array of context IDs forming a path, or empty array if no path exists
   */
  private async findPathBasic(sourceId: string, targetId: string): Promise<string[]> {
    // Simple BFS implementation
    const visited = new Set<string>();
    const queue: Array<{id: string, path: string[]}> = [{id: sourceId, path: [sourceId]}];
    
    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      
      if (id === targetId) {
        return path;
      }
      
      if (visited.has(id)) continue;
      visited.add(id);
      
      // Get all outgoing edges
      const outgoingEdges = this.edges.filter(edge => edge.source === id);
      
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          queue.push({
            id: edge.target,
            path: [...path, edge.target]
          });
        }
      }
    }
    
    return []; // No path found
  }
  
  /**
   * Find a path between two contexts using graphology
   * @param sourceId Source context ID
   * @param targetId Target context ID
   * @returns Array of context IDs forming a path, or empty array if no path exists
   */
  private async findPathWithGraphology(sourceId: string, targetId: string): Promise<string[]> {
    try {
      const { default: Graph } = await import('graphology');
      const { bidirectional } = await import('graphology-shortest-path');
      
      // Cast to any to handle possible API changes between versions
      const findPath = bidirectional as any;
      
      // Create a graph from the edges
      const graph = new Graph();
      
      // Add nodes
      const nodes = new Set<string>();
      this.edges.forEach(edge => {
        nodes.add(edge.source);
        nodes.add(edge.target);
      });
      
      // Add all nodes to the graph
      for (const node of nodes) {
        graph.addNode(node);
      }
      
      // Add edges with weights
      this.edges.forEach(edge => {
        // Skip if nodes don't exist (shouldn't happen, but just in case)
        if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) return;
        
        // Only add if not already exists
        if (!graph.hasEdge(edge.source, edge.target)) {
          graph.addEdge(edge.source, edge.target, { weight: 1 - edge.weight }); // Invert weight (higher weight = shorter path)
        }
      });
      
      // Find the shortest path
      if (graph.hasNode(sourceId) && graph.hasNode(targetId)) {
        try {
          // First try with weight parameter
          const path = findPath(graph, sourceId, targetId, 'weight');
          return path || [];
        } catch (e) {
          // If that fails, try without weight parameter
          console.warn('Error using weight in path finding, trying without weight:', e);
          const path = findPath(graph, sourceId, targetId);
          return path || [];
        }
      }
      
      return [];
    } catch (error) {
      console.warn('Error finding path with graphology, falling back to basic algorithm:', error);
      return this.findPathBasic(sourceId, targetId);
    }
  }
  
  /**
   * Find a path between two contexts
   * @param sourceId Source context ID
   * @param targetId Target context ID
   * @returns Array of context IDs forming a path, or empty array if no path exists
   */
  public async findPath(sourceId: string, targetId: string): Promise<string[]> {
    await this.ensureInitialized();
    
    if (this.fallbackMode) return [];
    
    // If source and target are the same, return just that ID
    if (sourceId === targetId) return [sourceId];
    
    try {
      // First try with graphology, if available
      const path = await this.findPathWithGraphology(sourceId, targetId);
      return path;
    } catch (error) {
      console.warn('Error in findPath, falling back to basic algorithm:', error);
      return this.findPathBasic(sourceId, targetId);
    }
  }
  
  /**
   * Get all contexts that have a specific relationship with the given context
   * @param contextId Context ID
   * @param type Relationship type
   * @param direction 'outgoing' for edges where contextId is the source, 'incoming' for edges where contextId is the target, 'both' for both directions
   * @returns Array of context IDs
   */
  public async getRelatedContexts(
    contextId: string, 
    type: ContextRelationshipType, 
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): Promise<string[]> {
    await this.ensureInitialized();
    
    if (this.fallbackMode) return [];
    
    const relatedContexts = new Set<string>();
    
    // Filter edges by direction and type
    this.edges.forEach(edge => {
      if (edge.type !== type) return;
      
      if (direction === 'outgoing' || direction === 'both') {
        if (edge.source === contextId) {
          relatedContexts.add(edge.target);
        }
      }
      
      if (direction === 'incoming' || direction === 'both') {
        if (edge.target === contextId) {
          relatedContexts.add(edge.source);
        }
      }
    });
    
    return Array.from(relatedContexts);
  }
  
  /**
   * Get all contexts in the graph
   * @returns Array of context IDs
   */
  public async getAllContexts(): Promise<string[]> {
    await this.ensureInitialized();
    
    if (this.fallbackMode) return [];
    
    const contexts = new Set<string>();
    
    this.edges.forEach(edge => {
      contexts.add(edge.source);
      contexts.add(edge.target);
    });
    
    return Array.from(contexts);
  }
  
  /**
   * Find communities of related contexts
   * @returns Array of communities (each an array of context IDs)
   */
  public async findCommunities(): Promise<string[][]> {
    await this.ensureInitialized();
    
    if (this.fallbackMode) return [];
    
    // Basic community detection using connected components
    const nodes = await this.getAllContexts();
    const visited = new Set<string>();
    const communities: string[][] = [];
    
    for (const node of nodes) {
      if (visited.has(node)) continue;
      
      // Do BFS to find the connected component
      const community: string[] = [];
      const queue: string[] = [node];
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        
        if (visited.has(current)) continue;
        visited.add(current);
        community.push(current);
        
        // Get all connected nodes
        const relationships = await this.getRelationships(current);
        for (const edge of relationships) {
          const neighbor = edge.source === current ? edge.target : edge.source;
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }
      
      communities.push(community);
    }
    
    return communities;
  }
  
  /**
   * Create a relationship between similar contexts
   * @param contextId1 First context ID
   * @param contextId2 Second context ID
   * @param similarity Similarity score (0-1)
   */
  public async addSimilarityRelationship(contextId1: string, contextId2: string, similarity: number): Promise<void> {
    if (similarity <= 0.3) return; // Only add relationships for significant similarities
    
    await this.addRelationship(
      contextId1,
      contextId2,
      ContextRelationshipType.SIMILAR,
      similarity,
      { createdAt: new Date().toISOString() }
    );
  }
}

/**
 * Factory function to create the graph repository
 * @param contextDir Directory to store graph data
 * @returns Graph repository implementation
 */
export async function createGraphRepository(contextDir: string): Promise<GraphRepositoryInterface> {
  try {
    const repo = new GraphRepository(contextDir);
    return repo;
  } catch (error) {
    console.error('Error creating graph repository:', error);
    throw error;
  }
} 