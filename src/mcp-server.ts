#!/usr/bin/env node

import express, { Request, Response } from 'express';
import { MemoryContextProtocol } from './mcp';
import { Message, HierarchicalSummary, MetaSummary, ContextImportance, ContextRelationshipType } from './types';

// Initialize the MCP instance
const mcp = new MemoryContextProtocol({
  messageLimitThreshold: 10,
  tokenLimitPercentage: 80,
  contextDir: '.prompt-context',
  useGit: true,
  autoSummarize: true,
  hierarchicalContext: true,
  metaSummaryThreshold: 5,
  maxHierarchyDepth: 3,
  useVectorDb: true,
  useGraphDb: true,
  similarityThreshold: 0.6,
  autoCleanupContexts: true
});

const app = express();
app.use(express.json());

// MCP Server info endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'prompt-context',
    description: 'Memory Context Protocol for AI agents to maintain conversation context',
    version: '0.1.0',
    tools: [
      {
        name: 'context_memory',
        description: 'Allows AI agents to maintain and retrieve conversation context for different files or topics',
        input_schema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['add', 'retrieve', 'summarize', 'get_related', 'get_hierarchy', 'get_meta', 'find_similar', 'add_relationship', 'find_path', 'cleanup'],
              description: 'Action to perform on the context'
            },
            contextId: {
              type: 'string',
              description: 'The identifier for the context (typically a file path or topic name)'
            },
            role: {
              type: 'string',
              enum: ['user', 'assistant'],
              description: 'Role of the message sender (user or assistant)'
            },
            content: {
              type: 'string',
              description: 'Content of the message'
            },
            importance: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Importance level of the message (affects retention during summarization)'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Tags for categorizing the message'
            },
            metaId: {
              type: 'string',
              description: 'Meta-summary ID for retrieving meta context information'
            },
            searchText: {
              type: 'string',
              description: 'Text to search for similar contexts'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return in similarity search'
            },
            targetId: {
              type: 'string',
              description: 'Target context ID for relationship operations'
            },
            relationshipType: {
              type: 'string',
              enum: ['similar', 'continues', 'references', 'parent', 'child'],
              description: 'Type of relationship between contexts'
            },
            strength: {
              type: 'number',
              description: 'Strength of relationship (0-1)'
            }
          },
          required: ['action', 'contextId']
        },
        output_schema: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the operation was successful'
            },
            message: {
              type: 'string',
              description: 'Status message'
            },
            summary: {
              type: 'object',
              description: 'Summary object if available'
            },
            messages: {
              type: 'array',
              description: 'Messages in the context if requested'
            },
            hierarchicalSummary: {
              type: 'object',
              description: 'Hierarchical summary if requested'
            },
            metaSummary: {
              type: 'object',
              description: 'Meta-summary if requested'
            },
            relatedContexts: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Related context IDs'
            },
            similarContexts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'Context ID'
                  },
                  score: {
                    type: 'number',
                    description: 'Similarity score (0-1)'
                  }
                }
              },
              description: 'Similar contexts with similarity scores'
            },
            path: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Path between contexts'
            },
            cleanedContexts: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Contexts that were cleaned up'
            },
            hierarchicalStructure: {
              type: 'object',
              properties: {
                parent: {
                  type: 'string',
                  description: 'Parent context ID'
                },
                children: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'Child context IDs'
                }
              },
              description: 'Hierarchical structure information'
            }
          }
        }
      }
    ]
  });
});

// Convert importance string to ContextImportance enum
function getImportanceLevel(importance?: string): ContextImportance | undefined {
  if (!importance) return undefined;
  
  switch (importance.toLowerCase()) {
    case 'low':
      return ContextImportance.LOW;
    case 'medium':
      return ContextImportance.MEDIUM;
    case 'high':
      return ContextImportance.HIGH;
    case 'critical':
      return ContextImportance.CRITICAL;
    default:
      return undefined;
  }
}

// Convert relationship type string to ContextRelationshipType enum
function getRelationshipType(type?: string): ContextRelationshipType | undefined {
  if (!type) return undefined;
  
  switch (type.toLowerCase()) {
    case 'similar':
      return ContextRelationshipType.SIMILAR;
    case 'continues':
      return ContextRelationshipType.CONTINUES;
    case 'references':
      return ContextRelationshipType.REFERENCES;
    case 'parent':
      return ContextRelationshipType.PARENT;
    case 'child':
      return ContextRelationshipType.CHILD;
    default:
      return undefined;
  }
}

