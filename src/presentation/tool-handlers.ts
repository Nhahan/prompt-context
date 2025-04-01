import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ContextServiceInterface } from '../services/context.interface';
import {
  addMessageSchema,
  retrieveContextSchema,
  similarContextSchema,
  addRelationshipSchema,
  getRelatedContextsSchema,
  summarizeContextSchema,
  visualizeContextSchema,
  getContextMetricsSchema,
  toolSchemas,
} from './tools-schema';
import { ContextImportance } from '../domain/types';

/**
 * Convert importance string to enum value
 * @param importance Importance as string
 * @returns Importance as enum value
 */
function parseImportance(importance: string): ContextImportance | undefined {
  switch (importance) {
    case 'LOW':
      return ContextImportance.LOW;
    case 'MEDIUM':
      return ContextImportance.MEDIUM;
    case 'HIGH':
      return ContextImportance.HIGH;
    case 'CRITICAL':
      return ContextImportance.CRITICAL;
    default:
      return undefined;
  }
}

/**
 * Tool handler for the ping tool
 * Simple ping tool to test connectivity
 */
export function handlePing() {
  return {
    content: [
      {
        type: 'text',
        text: 'pong',
      },
    ],
  };
}

/**
 * Tool handler for the add_message tool
 * @param args Tool arguments
 * @param contextService Context service
 */
export async function handleAddMessage(
  args: z.infer<typeof addMessageSchema>,
  contextService: ContextServiceInterface
) {
  const { contextId, message, role, importance, tags } = args;

  try {
    await contextService.addMessage({
      contextId,
      role,
      content: message,
      timestamp: Date.now(),
      importance: importance ? parseImportance(importance) : undefined,
      tags,
    });

    return { success: true };
  } catch (error) {
    console.error(`[Tool Handler] Error in add_message for ${contextId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Tool handler for the retrieve_context tool
 * @param args Tool arguments
 * @param contextService Context service
 */
export async function handleRetrieveContext(
  args: z.infer<typeof retrieveContextSchema>,
  contextService: ContextServiceInterface
) {
  try {
    const context = await contextService.getContext(args.contextId);

    if (!context) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, error: 'Context not found' }),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            contextId: args.contextId,
            messages: context.messages,
            hasSummary: context.hasSummary,
            summary: context.summary,
          }),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: errorMessage }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Tool handler for the get_similar_contexts tool
 * @param args Tool arguments
 * @param contextService Context service
 */
export async function get_similar_contexts(
  args: z.infer<typeof similarContextSchema>,
  contextService: ContextServiceInterface
): Promise<Array<{ contextId: string; similarity: number }>> {
  try {
    const similarContexts = await contextService.findSimilarContexts(args.query, args.limit);

    // Convert RelatedContext[] to { contextId: string; similarity: number }[]
    return similarContexts.map((context) => ({
      contextId: context.contextId,
      similarity: context.similarity ?? 0,
    }));
  } catch (error) {
    console.error(
      `[Tool Handler] Error in get_similar_contexts with query "${args.query}":`,
      error
    );
    return [];
  }
}

/**
 * Tool handler for the add_relationship tool
 * @param args Tool arguments
 * @param contextService Context service
 */
export async function handleAddRelationship(
  args: z.infer<typeof addRelationshipSchema>,
  contextService: ContextServiceInterface
) {
  try {
    await contextService.addRelationship(
      args.sourceContextId,
      args.targetContextId,
      args.relationshipType
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            sourceContextId: args.sourceContextId,
            targetContextId: args.targetContextId,
            relationshipType: args.relationshipType,
          }),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: errorMessage }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Tool handler for the get_related_contexts tool
 * @param args Tool arguments
 * @param contextService Context service
 */
export async function get_related_contexts(
  args: z.infer<typeof getRelatedContextsSchema>,
  contextService: ContextServiceInterface
): Promise<string[]> {
  try {
    const relatedContexts = await contextService.getRelatedContexts(
      args.contextId,
      args.relationshipType,
      args.direction
    );
    return relatedContexts;
  } catch (error) {
    console.error(`[Tool Handler] Error in get_related_contexts for ${args.contextId}:`, error);
    return [];
  }
}

/**
 * Tool handler for the summarize_context tool
 * @param args Tool arguments
 * @param contextService Context service
 */
export async function handleSummarizeContext(
  args: z.infer<typeof summarizeContextSchema>,
  contextService: ContextServiceInterface
) {
  try {
    const result = await contextService.triggerManualSummarization(args.contextId);

    if (result.success && result.summary) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.summary),
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              contextId: args.contextId,
              error: result.error || 'Unknown error during summarization',
            }),
          },
        ],
        isError: true,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: errorMessage }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Tool handler for the visualize_context tool
 * @param args Tool arguments
 * @param contextService Context service
 */
export async function handleVisualizeContext(
  args: z.infer<typeof visualizeContextSchema>,
  contextService: ContextServiceInterface
) {
  try {
    // 컨텍스트 ID가 제공되지 않은 경우 빈 세션 목록 반환
    if (!args.contextId) {
      // 참고: ContextServiceInterface에 listSessions 메서드가 없으므로 빈 배열 반환
      return {
        success: true,
        sessions: [],
        format: args.format,
      };
    }

    // 특정 컨텍스트 시각화
    const context = await contextService.getContext(args.contextId);
    if (!context) {
      return {
        success: false,
        error: `Context not found: ${args.contextId}`,
      };
    }

    // 관련 컨텍스트 가져오기
    let relatedContexts: Array<{ contextId: string }> = [];
    if (args.includeRelated) {
      const relatedIds = await contextService.getRelatedContexts(args.contextId);
      relatedContexts = relatedIds.map((id) => ({ contextId: id }));
    }

    if (args.format === 'text') {
      // 텍스트 형식 시각화
      const lines: string[] = [];
      lines.push(`Context ID: ${args.contextId}`);
      lines.push(`Messages: ${context.messages.length}`);
      lines.push(`Has Summary: ${!!context.summary}`);

      if (context.summary) {
        lines.push(`Summary: ${context.summary.messageCount || 0} messages summarized`);
        if (context.summary.keyInsights && context.summary.keyInsights.length > 0) {
          lines.push(`Key Insights: ${context.summary.keyInsights.join(', ')}`);
        }
      }

      if (relatedContexts.length > 0) {
        lines.push(`Related Contexts: ${relatedContexts.map((r) => r.contextId).join(', ')}`);
      }

      return {
        success: true,
        contextId: args.contextId,
        format: 'text',
        text: lines.join('\n'),
      };
    } else {
      // 기본 JSON 형식
      return {
        success: true,
        contextId: args.contextId,
        messageCount: context.messages.length,
        hasSummary: !!context.summary,
        summary: context.summary
          ? {
              keyInsights: context.summary.keyInsights || [],
              messageCount: context.summary.messageCount || 0,
              codeBlocks: (context.summary.codeBlocks || []).map((block) => ({
                language: block.language,
                importance: block.importance,
              })),
            }
          : null,
        relatedContexts,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to visualize context: ${errorMessage}`,
    };
  }
}

