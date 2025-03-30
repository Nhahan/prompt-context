#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 전역 변수 정의
const TEST_CONTEXT_ID = 'test-context-' + Date.now();
const TEST_CONTEXT_ID_2 = 'test-context-2-' + Date.now();
const LOG_FILE = path.resolve('./test-mcp.log');
let testPhase = 0;
let responseBuffer = '';

// 로그 파일 초기화
fs.writeFileSync(LOG_FILE, '');

// 함수 정의: log
function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  fs.appendFileSync(LOG_FILE, formattedMessage + '\n');
}

// 함수 정의: sendRequest
function sendRequest(request) {
  const requestStr = JSON.stringify(request);
  log(`요청 전송: ${requestStr}`);
  mcpServer.stdin.write(requestStr + '\n');
}

// 함수 정의: exitTest
function exitTest() {
  log('모든 테스트 완료, 프로세스 종료');
  mcpServer.kill();
  process.exit(0);
}

// 함수 정의: 모든 send...Request 함수들
function sendListToolsRequest() {
  log('도구 목록 요청 전송');
  const request = {
    id: "1",
    jsonrpc: "2.0",
    method: "tools/list"
  };
  sendRequest(request);
}

function sendPingRequest() {
  log('Ping 요청 전송');
  const request = {
    id: "2",
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "ping",
      arguments: {}
    }
  };
  sendRequest(request);
}

function sendAddMessageRequest() {
  log(`컨텍스트 ${TEST_CONTEXT_ID}에 메시지 추가 요청 전송`);
  const request = {
    id: "3",
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "add_message",
      arguments: {
        contextId: TEST_CONTEXT_ID,
        message: '안녕하세요, 이것은 테스트 메시지입니다.',
        role: 'user',
        importance: 'medium',
        tags: ['test', 'message']
      }
    }
  };
  sendRequest(request);
}

function sendRetrieveContextRequest() {
  log(`컨텍스트 ${TEST_CONTEXT_ID} 검색 요청 전송`);
  const request = {
    id: "4",
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "retrieve_context",
      arguments: {
        contextId: TEST_CONTEXT_ID
      }
    }
  };
  sendRequest(request);
}

function sendSummarizeRequest() {
  log(`컨텍스트 ${TEST_CONTEXT_ID} 요약 생성 요청 전송`);
  const request = {
    id: "5",
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "summarize_context",
      arguments: {
        contextId: TEST_CONTEXT_ID
      }
    }
  };
  sendRequest(request);
}

function sendGetSimilarContextsRequest() {
  log('유사 컨텍스트 검색 요청 전송');
  const request = {
    id: "6",
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "get_similar_contexts",
      arguments: {
        query: '테스트 메시지',
        limit: 2
      }
    }
  };
  sendRequest(request);
}

function sendAddMessageToSecondContextRequest() {
  log(`컨텍스트 ${TEST_CONTEXT_ID_2}에 메시지 추가 요청 전송`);
  const request = {
    id: "7",
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "add_message",
      arguments: {
        contextId: TEST_CONTEXT_ID_2,
        message: '두 번째 컨텍스트의 메시지입니다.',
        role: 'user',
      }
    }
  };
  sendRequest(request);
}

function sendAddRelationshipRequest() {
  log(`관계 추가 요청 전송: ${TEST_CONTEXT_ID} -> ${TEST_CONTEXT_ID_2}`);
  const request = {
    id: "8",
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "add_relationship",
      arguments: {
        sourceContextId: TEST_CONTEXT_ID,
        targetContextId: TEST_CONTEXT_ID_2,
        relationshipType: "similar",
        weight: 0.75
      }
    }
  };
  sendRequest(request);
}

function sendGetRelatedContextsRequest() {
  log(`연관 컨텍스트 검색 요청 (전체): ${TEST_CONTEXT_ID}`);
  const request = {
    id: "9",
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "get_related_contexts",
      arguments: {
        contextId: TEST_CONTEXT_ID
      }
    }
  };
  sendRequest(request);
}

function sendGetRelatedContextsWithTypeRequest() {
    log(`연관 컨텍스트 검색 요청 (타입 필터): ${TEST_CONTEXT_ID}`);
    const request = {
        id: "10",
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
            name: "get_related_contexts",
            arguments: {
                contextId: TEST_CONTEXT_ID,
                relationshipType: "similar",
                direction: "outgoing"
            }
        }
    };
    sendRequest(request);
}