// MCP Server tool endpoint
app.post('/tools/context_memory', async (req: Request, res: Response) => {
  try {
    const { 
      action, 
      contextId, 
      role, 
      content, 
      importance, 
      tags, 
      metaId, 
      searchText,
      limit,
      targetId,
      relationshipType,
      strength
    } = req.body;
    
    if (!action || !contextId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: action and contextId are required'
      });
    }
    
    let result;
    
    switch (action) {
      case 'add':
        if (!role || !content) {
          return res.status(400).json({
            success: false,
            message: 'Missing required parameters: role and content are required for add action'
          });
        }
        
        const message: Message = {
          role: role as 'user' | 'assistant',
          content,
          timestamp: Date.now(),
          importance: getImportanceLevel(importance),
          tags: tags
        };
        
        await mcp.addMessage(contextId, message);
        
        result = {
          success: true,
          message: `Message added to context '${contextId}'`
        };
        break;
      
      case 'retrieve':
        const messages = await mcp.getMessages(contextId);
        const summary = await mcp.loadSummary(contextId);
        
        result = {
          success: true,
          message: `Retrieved context for '${contextId}'`,
          messages,
          summary
        };
        break;
      
      case 'summarize':
        const summarizeResult = await mcp.summarizeContext(contextId);
        const updatedSummary = await mcp.loadSummary(contextId);
        
        result = {
          success: summarizeResult,
          message: summarizeResult 
            ? `Summary generated for context '${contextId}'` 
            : `Could not generate summary for context '${contextId}'`,
          summary: updatedSummary
        };
        break;
      
      case 'get_related':
        const relatedContexts = await mcp.getRelatedContexts(contextId);
        
        result = {
          success: true,
          message: `Retrieved related contexts for '${contextId}'`,
          relatedContexts
        };
        break;
      
      case 'get_hierarchy':
        const hierarchicalStructure = await mcp.getHierarchicalStructure(contextId);
        const hierarchicalSummary = await mcp.loadHierarchicalSummary(contextId);
        
        result = {
          success: true,
          message: `Retrieved hierarchical information for '${contextId}'`,
          hierarchicalStructure,
          hierarchicalSummary
        };
        break;
      
      case 'get_meta':
        if (!metaId) {
          // If no specific meta ID is provided, get all meta-summary IDs
          const metaSummaryIds = await mcp.getMetaSummaryIds();
          
          result = {
            success: true,
            message: `Retrieved ${metaSummaryIds.length} meta-summary IDs`,
            metaSummaryIds
          };
        } else {
          // Get specific meta-summary
          const metaSummary = await mcp.loadMetaSummary(metaId);
          
          if (!metaSummary) {
            result = {
              success: false,
              message: `Meta-summary with ID '${metaId}' not found`
            };
          } else {
            result = {
              success: true,
              message: `Retrieved meta-summary '${metaId}'`,
              metaSummary
            };
          }
        }
        break;
      
      case 'find_similar':
        if (!searchText) {
          return res.status(400).json({
            success: false,
            message: 'Missing required parameter: searchText is required for find_similar action'
          });
        }
        
        const similarContexts = await mcp.findSimilarContexts(searchText, limit || 5);
        
        result = {
          success: true,
          message: `Found ${similarContexts.length} similar contexts to the search text`,
          similarContexts
        };
        break;
      
      case 'add_relationship':
        if (!targetId || !relationshipType) {
          return res.status(400).json({
            success: false,
            message: 'Missing required parameters: targetId and relationshipType are required for add_relationship action'
          });
        }
        
        const relType = getRelationshipType(relationshipType);
        if (!relType) {
          return res.status(400).json({
            success: false,
            message: `Invalid relationship type: ${relationshipType}`
          });
        }
        
        const relStrength = typeof strength === 'number' ? strength : 0.8; // Default strength if not provided
        
        await mcp.addRelationship(contextId, targetId, relType, relStrength);
        
        result = {
          success: true,
          message: `Added ${relationshipType} relationship from '${contextId}' to '${targetId}'`
        };
        break;
      
      case 'find_path':
        if (!targetId) {
          return res.status(400).json({
            success: false,
            message: 'Missing required parameter: targetId is required for find_path action'
          });
        }
        
        const path = await mcp.findPath(contextId, targetId);
        
        result = {
          success: true,
          message: path.length > 0
            ? `Found path with ${path.length} nodes between '${contextId}' and '${targetId}'`
            : `No path found between '${contextId}' and '${targetId}'`,
          path
        };
        break;
      
      case 'cleanup':
        const cleanedContexts = await mcp.cleanupIrrelevantContexts(contextId);
        
        result = {
          success: true,
          message: `Cleaned up ${cleanedContexts.length} irrelevant contexts`,
          cleanedContexts
        };
        break;
      
      default:
        return res.status(400).json({
          success: false,
          message: `Unknown action: ${action}. Supported actions are 'add', 'retrieve', 'summarize', 'get_related', 'get_hierarchy', 'get_meta', 'find_similar', 'add_relationship', 'find_path', and 'cleanup'`
        });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      success: false,
      message: `Error processing request: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// Additional endpoint for getting all context IDs
app.get('/contexts', async (req: Request, res: Response) => {
  try {
    const contextIds = await mcp.getAllContextIds();
    
    res.json({
      success: true,
      message: `Retrieved ${contextIds.length} context IDs`,
      contextIds
    });
  } catch (error) {
    console.error('Error retrieving contexts:', error);
    res.status(500).json({
      success: false,
      message: `Error retrieving contexts: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// Endpoint for getting all hierarchical summaries
app.get('/hierarchies', async (req: Request, res: Response) => {
  try {
    const hierarchicalIds = await mcp.getAllHierarchicalContextIds();
    
    res.json({
      success: true,
      message: `Retrieved ${hierarchicalIds.length} hierarchical context IDs`,
      hierarchicalIds
    });
  } catch (error) {
    console.error('Error retrieving hierarchical contexts:', error);
    res.status(500).json({
      success: false,
      message: `Error retrieving hierarchical contexts: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// Endpoint for getting all meta-summaries
app.get('/meta-summaries', async (req: Request, res: Response) => {
  try {
    const metaSummaryIds = await mcp.getMetaSummaryIds();
    
    res.json({
      success: true,
      message: `Retrieved ${metaSummaryIds.length} meta-summary IDs`,
      metaSummaryIds
    });
  } catch (error) {
    console.error('Error retrieving meta-summaries:', error);
    res.status(500).json({
      success: false,
      message: `Error retrieving meta-summaries: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// Endpoint for similar contexts search
app.get('/similar', async (req: Request, res: Response) => {
  try {
    const { text, limit } = req.query;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: text'
      });
    }
    
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : 5;
    const similarContexts = await mcp.findSimilarContexts(text.toString(), limitNum);
    
    res.json({
      success: true,
      message: `Found ${similarContexts.length} similar contexts`,
      similarContexts
    });
  } catch (error) {
    console.error('Error finding similar contexts:', error);
    res.status(500).json({
      success: false,
      message: `Error finding similar contexts: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// Endpoint for finding related contexts by relationship type
app.get('/related/:contextId', async (req: Request, res: Response) => {
  try {
    const { contextId } = req.params;
    const { type, direction } = req.query;
    
    if (!contextId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: contextId'
      });
    }
    
    const relType = getRelationshipType(type?.toString());
    const dir = (direction?.toString() || 'both') as 'outgoing' | 'incoming' | 'both';
    
    const relatedContexts = relType 
      ? await mcp.getRelatedContextsByType(contextId, relType, dir)
      : await mcp.getRelatedContexts(contextId);
    
    res.json({
      success: true,
      message: `Found ${relatedContexts.length} related contexts for '${contextId}'`,
      relatedContexts
    });
  } catch (error) {
    console.error('Error finding related contexts:', error);
    res.status(500).json({
      success: false,
      message: `Error finding related contexts: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// Start server
const DEFAULT_PORT = 6789; // 변경된 기본 포트
const PORT = process.env.PORT || DEFAULT_PORT;

// 서버를 시작하고 포트가 사용 중인 경우 다른 포트 시도
const startServer = (port: number) => {
  const server = app.listen(port)
    .on('listening', () => {
      console.log(`Prompt Context MCP Server running on port ${port}`);
    })
    .on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is already in use, trying another port...`);
        // 기본 포트가 사용 중이면 랜덤 포트 시도 (8000-9000 범위 내)
        const randomPort = Math.floor(Math.random() * 1000) + 8000;
        startServer(randomPort);
      } else {
        console.error('Error starting server:', err);
      }
    });
};

startServer(Number(PORT));

// Handle standard input for MCP integration
process.stdin.setEncoding('utf8');
let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk;
  
  try {
    const requests = inputData.split('\n').filter(line => line.trim());
    const lastNewlineIndex = inputData.lastIndexOf('\n');
    
    if (lastNewlineIndex !== -1) {
      inputData = inputData.slice(lastNewlineIndex + 1);
      
      for (const request of requests) {
        if (!request.trim()) continue;
        
        try {
          const parsedRequest = JSON.parse(request);
          
          const mockReq = {
            body: parsedRequest.inputs
          };
          
          const mockRes = {
            json: (data: any) => {
              const response = {
                id: parsedRequest.id,
                outputs: data
              };
              
              process.stdout.write(JSON.stringify(response) + '\n');
            },
            status: (code: number) => {
              return {
                json: (data: any) => {
                  const response = {
                    id: parsedRequest.id,
                    error: {
                      code,
                      message: data.message || 'Unknown error'
                    }
                  };
                  
                  process.stdout.write(JSON.stringify(response) + '\n');
                }
              };
            }
          };
          
          if (parsedRequest.tool === 'context_memory') {
            app._router.handle(
              { ...mockReq, path: '/tools/context_memory', method: 'POST' } as any,
              mockRes as any,
              () => {}
            );
          } else {
            mockRes.status(404).json({
              message: `Unknown tool: ${parsedRequest.tool}`
            });
          }
        } catch (err) {
          console.error('Error processing JSON request:', err);
          process.stdout.write(JSON.stringify({
            error: {
              code: 400,
              message: 'Invalid JSON request'
            }
          }) + '\n');
        }
      }
    }
  } catch (err) {
    console.error('Error processing stdin:', err);
  }
});

export { app, mcp }; 