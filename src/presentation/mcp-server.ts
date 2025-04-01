#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import http from 'http';
import path from 'path';
import fs from 'fs-extra';
import { z, ZodError } from 'zod';
import { toolHandlers } from './tool-handlers';
import { ContextServiceInterface } from '../services/context.interface';
import { MCPConfig } from '../config/config';
import { ContextRelationshipType } from '../domain/types';

/**
 * MCP Server class responsible for handling MCP requests
 */
export class PromptContextMcpServer {
  private server: McpServer;
  private contextService: ContextServiceInterface;
  private config: MCPConfig;
  private packageVersion: string;
  private httpServer: http.Server | null = null;

  /**
   * Create a new MCP Server instance
   * @param contextService Context service
   * @param config MCP configuration
   */
  constructor(contextService: ContextServiceInterface, config: MCPConfig) {
    this.contextService = contextService;
    this.config = config;

    // Get package version
    this.packageVersion = 'unknown';
    try {
      // First try to find in the workspace root directory
      const workspaceRoot = process.cwd();
      const packageJsonPath = path.resolve(workspaceRoot, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        const packageJsonContent = fs.readJsonSync(packageJsonPath);
        this.packageVersion = packageJsonContent.version || 'unknown';
      } else {
        // Fall back to the original location if not found
        const altPath = path.join(__dirname, '..', '..', 'package.json');
        if (fs.existsSync(altPath)) {
          const packageJsonContent = fs.readJsonSync(altPath);
          this.packageVersion = packageJsonContent.version || 'unknown';
        }
      }
    } catch (error) {
      console.error('[MCP Server] Error reading package.json for version:', error);
    }

    // Initialize MCP server
    this.server = new McpServer({
      name: 'prompt-context-server',
      version: this.packageVersion,
    });

    console.error(`[MCP Server] Starting Prompt Context MCP Server v${this.packageVersion}`);
  }

  /**
   * Format Zod validation error for client response
   * @param error Zod error
   * @returns Formatted error message
   */
  private formatZodError(error: ZodError): string {
    return error.errors
      .map((issue) => {
        const path = issue.path.join('.');
        return `${path ? path + ': ' : ''}${issue.message}`;
      })
      .join('; ');
  }

  /**
   * Register all tool handlers with the MCP server
   */
  private registerTools(): void {
    // Register ping tool
    this.server.tool(
      'ping',
      {},
      async (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _args,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _extra
      ) => {
        console.error(`[MCP Server] Tool call received: ping`);
        return { content: [{ type: 'text', text: 'pong' }] };
      }
    );

    // Register add_message tool
    this.server.tool(
      'add_message',
      {
        contextId: z.string().min(1),
        message: z.string().min(1),
        role: z.enum(['user', 'assistant']),
        importance: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
        tags: z.array(z.string()).optional().default([]),
      },
      async (
        args,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _extra
      ) => {
        console.error(`[MCP Server] Tool call received: add_message`);
        try {
          const result = await toolHandlers.add_message(args, this.contextService);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [],
            error: { message: `Failed to add message: ${errorMessage}` },
          };
        }
      }
    );

