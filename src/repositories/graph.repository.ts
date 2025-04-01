import graphology from 'graphology';
import fs from 'fs-extra';
import path from 'path';
import { GraphRepositoryInterface, EdgeType } from './repository.interface';
import { ContextRelationshipType } from '../domain/types';

/**
 * Repository for managing graph database operations
 */
export class GraphRepository implements GraphRepositoryInterface {
  private graph: graphology;
  private dbPath: string;
  private isInitialized: boolean = false;

  /**
   * Create a new graph repository instance
   * @param contextDir The directory where graph data will be stored
   */
  constructor(contextDir: string) {
    this.graph = new graphology();
    this.dbPath = path.join(contextDir, 'graph-data.json');
  }

  /**
   * Ensure the graph database is initialized
   */
  public async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await fs.ensureDir(path.dirname(this.dbPath));

      // Load existing graph if it exists
      if (await fs.pathExists(this.dbPath)) {
        const data = await fs.readFile(this.dbPath, 'utf-8');
        const graphData = JSON.parse(data);
        this.graph.import(graphData);
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize graph repository:', error);
      // Continue with empty graph if load fails
    }
  }

  /**
   * Save the current graph state to disk
   */
  private async saveGraph(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.dbPath));
      await fs.writeFile(this.dbPath, JSON.stringify(this.graph.export()), 'utf-8');
    } catch (error) {
      console.error('Failed to save graph data:', error);
    }
  }

  /**
   * Add a relationship between two contexts
   */
  public async addRelationship(
    source: string,
    target: string,
    type: ContextRelationshipType,
    weight: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      // Ensure nodes exist
      if (!this.graph.hasNode(source)) {
        this.graph.addNode(source);
      }
      if (!this.graph.hasNode(target)) {
        this.graph.addNode(target);
      }

      // Add or update edge
      const edgeId = `${source}--${target}`;
      if (this.graph.hasEdge(edgeId)) {
        this.graph.setEdgeAttribute(edgeId, 'type', type);
        this.graph.setEdgeAttribute(edgeId, 'weight', weight);
        if (metadata) {
          this.graph.setEdgeAttribute(edgeId, 'metadata', metadata);
        }
      } else {
        this.graph.addEdgeWithKey(edgeId, source, target, {
          type,
          weight,
          createdAt: Date.now(),
          metadata,
        });
      }

      // Save changes to disk
      await this.saveGraph();
    } catch (error) {
      console.error('Error adding relationship:', error);
      throw error;
    }
  }

  /**
   * Get contexts related to the given context
   */
  public async getRelatedContexts(
    contextId: string,
    type?: ContextRelationshipType,
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): Promise<string[]> {
    await this.ensureInitialized();

    try {
      const relatedContexts = new Set<string>();

      if (direction === 'outgoing' || direction === 'both') {
        this.graph.forEachOutNeighbor(contextId, (neighbor, attributes) => {
          if (!type || attributes.type === type) {
            relatedContexts.add(neighbor);
          }
        });
      }

      if (direction === 'incoming' || direction === 'both') {
        this.graph.forEachInNeighbor(contextId, (neighbor, attributes) => {
          if (!type || attributes.type === type) {
            relatedContexts.add(neighbor);
          }
        });
      }

      return Array.from(relatedContexts);
    } catch (error) {
      console.error('Error getting related contexts:', error);
      throw error;
    }
  }

  /**
   * Get all relationships for a context
   */
  public async getRelationships(contextId: string): Promise<EdgeType[]> {
    await this.ensureInitialized();

    try {
      const edges: EdgeType[] = [];
      this.graph.forEachEdge((edge, attributes, source, target) => {
        if (source === contextId || target === contextId) {
          edges.push({
            source,
            target,
            type: attributes.type,
            weight: attributes.weight,
            createdAt: attributes.createdAt,
            metadata: attributes.metadata,
          });
        }
      });
      return edges;
    } catch (error) {
      console.error('Error getting relationships:', error);
      throw error;
    }
  }

  /**
   * Remove a context from the graph
   */
  public async removeContext(contextId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      if (this.graph.hasNode(contextId)) {
        this.graph.dropNode(contextId);
        // Save changes to disk
        await this.saveGraph();
      }
    } catch (error) {
      console.error('Error removing context:', error);
      throw error;
    }
  }

  /**
   * Find a path between contexts
   */
  public async findPath(sourceId: string, targetId: string): Promise<string[]> {
    await this.ensureInitialized();

    try {
      if (!this.graph.hasNode(sourceId) || !this.graph.hasNode(targetId)) {
        return [];
      }
      // Simple BFS implementation
      const queue: string[] = [sourceId];
      const visited = new Set<string>([sourceId]);
      const parent = new Map<string, string>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === targetId) {
          // Reconstruct path
          const path: string[] = [targetId];
          let node = targetId;
          while (parent.has(node)) {
            node = parent.get(node)!;
            path.unshift(node);
          }
          return path;
        }

        this.graph.forEachNeighbor(current, (neighbor) => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
            parent.set(neighbor, current);
          }
        });
      }

      return [];
    } catch (error) {
      console.error('Error finding path:', error);
      throw error;
    }
  }
}
