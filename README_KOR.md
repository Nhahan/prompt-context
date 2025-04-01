# Prompt Context

AI 에이전트가 이전 대화 컨텍스트를 효율적으로 기억하고 활용하는 데 도움이 되는 MCP 프로토콜입니다.

## 기능

- AI 에이전트를 위한 컨텍스트 메모리
- MCP(Model Context Protocol) 규격 준수
- 의미론적 검색을 위한 벡터 유사도 검색
- 계층적 컨텍스트 저장
- 그래프 기반 관계 추적
- 효율적인 리소스 활용

## 설치

```bash
npm install prompt-context
```

## 사용법

```javascript
const { initializeMcpServer } = require('prompt-context');

async function main() {
  const services = await initializeMcpServer();
  // MCP 서버가 이제 실행 중입니다
}

main();
```

## 문서

자세한 문서는 [docs](docs) 디렉토리를 참조하세요.

## 라이선스

MIT
