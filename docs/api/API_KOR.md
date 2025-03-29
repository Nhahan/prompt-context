# Memory Context Protocol (MCP) API 문서

## 개요

MCP(Memory Context Protocol)는 AI 에이전트가 대화 컨텍스트를 유지하고 관리할 수 있도록 설계된 프로토콜입니다. 이 API는 컨텍스트 관리, 요약, 벡터 데이터베이스 및 그래프 기반 관계를 포함한 다양한 기능을 제공합니다.

## 서버 정보

MCP 서버는 기본적으로 다음 위치에서 실행됩니다:
- 기본 포트: 6789
- 기본 엔드포인트: `http://localhost:6789`

## API 엔드포인트

### 1. 기본 정보 엔드포인트

#### GET /

기본 서버 정보와 사용 가능한 도구에 대한 정보를 반환합니다.

**응답 예시:**
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

### 2. 컨텍스트 메모리 도구

#### POST /tools/context_memory

AI 에이전트가 컨텍스트를 관리하기 위한 주요 엔드포인트입니다.

**요청 매개변수:**

| 필드 | 타입 | 설명 |
|------|------|------|
| action | string | 수행할 작업 (필수) |
| contextId | string | 컨텍스트 식별자 (필수) |
| role | string | 메시지 발신자의 역할 ('user' 또는 'assistant') |
| content | string | 메시지 내용 |
| importance | string | 메시지의 중요도 ('low', 'medium', 'high', 'critical') |
| tags | string[] | 메시지 분류용 태그 |
| metaId | string | 메타 요약 식별자 |
| searchText | string | 유사한 컨텍스트 검색을 위한 텍스트 |
| limit | number | 반환할 최대 결과 수 |
| targetId | string | 관계 작업을 위한 대상 컨텍스트 ID |
| relationshipType | string | 컨텍스트 간 관계 유형 ('similar', 'continues', 'references', 'parent', 'child') |
| strength | number | 관계의 강도 (0-1) |

**지원되는 작업:**

1. **add** - 컨텍스트에 메시지 추가
   ```json
   {
     "action": "add",
     "contextId": "file.js",
     "role": "user",
     "content": "이 함수는 무엇을 하나요?",
     "importance": "medium"
   }
   ```

2. **retrieve** - 컨텍스트 메시지와 요약 검색
   ```json
   {
     "action": "retrieve",
     "contextId": "file.js"
   }
   ```

3. **summarize** - 컨텍스트에 대한 요약 생성
   ```json
   {
     "action": "summarize",
     "contextId": "file.js"
   }
   ```

4. **get_related** - 관련 컨텍스트 검색
   ```json
   {
     "action": "get_related",
     "contextId": "file.js"
   }
   ```

5. **get_hierarchy** - 계층적 구조와 요약 검색
   ```json
   {
     "action": "get_hierarchy",
     "contextId": "file.js"
   }
   ```

6. **get_meta** - 메타 요약 검색
   ```json
   {
     "action": "get_meta",
     "metaId": "project-overview"
   }
   ```

7. **find_similar** - 유사한 컨텍스트 검색
   ```json
   {
     "action": "find_similar",
     "contextId": "file.js",
     "searchText": "비동기 함수",
     "limit": 5
   }
   ```

8. **add_relationship** - 컨텍스트 간 관계 추가
   ```json
   {
     "action": "add_relationship",
     "contextId": "file.js",
     "targetId": "related-file.js",
     "relationshipType": "references",
     "strength": 0.8
   }
   ```

9. **find_path** - 컨텍스트 간 경로 찾기
   ```json
   {
     "action": "find_path",
     "contextId": "file.js",
     "targetId": "related-file.js"
   }
   ```

10. **cleanup** - 관련 없는 컨텍스트 정리
   ```json
   {
     "action": "cleanup",
     "contextId": "file.js"
   }
   ```

### 3. 컨텍스트 관리 엔드포인트

#### GET /contexts

모든 컨텍스트 ID를 검색합니다.

**응답 예시:**
```json
{
  "success": true,
  "message": "Retrieved 5 context IDs",
  "contextIds": ["file.js", "app.js", "index.html", "style.css", "readme.md"]
}
```

