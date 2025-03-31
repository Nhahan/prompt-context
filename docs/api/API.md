# Model Context Protocol (MCP) API Documentation

## Overview

The Model Context Protocol (MCP) is a protocol designed to enable AI agents to maintain and manage conversation context. This implementation provides various functionalities including context management, summarization, vector database, and graph-based relationships through standardized MCP tools.

## Server Information

The MCP server is implemented as a standard JSONRPC service following the MCP protocol specification:
- Server is typically accessed via stdin/stdout when used with MCP clients
- Can also be run as a standalone server with `-p/--port` flag (default port: 6789)

## MCP Protocol

This implementation follows the Model Context Protocol specification. All interactions use the JSONRPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {
      "param1": "value1",
      "param2": "value2"
    }
  }
}
```

Responses follow the standard format:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "response content"
      }
    ]
  }
}
```

## Available Tools

The server implements the following MCP tools:

### `ping`

*   **Description**: Simple ping/pong test to check server connectivity.
*   **Input Schema**:
    *   `random_string` (string, optional): Dummy parameter for no-parameter tools.
*   **Output**: `pong`

### `add_message`

*   **Description**: Add a message (user or assistant) to a specific context. Creates the context if it doesn't exist.
*   **Input Schema**:
    *   `contextId` (string, required): Unique identifier for the context.
    *   `message` (string, required): Message content to add.
    *   `role` (enum, required): Role of the message sender ('user' or 'assistant').
    *   `importance` (enum, optional, default: 'MEDIUM'): Importance level ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').
    *   `tags` (array of strings, optional, default: []): Tags associated with the message.
*   **Output**: Success confirmation JSON object: `{"success": true}`

### `retrieve_context`

*   **Description**: Retrieve all messages and the latest summary for a given context ID.
*   **Input Schema**:
    *   `contextId` (string, required): Unique identifier for the context to retrieve.
*   **Output**: JSON object containing:
    *   `success` (boolean): Status of the operation.
    *   `contextId` (string): The requested context ID.
    *   `messages` (array of Message objects): The messages stored in the context.
    *   `hasSummary` (boolean): Whether this context has a summary.
    *   `summary` (ContextSummary object or null): The latest summary for the context if available.

### `get_similar_contexts`

*   **Description**: Find contexts that are semantically similar to a given query string using vector search.
*   **Input Schema**:
    *   `query` (string, required): Text to find similar contexts for.
    *   `limit` (number, optional, default: 5): Maximum number of contexts to return.
*   **Output**: JSON array of `SimilarContext` objects:
    *   `contextId` (string): ID of the similar context.
    *   `similarity` (number): Similarity score (typically between 0 and 1).

### `add_relationship`

*   **Description**: Add a directed relationship (e.g., similar, continues) between two contexts in the knowledge graph.
*   **Input Schema**:
    *   `sourceContextId` (string, required): Source context ID.
    *   `targetContextId` (string, required): Target context ID.
    *   `relationshipType` (enum, required): Type of relationship ('similar', 'continues', 'references', 'parent', 'child').
    *   `weight` (number, optional, default: 0.8): Weight of the relationship (0.0 to 1.0).
*   **Output**: JSON object confirmation: 
    ```json
    {
      "success": true,
      "sourceContextId": "source-id", 
      "targetContextId": "target-id", 
      "relationshipType": "relationship-type"
    }
    ```

### `get_related_contexts`

*   **Description**: Get a list of context IDs that are related to a specific context, optionally filtering by relationship type and direction.
*   **Input Schema**:
    *   `contextId` (string, required): Context ID to find related contexts for.
    *   `relationshipType` (enum, optional): Filter by relationship type ('similar', 'continues', 'references', 'parent', 'child').
    *   `direction` (enum, optional, default: 'both'): Direction of relationships ('incoming', 'outgoing', 'both').
*   **Output**: JSON array of context IDs (strings).

### `summarize_context`

*   **Description**: Generate or update the summary for a given context ID. Returns the generated summary object.
*   **Input Schema**:
    *   `contextId` (string, required): Context ID to generate summary for.
*   **Output**: JSON object containing summary information:
    *   `contextId` (string): The context ID.
    *   `createdAt` (number): Timestamp of when the summary was created.
    *   `summary` (string): The generated summary text.
    *   `codeBlocks` (array of strings): Any code blocks extracted from the context.
    *   `messageCount` (number): Number of messages in the context.
    *   `version` (number): Version of the summary.
    *   `keyInsights` (array of strings): Key insights extracted from the context.
    *   `importanceScore` (number): Overall importance score of the context.
    *   `tokensUsed` (number): Number of tokens used in the summary.
    *   `tokenLimit` (number): Maximum token limit for the summary.

