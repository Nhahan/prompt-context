import { z } from 'zod';
import { ContextRelationshipType } from '../domain/types';

/**
 * Schema for ping tool
 */
export const pingSchema = z.object({
  random_string: z.string().optional().describe('Dummy parameter for no-parameter tools'),
});

/**
 * Schema for add_message tool
 */
export const addMessageSchema = z.object({
  contextId: z.string().min(1).describe('Unique identifier for the conversation context'),
  message: z.string().min(1).describe('Message content'),
  role: z.enum(['user', 'assistant']).describe('Role of the message sender'),
  importance: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .default('MEDIUM')
    .describe('Importance level of the message'),
  tags: z.array(z.string()).default([]).describe('Tags for categorizing the message'),
});

/**
 * Schema for retrieve_context tool
 */
export const retrieveContextSchema = z.object({
  contextId: z
    .string()
    .min(1)
    .describe('Unique identifier for the conversation context to retrieve'),
});

/**
 * Schema for get_similar_contexts tool
 */
export const similarContextSchema = z.object({
  query: z.string().min(1).describe('Query text to find similar contexts'),
  limit: z
    .number()
    .int()
    .min(1)
    .default(5)
    .describe('Maximum number of similar contexts to return'),
});

/**
 * Schema for add_relationship tool
 */
export const addRelationshipSchema = z.object({
  sourceContextId: z.string().min(1).describe('Source context ID'),
  targetContextId: z.string().min(1).describe('Target context ID'),
  relationshipType: z
    .enum([
      ContextRelationshipType.SIMILAR,
      ContextRelationshipType.CONTINUES,
      ContextRelationshipType.REFERENCES,
      ContextRelationshipType.PARENT,
      ContextRelationshipType.CHILD,
    ])
    .describe('Type of relationship'),
  weight: z.number().min(0).max(1).default(0.8).describe('Relationship strength (0-1)'),
});

/**
 * Schema for get_related_contexts tool
 */
export const getRelatedContextsSchema = z.object({
  contextId: z.string().min(1).describe('Context ID to find related contexts for'),
  direction: z
    .enum(['incoming', 'outgoing', 'both'])
    .default('both')
    .describe('Relationship direction'),
  relationshipType: z
    .enum([
      ContextRelationshipType.SIMILAR,
      ContextRelationshipType.CONTINUES,
      ContextRelationshipType.REFERENCES,
      ContextRelationshipType.PARENT,
      ContextRelationshipType.CHILD,
    ])
    .optional()
    .describe('Type of relationship to filter by'),
});

/**
 * Schema for summarize_context tool
 */
export const summarizeContextSchema = z.object({
  contextId: z.string().min(1).describe('Context ID to summarize'),
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
};
