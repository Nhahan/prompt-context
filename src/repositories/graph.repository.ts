import fs from 'fs-extra';
import path from 'path';
import Graph from 'graphology';
import { GraphRepositoryInterface, EdgeType } from './repository.interface';
import { ContextRelationshipType } from '../domain/types';

interface GraphDBOptions {
  path: string;
}

/**
 * Repository for managing graph database operations
 */
export class GraphRepository implements GraphRepositoryInterface {
  private dbPath: string;
  private graph: Graph | null = null;
  private isInitialized: boolean = false;

  /**
   * Create a new graph repository instance
   */
  constructor(pathOrOptions: string | GraphDBOptions) {
    if (typeof pathOrOptions === 'string') {
      this.dbPath = pathOrOptions;
    } else {
      this.dbPath = pathOrOptions.path;
    }
  }

  /**
   * Ensure the graph database is initialized
   */
  public async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await fs.ensureDir(path.dirname(this.dbPath));

      // Load or create graph
      await this.loadOrCreateGraph();

      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing graph database:', error);
      throw error;
    }
  }

  /**
   * Load existing graph or create a new one
   */
  private async loadOrCreateGraph(): Promise<void> {
    const graphPath = path.join(this.dbPath, 'graph.json');

    try {
      // Check if graph exists
      if (await fs.pathExists(graphPath)) {
        // Load existing graph
        const graphData = await fs.readFile(graphPath, 'utf8');
        this.graph = new Graph();
        this.graph.import(JSON.parse(graphData));
      } else {
        // Create new graph
        this.graph = new Graph();

        // Save empty graph
        await this.saveGraph();
      }
    } catch (error) {
      console.error('Error loading graph:', error);

      // Create new graph on error
      this.graph = new Graph();

      // Save empty graph
      await this.saveGraph();
    }
  }

  /**
   * Save the graph to disk
   */
  private async saveGraph(): Promise<void> {
    if (!this.graph) return;

    const graphPath = path.join(this.dbPath, 'graph.json');

    try {
      await fs.ensureDir(path.dirname(graphPath));
      await fs.writeFile(graphPath, JSON.stringify(this.graph.export()), 'utf8');
    } catch (error) {
      console.error('Error saving graph:', error);
      throw error;
    }
  }

  /**
   * Add a relationship between two contexts
   */
  public async addRelationship(
    source: string,
    target: string,
    type: ContextRelationshipType,
    weight: number = 0.5,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.ensureInitialized();

    if (!this.graph) {
      throw new Error('Graph not initialized');
    }

    try {
      // Ensure nodes exist
      if (!this.graph.hasNode(source)) {
        this.graph.addNode(source, { id: source });
      }

      if (!this.graph.hasNode(target)) {
        this.graph.addNode(target, { id: target });
      }

      // Check if edge already exists
      const edgeId = `${source}--${target}`;
      if (this.graph.hasEdge(edgeId)) {
        // Update existing edge
        this.graph.setEdgeAttribute(edgeId, 'type', type);
        this.graph.setEdgeAttribute(edgeId, 'weight', weight);
        this.graph.setEdgeAttribute(edgeId, 'metadata', metadata);
      } else {
        // Add new edge
        this.graph.addEdgeWithKey(edgeId, source, target, {
          type,
          weight,
          createdAt: Date.now(),
          metadata,
        });
      }

      // Save the updated graph
      await this.saveGraph();
    } catch (error) {
      console.error('Error adding relationship to graph:', error);
      throw error;
    }
  }

  /**
   * Get contexts related to the given context
   */
  public async getRelatedContexts(
    contextId: string,
    type?: ContextRelationshipType,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<string[]> {
    await this.ensureInitialized();

    if (!this.graph || !this.graph.hasNode(contextId)) {
      return [];
    }

    try {
      const relatedContexts = new Set<string>();

      // Get outgoing edges
      if (direction === 'outgoing' || direction === 'both') {
        const outEdges = this.graph.outEdges(contextId);
        for (const edge of outEdges) {
          const edgeType = this.graph.getEdgeAttribute(edge, 'type');
          if (!type || edgeType === type) {
            relatedContexts.add(this.graph.target(edge));
          }
        }
      }

      // Get incoming edges
      if (direction === 'incoming' || direction === 'both') {
        const inEdges = this.graph.inEdges(contextId);
        for (const edge of inEdges) {
          const edgeType = this.graph.getEdgeAttribute(edge, 'type');
          if (!type || edgeType === type) {
            relatedContexts.add(this.graph.source(edge));
          }
        }
      }

      return Array.from(relatedContexts);
    } catch (error) {
      console.error('Error getting related contexts:', error);
      return [];
    }
  }

  /**
   * Get all relationships for a context
   */
  public async getRelationships(contextId: string): Promise<EdgeType[]> {
    await this.ensureInitialized();

    if (!this.graph || !this.graph.hasNode(contextId)) {
      return [];
    }

    try {
      const relationships: EdgeType[] = [];

      // Get outgoing edges
      const outEdges = this.graph.outEdges(contextId);
      for (const edge of outEdges) {
        const target = this.graph.target(edge);
        const type = this.graph.getEdgeAttribute(edge, 'type');
        const weight = this.graph.getEdgeAttribute(edge, 'weight') || 0.5;
        const createdAt = this.graph.getEdgeAttribute(edge, 'createdAt') || Date.now();
        const metadata = this.graph.getEdgeAttribute(edge, 'metadata') || {};

        relationships.push({
          source: contextId,
          target,
          type,
          weight,
          createdAt,
          metadata,
        });
      }

      // Get incoming edges
      const inEdges = this.graph.inEdges(contextId);
      for (const edge of inEdges) {
        const source = this.graph.source(edge);
        const type = this.graph.getEdgeAttribute(edge, 'type');
        const weight = this.graph.getEdgeAttribute(edge, 'weight') || 0.5;
        const createdAt = this.graph.getEdgeAttribute(edge, 'createdAt') || Date.now();
        const metadata = this.graph.getEdgeAttribute(edge, 'metadata') || {};

        relationships.push({
          source,
          target: contextId,
          type,
          weight,
          createdAt,
          metadata,
        });
      }

      return relationships;
    } catch (error) {
      console.error('Error getting relationships:', error);
      return [];
    }
  }

  /**
   * Remove a context from the graph
   */
  public async removeContext(contextId: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.graph || !this.graph.hasNode(contextId)) {
      return;
    }

    try {
      // Remove the node (graphology automatically removes connected edges)
      this.graph.dropNode(contextId);

      // Save the updated graph
      await this.saveGraph();
    } catch (error) {
      console.error('Error removing context from graph:', error);
      throw error;
    }
  }

  /**
   * Find a path between contexts
   */
  public async findPath(sourceId: string, targetId: string): Promise<string[]> {
    await this.ensureInitialized();

    if (!this.graph || !this.graph.hasNode(sourceId) || !this.graph.hasNode(targetId)) {
      return [];
    }

    try {
      // Simple BFS to find a path
      const visited = new Set<string>();
      const queue: Array<{ node: string; path: string[] }> = [{ node: sourceId, path: [sourceId] }];

      while (queue.length > 0) {
        const { node, path } = queue.shift()!;

        if (node === targetId) {
          return path;
        }

        if (visited.has(node)) {
          continue;
        }

        visited.add(node);

        // Add neighbors to queue
        const neighbors = this.graph.neighbors(node);
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push({
              node: neighbor,
              path: [...path, neighbor],
            });
          }
        }
      }

      // No path found
      return [];
    } catch (error) {
      console.error('Error finding path between contexts:', error);
      return [];
    }
  }
}

export default GraphRepository;
