#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { MemoryContextProtocol } from './mcp.js';
import { ContextImportance, ContextRelationshipType, Message } from './types.js';
import 'dotenv/config';
import path from 'path';
import * as fs from 'fs';

// 로그 설정: 모든 로그를 stderr로 출력하여 stdout와 충돌하지 않도록 함
const LOG_FILE = process.env.LOG_FILE ? path.resolve(process.env.LOG_FILE) : path.resolve('./mcp-server.log');

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.error(formattedMessage);
  
  // 로그 파일이 설정된 경우 파일에도 기록
  try {
    fs.appendFileSync(LOG_FILE, formattedMessage + '\n');
  } catch (err) {
    console.error(`Error writing to log file: ${err}`);
  }
}

// MCP 초기화 및 설정
log("Initializing MCP...");

// 환경 변수에서 설정 로드
const contextDir = process.env.CONTEXT_DIR || '.prompt-context';
const useGit = process.env.USE_GIT !== 'false';
const autoSummarize = process.env.AUTO_SUMMARIZE !== 'false';
const useVectorDb = process.env.USE_VECTOR_DB !== 'false';
const useGraphDb = process.env.USE_GRAPH_DB !== 'false';

// MCP 인스턴스 초기화
const mcp = new MemoryContextProtocol({
  messageLimitThreshold: parseInt(process.env.MESSAGE_LIMIT_THRESHOLD || '10'),
  tokenLimitPercentage: parseInt(process.env.TOKEN_LIMIT_PERCENTAGE || '80'),
  contextDir,
  useGit,
  autoSummarize,
  hierarchicalContext: process.env.HIERARCHICAL_CONTEXT !== 'false',
  metaSummaryThreshold: parseInt(process.env.META_SUMMARY_THRESHOLD || '5'),
  maxHierarchyDepth: parseInt(process.env.MAX_HIERARCHY_DEPTH || '3'),
  useVectorDb,
  useGraphDb,
  similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.6'),
  autoCleanupContexts: process.env.AUTO_CLEANUP_CONTEXTS !== 'false'
});

log("MCP initialized successfully");

// Zod 스키마 정의

const PingArgsSchema = z.object({}).describe("No arguments needed for ping.");

const AddMessageArgsSchema = z.object({
  contextId: z.string().min(1).describe("Unique identifier for the context"),
  message: z.string().min(1).describe("Message content to add"),
  role: z.enum(["user", "assistant"]).describe("Role of the message sender"),
  importance: z.enum(["low", "medium", "high", "critical"]).optional().default("medium").describe("Importance level (default: medium)"),
  tags: z.array(z.string()).optional().default([]).describe("Tags associated with the message (optional)"),
});
type AddMessageArgs = z.infer<typeof AddMessageArgsSchema>;

const RetrieveContextArgsSchema = z.object({
  contextId: z.string().min(1).describe("Unique identifier for the context to retrieve"),
});
type RetrieveContextArgs = z.infer<typeof RetrieveContextArgsSchema>;

const GetSimilarContextsArgsSchema = z.object({
  query: z.string().min(1).describe("Text to find similar contexts for"),
  limit: z.number().int().min(1).optional().default(5).describe("Maximum number of contexts to return (default: 5)"),
});
type GetSimilarContextsArgs = z.infer<typeof GetSimilarContextsArgsSchema>;

const RelationshipTypeEnum = z.enum([
    "similar",
    "continues",
    "references",
    "parent",
    "child",
]);

const AddRelationshipArgsSchema = z.object({
  sourceContextId: z.string().min(1).describe("Source context ID"),
  targetContextId: z.string().min(1).describe("Target context ID"),
  relationshipType: RelationshipTypeEnum.describe("Type of relationship (similar, continues, references, parent, child)"),
  weight: z.number().min(0).max(1).optional().default(0.8).describe("Weight of the relationship (0.0 to 1.0, default: 0.8)"),
});
type AddRelationshipArgs = z.infer<typeof AddRelationshipArgsSchema>;

const GetRelatedContextsArgsSchema = z.object({
  contextId: z.string().min(1).describe("Context ID to find related contexts for"),
  relationshipType: RelationshipTypeEnum.optional().describe("Optional: filter by relationship type"),
  direction: z.enum(["incoming", "outgoing", "both"]).optional().default("both").describe("Direction of relationships to get (default: both)"),
});
type GetRelatedContextsArgs = z.infer<typeof GetRelatedContextsArgsSchema>;

