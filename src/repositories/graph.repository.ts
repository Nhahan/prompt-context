import fs from 'fs-extra';
import path from 'path';
import { GraphRepositoryInterface } from './repository.interface';
import { ContextRelationshipType, ApiCallType } from '../domain/types';
import { ApiAnalytics } from '../utils/analytics';

/**
 * Interface for a graph edge (relationship between contexts)
 */
interface Edge {
  source: string;
  target: string;
  type: ContextRelationshipType;
  weight: number;
  createdAt: number;
  metadata?: Record<string, any>;
}

/**
 * Simple graph repository for context relationships
 */
export class GraphRepository implements GraphRepositoryInterface {
  private baseDir: string;
  private edges: Edge[] = [];
  private initialized: boolean = false;
  private analytics: ApiAnalytics | null = null;

  /**
   * Constructor
   * @param baseDir Base directory for storing graph data
   * @param analytics Optional analytics service
   */
  constructor(baseDir: string, analytics: ApiAnalytics | null = null) {
    this.baseDir = baseDir;
    this.analytics = analytics;
  }

  /**
   * Ensure the repository is initialized
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      const graphDir = path.join(this.baseDir, 'graph');
      await fs.ensureDir(graphDir);

      // Load existing edges
      const edgesFile = path.join(graphDir, 'context-relationships.json');
      if (await fs.pathExists(edgesFile)) {
        this.edges = await fs.readJson(edgesFile);
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize graph repository:', error);
      throw error;
    }
  }

  /**
   * Save edges to disk
   */
  private async saveEdges(): Promise<void> {
    const graphDir = path.join(this.baseDir, 'graph');
    await fs.ensureDir(graphDir);

    const edgesFile = path.join(graphDir, 'context-relationships.json');
    await fs.writeJson(edgesFile, this.edges, { spaces: 2 });
  }

  /**
   * Add a relationship between contexts
   * @param source Source context ID
   * @param target Target context ID
   * @param type Relationship type
   * @param weight Relationship weight/strength (0-1)
   * @param metadata Additional metadata
   */
  async addRelationship(
    source: string,
    target: string,
    type: ContextRelationshipType,
    weight: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.ensureInitialized();

    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.GRAPH_DB_ADD);
    }

    // Validate input
    if (weight < 0 || weight > 1) {
      throw new Error('Relationship weight must be between 0 and 1');
    }

    // Check if relationship already exists
    const existingEdgeIndex = this.edges.findIndex(
      (edge) => edge.source === source && edge.target === target && edge.type === type
    );

    if (existingEdgeIndex !== -1) {
      // Update existing edge
      this.edges[existingEdgeIndex] = {
        ...this.edges[existingEdgeIndex],
        weight,
        metadata: { ...this.edges[existingEdgeIndex].metadata, ...metadata },
      };
    } else {
      // Add new edge
      this.edges.push({
        source,
        target,
        type,
        weight,
        createdAt: Date.now(),
        metadata,
      });
    }

    await this.saveEdges();
  }

  /**
   * Get all relationships for a context
   * @param contextId Context ID
   * @returns Array of edges connected to the context
   */
  async getRelationships(contextId: string): Promise<Edge[]> {
    await this.ensureInitialized();

    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.GRAPH_DB_SEARCH);
    }

    return this.edges.filter((edge) => edge.source === contextId || edge.target === contextId);
  }

  /**
   * Remove all relationships for a context
   * @param contextId Context ID
   */
  async removeContext(contextId: string): Promise<void> {
    await this.ensureInitialized();

    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.GRAPH_DB_DELETE);
    }

    // Filter out edges that involve the context
    this.edges = this.edges.filter(
      (edge) => edge.source !== contextId && edge.target !== contextId
    );

    await this.saveEdges();
  }

  /**
   * Find a path between two contexts
   * @param sourceId Source context ID
   * @param targetId Target context ID
   * @returns Array of context IDs forming a path, or empty array if no path exists
   */
  async findPath(sourceId: string, targetId: string): Promise<string[]> {
    await this.ensureInitialized();

    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.GRAPH_DB_SEARCH);
    }

    // Simple breadth-first search implementation
    const visited = new Set<string>();
    const queue: { node: string; path: string[] }[] = [{ node: sourceId, path: [sourceId] }];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (node === targetId) {
        return path;
      }

      if (visited.has(node)) {
        continue;
      }

      visited.add(node);

      // Get all neighbors (both outgoing and incoming edges)
      const neighbors = this.edges
        .filter((edge) => edge.source === node)
        .map((edge) => edge.target)
        .concat(this.edges.filter((edge) => edge.target === node).map((edge) => edge.source));

      // Add neighbors to queue
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({ node: neighbor, path: [...path, neighbor] });
        }
      }
    }

    // No path found
    return [];
  }

  /**
   * Get all contexts that have a specific relationship with the given context
   * @param contextId Context ID
   * @param type Relationship type
   * @param direction 'outgoing' for edges where contextId is the source, 'incoming' for edges where contextId is the target, 'both' for both directions
   * @returns Array of context IDs
   */
  async getRelatedContexts(
    contextId: string,
    type?: ContextRelationshipType,
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): Promise<string[]> {
    await this.ensureInitialized();

    if (this.analytics) {
      this.analytics.trackCall(ApiCallType.GRAPH_DB_SEARCH);
    }

    let filteredEdges: Edge[] = [];

    if (direction === 'outgoing' || direction === 'both') {
      const outgoingEdges = this.edges.filter(
        (edge) => edge.source === contextId && (type === undefined || edge.type === type)
      );
      filteredEdges = filteredEdges.concat(outgoingEdges);
    }

    if (direction === 'incoming' || direction === 'both') {
      const incomingEdges = this.edges.filter(
        (edge) => edge.target === contextId && (type === undefined || edge.type === type)
      );
      filteredEdges = filteredEdges.concat(incomingEdges);
    }

    // Extract and deduplicate context IDs
    const relatedContextsSet = new Set<string>();

    for (const edge of filteredEdges) {
      if (edge.source === contextId) {
        relatedContextsSet.add(edge.target);
      } else {
        relatedContextsSet.add(edge.source);
      }
    }

    return Array.from(relatedContextsSet);
  }
}
