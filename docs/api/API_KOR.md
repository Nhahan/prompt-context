# 모델 컨텍스트 프로토콜(MCP) API 문서

## 개요

모델 컨텍스트 프로토콜(MCP)은, AI 에이전트가 대화 컨텍스트를 유지하고 관리할 수 있도록 설계된 프로토콜입니다. 이 구현은 표준화된 MCP 도구를 통해 컨텍스트 관리, 요약, 벡터 데이터베이스 및 그래프 기반 관계를 포함한 다양한 기능을 제공합니다.

## 서버 정보

MCP 서버는 MCP 프로토콜 사양을 따르는 표준 JSONRPC 서비스로 구현되어 있습니다:
- 서버는 일반적으로 MCP 클라이언트와 함께 사용될 때 stdin/stdout을 통해 접근됩니다
- `-p/--port` 플래그를 사용하여 독립 실행형 서버로 실행할 수도 있습니다(기본 포트: 6789)

## MCP 프로토콜

이 구현은 모델 컨텍스트 프로토콜 사양을 따릅니다. 모든 상호작용은 JSONRPC 2.0 형식을 사용합니다:

```json
{
  "jsonrpc": "2.0",
  "id": "요청-id",
  "method": "tools/call",
  "params": {
    "name": "도구_이름",
    "arguments": {
      "매개변수1": "값1",
      "매개변수2": "값2"
    }
  }
}
```

응답은 표준 형식을 따릅니다:

```json
{
  "jsonrpc": "2.0",
  "id": "요청-id",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "응답 내용"
      }
    ]
  }
}
```

## 사용 가능한 도구

서버는 다음과 같은 MCP 도구를 구현합니다:

### `ping`

*   **설명**: 서버 연결을 확인하기 위한 간단한 핑/퐁 테스트.
*   **입력 스키마**:
    *   `random_string` (문자열, 선택사항): 매개변수가 없는 도구를 위한 더미 매개변수.
*   **출력**: `pong`

### `add_message`

*   **설명**: 특정 컨텍스트에 메시지(사용자 또는 어시스턴트)를 추가합니다. 컨텍스트가 존재하지 않으면 생성합니다.
*   **입력 스키마**:
    *   `contextId` (문자열, 필수): 컨텍스트의 고유 식별자.
    *   `message` (문자열, 필수): 추가할 메시지 내용.
    *   `role` (열거형, 필수): 메시지 발신자의 역할('user' 또는 'assistant').
    *   `importance` (열거형, 선택사항, 기본값: 'MEDIUM'): 중요도 수준('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').
    *   `tags` (문자열 배열, 선택사항, 기본값: []): 메시지와 연관된 태그.
*   **출력**: 성공 확인 JSON 객체: `{"success": true}`

### `retrieve_context`

*   **설명**: 주어진 컨텍스트 ID에 대한 모든 메시지와 최신 요약을 검색합니다.
*   **입력 스키마**:
    *   `contextId` (문자열, 필수): 검색할 컨텍스트의 고유 식별자.
*   **출력**: 다음을 포함하는 JSON 객체:
    *   `success` (불리언): 작업의 상태.
    *   `contextId` (문자열): 요청된 컨텍스트 ID.
    *   `messages` (Message 객체 배열): 컨텍스트에 저장된 메시지들.
    *   `hasSummary` (불리언): 이 컨텍스트가 요약을 가지고 있는지 여부.
    *   `summary` (ContextSummary 객체 또는 null): 사용 가능한 경우 컨텍스트의 최신 요약.

### `get_similar_contexts`

*   **설명**: 벡터 검색을 사용하여 주어진 쿼리 문자열과 의미적으로 유사한 컨텍스트를 찾습니다.
*   **입력 스키마**:
    *   `query` (문자열, 필수): 유사한 컨텍스트를 찾기 위한 텍스트.
    *   `limit` (숫자, 선택사항, 기본값: 5): 반환할 최대 컨텍스트 수.
*   **출력**: `SimilarContext` 객체의 JSON 배열:
    *   `contextId` (문자열): 유사한 컨텍스트의 ID.
    *   `similarity` (숫자): 유사도 점수(일반적으로 0과 1 사이).

### `add_relationship`

*   **설명**: 지식 그래프에서 두 컨텍스트 간의 방향성 관계(예: 유사, 계속)를 추가합니다.
*   **입력 스키마**:
    *   `sourceContextId` (문자열, 필수): 소스 컨텍스트 ID.
    *   `targetContextId` (문자열, 필수): 타겟 컨텍스트 ID.
    *   `relationshipType` (열거형, 필수): 관계 유형('similar', 'continues', 'references', 'parent', 'child').
    *   `weight` (숫자, 선택사항, 기본값: 0.8): 관계의 가중치(0.0부터 1.0까지).
*   **출력**: JSON 객체 확인: 
    ```json
    {
      "success": true,
      "sourceContextId": "소스-id", 
      "targetContextId": "타겟-id", 
      "relationshipType": "관계-유형"
    }
    ```

### `get_related_contexts`

*   **설명**: 특정 컨텍스트와 관련된 컨텍스트 ID 목록을 가져옵니다. 선택적으로 관계 유형과 방향으로 필터링할 수 있습니다.
*   **입력 스키마**:
    *   `contextId` (문자열, 필수): 관련 컨텍스트를 찾을 컨텍스트 ID.
    *   `relationshipType` (열거형, 선택사항): 관계 유형으로 필터링('similar', 'continues', 'references', 'parent', 'child').
    *   `direction` (열거형, 선택사항, 기본값: 'both'): 관계 방향('incoming', 'outgoing', 'both').
