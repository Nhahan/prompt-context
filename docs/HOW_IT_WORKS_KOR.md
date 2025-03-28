# Memory Context Protocol (MCP)의 작동 방식

Memory Context Protocol (MCP)은 AI 에이전트를 위한 지능적이고 자율적인 컨텍스트 관리를 제공하도록 설계되었습니다. 이 문서는 MCP가 효과적으로 작동하는 내부 메커니즘과 프로세스를 설명합니다.

## 핵심 메커니즘

Memory Context Protocol은 다음과 같은 정교한 메커니즘을 통해 AI 도구와 자율적으로 작동합니다:

1. **지능적 컨텍스트 기록**: MCP는 대화를 기록하고 각 메시지의 중요도를 분석하여 중요한 정보를 보존하면서 메모리를 효율적으로 관리합니다.

2. **파일 수준 컨텍스트**: 각 파일이나 주제는 자체 전용 컨텍스트 저장소를 갖추어 세분화된 컨텍스트 관리가 가능합니다.

3. **적응형 요약**: 대화가 증가함에 따라 MCP는 중요한 정보를 잃지 않으면서 메모리 효율성을 유지하기 위해 최적의 시점에 자동으로 요약을 생성합니다.

4. **계층적 메모리 아키텍처**: 대규모 프로젝트의 경우, MCP는 다음과 같은 다단계 계층적 메모리 구조를 생성합니다:
   - **레벨 1**: 상세한 정보가 있는 개별 파일 컨텍스트
   - **레벨 2**: 관련 컨텍스트를 그룹화하는 계층적 요약
   - **레벨 3**: 프로젝트 전반의 이해를 제공하는 메타 요약

5. **중요도 분석**: 메시지는 의미적 내용과 명시적 태그 지정을 모두 사용하여 중요도가 분석되며, 중요한 정보는 메모리에 더 오래 유지됩니다.

6. **관계 감지**: MCP는 서로 다른 컨텍스트가 관련되어 있을 때 자동으로 감지하고 그래프 데이터베이스 접근 방식을 사용하여 연결을 구축합니다.

7. **사용자 개입 불필요**: 수동 컨텍스트 관리가 필요 없이 모든 것이 자동으로 백그라운드에서 처리됩니다.

## 기술 구현

### 벡터 데이터베이스 시스템

벡터 데이터베이스 기능은 `VectorRepository` 클래스에 구현되어 있으며, 의미적 임베딩을 사용하여 컨텍스트 간의 유사성 검색을 가능하게 합니다:

1. **임베딩 생성**: `@xenova/transformers`를 사용하여 컨텍스트 텍스트를 벡터 임베딩으로 변환합니다:
   ```typescript
   const { pipeline } = await import('@xenova/transformers');
   this.embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
   ```

2. **효율적인 벡터 저장**: 빠른 근사 최근접 이웃 검색을 위해 `hnswlib-node`를 사용합니다:
   ```typescript
   const hnswlib = await import('hnswlib-node');
   this.vectorIndex = new hnswlib.HierarchicalNSW('cosine', this.dimensions);
   ```

3. **대체 메커니즘**: 벡터 라이브러리를 사용할 수 없는 경우 키워드 매칭으로 대체하는 `KeywordMatchRepository`를 포함합니다:
   ```typescript
   export class KeywordMatchRepository implements VectorRepositoryInterface {
     // 키워드 기반 매칭으로 동일한 인터페이스 구현
   }
   ```

4. **벡터 인덱스 지속성**: 벡터 인덱스를 자동으로 디스크에 저장하고 로드합니다:
   ```typescript
   // 벡터 인덱스 저장
   const vectorDir = path.join(this.contextDir, 'vectors');
   const indexPath = path.join(vectorDir, 'vector-index.bin');
   this.vectorIndex.writeIndex(indexPath);
   ```

5. **유사성 검색**: 사용자 정의 가능한 임계값으로 코사인 유사성 검색을 구현합니다:
   ```typescript
   public async findSimilarContexts(text: string, limit: number = 5): Promise<SimilarContext[]> {
     // 쿼리 텍스트에 대한 임베딩 생성
     const embedding = await this.generateEmbedding(text);
     
     // 유사한 임베딩을 위해 벡터 인덱스 검색
     const result = this.vectorIndex.searchKnn(embedding, limit);
     
     // 결과를 컨텍스트 ID와 유사성 점수로 매핑
     // ...
   }
   ```

### 그래프 데이터베이스 시스템

그래프 데이터베이스 기능은 `GraphRepository` 클래스에 구현되어 컨텍스트 간의 관계 관리를 제공합니다:

1. **그래프 구조**: `graphology`와의 잠재적 통합과 함께 사용자 정의 구현을 사용하여 관계 그래프를 유지합니다:
   ```typescript
   export class GraphRepository implements GraphRepositoryInterface {
     private edges: ContextEdge[] = [];
     // ...
   }
   ```

