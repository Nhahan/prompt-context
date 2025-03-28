# Prompt Context MCP Server

AI 에이전트가 이전 대화 맥락을 효율적으로 기억하고 활용할 수 있도록 돕는 MCP 프로토콜입니다. 이 프로토콜은 각 파일 또는 맥락의 대화 기록을 추적하고 주기적으로 요약하여 저장함으로써 AI 에이전트의 맥락 이해도를 향상시킵니다.

*Read this in [English](README.md)*

## 주요 기능

- **지능형 컨텍스트 메모리**: AI 에이전트가 대화 이력을 자동으로 기억하고 필요할 때 불러옴
- **중요도 기반 컨텍스트 유지**: 중요 정보를 자동으로 식별하고 보존
- **자동 요약**: 메시지 수가 임계값에 도달하면 컨텍스트 요약 자동 생성
- **컨텍스트 관계 추적**: 벡터 유사도와 그래프 관계로 연관된 대화를 연결하여 지식 맥락 유지

### Claude Desktop에서 사용하기

`claude_desktop_config.json`에 다음을 추가하세요:

```json
{
  "mcpServers": {
    "prompt-context": {
      "command": "npx",
      "args": [
        "-y",
        "prompt-context-mcp"
      ]
    }
  }
}
```

### Docker에서 사용하기

```json
{
  "mcpServers": {
    "prompt-context": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "prompt-context"
      ]
    }
  }
}
```

### 사용 가능한 MCP 도구

#### context_memory

AI 에이전트가 다양한 파일이나 주제에 대한 대화 컨텍스트를 유지하고 검색할 수 있게 합니다.

**입력:**

- `action` (string): 수행할 작업 - 'add', 'retrieve', 'summarize', 'get_related', 'get_hierarchy', 'get_meta', 'find_similar', 'add_relationship', 'find_path', 또는 'cleanup'
- `contextId` (string): 컨텍스트 식별자(일반적으로 파일 경로 또는 주제 이름)
- `role` (string, 'add' 작업용): 메시지 발신자 역할('user' 또는 'assistant')
- `content` (string, 'add' 작업용): 메시지 내용
- `importance` (string, 'add' 작업용): 중요도 수준('low', 'medium', 'high', 또는 'critical')
- `tags` (string 배열, 'add' 작업용): 메시지 분류를 위한 태그
- `metaId` (string, 'get_meta' 작업용): 검색할 메타 요약 ID
- `searchText` (string, 'find_similar' 작업용): 유사한 컨텍스트를 검색할 텍스트
- `limit` (number, 'find_similar' 작업용): 반환할 최대 결과 수
- `targetId` (string, 관계 작업용): 관계 작업을 위한 대상 컨텍스트 ID
- `relationshipType` (string, 'add_relationship' 작업용): 관계 유형('similar', 'continues', 'references', 'parent', 'child')
- `strength` (number, 'add_relationship' 작업용): 관계 강도(0-1)

## 고급 기능

### 벡터 유사도 검색

MCP는 의미적으로 유사한 컨텍스트를 찾기 위해 벡터 임베딩을 사용하여 AI 에이전트가 다음을 수행할 수 있도록 합니다:

- 다른 표현을 사용하더라도 유사한 주제를 논의하는 컨텍스트 찾기
- 대화 간의 관계를 자동으로 감지
- 더 일관된 지식 구조 생성
- 관련 없는 컨텍스트를 정리하여 집중력 유지

유사도 검색 사용 예:

```javascript
// 쿼리와 유사한 컨텍스트 찾기
const response = await fetch('http://localhost:6789/similar?text=machine learning&limit=5');
const { similarContexts } = await response.json();
```

또는 MCP 도구를 통해:

```json
{
  "action": "find_similar",
  "contextId": "current-context",
  "searchText": "transformer models for natural language processing",
  "limit": 5
}
```

### 그래프 기반 관계

MCP는 다양한 관계 유형을 가진 컨텍스트 관계의 그래프 구조를 유지합니다:

- **similar**: 유사한 주제를 논의하는 컨텍스트
- **continues**: 하나의 컨텍스트가 다른 컨텍스트의 주제를 계속 이어가는 경우
- **references**: 하나의 컨텍스트가 다른 컨텍스트를 명시적으로 참조하는 경우
- **parent/child**: 컨텍스트 간의 계층적 관계

이를 통해 다음과 같은 더 정교한 컨텍스트 탐색 및 검색이 가능합니다:

