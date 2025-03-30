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

## 사용 가능한 도구

서버는 MCP 프로토콜을 통해 다음 도구들을 노출합니다:

### `ping`

*   **설명**: 서버 연결 상태를 확인하는 간단한 ping/pong 테스트입니다.
*   **입력 스키마**: 없음 (빈 객체).
*   **출력**: `pong`

### `add_message`

*   **설명**: 특정 컨텍스트에 메시지(사용자 또는 어시스턴트)를 추가합니다. 컨텍스트가 존재하지 않으면 생성합니다.
*   **입력 스키마**:
    *   `contextId` (string, 필수): 컨텍스트의 고유 식별자입니다.
    *   `message` (string, 필수): 추가할 메시지 내용입니다.
    *   `role` (enum, 필수): 메시지 발신자의 역할 ('user' 또는 'assistant')입니다.
    *   `importance` (enum, 선택, 기본값: 'medium'): 중요도 수준 ('low', 'medium', 'high', 'critical')입니다.
    *   `tags` (string 배열, 선택, 기본값: []): 메시지와 연관된 태그입니다.
*   **출력**: 확인 메시지: `Message added to context: {contextId}`

### `retrieve_context`

*   **설명**: 주어진 컨텍스트 ID에 대한 모든 메시지와 최신 요약을 검색합니다.
*   **입력 스키마**:
    *   `contextId` (string, 필수): 검색할 컨텍스트의 고유 식별자입니다.
*   **출력**: 다음을 포함하는 JSON 문자열:
    *   `contextId` (string): 요청된 컨텍스트 ID입니다.
    *   `messages` (Message 객체 배열): 컨텍스트에 저장된 메시지입니다.
    *   `summary` (ContextSummary 객체 또는 null): 컨텍스트의 최신 요약입니다.

### `get_similar_contexts`

*   **설명**: 벡터 검색을 사용하여 주어진 쿼리 문자열과 의미적으로 유사한 컨텍스트를 찾습니다.
*   **입력 스키마**:
    *   `query` (string, 필수): 유사한 컨텍스트를 찾기 위한 텍스트입니다.
    *   `limit` (number, 선택, 기본값: 5): 반환할 최대 컨텍스트 수입니다.
*   **출력**: `SimilarContext` 객체 배열을 포함하는 JSON 문자열:
    *   `contextId` (string): 유사한 컨텍스트의 ID입니다.
    *   `similarity` (number): 유사도 점수 (일반적으로 0과 1 사이)입니다.

### `add_relationship`

*   **설명**: 지식 그래프에서 두 컨텍스트 간의 방향성 관계(예: similar, continues)를 추가합니다.
*   **입력 스키마**:
    *   `sourceContextId` (string, 필수): 소스 컨텍스트 ID입니다.
    *   `targetContextId` (string, 필수): 대상 컨텍스트 ID입니다.
    *   `relationshipType` (enum, 필수): 관계 유형 ('similar', 'continues', 'references', 'parent', 'child')입니다.
    *   `weight` (number, 선택, 기본값: 0.8): 관계의 가중치 (0.0 ~ 1.0)입니다.
*   **출력**: 확인 메시지: `Relationship added: {sourceContextId} -> {targetContextId} ({relationshipType})`

### `get_related_contexts`

*   **설명**: 특정 컨텍스트와 관련된 컨텍스트 ID 목록을 가져옵니다. 선택적으로 관계 유형 및 방향으로 필터링할 수 있습니다.
*   **입력 스키마**:
    *   `contextId` (string, 필수): 관련 컨텍스트를 찾을 컨텍스트 ID입니다.
    *   `relationshipType` (enum, 선택): 관계 유형으로 필터링 ('similar', 'continues', 'references', 'parent', 'child').
    *   `direction` (enum, 선택, 기본값: 'both'): 관계 방향 ('incoming', 'outgoing', 'both').
*   **출력**: 컨텍스트 ID (문자열) 배열을 포함하는 JSON 문자열입니다.

### `summarize_context`

