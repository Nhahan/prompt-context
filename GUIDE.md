# MCP 서버 개발 가이드

## 소개

이 가이드는 MCP(Model Context Protocol) 서버를 개발할 때 참고할 수 있는 실용적인 정보를 제공합니다. `/mcp-reference/src` 디렉토리의 다양한 구현 예제를 분석하여 MCP 서버 개발에 필요한 핵심 패턴과 모범 사례를 정리했습니다.

## 기본 구조

모든 MCP 서버는 다음과 같은 기본 구조를 따릅니다:

```typescript
#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// 서버 초기화
const server = new Server(
  {
    name: "your-server-name",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 도구 정의 및 핸들러 등록
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // 도구 정의
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // 도구 호출 처리
  switch (name) {
    case "your_tool":
      // 도구 구현
      break;
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// 서버 시작
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Your MCP server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

## 도구 정의 패턴

### 1. 도구 정의

```typescript
// 방법 1: 상수로 정의
const YOUR_TOOL = {
  name: "your_tool_name",
  description: "도구에 대한 자세한 설명. 사용 시기와 방법 포함",
  inputSchema: {
    type: "object",
    properties: {
      param1: { 
        type: "string", 
        description: "매개변수 설명" 
      },
      param2: { 
        type: "number", 
        description: "매개변수 설명",
        minimum: 0 
      }
    },
    required: ["param1"]
  }
};

// 방법 2: TypeScript + zod를 사용한 유형 안전 방식
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const YourToolSchema = z.object({
  param1: z.string().describe("매개변수 설명"),
  param2: z.number().min(0).optional().describe("매개변수 설명")
});

// ListToolsRequestSchema 핸들러에서 사용
{
  name: "your_tool_name",
  description: "도구 설명",
  inputSchema: zodToJsonSchema(YourToolSchema)
}
```

### 2. 도구 리스트 등록

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "tool_one",
        description: "첫 번째 도구 설명",
        inputSchema: { /* 스키마 정의 */ }
      },
      {
        name: "tool_two",
        description: "두 번째 도구 설명",
        inputSchema: { /* 스키마 정의 */ }
      }
    ]
  };
});
```

### 3. 도구 호출 처리

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!args) {
    throw new Error("No arguments provided");
  }
  
  try {
    switch (name) {
      case "tool_one":
        // zod를 사용한 유효성 검사 (선택사항)
        const validArgs = YourToolSchema.parse(args);
        const result = await processToolOne(validArgs);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
        
      case "tool_two":
        // 직접 유효성 검사
        if (!args.required_param) {
          throw new Error("Missing required parameter");
        }
        const tool2Result = await processToolTwo(args);
        return {
          content: [{ type: "text", text: JSON.stringify(tool2Result, null, 2) }]
        };
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // zod 오류 처리
    if (error instanceof z.ZodError) {
      return {
        content: [{ 
          type: "text", 
          text: `Invalid input: ${JSON.stringify(error.errors)}` 
        }],
        isError: true
      };
    }
    
    // 일반 오류 처리
    return {
      content: [{ 
        type: "text", 
        text: `Error: ${error instanceof Error ? error.message : String(error)}` 
      }],
      isError: true
    };
  }
});
```

## 다양한 응답 유형

### 1. 텍스트 응답

```typescript
return {
  content: [{ type: "text", text: "텍스트 응답" }]
};
```

### 2. JSON 응답

```typescript
return {
  content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
};
```

### 3. 이미지 응답 (예: puppeteer)

```typescript
// Base64 인코딩된 이미지
const screenshot = await page.screenshot({ encoding: "base64" });

return {
  content: [
    { type: "text", text: "Screenshot taken" },
    { type: "image", data: screenshot, mimeType: "image/png" }
  ]
};
```

### 4. 오류 응답

```typescript
return {
  content: [{ type: "text", text: `오류 메시지: ${error.message}` }],
  isError: true  // 오류 플래그 설정
};
```

## 고급 패턴

### 1. 클래스 기반 도구 관리

```typescript
// sequentialthinking의 예시
class SequentialThinkingServer {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Record<string, ThoughtData[]> = {};

  // 도구 처리 메서드
  public processThought(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      // 입력 검증
      const validatedInput = this.validateThoughtData(input);
      
      // 상태 업데이트
      this.thoughtHistory.push(validatedInput);
      
      // 추가 로직...
      
      // 응답 반환
      return {
        content: [{
          type: "text",
          text: JSON.stringify(/* 결과 */, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: String(error) }, null, 2)
        }],
        isError: true
      };
    }
  }
  
  private validateThoughtData(input: unknown): ThoughtData {
    // 유효성 검사 로직
  }
}