2. **관계 유형**: `ContextRelationshipType` 열거형에서 다양한 관계 유형을 정의합니다:
   ```typescript
   export enum ContextRelationshipType {
     SIMILAR = 'similar',     // 유사한 내용을 가진 컨텍스트
     CONTINUES = 'continues', // 다른 컨텍스트에서 계속되는 컨텍스트
     REFERENCES = 'references', // 하나의 컨텍스트가 다른 컨텍스트를 참조
     PARENT = 'parent',       // 계층적 부모 관계
     CHILD = 'child'          // 계층적 자식 관계
   }
   ```

3. **경로 찾기**: 관련 컨텍스트 간의 경로를 찾는 알고리즘을 구현합니다:
   ```typescript
   public async findPath(sourceId: string, targetId: string): Promise<string[]> {
     // 가능한 경우 graphology 사용
     try {
       const graphology = await import('graphology');
       const { dijkstra } = await import('graphology-shortest-path');
       // 최적화된 그래프 알고리즘 사용
     } catch {
       // 기본 BFS 구현으로 대체
       return this.findPathBasic(sourceId, targetId);
     }
   }
   ```

4. **관계 강도**: 연결 강도를 나타내기 위한 가중치 관계를 지원합니다:
   ```typescript
   public async addRelationship(
     source: string,
     target: string,
     type: ContextRelationshipType,
     weight: number,
     metadata?: any
   ): Promise<void> {
     // 가중치 정보가 있는 엣지 추가 또는 업데이트
   }
   ```

5. **지속성**: 그래프 구조를 자동으로 디스크에 저장하고 로드합니다:
   ```typescript
   private async saveGraph(): Promise<void> {
     await fs.writeJson(this.graphPath, { edges: this.edges });
   }
   ```

### 계층적 컨텍스트 관리

계층적 컨텍스트 관리 시스템은 정보를 여러 레벨로 구성합니다:

1. **개별 컨텍스트**: 저장소에 저장된 각 파일이나 주제에 대한 기본 컨텍스트 데이터:
   ```typescript
   public async saveContextData(contextId: string, data: ContextData): Promise<void> {
     // 개별 컨텍스트 데이터 저장
   }
   ```

2. **계층적 요약**: 관련 컨텍스트를 계층적 구조로 그룹화합니다:
   ```typescript
   public async createHierarchicalSummary(contextIds: string[]): Promise<HierarchicalSummary> {
     // 여러 관련 컨텍스트를 포함하는 요약 생성
   }
   ```

3. **메타 요약**: 프로젝트 전반적인 이해를 제공하는 최상위 요약:
   ```typescript
   public async createMetaSummary(hierarchicalIds: string[]): Promise<MetaSummary> {
     // 여러 계층적 요약에서 메타 요약 생성
   }
   ```

### 메시지 중요도 분석

메시지는 여러 요소를 기반으로 자동으로 중요도가 분석됩니다:

1. **내용 분석**: 중요도 지표에 대한 메시지 내용을 분석합니다:
   ```typescript
   private analyzeImportance(message: Message): ContextImportance {
     // 중요도 지표에 대한 메시지 내용 분석
     // 질문, 코드 블록, 결정 등 확인
   }
   ```

2. **명시적 태그 지정**: `ContextImportance` 열거형을 통해 명시적 중요도 수준을 지원합니다:
   ```typescript
   export enum ContextImportance {
     LOW = 'low',
     MEDIUM = 'medium',
     HIGH = 'high',
     CRITICAL = 'critical'
   }
   ```

3. **중요도 기반 보존**: 중요도가 높은 메시지는 요약 중에 더 오래 보존됩니다:
   ```typescript
   public async createSummary(messages: Message[]): Promise<string> {
     // 요약에서 높은 중요도 메시지 우선 처리
   }
   ```

### 자동 관계 감지

MCP는 여러 방법을 통해 컨텍스트 간의 관계를 자동으로 감지합니다:

1. **벡터 유사성**: 벡터 임베딩을 사용하여 의미적으로 유사한 컨텍스트를 감지합니다:
   ```typescript
   // 벡터 유사성을 기반으로 유사한 컨텍스트 찾기
   const similarContexts = await this.vectorRepository.findSimilarContexts(
     summary.summary,
     this.config.maxSimilarContexts
   );
   ```

2. **내용 참조**: 컨텍스트 간의 명시적 참조를 감지합니다:
   ```typescript
   private detectReferences(content: string, allContextIds: string[]): string[] {
     // 콘텐츠에서 다른 컨텍스트 ID의 언급 감지
   }
   ```

3. **관계 그래프 구축**: 관련 컨텍스트의 그래프를 생성합니다:
   ```typescript
   // 컨텍스트 간의 관계 추가
   await this.graphRepository.addRelationship(
     sourceId,
     targetId,
     type,
     strength
   );
   ```

### 컨텍스트 정리 프로세스

자동 컨텍스트 정리 프로세스는 관련 없는 컨텍스트를 제거합니다:

1. **관련성 분석**: 현재 대화와 관련이 있는 컨텍스트를 식별합니다:
   ```typescript
   public async cleanupIrrelevantContexts(currentContextId: string): Promise<void> {
     // 현재 컨텍스트와 유사한 컨텍스트 찾기
     const similarContexts = await this.findSimilarContexts(currentContextId);
     
     // 그래프에서 직접 관련된 컨텍스트 가져오기
     const relatedContexts = this.graphRepository 
       ? await this.graphRepository.getRelatedContexts(currentContextId)
       : [];
     
     // 모든 관련 컨텍스트 결합
     const relevantContextIds = new Set([
       currentContextId,
       ...similarContexts.map(c => c.id),
       ...relatedContexts
     ]);
     
     // 관련 없는 컨텍스트 제거
     // ...
   }
   ```

2. **보존 규칙**: 어떤 컨텍스트를 보존할지 결정하는 규칙을 적용합니다:
   - 유사성 점수가 높은 컨텍스트는 보존됩니다
   - 명시적 관계가 있는 컨텍스트는 보존됩니다
   - 현재 계층적 구조에 있는 컨텍스트는 보존됩니다
   - 최근 컨텍스트는 유사성에 관계없이 보존됩니다

3. **정리 구현**: 보존 기준을 충족하지 않는 컨텍스트를 제거합니다:
   ```typescript
   // 관련이 없는 컨텍스트 제거
   for (const contextId of allContextIds) {
     if (!relevantContextIds.has(contextId)) {
       await this.repository.deleteContext(contextId);
       if (this.vectorRepository) {
         await this.vectorRepository.deleteContext(contextId);
       }
       if (this.graphRepository) {
         await this.graphRepository.removeContext(contextId);
       }
     }
   }
   ```

## MCP 서버 및 API 통합

MCP는 다양한 엔드포인트를 제공하는 RESTful API 서버를 통해 기능을 노출합니다:

1. **핵심 엔드포인트**:
   - `/add` - 컨텍스트에 메시지 추가
   - `/retrieve` - 컨텍스트 메시지 또는 요약 검색
   - `/summarize` - 컨텍스트에 대한 요약 생성 또는 검색

2. **벡터 및 그래프 기능**:
   - `/find_similar` - 유사한 내용이 있는 컨텍스트 찾기
   - `/add_relationship` - 컨텍스트 간의 관계 추가
   - `/find_path` - 관련 컨텍스트 간의 경로 찾기
   - `/cleanup` - 관련 없는 컨텍스트 정리

3. **계층적 관리**:
   - `/get_hierarchical` - 계층적 요약 가져오기
   - `/get_meta` - 메타 요약 가져오기

## 확장성 및 사용자 정의

MCP는 다음을 통해 확장 가능하고 사용자 정의가 가능하도록 설계되었습니다:

1. **구성 옵션**: `MCPConfig` 인터페이스의 광범위한 구성 옵션:
   ```typescript
   export interface MCPConfig {
     contextDir: string;
     maxContextMessages: number;
     maxTokensPerContext: number;
     useGit: boolean;
     gitAuthor: { name: string; email: string };
     autoSummarize: boolean;
     summarizeThreshold: number;
     useVectorDb: boolean;
     useGraphDb: boolean;
     similarityThreshold: number;
     maxSimilarContexts: number;
     createHierarchicalSummaries: boolean;
     autoCleanupContexts: boolean;
   }
   ```

2. **플러그형 컴포넌트**: 아키텍처는 대체 구현을 지원합니다:
   - 벡터 저장소는 다른 벡터 데이터베이스 구현으로 대체할 수 있습니다
   - 그래프 저장소는 다른 그래프 데이터베이스 구현으로 대체할 수 있습니다
   - 요약 생성기는 사용자 정의 요약 로직으로 대체할 수 있습니다

3. **우아한 성능 저하**: 종속성을 사용할 수 없는 경우 기능이 자동으로 더 간단한 구현으로 대체됩니다:
   ```typescript
   try {
     // 고급 기능 사용 시도
   } catch (error) {
     // 기본 기능으로 대체
     this.fallbackMode = true;
   }
   ```

## .gitignore 통합

MCP는 디렉토리를 스캔할 때 `.gitignore` 패턴을 자동으로 존중합니다:

1. **무시 패턴 로딩**: `.gitignore` 파일에서 패턴을 로드합니다:
   ```typescript
   private async loadIgnorePatterns(): Promise<string[]> {
     // .gitignore 패턴 로드
   }
   ```

2. **기본 패턴**: 일반적으로 제외되는 디렉토리에 대한 기본 패턴을 적용합니다:
   ```typescript
   const defaultPatterns = [
     'node_modules', '.git', 'dist', 'build', 'coverage',
     'tmp', '*.log', '*.lock', '*.min.*', '*.map'
   ];
   ```

3. **패턴 매칭**: 파일을 무시하기 위해 효율적인 패턴 매칭을 사용합니다:
   ```typescript
   public async shouldIgnore(filePath: string): Promise<boolean> {
     // 파일이 무시 패턴과 일치하는지 확인
   }
   ```

이러한 기술과 접근 방식을 결합하여 Memory Context Protocol은 AI 에이전트가 복잡한 프로젝트에서 일관된 컨텍스트 인식 상호 작용을 유지하는 데 도움이 되는 정교하고 자율적인 컨텍스트 관리 시스템을 제공합니다. 