const SummarizeContextArgsSchema = z.object({
  contextId: z.string().min(1).describe("Context ID to generate summary for"),
});
type SummarizeContextArgs = z.infer<typeof SummarizeContextArgsSchema>;

// 서버 인스턴스 생성 - 명시적으로 모든 설정 적용
const server = new Server(
  {
    name: "prompt-context-mcp",
    version: process.env.npm_package_version || "0.1.1-beta.14",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 도구 목록 요청 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => {
  log(`Received list_tools request`);
  
  const tools: Tool[] = [
    {
      name: "ping",
      description: "Simple ping/pong test to check server connectivity.",
      inputSchema: zodToJsonSchema(PingArgsSchema, "pingArgs") as any,
    },
    {
      name: "add_message",
      description: "Add a message (user or assistant) to a specific context. Creates the context if it doesn't exist.",
      inputSchema: zodToJsonSchema(AddMessageArgsSchema, "addMessageArgs") as any,
    },
    {
      name: "retrieve_context",
      description: "Retrieve all messages and the latest summary for a given context ID.",
      inputSchema: zodToJsonSchema(RetrieveContextArgsSchema, "retrieveContextArgs") as any,
    },
    {
      name: "get_similar_contexts",
      description: "Find contexts that are semantically similar to a given query string using vector search.",
      inputSchema: zodToJsonSchema(GetSimilarContextsArgsSchema, "getSimilarContextsArgs") as any,
    },
    {
      name: "add_relationship",
      description: "Add a directed relationship (e.g., similar, continues) between two contexts in the knowledge graph.",
      inputSchema: zodToJsonSchema(AddRelationshipArgsSchema, "addRelationshipArgs") as any,
    },
    {
      name: "get_related_contexts",
      description: "Get a list of context IDs that are related to a specific context, optionally filtering by relationship type and direction.",
      inputSchema: zodToJsonSchema(GetRelatedContextsArgsSchema, "getRelatedContextsArgs") as any,
    },
    {
      name: "summarize_context",
      description: "Generate or update the summary for a given context ID. Returns the generated summary.",
      inputSchema: zodToJsonSchema(SummarizeContextArgsSchema, "summarizeContextArgs") as any,
    }
  ];
  
  log(`Returning ${tools.length} tools in list_tools response`);
  return { tools };
});

// 도구 호출 요청 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs = {} } = request.params;
  log(`Received call_tool request for tool: ${name} with args: ${JSON.stringify(rawArgs)}`);
  
  try {
    switch (name) {
      case "ping":
        log("Executing ping tool");
        return { 
          content: [{ type: "text", text: "pong" }] 
        };
      
      case "add_message": {
        const parseResult = AddMessageArgsSchema.safeParse(rawArgs);
        if (!parseResult.success) {
          log(`Invalid arguments for add_message: ${JSON.stringify(parseResult.error.flatten().fieldErrors)}`);
          throw new Error(`Invalid arguments for add_message: ${JSON.stringify(parseResult.error.flatten().fieldErrors)}`);
        }
        const args: AddMessageArgs = parseResult.data;
        log(`Executing add_message with validated args: ${JSON.stringify(args)}`);
        
        let importanceEnum: ContextImportance;
        switch(args.importance) {
            case "low": importanceEnum = ContextImportance.LOW; break;
            case "high": importanceEnum = ContextImportance.HIGH; break;
            case "critical": importanceEnum = ContextImportance.CRITICAL; break;
            default: importanceEnum = ContextImportance.MEDIUM;
        }
        
        const message: Message = {
          content: args.message,
          role: args.role,
          timestamp: Date.now(),
          importance: importanceEnum,
          tags: args.tags
        };
        
        await mcp.addMessage(args.contextId, message);
        
        return {
          content: [{ 
            type: "text", 
            text: `Message added to context: ${args.contextId}` 
          }]
        };
      }
      
      case "retrieve_context": {
        const parseResult = RetrieveContextArgsSchema.safeParse(rawArgs);
         if (!parseResult.success) {
          log(`Invalid arguments for retrieve_context: ${JSON.stringify(parseResult.error.flatten().fieldErrors)}`);
          throw new Error(`Invalid arguments for retrieve_context: ${JSON.stringify(parseResult.error.flatten().fieldErrors)}`);
        }
        const args: RetrieveContextArgs = parseResult.data;
        log(`Executing retrieve_context for contextId: ${args.contextId}`);
        
        const messages = await mcp.getMessages(args.contextId);
        const summary = await mcp.loadSummary(args.contextId);
        
        const result = {
          contextId: args.contextId,
          messages: messages || [],
          summary: summary || null
        };
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(result, null, 2) 
          }]
        };
      }
      
      case "get_similar_contexts": {
        const parseResult = GetSimilarContextsArgsSchema.safeParse(rawArgs);
        if (!parseResult.success) {
          log(`Invalid arguments for get_similar_contexts: ${JSON.stringify(parseResult.error.flatten().fieldErrors)}`);
          throw new Error(`Invalid arguments for get_similar_contexts: ${JSON.stringify(parseResult.error.flatten().fieldErrors)}`);
        }
        const args: GetSimilarContextsArgs = parseResult.data;
        log(`Executing get_similar_contexts with query: ${args.query}, limit: ${args.limit}`);
        
        const similarContexts = await mcp.findSimilarContexts(args.query, args.limit);
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(similarContexts, null, 2) 
          }]
        };
      }
      
      case "add_relationship": {
        const parseResult = AddRelationshipArgsSchema.safeParse(rawArgs);
        if (!parseResult.success) {
           log(`Invalid arguments for add_relationship: ${JSON.stringify(parseResult.error.flatten().fieldErrors)}`);
           throw new Error(`Invalid arguments for add_relationship: ${JSON.stringify(parseResult.error.flatten().fieldErrors)}`);
        }
        const args: AddRelationshipArgs = parseResult.data;
        log(`Executing add_relationship: ${args.sourceContextId} -> ${args.targetContextId} (${args.relationshipType})`);
        
        let relType: ContextRelationshipType;
        switch (args.relationshipType) {
            case 'similar': relType = ContextRelationshipType.SIMILAR; break;
            case 'continues': relType = ContextRelationshipType.CONTINUES; break;
            case 'references': relType = ContextRelationshipType.REFERENCES; break;
            case 'parent': relType = ContextRelationshipType.PARENT; break;
            case 'child': relType = ContextRelationshipType.CHILD; break;
            default: relType = ContextRelationshipType.SIMILAR; // Should not happen with enum
        }
        
        await mcp.addRelationship(
          args.sourceContextId,
          args.targetContextId,
          relType,
          args.weight
        );
        
        return {
          content: [{ 
            type: "text", 
            text: `Relationship added: ${args.sourceContextId} -> ${args.targetContextId} (${args.relationshipType})` 
          }]
        };
      }
      
      case "get_related_contexts": {
        const parseResult = GetRelatedContextsArgsSchema.safeParse(rawArgs);
        if (!parseResult.success) {
          log(`Invalid arguments for get_related_contexts: ${JSON.stringify(parseResult.error.flatten().fieldErrors)}`);
          throw new Error(`Invalid arguments for get_related_contexts: ${JSON.stringify(parseResult.error.flatten().fieldErrors)}`);
        }
        const args: GetRelatedContextsArgs = parseResult.data;
        log(`Executing get_related_contexts for contextId: ${args.contextId}`);
        
        let relatedContexts: string[];
        
        if (args.relationshipType) {
          let relType: ContextRelationshipType;
          switch (args.relationshipType) {
            case 'similar': relType = ContextRelationshipType.SIMILAR; break;
            case 'continues': relType = ContextRelationshipType.CONTINUES; break;
            case 'references': relType = ContextRelationshipType.REFERENCES; break;
            case 'parent': relType = ContextRelationshipType.PARENT; break;
            case 'child': relType = ContextRelationshipType.CHILD; break;
            default: relType = ContextRelationshipType.SIMILAR; // Should not happen
          }
          relatedContexts = await mcp.getRelatedContextsByType(
            args.contextId, 
            relType, 
            args.direction
          );
        } else {
          relatedContexts = await mcp.getRelatedContexts(args.contextId);
        }
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(relatedContexts, null, 2) 
          }]
        };
      }
      
      case "summarize_context": {
        const parseResult = SummarizeContextArgsSchema.safeParse(rawArgs);
        if (!parseResult.success) {
           log(`Invalid arguments for summarize_context: ${JSON.stringify(parseResult.error.flatten().fieldErrors)}`);
           throw new Error(`Invalid arguments for summarize_context: ${JSON.stringify(parseResult.error.flatten().fieldErrors)}`);
        }
        const args: SummarizeContextArgs = parseResult.data;
        log(`Executing summarize_context for contextId: ${args.contextId}`);
        
        await mcp.summarizeContext(args.contextId);
        const summary = await mcp.loadSummary(args.contextId);
        
        return {
          content: [{ 
            type: "text", 
            text: summary?.summary || "Summary could not be generated or is empty." 
          }]
        };
      }
      
      default:
        log(`Unknown tool requested: ${name}`);
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    log(`Error executing ${name}: ${error.message}\nStack: ${error.stack}`);

    let userMessage = `An error occurred while executing the '${name}' tool.`;
    if (error.message.startsWith("Invalid arguments")) {
        userMessage = `Error: ${error.message}`;
    } else if (error.message.startsWith("Unknown tool")) {
        userMessage = `Error: The tool '${name}' is not recognized by the server.`;
    }

    return {
      content: [{ type: "text", text: userMessage }],
      isError: true
    };
  }
});

