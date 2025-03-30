# Memory Context Protocol (MCP) API Documentation

## Overview

The Memory Context Protocol (MCP) is a protocol designed to enable AI agents to maintain and manage conversation context. This API provides various functionalities including context management, summarization, vector database, and graph-based relationships.

## Server Information

The MCP server runs by default at:
- Default port: 6789
- Default endpoint: `http://localhost:6789`

## API Endpoints

### 1. Base Information Endpoint

#### GET /

Returns basic server information and available tools.

**Response Example:**
```json
{
  "name": "prompt-context",
  "description": "Memory Context Protocol for AI agents to maintain conversation context",
  "version": "0.1.0",
  "tools": [
    {
      "name": "context_memory",
      "description": "Allows AI agents to maintain and retrieve conversation context for different files or topics",
      "input_schema": { ... },
      "output_schema": { ... }
    }
  ]
}
```

### 2. Context Memory Tool

#### POST /tools/context_memory

The main endpoint for AI agents to manage context.

**Request Parameters:**

| Field | Type | Description |
|------|------|------|
| action | string | Action to perform (required) |
| contextId | string | Context identifier (required) |
| role | string | Role of the message sender ('user' or 'assistant') |
| content | string | Message content |
| importance | string | Message importance ('low', 'medium', 'high', 'critical') |
| tags | string[] | Tags for categorizing the message |
| metaId | string | Meta-summary identifier |
| searchText | string | Text to search for similar contexts |
| limit | number | Maximum number of results to return |
| targetId | string | Target context ID for relationship operations |
| relationshipType | string | Type of relationship between contexts ('similar', 'continues', 'references', 'parent', 'child') |
| strength | number | Strength of relationship (0-1) |

**Supported Actions:**

1. **add** - Add a message to a context
   ```json
   {
     "action": "add",
     "contextId": "file.js",
     "role": "user",
     "content": "What does this function do?",
     "importance": "medium"
   }
   ```

2. **retrieve** - Retrieve context messages and summary
   ```json
   {
     "action": "retrieve",
     "contextId": "file.js"
   }
   ```

3. **summarize** - Generate a summary for the context
   ```json
   {
     "action": "summarize",
     "contextId": "file.js"
   }
   ```

4. **get_related** - Get related contexts
   ```json
   {
     "action": "get_related",
     "contextId": "file.js"
   }
   ```

5. **get_hierarchy** - Get hierarchical structure and summary
   ```json
   {
     "action": "get_hierarchy",
     "contextId": "file.js"
   }
   ```

6. **get_meta** - Get meta summaries
   ```json
   {
     "action": "get_meta",
     "metaId": "project-overview"
   }
   ```

7. **find_similar** - Find similar contexts
   ```json
   {
     "action": "find_similar",
     "contextId": "file.js",
     "searchText": "async function",
     "limit": 5
   }
   ```

8. **add_relationship** - Add a relationship between contexts
   ```json
   {
     "action": "add_relationship",
     "contextId": "file.js",
     "targetId": "related-file.js",
     "relationshipType": "references",
     "strength": 0.8
   }
   ```

9. **find_path** - Find a path between contexts
   ```json
   {
     "action": "find_path",
     "contextId": "file.js",
     "targetId": "related-file.js"
   }
   ```

10. **cleanup** - Clean up irrelevant contexts
   ```json
   {
     "action": "cleanup",
     "contextId": "file.js"
   }
   ```

### 3. Context Management Endpoints

#### GET /contexts

Retrieve all context IDs.

**Response Example:**
```json
{
  "success": true,
  "message": "Retrieved 5 context IDs",
  "contextIds": ["file.js", "app.js", "index.html", "style.css", "readme.md"]
}
```

#### GET /hierarchies

Retrieve all hierarchical context IDs.

**Response Example:**
```json
{
  "success": true,
  "message": "Retrieved 3 hierarchical context IDs",
  "hierarchicalIds": ["project", "frontend", "backend"]
}
```

