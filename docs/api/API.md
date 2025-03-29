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