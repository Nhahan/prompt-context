#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z, ZodError, ZodIssue } from 'zod';
import { MCPConfig, ContextImportance, ContextRelationshipType, SummaryResult } from './types';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { ApiAnalytics } from './analytics';
import { FileSystemRepository } from './repository';
import { Summarizer } from './summarizer';
import { VectorRepository } from './vector-repository';
import { GraphRepository } from './graph-repository';
import { ContextService } from './services/context.service';

let packageVersion = 'unknown';
try {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJsonContent = fs.readJsonSync(packageJsonPath);
  packageVersion = packageJsonContent.version || 'unknown';
} catch (error) {
  console.error('[MCP Server] Error reading package.json for version:', error);
}

console.error(`[MCP Server] Starting Prompt Context MCP Server v${packageVersion}`);
console.error('[MCP Server] Script starting... Imports complete.');

dotenv.config();
console.error('[MCP Server] dotenv configured.');
const baseDir =
  process.env.MCP_SERVER_BASE_DIR || path.join(os.homedir(), '.mcp-servers', 'prompt-context');
console.error(`[MCP Server] Determined baseDir: ${baseDir}`);
try {
  fs.ensureDirSync(baseDir);
  console.error(`[MCP Server] Base directory ensured: ${baseDir}`);
} catch (err: any) {
  console.error(`[MCP Server] CRITICAL ERROR ensuring base directory ${baseDir}:`, err);
  process.exit(1);
}
const DEFAULT_CONFIG: Omit<Required<MCPConfig>, 'ignorePatterns'> & Pick<MCPConfig, 'contextDir'> =
  {
    messageLimitThreshold: 10,
    tokenLimitPercentage: 80,
    contextDir: path.join(baseDir, 'context'),
    autoSummarize: true,
    hierarchicalContext: true,
    metaSummaryThreshold: 5,
    maxHierarchyDepth: 3,
    useVectorDb: true,
    useGraphDb: true,
    vectorDb: {},
    summarizer: {},
    debug: false,
    similarityThreshold: 0.6,
    autoCleanupContexts: true,
    trackApiCalls: true,
    apiAnalyticsRetention: 30,
    fallbackToKeywordMatch: true,
    port: 6789,
  };
console.error(`[MCP Server] Default config loaded. Context dir: ${DEFAULT_CONFIG.contextDir}`);
let config: typeof DEFAULT_CONFIG & Pick<MCPConfig, 'contextDir'> = { ...DEFAULT_CONFIG };
const configPath = path.join(baseDir, '.mcp-config.json');
console.error(`[MCP Server] Config path: ${configPath}`);
try {
  if (fs.existsSync(configPath)) {
    const loadedConfig = fs.readJsonSync(configPath);
    config = { ...config, ...loadedConfig };
    console.error('[MCP Server] Loaded config from .mcp-config.json');
  } else {
    console.error('[MCP Server] .mcp-config.json not found, using defaults/env vars.');
  }
} catch (error) {
  console.error(
    `[MCP Server] Error reading config file ${configPath}, using defaults/env vars:`,
    error
  );
}
console.error('[MCP Server] Checking for environment variable overrides...');
Object.keys(DEFAULT_CONFIG).forEach((key) => {
  if (key === 'ignorePatterns') return;

  const envVarKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
  const envValue = process.env[envVarKey];
  if (envValue !== undefined) {
    let parsedValue: any = envValue;
    try {
      parsedValue = JSON.parse(envValue);
    } catch (e) {
      if (envValue.toLowerCase() === 'true') parsedValue = true;
      else if (envValue.toLowerCase() === 'false') parsedValue = false;
      else if (!isNaN(Number(envValue))) parsedValue = Number(envValue);
      else parsedValue = envValue;
    }
    if (typeof parsedValue === typeof (DEFAULT_CONFIG as any)[key]) {
      (config as any)[key] = parsedValue;
      console.error(
        `[MCP Server] Overridden config with env var ${envVarKey}=${JSON.stringify(parsedValue)}`
      );
    } else if (key === 'ignorePatterns' && Array.isArray(parsedValue)) {
      (config as any)[key] = parsedValue;
      console.error(
        `[MCP Server] Overridden config with env var ${envVarKey}=${JSON.stringify(parsedValue)}`
      );
    } else {
      console.error(
        `[MCP Server] Env var ${envVarKey} type mismatch. Expected ${typeof (DEFAULT_CONFIG as any)[key]}, got ${typeof parsedValue}. Skipping.`
      );
    }
  }
});
console.error('[MCP Server] Checking for CLI argument overrides...');
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
if (portIndex > -1 && args[portIndex + 1]) {
  const cliPort = parseInt(args[portIndex + 1], 10);
  if (!isNaN(cliPort)) {
    config.port = cliPort;
    console.error(`[MCP Server] Overridden port with CLI arg: ${config.port}`);
  }
}
const configIndex = args.indexOf('--config');
if (configIndex > -1 && args[configIndex + 1]) {
  try {
    const cliConfig = JSON.parse(args[configIndex + 1]);
    config = { ...config, ...cliConfig };
    console.error('[MCP Server] Overridden config with CLI --config arg.');
  } catch (error) {
    console.error('[MCP Server] Error parsing --config CLI argument:', error);
  }
}
if (!path.isAbsolute(config.contextDir)) {
  config.contextDir = path.resolve(config.contextDir);
  console.error(`[MCP Server] Resolved contextDir to absolute path: ${config.contextDir}`);
}
try {
  fs.ensureDirSync(config.contextDir);
  console.error(`[MCP Server] Ensured final context directory exists: ${config.contextDir}`);
} catch (err: any) {
  console.error(
    `[MCP Server] CRITICAL ERROR ensuring final context directory ${config.contextDir}:`,
    err
  );
  process.exit(1);
}
console.error('[MCP Server] Final configuration loaded:', JSON.stringify(config, null, 2));
console.error('[MCP Server] Initializing components...');

