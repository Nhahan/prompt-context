import { z } from 'zod';
import { ContextRelationshipType } from '../domain/types';

/**
 * Schema for ping tool
 */
export const pingSchema = z.object({});

/**
 * Schema for add_message tool
 */
export const addMessageSchema = z.object({
  contextId: z.string().min(1),
  message: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  importance: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  tags: z.array(z.string()).optional().default([]),
});

/**
 * Schema for retrieve_context tool
 */
export const retrieveContextSchema = z.object({
  contextId: z.string().min(1),
});

/**
 * Schema for get_similar_contexts tool
 */
export const similarContextSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).optional().default(5),
});

/**
 * Schema for add_relationship tool
 */
export const addRelationshipSchema = z.object({
  sourceContextId: z.string().min(1),
  targetContextId: z.string().min(1),
  relationshipType: z.nativeEnum(ContextRelationshipType),
  weight: z.number().min(0).max(1).optional().default(0.8),
});

/**
 * Schema for get_related_contexts tool
 */
export const getRelatedContextsSchema = z.object({
  contextId: z.string().min(1),
  relationshipType: z.nativeEnum(ContextRelationshipType).optional(),
  direction: z.enum(['incoming', 'outgoing', 'both']).optional().default('both'),
});

/**
 * Schema for summarize_context tool
 */
export const summarizeContextSchema = z.object({
  contextId: z.string().min(1),
});

/**
 * Schema for visualize_context tool
 */
export const visualizeContextSchema = z.object({
  contextId: z.string().min(1).optional(),
  includeRelated: z.boolean().optional().default(true),
  depth: z.number().int().min(1).max(3).optional().default(1),
  format: z.enum(['json', 'mermaid', 'text']).optional().default('json'),
});

/**
 * Schema for get_context_metrics tool
 */
export const getContextMetricsSchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('week'),
});

/**
 * Map of tool names to their Zod schemas
 */
export const toolSchemas = {
  ping: pingSchema,
  add_message: addMessageSchema,
  retrieve_context: retrieveContextSchema,
  get_similar_contexts: similarContextSchema,
  add_relationship: addRelationshipSchema,
  get_related_contexts: getRelatedContextsSchema,
  summarize_context: summarizeContextSchema,
  visualize_context: visualizeContextSchema,
  get_context_metrics: getContextMetricsSchema,
};