#### GET /meta-summaries

Retrieve all meta-summary IDs.

**Response Example:**
```json
{
  "success": true,
  "message": "Retrieved 2 meta-summary IDs",
  "metaSummaryIds": ["project-overview", "architecture"]
}
```

#### GET /similar

Search for similar contexts.

**Request Parameters:**
- `text` (query string) - Text to search (required)
- `limit` (query string) - Maximum number of results to return (default: 5)

**Response Example:**
```json
{
  "success": true,
  "message": "Found 3 similar contexts",
  "similarContexts": [
    {
      "contextId": "file.js",
      "similarity": 0.85
    },
    {
      "contextId": "app.js",
      "similarity": 0.72
    },
    {
      "contextId": "util.js",
      "similarity": 0.68
    }
  ]
}
```

#### GET /related/:contextId

Retrieve related contexts by relationship type.

**Request Parameters:**
- `contextId` (path parameter) - Context ID (required)
- `type` (query string) - Relationship type ('similar', 'continues', 'references', 'parent', 'child')
- `direction` (query string) - Relationship direction ('outgoing', 'incoming', 'both', default: 'both')

**Response Example:**
```json
{
  "success": true,
  "message": "Found 2 related contexts for 'file.js'",
  "relatedContexts": ["app.js", "util.js"]
}
```

## Available Tools

The server exposes the following tools via the MCP protocol:

### `ping`

*   **Description**: Simple ping/pong test to check server connectivity.
*   **Input Schema**: None (empty object).
*   **Output**: `pong`

### `add_message`

*   **Description**: Add a message (user or assistant) to a specific context. Creates the context if it doesn't exist.
*   **Input Schema**:
    *   `contextId` (string, required): Unique identifier for the context.
    *   `message` (string, required): Message content to add.
    *   `role` (enum, required): Role of the message sender ('user' or 'assistant').
    *   `importance` (enum, optional, default: 'medium'): Importance level ('low', 'medium', 'high', 'critical').
    *   `tags` (array of strings, optional, default: []): Tags associated with the message.
*   **Output**: Confirmation message: `Message added to context: {contextId}`

### `retrieve_context`

*   **Description**: Retrieve all messages and the latest summary for a given context ID.
*   **Input Schema**:
    *   `contextId` (string, required): Unique identifier for the context to retrieve.
*   **Output**: JSON string containing:
    *   `contextId` (string): The requested context ID.
    *   `messages` (array of Message objects): The messages stored in the context.
    *   `summary` (ContextSummary object or null): The latest summary for the context.

### `get_similar_contexts`

*   **Description**: Find contexts that are semantically similar to a given query string using vector search.
*   **Input Schema**:
    *   `query` (string, required): Text to find similar contexts for.
    *   `limit` (number, optional, default: 5): Maximum number of contexts to return.
*   **Output**: JSON string containing an array of `SimilarContext` objects:
    *   `contextId` (string): ID of the similar context.
    *   `similarity` (number): Similarity score (typically between 0 and 1).

### `add_relationship`

*   **Description**: Add a directed relationship (e.g., similar, continues) between two contexts in the knowledge graph.
*   **Input Schema**:
    *   `sourceContextId` (string, required): Source context ID.
    *   `targetContextId` (string, required): Target context ID.
    *   `relationshipType` (enum, required): Type of relationship ('similar', 'continues', 'references', 'parent', 'child').
    *   `weight` (number, optional, default: 0.8): Weight of the relationship (0.0 to 1.0).
*   **Output**: Confirmation message: `Relationship added: {sourceContextId} -> {targetContextId} ({relationshipType})`

### `get_related_contexts`

