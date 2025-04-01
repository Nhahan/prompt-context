#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import http from 'http';
import path from 'path';
import fs from 'fs-extra';
import { ContextService } from '../services/context.service';
import { MCPConfig } from '../config/config';
import { TOOL_NAMES, AddContextParams, GetContextParams } from '../domain/types';
import { z } from 'zod';

/**
 * Tool interface for strategy pattern
 */
interface Tool {
  getName(): string;
  getSchema(): z.ZodObject<any>;
  getHandler(server: PromptContextMcpServer): (args: any) => Promise<{
    content: Array<{ text: string; type: 'text' }>;
    isError?: boolean;
  }>;
}

/**
 * Add context tool implementation
 */
class AddContextTool implements Tool {
  getName(): string {
    return TOOL_NAMES.ADD_CONTEXT;
  }

  getSchema(): z.ZodObject<any> {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  getHandler(server: PromptContextMcpServer): (args: any) => Promise<{
    content: Array<{ text: string; type: 'text' }>;
    isError?: boolean;
  }> {
    return async (args) => {
      const typedArgs = args as AddContextParams;

      try {
        // Process importance parameter
        let importance = 0.5; // Default to MEDIUM
        if (typedArgs.importance) {
          switch (typedArgs.importance) {
            case 'LOW':
              importance = 0.25;
              break;
            case 'MEDIUM':
              importance = 0.5;
              break;
            case 'HIGH':
              importance = 0.75;
              break;
            case 'CRITICAL':
              importance = 1.0;
              break;
          }
        }

        // Add message to context
        await server.contextService.addMessage({
          contextId: typedArgs.contextId,
          content: typedArgs.message,
          role: typedArgs.role,
          timestamp: Date.now(),
          importance,
          tags: typedArgs.tags || [],
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Message added to context: ${typedArgs.contextId}`,
              }),
            },
          ],
          isError: false,
        };
      } catch (error) {
        console.error('Error in add_context handler:', error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
              }),
            },
          ],
          isError: true,
        };
      }
    };
  }
}

/**
 * Get context tool implementation
 */
class GetContextTool implements Tool {
  getName(): string {
    return TOOL_NAMES.GET_CONTEXT;
  }

  getSchema(): z.ZodObject<any> {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  getHandler(server: PromptContextMcpServer): (args: any) => Promise<{
    content: Array<{ text: string; type: 'text' }>;
    isError?: boolean;
  }> {
    return async (args) => {
      const typedArgs = args as GetContextParams;

      try {
        // Determine operation type
        if (typedArgs.contextId) {
          // Get specific context
          const context = await server.contextService.getContext(typedArgs.contextId);
          if (!context) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Context not found: ${typedArgs.contextId}`,
                  }),
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
                  result: context,
                }),
              },
            ],
            isError: false,
          };
        } else if (typedArgs.query) {
          // Search for similar contexts
          const similarContexts = await server.contextService.findSimilarContexts(
            typedArgs.query,
            typedArgs.limit || 5
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  result: similarContexts,
                }),
              },
            ],
            isError: false,
          };
        } else {
          // Invalid arguments
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Either contextId or query must be provided',
                }),
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        console.error('Error in get_context handler:', error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
              }),
            },
          ],
          isError: true,
        };
      }
    };
  }
}

/**
 * MCP Server class responsible for handling MCP requests
 */
export class PromptContextMcpServer {
  private server: McpServer;
  public contextService: ContextService;
  private config: MCPConfig;
  private packageVersion: string;
  private httpServer: http.Server | null = null;
  public tools: Tool[] = [];

  /**
   * Create a new MCP Server instance
   * @param contextService Context service
   * @param config MCP configuration
   */
  constructor(contextService: ContextService, config: MCPConfig) {
    this.contextService = contextService;
    this.config = config;

    // Initialize available tools
    this.tools = [new AddContextTool(), new GetContextTool()];

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
   * Start HTTP server if configured
   */
  private async startHttpServer(): Promise<void> {
    if (!this.config.enableHttpServer) {
      console.error('[MCP Server] HTTP server disabled in configuration.');
      return;
    }

    try {
      const httpPort = this.config.httpPort || 3000;

      return new Promise((resolve) => {
        this.httpServer = http
          .createServer((req, res) => {
            if (req.url === '/health') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'ok', version: this.packageVersion }));
              return;
            }

            if (req.url === '/info') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  name: 'prompt-context-server',
                  version: this.packageVersion,
                  tools: this.tools.map((tool) => tool.getName()),
                  config: {
                    ...this.config,
                    // Hide sensitive info
                    apiKey: this.config.apiKey ? '********' : undefined,
                  },
                })
              );
              return;
            }

            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
          })
          .listen(httpPort, () => {
            console.error(`[MCP Server] HTTP server started on port ${httpPort}`);
            resolve();
          });
      });
    } catch (error) {
      console.error('[MCP Server] Failed to start HTTP server:', error);
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    try {
      // Register tool handlers
      this.registerTools();

      // Start the HTTP server if enabled
      await this.startHttpServer();

      // Start server with stdio transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      console.error('[MCP Server] Ready to receive requests');
      console.error('[MCP Server] MCP Server started successfully.');
    } catch (error) {
      console.error('[MCP Server] Error starting server:', error);
      throw error;
    }
  }

  /**
   * Register MCP tools
   */
  private registerTools(): void {
    console.log('[MCP Server] Registering tools...');

    // Register each tool using the strategy pattern
    for (const tool of this.tools) {
      this.server.tool(tool.getName(), tool.getHandler(this));
    }
  }
}