const thinkingServer = new SequentialThinkingServer();

// CallToolRequestSchema 핸들러에서 사용
if (request.params.name === "sequentialthinking") {
  return thinkingServer.processThought(request.params.arguments);
}
```

### 2. 외부 API 통합

GitHub 예시:

```typescript
async function createIssue(owner: string, repo: string, options: CreateIssueOptions): Promise<Issue> {
  try {
    console.error(`[DEBUG] Attempting to create issue in ${owner}/${repo}`);
    console.error(`[DEBUG] Issue options:`, JSON.stringify(options, null, 2));
    
    const issue = await apiCall(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify(options)
    });
    
    console.error(`[DEBUG] Issue created successfully`);
    return issue;
  } catch (err) {
    console.error(`[ERROR] Failed to create issue:`, err);
    
    if (err instanceof GitHubResourceNotFoundError) {
      throw new Error(
        `Repository '${owner}/${repo}' not found. Please verify:\n` +
        `1. The repository exists\n` +
        `2. You have correct access permissions\n` +
        `3. The owner and repository names are spelled correctly`
      );
    }
    
    throw err;
  }
}

// CallToolRequestSchema 핸들러에서 사용
case "create_issue": {
  const args = issues.CreateIssueSchema.parse(request.params.arguments);
  const { owner, repo, ...options } = args;
  const issue = await createIssue(owner, repo, options);
  return {
    content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
  };
}
```

### 3. 리소스 관리

메모리 서버 예시:

```typescript
class KnowledgeGraphManager {
  private async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await fs.readFile(MEMORY_FILE_PATH, "utf-8");
      // 파일 데이터 파싱 및 처리
      return parsed;
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
        return { entities: [], relations: [] }; // 파일이 없으면 빈 그래프 반환
      }
      throw error;
    }
  }

  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const lines = [
      // 데이터 직렬화
    ];
    await fs.writeFile(MEMORY_FILE_PATH, lines.join("\n"));
  }
  
  // 서비스 메서드
  async createEntities(entities: Entity[]): Promise<Entity[]> {
    // 1. 데이터 로드
    const graph = await this.loadGraph();
    
    // 2. 상태 업데이트
    const newEntities = entities.filter(/* 필터링 로직 */);
    graph.entities.push(...newEntities);
    
    // 3. 데이터 저장
    await this.saveGraph(graph);
    
    // 4. 결과 반환
    return newEntities;
  }
  
  // 다른 메서드들...
}
```

### 4. 환경 변수 및 설정

```typescript
// Redis 연결 예시
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redisClient = createClient({
  url: REDIS_URL
});

// 메모리 저장 경로 예시
const defaultMemoryPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)), 
  'memory.json'
);

const MEMORY_FILE_PATH = process.env.MEMORY_FILE_PATH
  ? path.isAbsolute(process.env.MEMORY_FILE_PATH)
    ? process.env.MEMORY_FILE_PATH
    : path.join(path.dirname(fileURLToPath(import.meta.url)), process.env.MEMORY_FILE_PATH)
  : defaultMemoryPath;
```

## 모범 사례

### 1. 자세한 도구 설명

Sequential Thinking 도구 예시:
```typescript
const SEQUENTIAL_THINKING_TOOL: Tool = {
  name: "sequentialthinking",
  description: `A detailed tool for dynamic and reflective problem-solving through thoughts.
This tool helps analyze problems through a flexible thinking process that can adapt and evolve.
Each thought can build on, question, or revise previous insights as understanding deepens.

When to use this tool:
- Breaking down complex problems into steps
- Planning and design with room for revision
...

Parameters explained:
- thought: Your current thinking step, which can include:
* Regular analytical steps
* Revisions of previous thoughts
...

You should:
1. Start with an initial estimate of needed thoughts, but be ready to adjust
2. Feel free to question or revise previous thoughts
...`,
  inputSchema: {
    // 스키마 정의
  }
};
```

### 2. 구조화된 오류 처리

GitHub 예시:
```typescript
function formatGitHubError(error: GitHubError): string {
  let message = `GitHub API Error: ${error.message}`;
  
  if (error instanceof GitHubValidationError) {
    message = `Validation Error: ${error.message}`;
    if (error.response) {
      message += `\nDetails: ${JSON.stringify(error.response)}`;
    }
  } else if (error instanceof GitHubResourceNotFoundError) {
    message = `Not Found: ${error.message}`;
  } 
  // 다른 오류 유형 처리...
  
  return message;
}

// 오류 처리 사용
try {
  // 작업 수행
} catch (error) {
  if (isGitHubError(error)) {
    throw new Error(formatGitHubError(error));
  }
  throw error;
}
```

### 3. 데이터 유효성 검사

Zod 예시:
```typescript
import { z } from "zod";

