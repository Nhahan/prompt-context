#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// Re-comment out HTTP transport as the path seems incorrect
// import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js"; 
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { MemoryContextProtocol } from './mcp.js';
import { 
    ContextImportance, 
    ContextRelationshipType, 
    Message, 
    MCPConfig,
} from './types.js';
import 'dotenv/config';
import path from 'path';
import * as fs from 'fs';

// Log settings: Log all messages to stderr to avoid conflicts with stdout
const LOG_FILE = process.env.LOG_FILE ? path.resolve(process.env.LOG_FILE) : path.resolve('./mcp-server.log');

function log(message: string, ...optionalParams: any[]): void {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}${optionalParams.length > 0 ? ' ' + JSON.stringify(optionalParams) : ''}`;
  console.error(formattedMessage);
  
  // Write logs to file if LOG_FILE is set
  try {
    fs.appendFileSync(LOG_FILE, formattedMessage + '\n');
  } catch (err) {
    console.error(`Error writing to log file: ${err}`);
  }
}

// Argument Parsing (Using built-in function)
function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      const key = args[i].slice(2);
      result[key] = args[i + 1];
      i++;
    } else if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      result[key] = 'true';
    }
  }
  return result;
}

// Zod Schemas
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

// Main Execution Function
async function main() {
  log("Starting MCP Server...");
  log(`Runtime Environment: Node.js ${process.version}, OS: ${process.platform} ${process.arch}`);

  const parsedArgs = parseArgs();
  log("Parsed arguments:", JSON.stringify(parsedArgs));

  // Configuration Loading and Merging
  let config: Partial<MCPConfig> = {};
  config.messageLimitThreshold = parseInt(process.env.MESSAGE_LIMIT_THRESHOLD || '10');
  config.tokenLimitPercentage = parseInt(process.env.TOKEN_LIMIT_PERCENTAGE || '80');
  config.contextDir = process.env.CONTEXT_DIR || '.prompt-context';
  config.useGit = process.env.USE_GIT !== 'false';
  config.autoSummarize = process.env.AUTO_SUMMARIZE !== 'false';
  config.hierarchicalContext = process.env.HIERARCHICAL_CONTEXT !== 'false';
  config.metaSummaryThreshold = parseInt(process.env.META_SUMMARY_THRESHOLD || '5');
  config.maxHierarchyDepth = parseInt(process.env.MAX_HIERARCHY_DEPTH || '3');
  config.useVectorDb = process.env.USE_VECTOR_DB !== 'false';
  config.useGraphDb = process.env.USE_GRAPH_DB !== 'false';
  config.similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.6');
  config.autoCleanupContexts = process.env.AUTO_CLEANUP_CONTEXTS !== 'false';
  config.port = Number(process.env.PORT || parsedArgs.port || '6789');

  if (parsedArgs.config) {
      try {
          let configJson = parsedArgs.config;
          if (configJson.startsWith('"') && configJson.endsWith('"')) {
              configJson = configJson.slice(1, -1).replace(/\\"/g, '"');
          }
          const parsedConfigOverrides = JSON.parse(configJson || '{}');
          config = { ...config, ...parsedConfigOverrides };
          log("Applied config overrides from --config argument.");
      } catch (error) {
          log(`Error parsing --config JSON: ${error}`);
      }
  }
  log("Final configuration:", JSON.stringify(config));

  let mcp: MemoryContextProtocol;
  try {
      mcp = new MemoryContextProtocol(config);
      log("MemoryContextProtocol initialized.");
  } catch (initError) {
      log("Fatal error during MemoryContextProtocol initialization:", initError);
      process.exit(1);
  }

  const server = new Server(
    {
      name: "prompt-context-mcp",
      version: process.env.npm_package_version || "unknown",
    },
    {
      capabilities: { tools: {} },
    }
  );

  const tools: Tool[] = [
    {
        name: "ping",
        description: "Simple ping/pong test to check server connectivity.",
        inputSchema: zodToJsonSchema(PingArgsSchema) as any,
    },
    {
        name: "add_message",
        description: "Add a message (user or assistant) to a specific context. Creates the context if it doesn't exist.",
        inputSchema: zodToJsonSchema(AddMessageArgsSchema) as any,
    },
    {
        name: "retrieve_context",
        description: "Retrieve all messages and the latest summary for a given context ID.",
        inputSchema: zodToJsonSchema(RetrieveContextArgsSchema) as any,
    },
    {
        name: "get_similar_contexts",
        description: "Find contexts that are semantically similar to a given query string using vector search.",
        inputSchema: zodToJsonSchema(GetSimilarContextsArgsSchema) as any,
    },
    {
        name: "add_relationship",
        description: "Add a directed relationship (e.g., similar, continues) between two contexts in the knowledge graph.",
        inputSchema: zodToJsonSchema(AddRelationshipArgsSchema) as any,
    },
    {
        name: "get_related_contexts",
        description: "Get a list of context IDs that are related to a specific context, optionally filtering by relationship type and direction.",
        inputSchema: zodToJsonSchema(GetRelatedContextsArgsSchema) as any,
    },
    {
        name: "summarize_context",
        description: "Generate or update the summary for a given context ID. Returns the generated summary.",
        inputSchema: zodToJsonSchema(SummarizeContextArgsSchema) as any,
    }
  ];
  
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    log(`Received list_tools request`);
    log(`Returning ${tools.length} tools`);
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs = {} } = request.params;
    log(`Received call_tool request for tool: ${name} with args: ${JSON.stringify(rawArgs)}`);
    
    try {
      switch (name) {
        case "ping":
          log("Executing ping");
          return { content: [{ type: "text", text: "pong" }] };
        
        case "add_message": {
          const args = AddMessageArgsSchema.parse(rawArgs);
          log(`Executing add_message for context: ${args.contextId}`);
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
          return { content: [{ type: "text", text: `Message added to context: ${args.contextId}` }] };
        }

        case "retrieve_context": {
            const args = RetrieveContextArgsSchema.parse(rawArgs);
            log(`Executing retrieve_context for context: ${args.contextId}`);
            const messages = await mcp.getMessages(args.contextId);
            const summary = await mcp.loadSummary(args.contextId);
            const result = {
                contextId: args.contextId,
                messages: messages || [],
                summary: summary || null
            };
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "get_similar_contexts": {
            const args = GetSimilarContextsArgsSchema.parse(rawArgs);
            log(`Executing get_similar_contexts with query: ${args.query}, limit: ${args.limit}`);
            const similarContexts = await mcp.findSimilarContexts(args.query, args.limit);
            return { content: [{ type: "text", text: JSON.stringify(similarContexts, null, 2) }] };
        }

        case "add_relationship": {
            const args = AddRelationshipArgsSchema.parse(rawArgs);
            log(`Executing add_relationship: ${args.sourceContextId} -> ${args.targetContextId}`);
            const relationshipTypeEnum = args.relationshipType as ContextRelationshipType;
            await mcp.addRelationship(args.sourceContextId, args.targetContextId, relationshipTypeEnum, args.weight);
            return { content: [{ type: "text", text: `Relationship added: ${args.sourceContextId} -> ${args.targetContextId} (${args.relationshipType})` }] };
        }

        case "get_related_contexts": {
            const args = GetRelatedContextsArgsSchema.parse(rawArgs);
            log(`Executing get_related_contexts for context: ${args.contextId}`);
            let relatedContexts: string[];
            if (args.relationshipType) {
                const typeEnum = args.relationshipType as ContextRelationshipType;
                relatedContexts = await mcp.getRelatedContextsByType(args.contextId, typeEnum, args.direction);
            } else {
                relatedContexts = await mcp.getRelatedContexts(args.contextId);
            }
            return { content: [{ type: "text", text: JSON.stringify(relatedContexts, null, 2) }] };
        }

        case "summarize_context": {
            const args = SummarizeContextArgsSchema.parse(rawArgs);
            log(`Executing summarize_context for context: ${args.contextId}`);
            const success = await mcp.summarizeContext(args.contextId);
            let summaryText = "Summary generation failed or context not found.";
            if (success) {
                const summary = await mcp.loadSummary(args.contextId);
                summaryText = summary?.summary || "Summary generated but could not be loaded or is empty.";
            }
            return { content: [{ type: "text", text: summaryText }] }; 
        }

        default:
          log(`Unknown tool requested: ${name}`);
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      log(`Error executing ${name}: ${error.message}\nStack: ${error.stack}`);
      let userMessage = `An error occurred while executing the '${name}' tool.`;
      if (error instanceof z.ZodError) {
           userMessage = `Invalid arguments for ${name}: ${JSON.stringify(error.flatten().fieldErrors)}`;
      } else if (error.message.startsWith("Unknown tool")) {
          userMessage = `Error: The tool '${name}' is not recognized by the server.`;
      }
      return {
        content: [{ type: "text", text: userMessage }],
        isError: true
      };
    }
  });

  process.on('SIGINT', () => {
    log("SIGINT received. Shutting down...");
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    log("SIGTERM received. Shutting down...");
    process.exit(0);
  });

  const isMCPMode = parsedArgs['mcp-mode'] === 'true' || 
                   process.argv.includes('--mcp-mode') || 
                   process.env.MCP_MODE === 'true' || 
                   !process.stdout.isTTY;
  
  if (isMCPMode) {
      log("Starting in MCP mode with stdio transport");
      const transport = new StdioServerTransport();
      await server.connect(transport); 
      log("MCP server connected and ready for requests via stdio.");
  } else {
      // Disable HTTP mode completely for now
      log("HTTP server mode is disabled. Please use --mcp-mode to run.");
      process.exit(0); // Exit cleanly if not MCP mode
  }
}

if (require.main === module) {
  main().catch(error => {
      log("Unhandled error in main execution:", error);
      process.exit(1);
  });
} 