*   **Description**: Get a list of context IDs that are related to a specific context, optionally filtering by relationship type and direction.
*   **Input Schema**:
    *   `contextId` (string, required): Context ID to find related contexts for.
    *   `relationshipType` (enum, optional): Filter by relationship type ('similar', 'continues', 'references', 'parent', 'child').
    *   `direction` (enum, optional, default: 'both'): Direction of relationships ('incoming', 'outgoing', 'both').
*   **Output**: JSON string containing an array of context IDs (strings).

### `summarize_context`

*   **Description**: Generate or update the summary for a given context ID. Returns the generated summary text.
*   **Input Schema**:
    *   `contextId` (string, required): Context ID to generate summary for.
*   **Output**: The generated summary text (string) or an error message if summarization failed.

## Configuration Options

The MCP server recognizes these configuration options, which can be set via environment variables or a `--config` argument with a JSON string. Environment variables take precedence.

| Option | Environment Variable | Description | Default | CLI Argument Override |
|---|---|---|---|---|
| `messageLimitThreshold` | `MESSAGE_LIMIT_THRESHOLD` | Message count threshold to trigger summary | 10 | `--config '{"messageLimitThreshold": 20}'` |
| `tokenLimitPercentage` | `TOKEN_LIMIT_PERCENTAGE` | Token count threshold as percentage of model limit | 80 | `--config '{"tokenLimitPercentage": 70}'` |
| `contextDir` | `CONTEXT_DIR` | Context storage directory | '.prompt-context' | `--config '{"contextDir": "./my-context"}'` |
| `ignorePatterns` | `IGNORE_PATTERNS` (JSON string array) | Patterns for files and directories to ignore | [] | `--config '{"ignorePatterns": ["node_modules", ".*.log"]}'` |
| `autoSummarize` | `AUTO_SUMMARIZE` | Whether to enable automatic summarization (set to 'false' to disable) | true | `--config '{"autoSummarize": false}'` |
| `hierarchicalContext` | `HIERARCHICAL_CONTEXT` | Enable hierarchical context management (set to 'false' to disable) | true | `--config '{"hierarchicalContext": false}'` |
| `metaSummaryThreshold` | `META_SUMMARY_THRESHOLD` | Number of contexts before creating a meta-summary | 5 | `--config '{"metaSummaryThreshold": 10}'` |
| `maxHierarchyDepth` | `MAX_HIERARCHY_DEPTH` | Maximum hierarchical depth for meta-summaries | 3 | `--config '{"maxHierarchyDepth": 5}'` |
| `useVectorDb` | `USE_VECTOR_DB` | Enable vector similarity search (set to 'false' to disable) | true | `--config '{"useVectorDb": false}'` |
| `useGraphDb` | `USE_GRAPH_DB` | Enable graph-based context relationships (set to 'false' to disable) | true | `--config '{"useGraphDb": false}'` |
| `similarityThreshold` | `SIMILARITY_THRESHOLD` | Minimum similarity threshold for related contexts | 0.6 | `--config '{"similarityThreshold": 0.7}'` |
| `autoCleanupContexts` | `AUTO_CLEANUP_CONTEXTS` | Enable automatic cleanup of irrelevant contexts (set to 'false' to disable) | true | `--config '{"autoCleanupContexts": false}'` |
| `trackApiCalls` | `TRACK_API_CALLS` | Enable API call tracking and analytics (set to 'false' to disable) | true | `--config '{"trackApiCalls": false}'` |
| `apiAnalyticsRetention` | `API_ANALYTICS_RETENTION` | Number of days to retain API call data | 30 | `--config '{"apiAnalyticsRetention": 60}'` |
| `fallbackToKeywordMatch` | `FALLBACK_TO_KEYWORD_MATCH` | Whether to use keyword matching when vector search fails (set to 'false' to disable) | true | `--config '{"fallbackToKeywordMatch": false}'` |
| `port` | `PORT` | Port number for the server (if not running in MCP mode) | 6789 | `--port 8080` or `--config '{"port": 8080}'` |

## Data Models

