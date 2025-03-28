import { MemoryContextProtocol, Message } from '../';

// MCP 인스턴스 생성
const mcp = new MemoryContextProtocol({
  // 기본 설정 사용, 필요시 사용자 정의 설정 추가 가능
  messageLimitThreshold: 5, // 5개 메시지 후 요약
  useGit: true,
  contextDir: '.prompt-context',
  autoSummarize: true
});

// 예제로 사용할 컨텍스트 ID (보통 파일 경로)
const contextId = 'examples/conversation-1.md';

// 예제 대화 메시지 생성
const createMessage = (role: 'user' | 'assistant', content: string): Message => ({
  role,
  content,
  timestamp: Date.now()
});

// 비동기 함수로 메시지 추가 및 처리
async function runExample() {
  try {
    console.log('Memory Context Protocol (MCP) 기본 사용법 예제');
    console.log('======================================');

    // 사용자 메시지 추가
    await mcp.addMessage(contextId, createMessage('user', '안녕하세요! TypeScript를 사용하여 Express API를 만들고 싶습니다.'));
    
    // 어시스턴트 메시지 추가
    await mcp.addMessage(contextId, createMessage('assistant', 
      '안녕하세요! TypeScript로 Express API를 만드는 것은 좋은 선택입니다. 시작하려면 다음 코드를 사용할 수 있습니다:\n\n' +
      '```typescript\n' +
      'import express from \'express\';\n' +
      'const app = express();\n' +
      'const port = 3000;\n\n' +
      'app.get(\'/\', (req, res) => {\n' +
      '  res.send(\'Hello World!\');\n' +
      '});\n\n' +
      'app.listen(port, () => {\n' +
      '  console.log(`Server running at http://localhost:${port}`);\n' +
      '});\n' +
      '```\n\n' +
      '이 기본 코드로 시작하여 필요에 따라 확장할 수 있습니다.'
    ));

    // 추가 사용자 메시지
    await mcp.addMessage(contextId, createMessage('user', '감사합니다! 이제 데이터베이스를 연결하고 싶은데 MongoDB를 사용하는 방법을 알려주실 수 있나요?'));
    
    // 어시스턴트 응답
    await mcp.addMessage(contextId, createMessage('assistant', 
      'MongoDB를 Express 앱에 연결하려면 다음 단계를 따르세요:\n\n' +
      '1. 먼저 필요한 패키지를 설치합니다:\n' +
      '```bash\n' +
      'npm install mongoose\n' +
      '```\n\n' +
      '2. MongoDB 연결 코드를 추가합니다:\n' +
      '```typescript\n' +
      'import express from \'express\';\n' +
      'import mongoose from \'mongoose\';\n\n' +
      'const app = express();\n' +
      'const port = 3000;\n\n' +
      '// MongoDB 연결\n' +
      'mongoose.connect(\'mongodb://localhost:27017/myapp\')\n' +
      '  .then(() => console.log(\'MongoDB connected\'))\n' +
      '  .catch(err => console.error(\'MongoDB connection error:\', err));\n\n' +
      '// 라우트 설정\n' +
      'app.get(\'/\', (req, res) => {\n' +
      '  res.send(\'Hello World!\');\n' +
      '});\n\n' +
      'app.listen(port, () => {\n' +
      '  console.log(`Server running at http://localhost:${port}`);\n' +
      '});\n' +
      '```\n\n' +
      '3. 이제 MongoDB 모델을 정의할 수 있습니다:\n' +
      '```typescript\n' +
      'import { Schema, model } from \'mongoose\';\n\n' +
      'interface IUser {\n' +
      '  name: string;\n' +
      '  email: string;\n' +
      '  createdAt: Date;\n' +
      '}\n\n' +
      'const userSchema = new Schema<IUser>({\n' +
      '  name: { type: String, required: true },\n' +
      '  email: { type: String, required: true, unique: true },\n' +
      '  createdAt: { type: Date, default: Date.now }\n' +
      '});\n\n' +
      'export const User = model<IUser>(\'User\', userSchema);\n' +
      '```'
    ));

    // 추가 질문
    await mcp.addMessage(contextId, createMessage('user', '모델을 만들었으니 이제 API 엔드포인트를 만드는 방법을 알려주세요.'));
    
    // 추가 응답
    await mcp.addMessage(contextId, createMessage('assistant', 
      'API 엔드포인트를 만들어 보겠습니다. 사용자를 생성하고 조회하는 엔드포인트를 예로 들겠습니다:\n\n' +
      '```typescript\n' +
      'import express from \'express\';\n' +
      'import { User } from \'./models/User\';\n\n' +
      'const router = express.Router();\n\n' +
      '// 모든 사용자 조회\n' +
      'router.get(\'/users\', async (req, res) => {\n' +
      '  try {\n' +
      '    const users = await User.find();\n' +
      '    res.json(users);\n' +
      '  } catch (err) {\n' +
      '    res.status(500).json({ message: err.message });\n' +
      '  }\n' +
      '});\n\n' +
      '// 특정 사용자 조회\n' +
      'router.get(\'/users/:id\', async (req, res) => {\n' +
      '  try {\n' +
      '    const user = await User.findById(req.params.id);\n' +
      '    if (!user) return res.status(404).json({ message: \'User not found\' });\n' +
      '    res.json(user);\n' +
      '  } catch (err) {\n' +
      '    res.status(500).json({ message: err.message });\n' +
      '  }\n' +
      '});\n\n' +
      '// 사용자 생성\n' +
      'router.post(\'/users\', async (req, res) => {\n' +
      '  const user = new User({\n' +
      '    name: req.body.name,\n' +
      '    email: req.body.email\n' +
      '  });\n\n' +
      '  try {\n' +
      '    const newUser = await user.save();\n' +
      '    res.status(201).json(newUser);\n' +
      '  } catch (err) {\n' +
      '    res.status(400).json({ message: err.message });\n' +
      '  }\n' +
      '});\n\n' +
      'export default router;\n' +
      '```\n\n' +
      '그리고 메인 app.ts 파일에서 이 라우터를 사용하려면:\n\n' +
      '```typescript\n' +
      'import express from \'express\';\n' +
      'import mongoose from \'mongoose\';\n' +
      'import userRoutes from \'./routes/users\';\n\n' +
      'const app = express();\n' +
      'const port = 3000;\n\n' +
      '// JSON 미들웨어\n' +
      'app.use(express.json());\n\n' +
      '// MongoDB 연결\n' +
      'mongoose.connect(\'mongodb://localhost:27017/myapp\')\n' +
      '  .then(() => console.log(\'MongoDB connected\'))\n' +
      '  .catch(err => console.error(\'MongoDB connection error:\', err));\n\n' +
      '// 라우트 설정\n' +
      'app.use(\'/api\', userRoutes);\n\n' +
      'app.listen(port, () => {\n' +
      '  console.log(`Server running at http://localhost:${port}`);\n' +
      '});\n' +
      '```'
    ));

    // 이제 충분한 메시지가 쌓였으므로 요약 발생해야 함 (자동 요약이 활성화된 경우)
    // 또는 수동으로 요약 요청
    const summaryResult = await mcp.summarizeContext(contextId);
    console.log(`요약 생성 결과: ${summaryResult ? '성공' : '실패'}`);

    // 요약 로드
    const summary = await mcp.loadSummary(contextId);
    console.log('\n요약 내용:');
    console.log('======================================');
    
    if (summary) {
      console.log(`컨텍스트 ID: ${summary.contextId}`);
      console.log(`마지막 업데이트: ${new Date(summary.lastUpdated).toLocaleString()}`);
      console.log(`메시지 수: ${summary.messageCount}`);
      console.log(`요약 버전: ${summary.version}`);
      console.log('\n요약 텍스트:');
      console.log(summary.summary);
      
      console.log('\n코드 블록:');
      summary.codeBlocks.forEach((block, index) => {
        console.log(`\n-- 코드 블록 #${index + 1} --`);
        console.log(`언어: ${block.language || '지정되지 않음'}`);
        console.log(`코드:\n${block.code}`);
      });
    } else {
      console.log('요약이 없습니다.');
    }

    console.log('\n======================================');
    console.log('예제 완료.');
  } catch (error) {
    console.error('오류 발생:', error);
  }
}

// 예제 실행
runExample().catch(console.error); 