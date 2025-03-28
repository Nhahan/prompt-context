# AI 에이전트를 위한 메모리 컨텍스트 프로토콜 (MCP)

`prompt-context`는 AI 에이전트가 이전 대화 컨텍스트를 효율적으로 기억하고 활용할 수 있도록 돕는 TypeScript 라이브러리입니다. 이 프로토콜은 각 파일이나 컨텍스트별로 대화 기록을 추적하고, 주기적으로 요약하며, AI 에이전트의 컨텍스트 이해력을 향상시키기 위해 요약본을 저장합니다.

*[English](README.md)*

## 주요 기능

- **지능형 컨텍스트 관리**: AI 에이전트가 필요에 따라 자율적으로 대화 컨텍스트를 기록하고 검색할 수 있습니다
- **컨텍스트 기반 메모리 관리**: 파일이나 주제별로 대화를 별도로 구성합니다
- **자동 요약 생성**: 메시지 수나 토큰 수가 임계값에 도달하면 자동으로 요약을 생성합니다
- **계층적 요약**: 효율적인 메모리 사용을 위해 상세 컨텍스트와 상위 수준 요약을 모두 유지합니다
- **중요도 기반 보존**: 지능형 중요도 분석을 기반으로 중요한 정보를 식별하고 보존합니다
- **관련 컨텍스트 감지**: 관련된 컨텍스트를 자동으로 감지하고 연결하여 포괄적인 이해를 돕습니다
- **메타 요약**: 관련된 정보의 계층을 연결하는 프로젝트 전체 메타 요약을 생성합니다
- **코드 블록 보존**: 요약에서 중요한 정보를 유지하기 위해 코드 블록을 보존합니다
- **Git 통합**: Git으로 요약 파일을 버전 관리합니다
- **제로 구성**: AI 도구 구성에 MCP를 추가하기만 하면 자동으로 작동합니다
- **벡터 유사성 검색**: 서로 다른 컨텍스트 간에 의미론적으로 유사한 대화를 찾습니다
- **그래프 기반 관계**: 관련 대화를 연결하는 지식 그래프를 유지합니다
- **자율 작동**: 관련 없는 컨텍스트를 자동으로 정리합니다

## 설치

> **참고:** 이 패키지는 현재 베타 버전입니다. `@beta` 태그를 사용하여 베타 버전을 설치할 수 있습니다.

```bash
# 전역 설치
npm install -g prompt-context@beta
```

## MCP 서버 사용법

이 라이브러리는 Claude, Cursor 등의 AI 도구와 함께 MCP(Model Context Protocol) 서버로 사용되도록 설계되었습니다. AI 에이전트는 필요할 때 MCP를 통해 자율적으로 컨텍스트를 관리합니다.

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

### Cursor 에디터에서 사용하기

Cursor에서 Memory Context Protocol을 사용하려면:

1. 패키지를 전역적으로 설치하세요:
```bash
npm install -g prompt-context@beta
```

2. 홈 디렉토리에 `.cursor/mcps.json` 파일을 생성하세요:
```bash
mkdir -p ~/.cursor && touch ~/.cursor/mcps.json
```

3. `.cursor/mcps.json` 파일에 다음 구성을 추가하세요:
```json
{
  "prompt-context": {
    "command": "npx",
    "args": [
      "prompt-context-mcp"
    ]
  }
}
```

4. 변경사항을 적용하기 위해 Cursor를 재시작하세요.

5. 특정 프로젝트에서 MCP를 활성화하려면 프로젝트 루트에 `.cursor-settings.json` 파일을 다음과 같이 생성하세요:
```json
{
  "mcps": [
    "prompt-context"
  ]
}
```

이렇게 하면 Cursor가 구성에 따라 자동 요약 기능과 함께 코딩 세션 간에 컨텍스트를 유지할 수 있습니다.

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
- `contextId` (string): 컨텍스트 식별자(일반적으로 파일 경로나 주제 이름)
- `role` (string, 'add' 작업의 경우): 메시지 발신자의 역할('user' 또는 'assistant')
- `content` (string, 'add' 작업의 경우): 메시지 내용
- `importance` (string, 'add' 작업의 경우): 중요도 수준('low', 'medium', 'high', 또는 'critical')
- `tags` (string 배열, 'add' 작업의 경우): 메시지 분류를 위한 태그
- `metaId` (string, 'get_meta' 작업의 경우): 검색할 메타 요약 ID
- `searchText` (string, 'find_similar' 작업의 경우): 유사한 컨텍스트를 검색할 텍스트
- `limit` (number, 'find_similar' 작업의 경우): 반환할 최대 결과 수
- `targetId` (string, 관계 작업의 경우): 관계 작업을 위한 대상 컨텍스트 ID
- `relationshipType` (string, 'add_relationship' 작업의 경우): 관계 유형('similar', 'continues', 'references', 'parent', 'child')
- `strength` (number, 'add_relationship' 작업의 경우): 관계 강도(0-1)