function sendAddMessageInvalidArgsRequest() {
  log(`잘못된 인수 메시지 추가 요청 전송 (message 누락)`);
  const request = {
    id: "11",
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "add_message",
      arguments: {
        contextId: TEST_CONTEXT_ID,
        role: 'user',
      }
    }
  };
  sendRequest(request);
}

function sendUnknownToolRequest() {
  log(`존재하지 않는 도구 호출 요청 전송`);
  const request = {
    id: "12",
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "non_existent_tool",
      arguments: {}
    }
  };
  sendRequest(request);
}

// 함수 정의: handleResponse (testScenarios 정의 전에 위치해야 함)
function handleResponse(response) {
  log(`응답 처리 중 (테스트 단계: ${testPhase})`);
  testPhase++;
  // This check needs testScenarios to be defined, so call must happen after definition
  if (testPhase < testScenarios.length) { 
    setTimeout(() => {
      // Ensure testScenarios exists before calling the function
      if (testScenarios && testPhase < testScenarios.length) {
          testScenarios[testPhase]();
      } else {
          log(`Error: Attempted to run test phase ${testPhase} but testScenarios is not ready or index out of bounds.`);
          exitTest(); // Exit if something is wrong
      }
    }, 1000);
  }
}

// MCP 서버 프로세스 실행 및 핸들러 설정
const mcpServer = spawn('node', [
  path.resolve('./dist/mcp-server.js'),
  '--mcp-mode',
  '--client', 'test-client',
  '--config', '{"debug":true}'
], {
  stdio: ['pipe', 'pipe', 'pipe']
});

mcpServer.stderr.on('data', (data) => {
  log(`MCP 서버 stderr: ${data.toString().trim()}`);
});

mcpServer.stdout.on('data', (data) => {
  const output = data.toString();
  log(`MCP 서버 stdout: ${output.trim()}`);
  responseBuffer += output;
  try {
    const lines = responseBuffer.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line) {
        try {
          const json = JSON.parse(line);
          log(`받은 응답: ${JSON.stringify(json, null, 2)}`);
          // Defer handling until testScenarios is defined
          if (typeof testScenarios !== 'undefined') {
              handleResponse(json);
          } else {
              log("Waiting for testScenarios definition...");
          }
        } catch (err) {
          log(`JSON 파싱 오류 (오류 무시): ${err.message}`);
        }
      }
    }
    responseBuffer = lines[lines.length - 1];
  } catch (err) {
    log(`응답 처리 오류: ${err.message}`);
  }
});

mcpServer.on('error', (err) => {
  log(`MCP 서버 오류: ${err.message}`);
});

mcpServer.on('close', (code) => {
  log(`MCP 서버 프로세스 종료 (코드: ${code})`);
});

// testScenarios 배열 정의 (모든 함수 정의 이후)
const testScenarios = [
  sendListToolsRequest,               // 0
  sendPingRequest,                    // 1
  sendAddMessageRequest,              // 2: Add msg to ctx 1
  sendRetrieveContextRequest,         // 3: Retrieve ctx 1
  sendSummarizeRequest,               // 4: Summarize ctx 1
  sendGetSimilarContextsRequest,      // 5: Find similar
  sendAddMessageToSecondContextRequest,// 6: Add msg to ctx 2
  sendAddRelationshipRequest,         // 7: Add relationship ctx1 -> ctx2
  sendGetRelatedContextsRequest,      // 8: Get related for ctx1 (all)
  sendGetRelatedContextsWithTypeRequest,// 9: Get related for ctx1 (filtered)
  sendAddMessageInvalidArgsRequest,   // 10: Error test - invalid args
  sendUnknownToolRequest,             // 11: Error test - unknown tool
  exitTest                            // 12: Finish
];

// 테스트 시작 (testScenarios 정의 이후)
log('테스트 시작');
// Ensure server has time to start before sending first request
setTimeout(() => {
    if (testScenarios && testPhase < testScenarios.length) {
        testScenarios[testPhase]();
    } else {
        log("Error: testScenarios not ready for initial call.");
        exitTest();
    }
}, 500); // Add a small delay

// SIGINT 핸들러
process.on('SIGINT', () => {
  log('테스트 중단됨');
  mcpServer.kill();
  process.exit(1);
}); 