// 프로세스 종료 핸들러
process.on('SIGINT', () => {
  log("SIGINT received. Shutting down...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  log("SIGTERM received. Shutting down...");
  process.exit(0);
});

// 명령줄 인자 파싱
function parseArgs() {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      const key = args[i].slice(2); // '--' 제거
      result[key] = args[i + 1];
      i++; // 다음 인자 건너뛰기
    } else if (args[i].startsWith('--')) {
      const key = args[i].slice(2); // '--' 제거
      result[key] = 'true';
    }
  }
  
  return result;
}

// HTTP 서버 시작 (개발 및 테스트용)
async function startHTTPServer(port: number) {
  try {
    const express = require('express');
    const app = express();
    app.use(express.json());
    
    app.get('/', (_req: any, res: any) => {
      res.json({
        name: "Prompt Context MCP Server",
        version: process.env.npm_package_version || "0.1.1",
        description: "Memory context management for AI agents",
      });
    });
    
    // HTTP 서버 실행
    app.listen(port, () => {
      log(`HTTP Server running at http://localhost:${port}`);
      log('Use --mcp-mode to run in MCP mode with stdin/stdout transport.');
    });
  } catch (error) {
    log(`Failed to start HTTP server: ${error}`);
    process.exit(1);
  }
}

// 메인 함수: 서버 시작
async function main() {
  try {
    log("Starting MCP Server...");
    
    // 환경 변수 정보 출력
    log(`Runtime Environment: Node.js ${process.version}`);
    log(`Operating System: ${process.platform} ${process.arch}`);
    
    // Vector repository 및 Graph repository는 자동으로 초기화됨
    log("MCP repositories initialized");
    
    // 명령줄 인자 파싱
    const parsedArgs = parseArgs();
    
    // 클라이언트 및 설정 정보 로깅
    if (parsedArgs.client) {
      log(`Client type: ${parsedArgs.client}`);
    }
    
    if (parsedArgs.config) {
      try {
        let configJson = parsedArgs.config;
        if (configJson.startsWith('"') && configJson.endsWith('"')) {
          configJson = configJson.slice(1, -1);
        }
        
        const config = JSON.parse(configJson);
        log(`Config: ${JSON.stringify(config)}`);
      } catch (error) {
        log(`Error parsing config JSON: ${error}`);
      }
    }
    
    // MCP 모드 확인
    const isMCPMode = parsedArgs['mcp-mode'] === 'true' || 
                     process.argv.includes('--mcp-mode') || 
                     process.env.MCP_MODE === 'true' || 
                     !process.stdout.isTTY;
    
    if (isMCPMode) {
      // MCP 모드로 실행
      log("Starting in MCP mode with stdio transport");
      const transport = new StdioServerTransport();
      await server.connect(transport);
      log("MCP server connected and ready for requests");
    } else {
      // HTTP 모드로 실행
      const PORT = Number(process.env.PORT || 6789);
      log(`Starting in HTTP mode on port ${PORT}`);
      startHTTPServer(PORT);
    }
  } catch (error) {
    log(`Fatal error in initialization: ${error}`);
    process.exit(1);
  }
}

// 직접 실행 시 메인 함수 호출
if (require.main === module) {
  main().catch((error) => {
    log(`Unhandled error in main: ${error}`);
    process.exit(1);
  });
}

// 서버 모듈 내보내기
export { mcp, server }; 