const SetArgumentsSchema = z.object({
  key: z.string(),
  value: z.string(),
  expireSeconds: z.number().optional(),
});

try {
  const { key, value, expireSeconds } = SetArgumentsSchema.parse(args);
  // 유효성 검사 통과, 작업 수행
} catch (error) {
  if (error instanceof z.ZodError) {
    throw new Error(
      `Invalid arguments: ${error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ")}`
    );
  }
  throw error;
}
```

### 4. 연결 관리

Redis 예시:
```typescript
// 연결 설정
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', (err: Error) => console.error('Redis Client Error', err));

// 시작 시 연결
async function main() {
  try {
    await redisClient.connect();
    console.error(`Connected to Redis successfully at ${REDIS_URL}`);
    
    // 서버 시작
  } catch (error) {
    console.error("Error during startup:", error);
    await redisClient.quit();
    process.exit(1);
  }
}

// 종료 시 정리
main().catch((error) => {
  console.error("Fatal error in main():", error);
  redisClient.quit().finally(() => process.exit(1));
});
```

### 5. 자세한 로깅

```typescript
// GitHub 예시
console.error(`[DEBUG] Attempting to create issue in ${owner}/${repo}`);
console.error(`[DEBUG] Issue options:`, JSON.stringify(options, null, 2));

try {
  // 작업 수행
  console.error(`[DEBUG] Issue created successfully`);
} catch (err) {
  console.error(`[ERROR] Failed to create issue:`, err);
}

// Sequential Thinking 예시
const formattedThought = this.formatThought(validatedInput);
console.error(formattedThought); // 사용자 친화적 형식으로 출력
```

## 예제 구현

### 1. 간단한 Redis 도구

```typescript
// 도구 정의
const SET_TOOL = {
  name: "set",
  description: "Set a Redis key-value pair with optional expiration",
  inputSchema: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "Redis key",
      },
      value: {
        type: "string",
        description: "Value to store",
      },
      expireSeconds: {
        type: "number",
        description: "Optional expiration time in seconds",
      },
    },
    required: ["key", "value"],
  },
};

// 도구 핸들러
if (name === "set") {
  const { key, value, expireSeconds } = SetArgumentsSchema.parse(args);
  
  if (expireSeconds) {
    await redisClient.setEx(key, expireSeconds, value);
  } else {
    await redisClient.set(key, value);
  }

  return {
    content: [
      {
        type: "text",
        text: `Successfully set key: ${key}`,
      },
    ],
  };
}
```

### 2. 스크린샷 도구 (Puppeteer)

```typescript
// 도구 정의
const SCREENSHOT_TOOL = {
  name: "puppeteer_screenshot",
  description: "Take a screenshot of the current page or a specific element",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Name for the screenshot" },
      selector: { type: "string", description: "CSS selector for element to screenshot" },
      width: { type: "number", description: "Width in pixels (default: 800)" },
      height: { type: "number", description: "Height in pixels (default: 600)" },
    },
    required: ["name"],
  },
};

// 도구 핸들러
if (name === "puppeteer_screenshot") {
  const width = args.width ?? 800;
  const height = args.height ?? 600;
  await page.setViewport({ width, height });

  const screenshot = await (args.selector ?
    (await page.$(args.selector))?.screenshot({ encoding: "base64" }) :
    page.screenshot({ encoding: "base64", fullPage: false }));

  if (!screenshot) {
    return {
      content: [{
        type: "text",
        text: args.selector ? `Element not found: ${args.selector}` : "Screenshot failed",
      }],
      isError: true,
    };
  }

  // 스크린샷 저장 (선택사항)
  screenshots.set(args.name, screenshot as string);

  return {
    content: [
      {
        type: "text",
        text: `Screenshot '${args.name}' taken at ${width}x${height}`,
      },
      {
        type: "image",
        data: screenshot,
        mimeType: "image/png",
      },
    ],
    isError: false,
  };
}
```

## 결론

MCP 서버 개발 시 다음 핵심 원칙을 따르세요:

1. **명확한 도구 정의**: 사용 방법과 시기를 자세히 설명한 도구 설명 제공
2. **매개변수 유효성 검사**: zod 또는 자체 유효성 검사 로직 사용
3. **구조화된 오류 처리**: 명확한 오류 메시지와 isError 플래그 사용
4. **적절한 리소스 관리**: 외부 리소스 연결과 정리 관리
5. **명확한 로깅**: 디버깅을 위한 상세 로그

다양한 예제 구현을 참고하여 요구사항에 맞는 MCP 서버를 개발하세요. 