async function initializeComponents() {
  let analytics: ApiAnalytics | null = null;
  if (config.trackApiCalls) {
    try {
      analytics = new ApiAnalytics();
      console.error('[MCP Server] Analytics initialized.');
    } catch (error) {
      console.error('[MCP Server] Error initializing Analytics (continuing without it):', error);
    }
  } else {
    console.error('[MCP Server] API call tracking disabled.');
  }

  console.error(
    `[MCP Server] Initializing FileSystemRepository with contextDir: ${config.contextDir}`
  );
  const repository = new FileSystemRepository(config);
  console.error('[MCP Server] FileSystemRepository initialized.');

  let vectorRepository: VectorRepository | null = null;
  let graphRepository: GraphRepository | null = null;

  if (config.useVectorDb) {
    console.error('[MCP Server] Initializing VectorRepository...');
    vectorRepository = new VectorRepository(config.contextDir);
    try {
      await vectorRepository.ensureInitialized();
      console.error('[MCP Server] VectorRepository successfully initialized.');
    } catch (err) {
      console.error('[MCP Server] Warning: VectorRepository initialization error:', err);
    }
  } else {
    console.error('[MCP Server] Vector DB usage disabled.');
  }

  if (config.useGraphDb) {
    console.error('[MCP Server] Initializing GraphRepository...');
    graphRepository = new GraphRepository(config.contextDir);
    try {
      await graphRepository.ensureInitialized();
      console.error('[MCP Server] GraphRepository successfully initialized.');
    } catch (err) {
      console.error('[MCP Server] Warning: GraphRepository initialization error:', err);
    }
  } else {
    console.error('[MCP Server] Graph DB usage disabled.');
  }

  console.error('[MCP Server] All required repositories initialized successfully.');

  console.error('[MCP Server] Initializing Summarizer...');
  const summarizer =
    config.autoSummarize || config.useVectorDb
      ? new Summarizer(config.tokenLimitPercentage, analytics, vectorRepository, graphRepository)
      : undefined;
  console.error('[MCP Server] Summarizer initialized.');

  console.error('[MCP Server] Initializing ContextService...');
  const contextService = new ContextService(
    { fs: repository, vector: vectorRepository, graph: graphRepository },
    summarizer,
    config,
    analytics
  );
  console.error('[MCP Server] ContextService initialized.');

  return { contextService, analytics };
}

