export interface Context {
  id: string;
  text: string;
  summary: string;
  embedding: number[];
  relationships?: Array<{
    contextId: string;
    type: string;
    weight: number;
  }>;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ContextSummary {
  contextId: string;
  summary: string;
}