## 고급 기능

### 벡터 유사성 검색

MCP는 벡터 임베딩을 사용하여 의미적으로 유사한 컨텍스트를 찾아내 AI 에이전트가 다음을 수행할 수 있게 합니다:

- 다른 표현을 사용하더라도 유사한 주제를 논의하는 컨텍스트 찾기
- 대화 간의 관계를 자동으로 감지
- 더 일관된 지식 구조 생성
- 관련 없는 컨텍스트를 정리하여 집중력 유지

유사성 검색 사용 예:

```javascript
// 쿼리와 유사한 컨텍스트 찾기
const response = await fetch('http://localhost:3000/similar?text=machine learning&limit=5');
const { similarContexts } = await response.json();
```

또는 MCP 도구를 통해:

```json
{
  "action": "find_similar",
  "contextId": "current-context",
  "searchText": "자연어 처리를 위한 트랜스포머 모델",
  "limit": 5
}
```

### 그래프 기반 관계

MCP는 다양한 관계 유형을 가진 컨텍스트 관계의 그래프 구조를 유지합니다:

- **similar**: 유사한 주제를 논의하는 컨텍스트
- **continues**: 하나의 컨텍스트가 다른 컨텍스트에서 주제를 계속 이어감
- **references**: 하나의 컨텍스트가 다른 컨텍스트를 명시적으로 참조
- **parent/child**: 컨텍스트 간의 계층적 관계

이를 통해 더 정교한 컨텍스트 탐색 및 검색이 가능합니다:

```javascript
// 컨텍스트 간 관계 추가
await fetch('http://localhost:3000/tools/context_memory', {
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
const response = await fetch('http://localhost:3000/tools/context_memory', {
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

MCP는 집중적이고 관리 가능한 컨텍스트 공간을 유지하기 위해 관련 없는 컨텍스트를 자동으로 제거할 수 있습니다:

```javascript
// 현재 컨텍스트를 기준으로 정리 트리거
await fetch('http://localhost:3000/tools/context_memory', {
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
2. 유사성이 높거나 명시적 관계가 있는 컨텍스트 보존
3. 부모-자식 관계를 보존하여 계층 구조 유지
4. 관련이 없거나 더 이상 관련이 없는 컨텍스트 제거

## 구성

MCP는 합리적인 기본값을 제공하며 별도의 구성 없이도 작동합니다. 그러나 필요한 경우 MCP를 초기화하고 구성할 수 있습니다:

```bash
# 현재 디렉토리에 MCP 초기화 (.mcp-config.json 생성)
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
| `tokenLimitPercentage` | 모델 한도의 백분율로 표시된 토큰 수 임계값 | 80 |
| `contextDir` | 컨텍스트 저장 디렉토리 | '.prompt-context' |
| `useGit` | Git 저장소 사용 여부 | true |
| `ignorePatterns` | 무시할 파일 및 디렉토리 패턴 | [] |
| `autoSummarize` | 자동 요약 활성화 여부 | true |
| `hierarchicalContext` | 계층적 컨텍스트 관리 활성화 | true |
| `metaSummaryThreshold` | 메타 요약을 생성하기 전 컨텍스트 수 | 5 |
| `maxHierarchyDepth` | 메타 요약의 최대 계층 깊이 | 3 |
| `useVectorDb` | 유사성 검색을 위한 벡터 데이터베이스 활성화 | true |
| `useGraphDb` | 컨텍스트 관계를 위한 그래프 데이터베이스 활성화 | true |
| `similarityThreshold` | 자동 관계 감지를 위한 임계값 | 0.6 |
| `autoCleanupContexts` | 관련 없는 컨텍스트 자동 정리 | true |

80%의 `tokenLimitPercentage`는 엄격한 제한보다는 가이드라인으로 작용합니다. AI 에이전트는 이 임계값을 사용하여 컨텍스트 창이 너무 커지는 것을 방지하면서, 관련성과 중요도에 따라 컨텍스트를 저장할 시기를 지능적으로 결정합니다.

### .gitignore 통합

`.gitignore` 파일에 정의된 패턴은 자동으로 로드되어 무시 패턴으로 사용됩니다. 또한 다음과 같은 기본 패턴이 적용됩니다:

- node_modules
- .git
- dist
- build
- coverage
- tmp
- *.log
- *.lock
- *.min.*
- *.map

## 기여하기

Memory Context Protocol에 기여하는 데 관심이 있으신가요? 자세한 내용은 [기여 가이드라인](CONTRIBUTING.md)을 참조하세요.

## 라이선스

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다 - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요. 