# 코드 구조

이 문서는 Prompt Context MCP 서버 코드베이스의 구조와 주요 파일들의 역할을 설명합니다.

## 주요 구성 요소

### 코어 모듈

| 파일 | 설명 |
|------|-------------|
| `src/main.ts` | MCP 서버의 진입점, MCP 프로토콜 핸들러 초기화 |
| `src/index.ts` | 패키지 메인 내보내기, 프로그래밍 방식 사용을 위한 공개 API 제공 |

### 도메인 레이어

도메인 레이어는 핵심 비즈니스 로직과 엔티티를 포함합니다.

| 파일 | 설명 |
|------|-------------|
| `src/domain/context.service.ts` | 컨텍스트 관리 로직을 구현하는 핵심 서비스 |
| `src/domain/message.service.ts` | 메시지 처리, 태깅, 중요도 평가 처리 |
| `src/domain/relationship.service.ts` | 서로 다른 컨텍스트 간 관계 관리 |
| `src/domain/summarizer.service.ts` | 컨텍스트 요약 로직 구현 |

### 저장소 레이어

저장소 레이어는 데이터 영속성과 저장을 처리합니다.

| 파일 | 설명 |
|------|-------------|
| `src/repositories/repository.interface.ts` | 저장소 인터페이스와 공통 타입 정의 |
| `src/repositories/file-system.repository.ts` | 컨텍스트 데이터를 위한 파일 기반 저장소 구현 |
| `src/repositories/vector.repository.ts` | HNSW를 이용한 벡터 임베딩 및 유사도 검색 관리 |
| `src/repositories/graph.repository.ts` | 컨텍스트 관계를 위한 그래프 기반 저장소 구현 |

### 프레젠테이션 레이어

프레젠테이션 레이어는 사용자 인터페이스와 외부 통신을 처리합니다.

| 파일 | 설명 |
|------|-------------|
| `src/presentation/mcp-tools.ts` | MCP 프로토콜 도구 API 구현 |
| `src/presentation/http-api.ts` | 비 MCP 클라이언트를 위한 HTTP API 엔드포인트 |
| `src/presentation/cli.ts` | 설정 및 직접 사용을 위한 명령줄 인터페이스 |

### 설정

| 파일 | 설명 |
|------|-------------|
| `src/config/config.ts` | 기본값과 오버라이드가 있는 설정 관리 시스템 |
| `src/config/schema.ts` | 설정 유효성 검사를 위한 JSON 스키마 정의 |

### 유틸리티

| 파일 | 설명 |
|------|-------------|
| `src/utils/embedding.ts` | 트랜스포머 모델을 이용한 텍스트 임베딩 생성 처리 |
| `src/utils/tokenizer.ts` | 토큰 카운팅 및 텍스트 토큰화 유틸리티 |
| `src/utils/logger.ts` | 로깅 유틸리티 |
| `src/utils/file.ts` | 파일 시스템 헬퍼 함수 |

## 데이터베이스 구현

### 벡터 데이터베이스

벡터 데이터베이스는 `vector.repository.ts`에서 `hnswlib-node` 패키지의 HNSW(Hierarchical Navigable Small World) 알고리즘을 사용하여 구현됩니다. 주요 기능:

- 외부 데이터베이스 의존성 없음
- 의미론적 쿼리를 위한 효율적인 유사도 검색
- 휴대성을 위한 플랫 파일 형태의 지속성
- 트랜스포머 모델을 사용한 자동 임베딩 생성

### 그래프 데이터베이스

그래프 데이터베이스는 `graph.repository.ts`에서 `graphology` 라이브러리를 사용하여 구현됩니다. 제공 기능:

- 컨텍스트 간 관계 추적
- 관련 컨텍스트 찾기 위한 순회 기능
- 외부 의존성 없는 영구 저장소
- 가중치가 있는 관계 지원

## 테스트

| 디렉토리 | 설명 |
|-----------|-------------|
| `src/__tests__/integration-tests/` | 실제 사용 시나리오를 시뮬레이션하는 통합 테스트 |

## 통합

서버는 다양한 모드로 사용될 수 있습니다:

1. **MCP 프로토콜 모드**: Cursor와 같은 MCP 호환 클라이언트에서 사용
2. **독립 실행 모드**: 비 MCP 클라이언트를 위한 HTTP 서버로 실행
3. **라이브러리 모드**: 다른 Node.js 애플리케이션에서 프로그래밍 방식으로 사용 