### `visualize_context`

*   **Description**: Visualize a context or list all session contexts. Provides a structured view of context information.
*   **Input Schema**:
    *   `contextId` (string, optional): Context ID to visualize. If not provided, returns a list of sessions.
    *   `includeRelated` (boolean, optional, default: true): Whether to include related contexts in the visualization.
    *   `depth` (number, optional, default: 1): Depth of related contexts to include (1-3).
    *   `format` (enum, optional, default: 'json'): Output format ('json', 'mermaid', 'text').
*   **Output**: JSON object containing visualization information:
    *   When contextId is provided:
        ```json
        {
          "success": true,
          "contextId": "context-id",
          "messageCount": 10,
          "hasSummary": true,
          "summary": "Summary text or null",
          "relatedContexts": ["related-id-1", "related-id-2"]
        }
        ```
    *   When format is 'text':
        ```json
        {
          "success": true,
          "contextId": "context-id",
          "format": "text",
          "text": "Context ID: context-id\nMessages: 10\nHas Summary: true"
        }
        ```
    *   When format is 'mermaid':
        ```json
        {
          "success": true,
          "format": "mermaid",
          "diagram": "graph TD;\n  context-id-->related-id-1;\n  context-id-->related-id-2;"
        }
        ```
    *   When no contextId is provided:
        ```json
        {
          "success": true,
          "sessions": ["session-id-1", "session-id-2"],
          "format": "json"
        }
        ```

### `get_context_metrics`

*   **Description**: Retrieve usage metrics and analytics for context operations. Provides insight into context usage patterns.
*   **Input Schema**:
    *   `period` (enum, optional, default: 'week'): Time period to analyze ('day', 'week', 'month').
*   **Output**: JSON object containing metrics:
    ```json
    {
      "success": true,
      "metrics": {
        "averageScore": 0.75,
        "totalCalls": 150,
        "byType": {
          "add_message": 80,
          "retrieve_context": 40,
          "get_similar_contexts": 30
        },
        "historyTrend": [
          {"date": "2023-06-01", "count": 25},
          {"date": "2023-06-02", "count": 32}
        ],
        "contextStats": {
          "totalContexts": 45,
          "averageMessagesPerContext": 12,
          "summaryRate": 0.85
        },
        "relationshipMetrics": {
          "totalRelationships": 128,
          "byType": {
            "similar": 54,
            "continues": 36,
            "references": 22,
            "parent": 10,
            "child": 6
          }
        }
      },
      "period": "week"
    }
    ```

## Configuration Options

The MCP server recognizes these configuration options, which can be set via environment variables or a `--config` argument with a JSON string:

| Option | Environment Variable | Description | Default |
|---|---|---|---|
| `contextDir` | `CONTEXT_DIR` | Context storage directory | '.prompt-context' |
| `messageLimitThreshold` | `MESSAGE_LIMIT_THRESHOLD` | Message count threshold to trigger summary | 5 |
| `tokenLimitPercentage` | `TOKEN_LIMIT_PERCENTAGE` | Token count threshold as percentage of model limit | 80 |
| `autoSummarize` | `AUTO_SUMMARIZE` | Whether to enable automatic summarization | true |
| `useVectorDb` | `USE_VECTOR_DB` | Enable vector similarity search | true |
| `useGraphDb` | `USE_GRAPH_DB` | Enable graph-based context relationships | true |
| `similarityThreshold` | `SIMILARITY_THRESHOLD` | Minimum similarity threshold for related contexts | 0.6 |
| `port` | `PORT` | Port number for standalone server mode | 6789 |

## Data Models

### Message

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tags: string[];
  timestamp: number;
}
```

### ContextSummary

```typescript
interface ContextSummary {
  contextId: string;
  createdAt: number;
  summary: string;
  codeBlocks: string[];
  messageCount: number;
  version: number;
  keyInsights: string[];
  importanceScore: number;
  tokensUsed: number;
  tokenLimit: number;
}
```

### SimilarContext

```typescript
interface SimilarContext {
  contextId: string;
  similarity: number;
}
```

### ContextRelationshipType

```typescript
enum ContextRelationshipType {
  SIMILAR = 'similar',
  CONTINUES = 'continues',
  REFERENCES = 'references',
  PARENT = 'parent',
  CHILD = 'child'
}
```

## Error Handling

All API responses follow the JSONRPC 2.0 error format:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "error": {
    "code": -32602,
    "message": "Invalid parameters: ..."
  }
}
```

**Common Error Codes:**
- -32600: Invalid Request
- -32601: Method not found
- -32602: Invalid params
- -32603: Internal error
- -32000: Server error 