import graphology from 'graphology';
import fs from 'fs-extra';
import path from 'path';
import { ContextRelationshipType } from '../domain/types';

/**
 * Edge type for graph relationships
 */
export interface EdgeType {
  source: string;
  target: string;
  type: ContextRelationshipType;
  weight: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Repository for managing graph database operations
 */
export class GraphRepository {
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
}