*   **설명**: 주어진 컨텍스트 ID에 대한 요약을 생성하거나 업데이트합니다. 생성된 요약 텍스트를 반환합니다.
*   **입력 스키마**:
    *   `contextId` (string, 필수): 요약을 생성할 컨텍스트 ID입니다.
*   **출력**: 생성된 요약 텍스트 (문자열) 또는 요약 실패 시 오류 메시지입니다.

## 구성 옵션

MCP 서버는 다음 구성 옵션을 인식합니다. 이 옵션들은 환경 변수 또는 JSON 문자열과 함께 `--config` 인수를 통해 설정할 수 있습니다. 환경 변수가 우선 적용됩니다.

| 옵션 | 환경 변수 | 설명 | 기본값 | CLI 인수 재정의 |
|---|---|---|---|---|
| `messageLimitThreshold` | `MESSAGE_LIMIT_THRESHOLD` | 요약을 트리거하는 메시지 수 임계값 | 10 | `--config '{"messageLimitThreshold": 20}'` |
| `tokenLimitPercentage` | `TOKEN_LIMIT_PERCENTAGE` | 모델 제한의 백분율로 표시되는 토큰 수 임계값 | 80 | `--config '{"tokenLimitPercentage": 70}'` |
| `contextDir` | `CONTEXT_DIR` | 컨텍스트 저장 디렉토리 | '.prompt-context' | `--config '{"contextDir": "./my-context"}'` |
| `ignorePatterns` | `IGNORE_PATTERNS` (JSON 문자열 배열) | 무시할 파일 및 디렉토리 패턴 | [] | `--config '{"ignorePatterns": ["node_modules", ".*.log"]}'` |
| `autoSummarize` | `AUTO_SUMMARIZE` | 자동 요약 활성화 여부 ('false'로 설정하여 비활성화) | true | `--config '{"autoSummarize": false}'` |
| `hierarchicalContext` | `HIERARCHICAL_CONTEXT` | 계층적 컨텍스트 관리 활성화 ('false'로 설정하여 비활성화) | true | `--config '{"hierarchicalContext": false}'` |
| `metaSummaryThreshold` | `META_SUMMARY_THRESHOLD` | 메타 요약을 생성하기 전 컨텍스트 수 | 5 | `--config '{"metaSummaryThreshold": 10}'` |
| `maxHierarchyDepth` | `MAX_HIERARCHY_DEPTH` | 메타 요약의 최대 계층 깊이 | 3 | `--config '{"maxHierarchyDepth": 5}'` |
| `useVectorDb` | `USE_VECTOR_DB` | 벡터 유사도 검색 활성화 ('false'로 설정하여 비활성화) | true | `--config '{"useVectorDb": false}'` |
| `useGraphDb` | `USE_GRAPH_DB` | 그래프 기반 컨텍스트 관계 활성화 ('false'로 설정하여 비활성화) | true | `--config '{"useGraphDb": false}'` |
| `similarityThreshold` | `SIMILARITY_THRESHOLD` | 관련 컨텍스트의 최소 유사도 임계값 | 0.6 | `--config '{"similarityThreshold": 0.7}'` |
| `autoCleanupContexts` | `AUTO_CLEANUP_CONTEXTS` | 관련 없는 컨텍스트의 자동 정리 활성화 ('false'로 설정하여 비활성화) | true | `--config '{"autoCleanupContexts": false}'` |
| `trackApiCalls` | `TRACK_API_CALLS` | API 호출 추적 및 분석 활성화 ('false'로 설정하여 비활성화) | true | `--config '{"trackApiCalls": false}'` |
| `apiAnalyticsRetention` | `API_ANALYTICS_RETENTION` | API 호출 데이터 보존 일수 | 30 | `--config '{"apiAnalyticsRetention": 60}'` |
| `fallbackToKeywordMatch` | `FALLBACK_TO_KEYWORD_MATCH` | 벡터 검색 실패 시 키워드 매칭 사용 여부 ('false'로 설정하여 비활성화) | true | `--config '{"fallbackToKeywordMatch": false}'` |
| `port` | `PORT` | 서버 포트 번호 (MCP 모드가 아닐 경우) | 6789 | `--port 8080` 또는 `--config '{"port": 8080}'` |

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