*   **출력**: 컨텍스트 ID(문자열)의 JSON 배열.

### `summarize_context`

*   **설명**: 주어진 컨텍스트 ID에 대한 요약을 생성하거나 업데이트합니다. 생성된 요약 객체를 반환합니다.
*   **입력 스키마**:
    *   `contextId` (문자열, 필수): 요약을 생성할 컨텍스트 ID.
*   **출력**: 요약 정보를 포함하는 JSON 객체:
    *   `contextId` (문자열): 컨텍스트 ID.
    *   `createdAt` (숫자): 요약이 생성된 타임스탬프.
    *   `summary` (문자열): 생성된 요약 텍스트.
    *   `codeBlocks` (문자열 배열): 컨텍스트에서 추출된 코드 블록.
    *   `messageCount` (숫자): 컨텍스트의 메시지 수.
    *   `version` (숫자): 요약 버전.
    *   `keyInsights` (문자열 배열): 컨텍스트에서 추출된 주요 인사이트.
    *   `importanceScore` (숫자): 컨텍스트의 전체 중요도 점수.
    *   `tokensUsed` (숫자): 요약에 사용된 토큰 수.
    *   `tokenLimit` (숫자): 요약의 최대 토큰 제한.

### `visualize_context`

*   **설명**: 컨텍스트를 시각화하거나 모든 세션 컨텍스트를 나열합니다. 컨텍스트 정보의 구조화된 보기를 제공합니다.
*   **입력 스키마**:
    *   `contextId` (문자열, 선택 사항): 시각화할 컨텍스트 ID. 제공되지 않으면 세션 목록을 반환합니다.
    *   `includeRelated` (불리언, 선택 사항, 기본값: true): 시각화에 관련 컨텍스트를 포함할지 여부.
    *   `depth` (숫자, 선택 사항, 기본값: 1): 포함할 관련 컨텍스트의 깊이(1-3).
    *   `format` (열거형, 선택 사항, 기본값: 'json'): 출력 형식('json', 'mermaid', 'text').
*   **출력**: 시각화 정보가 포함된 JSON: 
    *   contextId가 제공된 경우:
        ```json
        {
          "success": true,
          "contextId": "context-id",
          "messageCount": 10,
          "hasSummary": true,
          "summary": "요약 텍스트 또는 null",
          "relatedContexts": ["related-id-1", "related-id-2"]
        }
        ```
    *   format이 'text'인 경우:
        ```json
        {
          "success": true,
          "contextId": "context-id",
          "format": "text",
          "text": "컨텍스트 ID: context-id\n메시지: 10\n요약 있음: true"
        }
        ```
    *   format이 'mermaid'인 경우:
        ```json
        {
          "success": true,
          "format": "mermaid",
          "diagram": "graph TD;\n  context-id-->related-id-1;\n  context-id-->related-id-2;"
        }
        ```
    *   contextId가 제공되지 않은 경우:
        ```json
        {
          "success": true,
          "sessions": ["session-id-1", "session-id-2"],
          "format": "json"
        }
        ```

### `get_context_metrics`

*   **설명**: 컨텍스트 작업에 대한 사용 지표 및 통계를 검색합니다. 컨텍스트 사용 패턴에 대한 인사이트를 제공합니다.
*   **입력 스키마**:
    *   `period` (열거형, 선택 사항, 기본값: 'week'): 분석할 기간('day', 'week', 'month').
*   **출력**: 지표가 포함된 JSON 객체:
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

## 구성 옵션

MCP 서버는 환경 변수 또는 JSON 문자열을 포함한 `--config` 인수를 통해 설정할 수 있는 다음과 같은 구성 옵션을 인식합니다:

| 옵션 | 환경 변수 | 설명 | 기본값 |
|---|---|---|---|
| `contextDir` | `CONTEXT_DIR` | 컨텍스트 저장 디렉토리 | '.prompt-context' |
| `messageLimitThreshold` | `MESSAGE_LIMIT_THRESHOLD` | 요약을 트리거하는 메시지 수 임계값 | 5 |
| `tokenLimitPercentage` | `TOKEN_LIMIT_PERCENTAGE` | 모델 제한의 백분율로 표현된 토큰 수 임계값 | 80 |
| `autoSummarize` | `AUTO_SUMMARIZE` | 자동 요약 활성화 여부 | true |
| `useVectorDb` | `USE_VECTOR_DB` | 벡터 유사성 검색 활성화 | true |
| `useGraphDb` | `USE_GRAPH_DB` | 그래프 기반 컨텍스트 관계 활성화 | true |
| `similarityThreshold` | `SIMILARITY_THRESHOLD` | 관련 컨텍스트의 최소 유사성 임계값 | 0.6 |
| `port` | `PORT` | 독립 실행형 서버 모드의 포트 번호 | 6789 |

## 데이터 모델

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

## 오류 처리

모든 API 응답은 JSONRPC 2.0 오류 형식을 따릅니다:

```json
{
  "jsonrpc": "2.0",
  "id": "요청-id",
  "error": {
    "code": -32602,
    "message": "잘못된 매개변수: ..."
  }
}
```