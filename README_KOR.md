# Prompt Context MCP 서버

AI 에이전트가 벡터 임베딩과 그래프 관계를 사용하여 대화 컨텍스트를 효율적으로 저장, 검색 및 관리할 수 있게 해주는 Model Context Protocol(MCP) 서버입니다.

## 개요

Prompt Context MCP 서버는 AI 에이전트에게 영구적인 메모리 기능을 제공하는 MCP 구현체입니다. Vector DB와 Graph DB 기술을 함께 사용하여 대화 컨텍스트를 저장하고, 의미적으로 유사한 대화를 찾으며, 서로 다른 대화 스레드 간의 관계를 관리합니다.

## 기능

- `add_context`와 `get_context` 도구를 통해 대화 컨텍스트를 효율적으로 저장하고 검색
- 벡터 기반 의미 검색으로 유사한 대화 찾기
- 관련 컨텍스트 간 자동 관계 형성
- 벡터 임베딩과 그래프 관계를 모두 활용하는 하이브리드 저장 방식
- 메시지 중요도 수준 및 태그 지원
- 컨텍스트가 토큰 제한을 초과할 때 자동 요약 기능

## 설치

```bash
npm install prompt-context
```

## 사용법

Prompt Context MCP 서버는 두 가지 핵심 도구만 제공합니다:

### 1. `add_context`

컨텍스트에 메시지를 추가합니다. 컨텍스트가 존재하지 않을 경우 새로 생성합니다.

**파라미터:**

- `contextId`: 컨텍스트의 고유 문자열 식별자
- `message`: 추가할 메시지 내용
- `role`: 'user' 또는 'assistant' 중 하나
- `importance`: 선택적 메시지 중요도 ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
- `tags`: 선택적 분류용 문자열 태그 배열

```javascript
// 예제
const result = await mcpClient.callTool('add_context', {
  contextId: 'project-a-design-discussion',
  message: '이 프로젝트의 데이터베이스를 어떻게 구성해야 할까요?',
  role: 'user',
  importance: 'HIGH',
  tags: ['database', 'design', 'architecture'],
});
```

### 2. `get_context`

ID로 컨텍스트를 검색하거나 쿼리를 기반으로 유사한 컨텍스트를 검색합니다.

**파라미터:**

- `contextId`: 검색할 컨텍스트의 ID, 또는
- `query`: 유사한 컨텍스트를 찾기 위한 텍스트 쿼리

```javascript
// ID로 검색
const context = await mcpClient.callTool('get_context', {
  contextId: 'project-a-design-discussion',
});

// 유사한 컨텍스트 찾기
const similarContexts = await mcpClient.callTool('get_context', {
  query: '데이터베이스 스키마 설계 패턴',
});
```

## 내부 작동 원리

Prompt Context MCP 서버는 Vector DB와 Graph DB 기술을 모두 활용합니다:

1. **벡터 저장소**: 메시지가 컨텍스트에 추가될 때, 전체 컨텍스트가 임베딩되어 벡터 데이터베이스에 저장되어 의미적 유사성 검색을 가능하게 합니다.

2. **그래프 관계**: 관련된 컨텍스트는 자동으로 그래프 데이터베이스에 연결되어 컨텍스트 관계의 탐색과 발견을 가능하게 합니다.

두 기술은 함께 작동하여 AI 에이전트에게 의미 검색과 관계 기반 컨텍스트 관리의 장점을 결합한 강력한 메모리 시스템을 제공합니다.

## 설정

환경 변수나 `.mcp-config.json` 파일을 사용하여 서버를 구성할 수 있습니다:

```json
{
  "contextDir": "/path/to/context/storage",
  "useVectorDb": true,
  "useGraphDb": true,
  "autoSummarize": true,
  "similarityThreshold": 0.6
}
```

## 개발

이 프로젝트에 기여하려면:

```bash
# 저장소 복제
git clone https://github.com/your-username/prompt-context.git
cd prompt-context

# 의존성 설치
npm install

# 빌드
npm run build

# 테스트 실행
npm test
```

## 라이센스

MIT