// MCP 서버 시작 함수
async function startMcpServer(contextService: ContextService, analytics: ApiAnalytics | null) {
  const server = new McpServer({
    name: 'prompt-context',
    version: packageVersion,
  });
  console.error('[MCP Server] McpServer instance created.');

  console.error('[MCP Server] Registering MCP tools...');

  function formatZodError(error: ZodError): string {
    const issues = error.issues
      .map((issue: ZodIssue) => {
        const path = issue.path.join('.');
        return `Field '${path}': ${issue.message}`;
      })
      .join(', ');
    return `Invalid arguments: ${issues}`;
  }

  // ping 도구 등록
  server.tool('ping', {}, async (args, extra) => {
    console.error('[MCP Server] Received ping request.');
    return { content: [{ type: 'text' as const, text: 'pong' }] };
  });
  console.error('[MCP Server] Registered tool: ping');

  // add_message 도구 등록
  server.tool(
    'add_message',
    {
      contextId: z.string().min(1),
      message: z.string().min(1),
      role: z.enum(['user', 'assistant']),
      importance: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
      tags: z.array(z.string()).optional().default([]),
    },
    async (args, extra) => {
      const { contextId, message, role, importance, tags } = args;
      console.error(`[MCP Server] Received add_message for context: ${contextId} via MCP.`);
      try {
        // 문자열 중요도를 열거형 값으로 변환
        let importanceValue: ContextImportance = ContextImportance.MEDIUM;
        switch (importance.toUpperCase()) {
          case 'LOW':
            importanceValue = ContextImportance.LOW;
            break;
          case 'HIGH':
            importanceValue = ContextImportance.HIGH;
            break;
          case 'CRITICAL':
            importanceValue = ContextImportance.CRITICAL;
            break;
        }

        await contextService.addMessage(contextId, {
          role,
          content: message,
          importance: importanceValue,
          tags,
        });

        return {
          content: [{ type: 'text' as const, text: `Message added to context: ${contextId}` }],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[MCP Server] Error in add_message handler for ${contextId}:`, errorMessage);
        return { content: [], error: { message: `Failed to add message: ${errorMessage}` } };
      }
    }
  );
  console.error('[MCP Server] Registered tool: add_message');

  // retrieve_context 도구 등록
  server.tool('retrieve_context', { contextId: z.string().min(1) }, async (args, extra) => {
    const { contextId } = args;
    console.error(`[MCP Server] Received retrieve_context for context: ${contextId} via MCP.`);
    try {
      const context = await contextService.getContext(contextId);
      if (!context) {
        return { content: [], error: { message: `Context not found: ${contextId}` } };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(context) }] };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[MCP Server] Error in retrieve_context handler for ${contextId}:`,
        errorMessage
      );
      return { content: [], error: { message: `Failed to retrieve context: ${errorMessage}` } };
    }
  });
  console.error('[MCP Server] Registered tool: retrieve_context');

  // get_similar_contexts 도구 등록
  server.tool(
    'get_similar_contexts',
    {
      query: z.string().min(1),
      limit: z.number().int().min(1).optional().default(5),
    },
    async (args, extra) => {
      const { query, limit } = args;
      console.error(
        `[MCP Server] Received get_similar_contexts with query: "${query?.substring(0, 50)}..." via MCP.`
      );
      if (!config.useVectorDb) {
        return {
          content: [],
          error: { message: 'Vector database is not enabled in configuration.' },
        };
      }
      try {
        const results = await contextService.findSimilarContexts(query, limit);
        return { content: [{ type: 'text' as const, text: JSON.stringify(results) }] };
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[MCP Server] Error in get_similar_contexts handler:`, errorMessage);
        return {
          content: [],
          error: { message: `Failed to find similar contexts: ${errorMessage}` },
        };
      }
    }
  );
  console.error('[MCP Server] Registered tool: get_similar_contexts');

  // add_relationship 도구 등록
  server.tool(
    'add_relationship',
    {
      sourceContextId: z.string().min(1),
      targetContextId: z.string().min(1),
      relationshipType: z.nativeEnum(ContextRelationshipType),
      weight: z.number().min(0).max(1).optional().default(0.8),
    },
    async (args, extra) => {
      const { sourceContextId, targetContextId, relationshipType, weight } = args;
      console.error(
        `[MCP Server] Received add_relationship: ${sourceContextId} -> ${targetContextId} (${relationshipType}) via MCP.`
      );
      if (!config.useGraphDb) {
        return {
          content: [],
          error: { message: 'Graph database is not enabled in configuration.' },
        };
      }
      try {
        await contextService.addRelationship(
          sourceContextId,
          targetContextId,
          relationshipType,
          weight
        );
        return {
          content: [
            {
              type: 'text' as const,
              text: `Relationship added: ${sourceContextId} -> ${targetContextId} (${relationshipType})`,
            },
          ],
        };
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[MCP Server] Error in add_relationship handler:`, errorMessage);
        return { content: [], error: { message: `Failed to add relationship: ${errorMessage}` } };
      }
    }
  );
  console.error('[MCP Server] Registered tool: add_relationship');

  // get_related_contexts 도구 등록
  server.tool(
    'get_related_contexts',
    {
      contextId: z.string().min(1),
      relationshipType: z.nativeEnum(ContextRelationshipType).optional(),
      direction: z.enum(['incoming', 'outgoing', 'both']).optional().default('both'),
    },
    async (args, extra) => {
      const { contextId, relationshipType, direction } = args;
      console.error(
        `[MCP Server] Received get_related_contexts for context: ${contextId} via MCP.`
      );
      if (!config.useGraphDb) {
        return {
          content: [{ type: 'text', text: "[]" }],
          error: { message: 'Graph database is not enabled in configuration.' },
        };
      }
      try {
        const relatedContextIds = await contextService.getRelatedContexts(
          contextId,
          relationshipType,
          direction
        );
        
        // 명시적으로 배열을 JSON으로 변환하고 로깅 추가
        const jsonResult = JSON.stringify(relatedContextIds);
        console.error(`[MCP Server] Related contexts result: ${jsonResult}`);
        
        return { 
          content: [{ type: 'text', text: jsonResult }] 
        };
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `[MCP Server] Error in get_related_contexts handler for ${contextId}:`,
          errorMessage
        );
        // 오류가 발생해도 유효한 JSON 반환
        return {
          content: [{ type: 'text', text: "[]" }],
          error: { message: `Failed to get related contexts: ${errorMessage}` },
        };
      }
    }
  );
  console.error('[MCP Server] Registered tool: get_related_contexts');

  // summarize_context 도구 등록
  server.tool('summarize_context', { contextId: z.string().min(1) }, async (args, extra) => {
    const { contextId } = args;
    console.error(`[MCP Server] Received summarize_context for context: ${contextId} via MCP.`);
    try {
      const result: SummaryResult = await contextService.triggerManualSummarization(contextId);

      if (result.success && result.summary) {
        return {
          content: [
            {
              type: 'text' as const,
              text: result.summary.summary,
            },
          ],
        };
      } else {
        return {
          content: [],
          error: {
            message: `Failed to summarize context: ${result.error || 'Unknown summarization error'}`,
          },
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[MCP Server] Error in summarize_context handler for ${contextId}:`,
        errorMessage
      );
      return {
        content: [],
        error: {
          message: `Failed to trigger summarization: ${errorMessage}`,
        },
      };
    }
  });
  console.error('[MCP Server] Registered tool: summarize_context');

  console.error('[MCP Server] All tools registered.');

  // StdioServerTransport를 사용하여 리스닝 시작
  try {
    console.error('[MCP Server] Starting MCP listener with stdio transport...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[MCP Server] McpServer connected via stdio. Ready for requests.');
  } catch (error) {
    console.error('[MCP Server] CRITICAL ERROR starting MCP listener:', error);
    process.exit(1);
  }
}

// 메인 실행 로직
async function main() {
  try {
    console.error('[MCP Server] Starting component initialization...');
    const { contextService, analytics } = await initializeComponents();
    console.error('[MCP Server] Component initialization complete. Starting MCP server...');
    await startMcpServer(contextService, analytics);
  } catch (error) {
    console.error('[MCP Server] CRITICAL ERROR during startup:', error);
    process.exit(1);
  }
}

main();

// 프로세스 종료 처리
process.on('SIGINT', async () => {
  console.error('[MCP Server] Received SIGINT. Shutting down...');
  console.error('[MCP Server] Shutdown complete (save operations skipped).');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[MCP Server] Received SIGTERM. Shutting down...');
  console.error('[MCP Server] Shutdown complete (save operations skipped).');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[MCP Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[MCP Server] Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  // 스크립트가 직접 실행되었을 때 로깅만 추가
  console.error('[MCP Server] Script executed directly');
}