/**
 * Tool handler for the get_context_metrics tool
 * @param args Tool arguments
 * @param contextService Context service
 */
export async function handleGetContextMetrics(
  args: z.infer<typeof getContextMetricsSchema>,
  contextService: ContextServiceInterface
) {
  try {
    // 기본 메트릭 반환 (analytics 서비스 없이도 작동하도록)
    const allContexts = await contextService.getContext(args.period || 'all');
    const contextCount = allContexts ? 1 : 0;

    return {
      success: true,
      metrics: {
        averageScore: 0,
        totalCalls: contextCount,
        byType: { context: contextCount },
        historyTrend: [],
      },
      period: args.period,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to get context metrics: ${errorMessage}`,
    };
  }
}

/**
 * Map of tool names to their handler functions
 */
export const toolHandlers = {
  ping: handlePing,
  add_message: handleAddMessage,
  retrieve_context: handleRetrieveContext,
  get_similar_contexts: get_similar_contexts,
  add_relationship: handleAddRelationship,
  get_related_contexts: get_related_contexts,
  summarize_context: handleSummarizeContext,
  visualize_context: handleVisualizeContext,
  get_context_metrics: handleGetContextMetrics,
};

/**
 * Tool definitions for MCP server
 */
export const toolDefinitions = Object.entries(toolSchemas).map(([name, schema]) => ({
  name,
  description: getToolDescription(name),
  inputSchema: zodToJsonSchema(schema, `${name}Schema`),
}));

/**
 * Get tool description based on tool name
 * @param toolName Tool name
 */
function getToolDescription(toolName: string): string {
  switch (toolName) {
    case 'ping':
      return 'Simple ping tool to test connectivity with the MCP server';
    case 'add_message':
      return 'Add a message to a conversation context';
    case 'retrieve_context':
      return 'Retrieve a conversation context by ID';
    case 'get_similar_contexts':
      return 'Find contexts similar to a query';
    case 'add_relationship':
      return 'Add a relationship between two contexts';
    case 'get_related_contexts':
      return 'Get contexts related to a specific context';
    case 'summarize_context':
      return 'Trigger manual summarization for a context';
    case 'visualize_context':
      return 'Visualize a conversation context';
    case 'get_context_metrics':
      return 'Get context metrics';
    default:
      return 'Tool description not available';
  }
}
