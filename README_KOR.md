# Prompt Context MCP Server

AI 에이전트가 이전 대화 맥락을 효율적으로 기억하고 활용할 수 있도록 돕는 MCP 프로토콜입니다. 이 프로토콜은 각 파일 또는 맥락의 대화 기록을 추적하고 주기적으로 요약하여 저장함으로써 AI 에이전트의 맥락 이해도를 향상시킵니다.

> *Read this in [English](README.md)*

## 주요 기능

- **지능형 컨텍스트 메모리**: AI 에이전트가 대화 이력을 자동으로 기억하고 필요할 때 불러옴
- **중요도 기반 컨텍스트 유지**: 중요 정보를 자동으로 식별하고 보존
- **자동 요약**: 메시지 수가 임계값에 도달하면 컨텍스트 요약 자동 생성
- **컨텍스트 관계 추적**: 벡터 유사도와 그래프 관계로 연관된 대화를 연결하여 지식 맥락 유지
- **API 호출 분석**: 벡터 및 그래프 데이터베이스와 LLM 서비스에 대한 API 호출을 추적하고 분석하여 성능 모니터링 및 최적화 지원

## 사용법

### NPX 설치

```json
{
  "mcpServers": {
    "prompt-context": {
      "command": "npx",
      "args": [
        "-y",
        "prompt-context"
      ]
    }
  }
}
```

### Docker

```bash
docker build -t prompt-context .
```

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

## MCP 도구

### context_memory

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

## 문서

더 자세한 정보는 `docs` 디렉토리의 문서를 참조하세요:

- [작동 방식](docs/HOW_IT_WORKS_KOR.md) - 시스템 아키텍처 및 기술 선택에 대한 자세한 설명
- [기여 가이드](docs/CONTRIBUTING.md) - 프로젝트 기여에 관한 지침

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
| `trackApiCalls` | API 호출 추적 및 분석 활성화 | true |
| `apiAnalyticsRetention` | API 호출 데이터 보존 일수 | 30 |
| `fallbackToKeywordMatch` | 벡터 검색 실패 시 키워드 매칭 사용 여부 | true |

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

## 라이선스

이 프로젝트는 MIT 라이선스로 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.