#### GET /hierarchies

모든 계층적 컨텍스트 ID를 검색합니다.

**응답 예시:**
```json
{
  "success": true,
  "message": "Retrieved 3 hierarchical context IDs",
  "hierarchicalIds": ["project", "frontend", "backend"]
}
```

#### GET /meta-summaries

모든 메타 요약 ID를 검색합니다.

**응답 예시:**
```json
{
  "success": true,
  "message": "Retrieved 2 meta-summary IDs",
  "metaSummaryIds": ["project-overview", "architecture"]
}
```

#### GET /similar

유사한 컨텍스트를 검색합니다.

**요청 매개변수:**
- `text` (query string) - 검색할 텍스트 (필수)
- `limit` (query string) - 반환할 최대 결과 수 (기본값: 5)

**응답 예시:**
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

관계 유형별로 관련 컨텍스트를 검색합니다.

**요청 매개변수:**
- `contextId` (path parameter) - 컨텍스트 ID (필수)
- `type` (query string) - 관계 유형 ('similar', 'continues', 'references', 'parent', 'child')
- `direction` (query string) - 관계 방향 ('outgoing', 'incoming', 'both', 기본값: 'both')

**응답 예시:**
```json
{
  "success": true,
  "message": "Found 2 related contexts for 'file.js'",
  "relatedContexts": ["app.js", "util.js"]
}
```

## 데이터 모델

### 메시지 (Message)

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  importance?: ContextImportance;
  tags?: string[];
}
```

### 컨텍스트 요약 (ContextSummary)

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

### 계층적 요약 (HierarchicalSummary)

```typescript
interface HierarchicalSummary {
  parentContextId: string;
  childContextIds: string[];
  summary: string;
  lastUpdated: number;
  version: number;
}
```

### 메타 요약 (MetaSummary)

```typescript
interface MetaSummary {
  id: string;
  summary: string;
  contextIds: string[];
  lastUpdated: number;
  version: number;
}
```

### 관계 유형 (ContextRelationshipType)

```typescript
enum ContextRelationshipType {
  SIMILAR = 'similar',
  CONTINUES = 'continues',
  REFERENCES = 'references',
  PARENT = 'parent',
  CHILD = 'child'
}
```

## 내부 API

### VectorRepositoryInterface

벡터 저장소 API는 컨텍스트 요약을 벡터로 저장하고 유사한 컨텍스트를 검색하는 기능을 제공합니다.

```typescript
interface VectorRepositoryInterface {
  addSummary(summary: ContextSummary): Promise<void>;
  findSimilarContexts(text: string, limit?: number): Promise<SimilarContext[]>;
  deleteContext(contextId: string): Promise<void>;
  hasContext(contextId: string): Promise<boolean>;
}
```

### GraphRepositoryInterface

그래프 저장소 API는 컨텍스트 간의 관계를 관리합니다.

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

요약 서비스 API는 메시지와 컨텍스트에 대한 요약을 생성합니다.

```typescript 
interface SummarizerService {
  summarize(messages: Message[], contextId: string): Promise<SummaryResult>;
  createHierarchicalSummary?(summaries: ContextSummary[], parentId: string): Promise<HierarchicalSummary>;
  createMetaSummary?(contexts: string[]): Promise<MetaSummary>;
  analyzeMessageImportance?(message: Message, contextId: string): Promise<ContextImportance>;
}
```

### ApiAnalytics

API 호출 분석 API는 다양한 API 호출을 추적하고 통계를 제공합니다.

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

## 오류 처리

모든 API 응답은 성공 또는 실패 상태를 나타내는 `success` 필드를 포함합니다. 오류가 발생하면 HTTP 상태 코드와 함께 오류 메시지가 반환됩니다.

**예시 오류 응답:**
```json
{
  "success": false,
  "message": "Missing required parameter: text"
}
```

**일반적인 오류 코드:**
- 400: 잘못된 요청 (매개변수 누락 또는 유효하지 않음)
- 404: 리소스를 찾을 수 없음
- 500: 서버 내부 오류 