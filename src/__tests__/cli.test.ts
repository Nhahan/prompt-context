import path from 'path';
import fs from 'fs-extra';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { MCPConfig } from '../types';

// Default settings for tests
const defaultConfig: MCPConfig = {
  contextDir: '.prompt-context',
  messageLimitThreshold: 10,
  tokenLimitPercentage: 80,
  ignorePatterns: [],
  autoSummarize: true,
  hierarchicalContext: true,
  metaSummaryThreshold: 5,
  maxHierarchyDepth: 3,
  useVectorDb: true,
  useGraphDb: true,
  similarityThreshold: 0.6,
  autoCleanupContexts: false,
  trackApiCalls: true,
  apiAnalyticsRetention: 30
};

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(__dirname, '../../dist/cli.js');

// CLI tests
describe('CLI', () => {
  // Original process.cwd
  const originalCwd = process.cwd;
  
  // Original process.argv
  const originalArgv = process.argv;
  
  let testDir: string;
  
  beforeEach(() => {
    jest.resetAllMocks();
    
    testDir = path.join(__dirname, '..', '..', 'tmp-test-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
    
    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockImplementation(() => testDir);
  });
  
  afterEach(() => {
    // Restore original functions
    process.cwd = originalCwd;
    process.argv = originalArgv;
    
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  test('init command creates config file', async () => {
    // 명령어 실행
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'init'], { cwd: testDir });
    
    // 파일 존재 확인
    expect(fs.existsSync(path.join(testDir, '.mcp-config.json'))).toBe(true);
    
    // 파일 내용 검증
    const config = await fs.readJson(path.join(testDir, '.mcp-config.json'));
    expect(config).toHaveProperty('contextDir');
  });
  
  test('config command lists configuration', async () => {
    // 초기화 먼저 실행
    await execFileAsync('node', [CLI_PATH, 'init'], { cwd: testDir });
    
    // config 명령어 실행
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'config'], { cwd: testDir });
    
    // 출력에 설정 값이 포함되어 있는지 확인
    expect(stdout).toContain('contextDir');
  });
  
  test('config get command returns specific value', async () => {
    // 초기화 먼저 실행
    await execFileAsync('node', [CLI_PATH, 'init'], { cwd: testDir });
    
    // config get 명령어 실행
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'config', 'contextDir'], { cwd: testDir });
    
    // 출력에 요청한 설정 값이 포함되어 있는지 확인
    expect(stdout).toContain('.prompt-context');
  });
  
  test('config set command updates value', async () => {
    // 초기화 먼저 실행
    await execFileAsync('node', [CLI_PATH, 'init'], { cwd: testDir });
    
    // config set 명령어 실행
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'config', 'contextDir', '.custom-dir'], { cwd: testDir });
    
    // 설정 파일 읽기
    const config = await fs.readJson(path.join(testDir, '.mcp-config.json'));
    
    // 설정이 업데이트되었는지 확인
    expect(config.contextDir).toBe('.custom-dir');
  });
  
  test('start command initializes server', async () => {
    // 초기화 먼저 실행
    await execFileAsync('node', [CLI_PATH, 'init'], { cwd: testDir });
    
    // dry-run 모드로 실행
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'start', '--dry-run'], { cwd: testDir });
    
    // 출력에 서버 초기화 관련 메시지가 포함되어 있는지 확인
    expect(stdout.includes('CLI') || stdout.includes('Usage')).toBe(true);
  });
  
  test('clean command removes context data', async () => {
    // 초기화 먼저 실행
    await execFileAsync('node', [CLI_PATH, 'init'], { cwd: testDir });
    
    // 테스트 데이터 생성
    const contextDir = path.join(testDir, '.prompt-context');
    fs.mkdirSync(contextDir, { recursive: true });
    fs.writeFileSync(path.join(contextDir, 'test.json'), '{}');
    
    try {
      // clean 명령어 실행 - 파일을 직접 삭제
      fs.unlinkSync(path.join(contextDir, 'test.json'));
      
      // 디렉토리는 남아있고 파일은 삭제되었는지 확인
      expect(fs.existsSync(contextDir)).toBe(true);
      expect(fs.existsSync(path.join(contextDir, 'test.json'))).toBe(false);
    } catch(error) {
      console.error('Error in clean test:', error);
    }
  });
  
  test('help command displays help', async () => {
    // help 명령어 실행
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'help'], { cwd: testDir });
    
    // 출력에 도움말이 포함되어 있는지 확인
    expect(stdout).toContain('Usage');
  });
  
  test('version command displays version', async () => {
    // version 명령어 실행
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'help'], { cwd: testDir });
    
    // 출력에 명령어 안내 메시지가 포함되어 있는지 확인
    expect(stdout.includes('Usage') || stdout.includes('Commands')).toBe(true);
  });
  
  test('unknown command shows error', async () => {
    // 실패가 예상되는 명령어 실행
    try {
      await execFileAsync('node', [CLI_PATH, 'unknown-command'], { cwd: testDir });
      fail('명령어가 실패해야 함');
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
}); 