```javascript
// 컨텍스트 간 관계 추가
await fetch('http://localhost:6789/tools/context_memory', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'add_relationship',
    contextId: 'context-1',
    targetId: 'context-2',
    relationshipType: 'similar',
    strength: 0.8
  })
});

// 컨텍스트 간 경로 찾기
const response = await fetch('http://localhost:6789/tools/context_memory', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'find_path',
    contextId: 'context-1',
    targetId: 'context-3'
  })
});
```

### 자동 컨텍스트 정리

MCP는 관련 없는 컨텍스트를 자동으로 제거하여 집중적이고 관리 가능한 컨텍스트 공간을 유지할 수 있습니다:

```javascript
// 현재 컨텍스트에 대한 정리 트리거
await fetch('http://localhost:6789/tools/context_memory', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'cleanup',
    contextId: 'current-context'
  })
});
```

정리 프로세스:
1. 현재 대화와 관련된 컨텍스트 식별
2. 높은 유사성이나 명시적인 관계가 있는 컨텍스트 보존
3. 부모-자식 관계를 보존하여 계층 구조 유지
4. 관련 없거나 더 이상 관련이 없는 컨텍스트 제거

## 구성

MCP는 합리적인 기본값으로 제공되며 별도의 구성 없이도 작동합니다. 그러나 필요한 경우 MCP를 초기화하고 구성할 수 있습니다:

```bash
# 현재 디렉토리에서 MCP 초기화(.mcp-config.json 생성)
npx prompt-context init

# 현재 구성 보기
npx prompt-context config

# 특정 설정 업데이트
npx prompt-context config hierarchicalContext true
```

### 구성 옵션

MCP 서버는 다음 구성 옵션을 인식합니다:

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `messageLimitThreshold` | 요약을 트리거하는 메시지 수 임계값 | 10 |
| `tokenLimitPercentage` | 모델 제한의 백분율로 표시되는 토큰 수 임계값 | 80 |
| `contextDir` | 컨텍스트 저장 디렉토리 | '.prompt-context' |
| `useGit` | Git 리포지토리 사용 여부 | true |
| `ignorePatterns` | 무시할 파일 및 디렉토리 패턴 | [] |
| `autoSummarize` | 자동 요약 활성화 여부 | true |
| `hierarchicalContext` | 계층적 컨텍스트 관리 활성화 | true |
| `metaSummaryThreshold` | 메타 요약을 생성하기 전 컨텍스트 수 | 5 |
| `maxHierarchyDepth` | 메타 요약의 최대 계층 깊이 | 3 |
| `useVectorDb` | 벡터 유사도 검색 활성화 | true |
| `useGraphDb` | 그래프 기반 컨텍스트 관계 활성화 | true |
| `similarityThreshold` | 관련 컨텍스트의 최소 유사도 임계값 | 0.6 |
| `autoCleanupContexts` | 관련 없는 컨텍스트의 자동 정리 활성화 | true |

## 팀 환경에서 MCP 사용하기

팀 환경에서 MCP를 사용할 때는 컨텍스트 데이터가 어떻게 관리되는지 고려하는 것이 중요합니다:

### Git 관리 권장 사항

기본적으로 MCP는 모든 컨텍스트 데이터를 프로젝트 내의 `.prompt-context` 디렉토리에 저장합니다. 팀 환경에서는 다음을 방지하기 위해 이 디렉토리를 `.gitignore` 파일에 추가해야 합니다:

1. 대화 컨텍스트로 Git 저장소 비대화
2. 여러 팀원이 컨텍스트를 수정할 때 발생할 수 있는 병합 충돌
3. 의도치 않게 개인적이거나 민감한 대화 공유
4. 컨텍스트 변경으로 커밋 히스토리 오염

프로젝트의 `.gitignore` 파일에 다음을 추가하세요:

```
# MCP
.prompt-context/
```

### 팀 간 컨텍스트 공유

특정 컨텍스트를 팀 전체에서 공유해야 하는 경우 다음을 고려하세요:

1. 중요한 요약을 명시적으로 내보내어 공유
2. 팀을 위한 공유 MCP 서버 설정
3. 공유 컨텍스트를 위한 데이터베이스 백엔드 사용(향후 업데이트 예정)

이 접근 방식은 각 팀원이 개인 대화 컨텍스트를 유지하면서 필요할 때 중요한 컨텍스트 정보를 공유할 수 있도록 합니다.

## 라이선스

이 프로젝트는 MIT 라이선스로 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.