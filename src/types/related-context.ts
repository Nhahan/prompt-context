export interface RelatedContext {
  contextId: string;
  text: string;
  summary: string;
  type: string;
  weight: number;
  similarity?: number; // Optional similarity score for search results
}