    // Register retrieve_context tool
    this.server.tool(
      'retrieve_context',
      { contextId: z.string().min(1) },
      async (
        args,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _extra
      ) => {
        console.error(`[MCP Server] Tool call received: retrieve_context`);
        try {
          const result = await toolHandlers.retrieve_context(args, this.contextService);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [],
            error: { message: `Failed to retrieve context: ${errorMessage}` },
          };
        }
      }
    );

    // Register get_similar_contexts tool
    this.server.tool(
      'get_similar_contexts',
      {
        query: z.string().min(1),
        limit: z.number().int().min(1).optional().default(5),
      },
      async (
        args,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _extra
      ) => {
        console.error(`[MCP Server] Tool call received: get_similar_contexts`);
        try {
          const similarContexts = await toolHandlers.get_similar_contexts(
            args,
            this.contextService
          );
          return {
            content: [{ type: 'text', text: JSON.stringify(similarContexts) }],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: 'text', text: JSON.stringify([]) }],
            error: { message: `Failed to find similar contexts: ${errorMessage}` },
          };
        }
      }
    );

    // Register add_relationship tool
    this.server.tool(
      'add_relationship',
      {
        sourceContextId: z.string().min(1),
        targetContextId: z.string().min(1),
        relationshipType: z.nativeEnum(ContextRelationshipType),
        weight: z.number().min(0).max(1).optional().default(0.8),
      },
      async (
        args,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _extra
      ) => {
        console.error(`[MCP Server] Tool call received: add_relationship`);
        try {
          const result = await toolHandlers.add_relationship(args, this.contextService);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [],
            error: { message: `Failed to add relationship: ${errorMessage}` },
          };
        }
      }
    );

    // Register get_related_contexts tool
    this.server.tool(
      'get_related_contexts',
      {
        contextId: z.string().min(1),
        relationshipType: z.nativeEnum(ContextRelationshipType).optional(),
        direction: z.enum(['incoming', 'outgoing', 'both']).optional().default('both'),
      },
      async (
        args,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _extra
      ) => {
        console.error(`[MCP Server] Tool call received: get_related_contexts`);
        try {
          const relatedContexts = await toolHandlers.get_related_contexts(
            args,
            this.contextService
          );
          return {
            content: [{ type: 'text', text: JSON.stringify(relatedContexts) }],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: 'text', text: JSON.stringify([]) }],
            error: { message: `Failed to get related contexts: ${errorMessage}` },
          };
        }
      }
    );

    // Register summarize_context tool
    this.server.tool(
      'summarize_context',
      { contextId: z.string().min(1) },
      async (
        args,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _extra
      ) => {
        console.error(`[MCP Server] Tool call received: summarize_context`);
        try {
          const result = await toolHandlers.summarize_context(args, this.contextService);
          // Extract summary information directly from JSON response
          try {
            const responseObj = JSON.parse(result.content[0].text);
            if (responseObj.success && responseObj.summary) {
              return {
                content: [{ type: 'text', text: JSON.stringify(responseObj.summary) }],
              };
            } else {
              return {
                content: [{ type: 'text', text: '""' }],
              };
            }
          } catch (e) {
            // Return empty string if parsing fails
            return {
              content: [{ type: 'text', text: '""' }],
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: 'text', text: '""' }],
            error: { message: `Failed to summarize context: ${errorMessage}` },
          };
        }
      }
    );

    // Register visualize_context tool
    this.server.tool(
      'visualize_context',
      {
        contextId: z.string().optional(),
        includeRelated: z.boolean().optional().default(true),
        depth: z.number().int().min(1).max(3).optional().default(1),
        format: z.enum(['json', 'mermaid', 'text']).optional().default('json'),
      },
      async (
        args,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _extra
      ) => {
        console.error(`[MCP Server] Tool call received: visualize_context`);
        try {
          const result = await toolHandlers.visualize_context(args, this.contextService);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [],
            error: { message: `Failed to visualize context: ${errorMessage}` },
          };
        }
      }
    );

    // Register get_context_metrics tool
    this.server.tool(
      'get_context_metrics',
      {
        period: z.enum(['day', 'week', 'month']).optional().default('week'),
      },
      async (
        args,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _extra
      ) => {
        console.error(`[MCP Server] Tool call received: get_context_metrics`);
        try {
          const result = await toolHandlers.get_context_metrics(args, this.contextService);
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Failed to get context metrics: ${errorMessage}`,
                }),
              },
            ],
            isError: true,
          };
        }
      }
    );

    console.error('[MCP Server] All tools registered.');
  }

  /**
   * Start the HTTP server
   */
  private async startHttpServer(): Promise<void> {
    const port = this.config.port || 6789;

    this.httpServer = http.createServer(async (req, res) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle preflight request
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Only support POST requests to /mcp/function
      if (req.method !== 'POST' || req.url !== '/mcp/function') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Not Found' } }));
        return;
      }

      try {
        // Read request body
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        await new Promise<void>((resolve, reject) => {
          req.on('end', () => resolve());
          req.on('error', (err) => reject(err));
        });

        // Parse request body
        let requestData;
        try {
          requestData = JSON.parse(body);
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: { message: 'Invalid JSON request body' },
            })
          );
          return;
        }

        // Validate function call
        if (!requestData.function_call || !requestData.function_call.name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: { message: 'Missing function_call.name in request' },
            })
          );
          return;
        }

        // Handle the function call
        const functionName = requestData.function_call.name.replace(
          /^mcp_Prompt_Context_Test_/,
          ''
        );
        const args = requestData.function_call.arguments || {};

        console.error(`[MCP Server] HTTP Tool call received: ${functionName}`, args);

        // Process the function call
        let result;
        switch (functionName) {
          case 'ping':
            result = { content: [{ type: 'text', text: 'pong' }] };
            break;
          case 'add_message':
            result = await toolHandlers.add_message(args, this.contextService);
            break;
          case 'retrieve_context':
            result = await toolHandlers.retrieve_context(args, this.contextService);
            break;
          case 'get_similar_contexts':
            result = await toolHandlers.get_similar_contexts(args, this.contextService);
            break;
          case 'add_relationship':
            result = await toolHandlers.add_relationship(args, this.contextService);
            break;
          case 'get_related_contexts':
            result = await toolHandlers.get_related_contexts(args, this.contextService);
            break;
          case 'summarize_context':
            result = await toolHandlers.summarize_context(args, this.contextService);
            break;
          case 'visualize_context':
            result = await toolHandlers.visualize_context(args, this.contextService);
            break;
          case 'get_context_metrics':
            result = await toolHandlers.get_context_metrics(args, this.contextService);
            break;
          default:
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: { message: `Unknown function: ${functionName}` },
              })
            );
            return;
        }

        // Send the response
        res.writeHead(200, { 'Content-Type': 'application/json' });

        if (typeof result === 'string') {
          // If result is already a string, wrap it
          res.end(
            JSON.stringify({
              content: [{ type: 'text', text: result }],
            })
          );
        } else if (result && 'content' in result) {
          // If result already has content format, use it directly
          res.end(JSON.stringify(result));
        } else {
          // Otherwise, serialize the result object
          res.end(
            JSON.stringify({
              content: [{ type: 'text', text: JSON.stringify(result) }],
            })
          );
        }
      } catch (error) {
        console.error('[MCP Server] Error handling HTTP request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: {
              message: `Server error: ${error instanceof Error ? error.message : String(error)}`,
            },
          })
        );
      }
    });

    // Start the HTTP server
    return new Promise((resolve, reject) => {
      this.httpServer
        ?.listen(port, () => {
          console.error(`[MCP Server] HTTP server listening on port ${port}`);
          resolve();
        })
        .on('error', (error) => {
          console.error(`[MCP Server] Error starting HTTP server:`, error);
          reject(error);
        });
    });
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    this.registerTools();

    // Determine server type from environment variable
    const serverType = process.env.MCP_SERVER_TYPE || 'stdio';

    if (serverType === 'http') {
      console.error('[MCP Server] Starting in HTTP mode...');
      await this.startHttpServer();
    } else {
      // Default to stdio transport
      const transport = new StdioServerTransport();
      console.error('[MCP Server] Connecting to stdio transport...');

      try {
        await this.server.connect(transport);
      } catch (error) {
        console.error('[MCP Server] Server connection error:', error);
        throw error;
      }
    }

    console.error('[MCP Server] MCP Server started successfully.');
  }
}
