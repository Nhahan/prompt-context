#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
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
    return "add_context";
  }

  getSchema(): z.ZodObject<any> {
    return z.object({
      random_string: z.string(),
      contextId: z.string(),
      message: z.string(),
      role: z.enum(['user', 'assistant']),
      importance: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      tags: z.array(z.string()).optional(),
    });
  }

  getHandler(server: PromptContextMcpServer): (args: any) => Promise<{
    content: Array<{ text: string; type: 'text' }>;
    isError?: boolean;
  }> {
    return async (rawArgs: any) => {
      // UUID 자동 생성
      const requestId = crypto.randomUUID();
      
      try {
        // 전체 rawArgs 객체를 검사하기 위한 자세한 로깅
        console.error(`[DEBUG] AddContextTool [${requestId}] Raw args (typeof: ${typeof rawArgs}):`, rawArgs);
        console.error(`[DEBUG] AddContextTool [${requestId}] Raw args JSON:`, JSON.stringify(rawArgs, null, 2));
        console.error(`[DEBUG] AddContextTool [${requestId}] Raw args keys:`, Object.keys(rawArgs));
        
        // 매개변수 처리 로직 개선
        let args;
        if (typeof rawArgs === 'object') {
          // 다양한 매개변수 구조 처리
          if (rawArgs.arguments) {
            args = rawArgs.arguments;
            console.error(`[DEBUG] AddContextTool [${requestId}] Using rawArgs.arguments`);
          } else if (rawArgs.params && rawArgs.params.arguments) {
            args = rawArgs.params.arguments;
            console.error(`[DEBUG] AddContextTool [${requestId}] Using rawArgs.params.arguments`);
          } else if (rawArgs.params) {
            args = rawArgs.params;
            console.error(`[DEBUG] AddContextTool [${requestId}] Using rawArgs.params`);
          } else {
            args = rawArgs;
            console.error(`[DEBUG] AddContextTool [${requestId}] Using rawArgs directly`);
          }
        } else {
          args = rawArgs;
          console.error(`[DEBUG] AddContextTool [${requestId}] Using rawArgs directly (non-object)`);
        }
        
        console.error(`[DEBUG] AddContextTool [${requestId}] Processed args:`, JSON.stringify(args, null, 2));
        
        // 필수 파라미터 검증
        if (!args.contextId) {
          console.error('[DEBUG] Missing contextId');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Context ID is required',
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
        
        if (!args.message) {
          console.error('[DEBUG] Missing message');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Message content is required',
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
        
        if (!args.role || (args.role !== 'user' && args.role !== 'assistant')) {
          console.error(`[DEBUG] Invalid role: ${args.role}`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Role must be either "user" or "assistant"',
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
        
        // Process importance parameter
        let importance = 0.5; // Default to MEDIUM
        if (args.importance) {
          switch (args.importance) {
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
          contextId: args.contextId,
          content: args.message,
          role: args.role,
          timestamp: Date.now(),
          importance,
          tags: args.tags || [],
        });

        // 성공 응답을 JSON 형식으로 반환
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Message added to context: ${args.contextId}`,
              }, null, 2),
            },
          ],
          isError: false,
        };
      } catch (error) {
        console.error(`[ERROR] Error in add_context handler [${requestId}]:`, error);
        
        // 오류 응답을 JSON 형식으로 반환
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
              }, null, 2),
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
    return "get_context";
  }

  getSchema(): z.ZodObject<any> {
    return z.object({
      random_string: z.string(),
      contextId: z.string().optional(),
      query: z.string().optional(),
      limit: z.number().int().optional(),
    });
  }

  getHandler(server: PromptContextMcpServer): (args: any) => Promise<{
    content: Array<{ text: string; type: 'text' }>;
    isError?: boolean;
  }> {
    return async (rawArgs: any) => {
      // UUID 자동 생성
      const requestId = crypto.randomUUID();
      
      try {
        // 전체 rawArgs 객체를 검사하기 위한 자세한 로깅
        console.error(`[DEBUG] GetContextTool [${requestId}] Raw args (typeof: ${typeof rawArgs}):`, rawArgs);
        console.error(`[DEBUG] GetContextTool [${requestId}] Raw args JSON:`, JSON.stringify(rawArgs, null, 2));
        console.error(`[DEBUG] GetContextTool [${requestId}] Raw args keys:`, Object.keys(rawArgs));
        
        // 매개변수 처리 로직 개선
        let args;
        if (typeof rawArgs === 'object') {
          // 다양한 매개변수 구조 처리
          if (rawArgs.arguments) {
            args = rawArgs.arguments;
            console.error(`[DEBUG] GetContextTool [${requestId}] Using rawArgs.arguments`);
          } else if (rawArgs.params && rawArgs.params.arguments) {
            args = rawArgs.params.arguments;
            console.error(`[DEBUG] GetContextTool [${requestId}] Using rawArgs.params.arguments`);
          } else if (rawArgs.params) {
            args = rawArgs.params;
            console.error(`[DEBUG] GetContextTool [${requestId}] Using rawArgs.params`);
          } else {
            args = rawArgs;
            console.error(`[DEBUG] GetContextTool [${requestId}] Using rawArgs directly`);
          }
        } else {
          args = rawArgs;
          console.error(`[DEBUG] GetContextTool [${requestId}] Using rawArgs directly (non-object)`);
        }
        
        console.error(`[DEBUG] GetContextTool [${requestId}] Processed args:`, JSON.stringify(args, null, 2));
        
        // 필수 파라미터 검증
        const hasContextId = !!args.contextId;
        const hasQuery = !!args.query;
        
        console.error(`[DEBUG] GetContextTool [${requestId}] hasContextId: ${hasContextId}, hasQuery: ${hasQuery}`);
        
        if (!hasContextId && !hasQuery) {
          console.error('[DEBUG] Missing both contextId and query');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Either contextId or query must be provided',
                }, null, 2),
              },
            ],
            isError: true,
          };
        }

        // 특정 컨텍스트 검색
        if (hasContextId) {
          console.error(`[DEBUG] Retrieving context: ${args.contextId}`);
          const context = await server.contextService.getContext(args.contextId);
          
          if (!context) {
            console.error(`[DEBUG] Context not found: ${args.contextId}`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Context with ID '${args.contextId}' not found`,
                  }, null, 2),
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
                  context,
                }, null, 2),
              },
            ],
          };
        } else {
          // 유사 컨텍스트 검색 (hasQuery가 true인 경우)
          console.error(`[DEBUG] Searching for contexts with query: ${args.query}`);
          const contexts = await server.contextService.findSimilarContexts(
            args.query, 
            args.limit || 5
          );
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  contexts,
                }, null, 2),
              },
            ],
          };
        }
      } catch (error) {
        console.error(`[ERROR] Error in get_context handler [${requestId}]:`, error);
        
        // 오류 응답을 JSON 형식으로 반환
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
              }, null, 2),
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
  private server!: McpServer;
  private httpServer?: http.Server;
  public contextService: ContextService;
  private config: Omit<MCPConfig, 'ignorePatterns'>;
  private packageVersion: string;
  public tools: Tool[];

  /**
   * Constructor
   * @param contextService Context service instance
   * @param config Configuration options
   */
  constructor(contextService: ContextService, config: Omit<MCPConfig, 'ignorePatterns'>) {
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
      console.error('[DEBUG] Starting MCP server...');
      
      // 서버 초기화
      this.server = new McpServer({
        name: 'prompt-context-server',
        version: this.packageVersion,
      }, {
        capabilities: {
          tools: {},
        },
      });
      
      // 도구 등록
      console.error('[DEBUG] Registering tools...');
      
      // 도구 스키마 로깅
      for (const tool of this.tools) {
        const name = tool.getName();
        const schema = tool.getSchema();
        console.error(`[DEBUG] Tool ${name} schema:`, JSON.stringify(schema, null, 2));
      }
      
      for (const tool of this.tools) {
        const name = tool.getName();
        console.error(`[DEBUG] Registering tool: ${name}`);
        
        try {
          this.server.tool(name, tool.getHandler(this));
          console.error(`[DEBUG] Tool ${name} registered successfully`);
        } catch (error) {
          console.error(`[ERROR] Failed to register tool ${name}:`, error);
          throw error;
        }
      }

      console.error('[DEBUG] Tools registered, checking HTTP server configuration...');
      
      // Start the HTTP server if enabled
      await this.startHttpServer();

      console.error('[DEBUG] Initializing stdio transport...');
      
      // Start server with stdio transport
      const transport = new StdioServerTransport();
      console.error('[DEBUG] Connecting server to transport...');
      
      await this.server.connect(transport);

      console.error('[DEBUG] Server connected to transport successfully');
      console.error('[MCP Server] Ready to receive requests');
      console.error('[MCP Server] MCP Server started successfully.');
    } catch (error) {
      console.error('[MCP Server] Error starting server:', error);
      console.error(`[DEBUG] Stack trace: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
      throw error;
    }
  }
}
