/**
 * Integration Test Runner
 *
 * Runs integration tests without Jest, using real embeddings and database
 */

import { runComplexDevelopmentScenario } from '../src/__tests__/integration-tests/complex-development-scenario.test';
import { runReactAIDevelopmentScenario } from '../src/__tests__/integration-tests/react-ai-development.test';

// Set environment variables for integration tests
process.env.RUN_INTEGRATION_TESTS = 'true';
process.env.NODE_ENV = 'production'; // 실제 환경과 동일하게 설정
process.env.MCP_DEBUG = 'false'; // 디버그 모드 비활성화

/**
 * Wait for a specified time to ensure all async operations finish
 * @param ms Time to wait in milliseconds
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safely exit the process after cleaning up
 * @param code Exit code
 */
function safeExit(code: number) {
  console.log(`\n프로세스를 안전하게 종료합니다 (종료 코드: ${code})...`);
  
  // 다음 이벤트 루프 틱에서 종료
  process.nextTick(() => {
    try {
      // 강제 가비지 컬렉션 시도 (지원하는 환경에서만)
      if (global.gc && typeof global.gc === 'function') {
        (global as any).gc();
      }
    } catch (e) {
      // gc가 지원되지 않는 경우 무시
    }
    
    // 짧은 지연 후 종료
    setTimeout(() => {
      process.exit(code);
    }, 1000);
  });
}

async function runAllIntegrationTests() {
  console.log('===== 통합 테스트 시작 =====');
  console.log('실제 임베딩과 DB를 사용한 테스트 실행');

  try {
    console.log('\n1. Complex Development Scenario 테스트 실행 중...');
    await runComplexDevelopmentScenario();
    console.log('\n✓ Complex Development Scenario 테스트 완료');

    // 첫 번째 테스트와 두 번째 테스트 사이에 짧은 대기 시간을 추가하여 리소스가 정리될 시간을 줍니다
    await wait(2000);

    console.log('\n2. React AI Development Scenario 테스트 실행 중...');
    await runReactAIDevelopmentScenario();
    console.log('\n✓ React AI Development Scenario 테스트 완료');

    // 마무리 작업을 위한 대기 시간 추가
    await wait(2000);

    console.log('\n===== 모든 통합 테스트 성공적으로 완료 =====');

    safeExit(0);
  } catch (error) {
    console.error('\n❌ 통합 테스트 실패:', error);

    // 오류 발생 시에도 안전한 종료를 위해 대기 시간 추가
    await wait(1000);
    safeExit(1);
  }
}

// 프로세스 종료 시그널 처리
process.on('SIGINT', async () => {
  console.log('\n인터럽트 신호를 받았습니다. 안전하게 종료합니다...');
  await wait(1000);
  safeExit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n종료 신호를 받았습니다. 안전하게 종료합니다...');
  await wait(1000);
  safeExit(0);
});

// 처리되지 않은 예외 처리
process.on('uncaughtException', async (error) => {
  console.error('\n처리되지 않은 예외 발생:', error);
  await wait(1000);
  safeExit(1);
});

// 테스트 실행
runAllIntegrationTests();