### Message

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  importance?: ContextImportance;
  tags?: string[];
}
```

### ContextSummary

```typescript
interface ContextSummary {
  contextId: string;
  summary: string;
  lastUpdated: number;
  messageCount: number;
  codeBlocks?: string[];
  importanceScore?: number;
  relatedContexts?: string[];
  version: number;
}
```

### HierarchicalSummary

```typescript
interface HierarchicalSummary {
  parentContextId: string;
  childContextIds: string[];
  summary: string;
  lastUpdated: number;
  version: number;
}
```

### MetaSummary

```typescript
interface MetaSummary {
  id: string;
  summary: string;
  contextIds: string[];
  lastUpdated: number;
  version: number;
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

## Internal APIs

### VectorRepositoryInterface

The Vector Repository API provides functionality to store context summaries as vectors and retrieve similar contexts.

```typescript
interface VectorRepositoryInterface {
  addSummary(summary: ContextSummary): Promise<void>;
  findSimilarContexts(text: string, limit?: number): Promise<SimilarContext[]>;
  deleteContext(contextId: string): Promise<void>;
  hasContext(contextId: string): Promise<boolean>;
}
```

### GraphRepositoryInterface

The Graph Repository API manages relationships between contexts.

```typescript
interface GraphRepositoryInterface {
  addRelationship(source: string, target: string, type: ContextRelationshipType, weight: number, metadata?: any): Promise<void>;
  getRelationships(contextId: string): Promise<ContextEdge[]>;
  removeContext(contextId: string): Promise<void>;
  findPath(sourceId: string, targetId: string): Promise<string[]>;
  getRelatedContexts(contextId: string, type: ContextRelationshipType, direction: 'outgoing' | 'incoming' | 'both'): Promise<string[]>;
}
```

### SummarizerService

The Summarizer Service API generates summaries for messages and contexts.

```typescript 
interface SummarizerService {
  summarize(messages: Message[], contextId: string): Promise<SummaryResult>;
  createHierarchicalSummary?(summaries: ContextSummary[], parentId: string): Promise<HierarchicalSummary>;
  createMetaSummary?(contexts: string[]): Promise<MetaSummary>;
  analyzeMessageImportance?(message: Message, contextId: string): Promise<ContextImportance>;
}
```

### ApiAnalytics

The API Analytics API tracks various API calls and provides statistics.

```typescript
enum ApiCallType {
  VECTOR_DB_ADD = 'vector_db_add',
  VECTOR_DB_SEARCH = 'vector_db_search',
  VECTOR_DB_DELETE = 'vector_db_delete',
  GRAPH_DB_ADD = 'graph_db_add',
  GRAPH_DB_SEARCH = 'graph_db_search',
  GRAPH_DB_DELETE = 'graph_db_delete',
  LLM_SUMMARIZE = 'llm_summarize',
  LLM_HIERARCHICAL_SUMMARIZE = 'llm_hierarchical_summarize',
  LLM_META_SUMMARIZE = 'llm_meta_summarize'
}

interface ApiCallInfo {
  type: ApiCallType;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface ApiStats {
  totalCalls: number;
  callsByType: Record<ApiCallType, number>;
  averageDuration?: Record<ApiCallType, number>;
}

class ApiAnalytics {
  public static getInstance(): ApiAnalytics;
  public trackCall(type: ApiCallType, metadata?: Record<string, any>): () => void;
  public getCallCount(type: ApiCallType): number;
  public getStats(): ApiStats;
  public getCallsInTimeRange(startTime: number, endTime: number): ApiCallInfo[];
}
```

## Error Handling

All API responses include a `success` field indicating success or failure. If an error occurs, an error message is returned along with an HTTP status code.

**Example Error Response:**
```json
{
  "success": false,
  "message": "Missing required parameter: text"
}
```

**Common Error Codes:**
- 400: Bad Request (missing or invalid parameters)
- 404: Resource Not Found
- 500: Internal Server Error 