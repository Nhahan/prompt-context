# How Memory Context Protocol (MCP) Works

The Memory Context Protocol (MCP) is designed to provide intelligent and autonomous context management for AI agents. This document explains the internal mechanisms and processes that make MCP work effectively.

## Core Mechanisms

The Memory Context Protocol operates autonomously with your AI tool through several sophisticated mechanisms:

1. **Intelligent Context Recording**: The MCP records conversations and analyzes the importance of each message, preserving critical information while managing memory efficiently.

2. **File-Level Context**: Each file or topic gets its own dedicated context storage, allowing for granular context management.

3. **Adaptive Summarization**: As conversations grow, the MCP automatically creates summaries at optimal points to maintain memory efficiency without losing important information.

4. **Hierarchical Memory Architecture**: For extensive projects, MCP creates a multi-level hierarchical memory structure:
   - **Level 1**: Individual file contexts with detailed information
   - **Level 2**: Hierarchical summaries that group related contexts
   - **Level 3**: Meta-summaries that provide project-wide understanding

5. **Importance Analysis**: Messages are analyzed for importance using both semantic content and explicit tagging, with critical information retained longer in memory.

6. **Relationship Detection**: The MCP automatically detects when different contexts are related and builds connections using a graph database approach.

7. **Zero User Intervention**: No need for manual context management - it all happens automatically behind the scenes.

## Technical Implementation

### Vector Database System

The vector database functionality is implemented in `VectorRepository` class that uses semantic embedding to enable similarity search between contexts:

1. **Embedding Generation**: Converts context text into vector embeddings using `@xenova/transformers`:
   ```typescript
   const { pipeline } = await import('@xenova/transformers');
   this.embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
   ```

2. **Efficient Vector Storage**: Uses `hnswlib-node` for fast approximate nearest neighbor search:
   ```typescript
   const hnswlib = await import('hnswlib-node');
   this.vectorIndex = new hnswlib.HierarchicalNSW('cosine', this.dimensions);
   ```

3. **Fallback Mechanism**: Includes a `KeywordMatchRepository` that falls back to keyword matching if vector libraries are unavailable:
   ```typescript
   export class KeywordMatchRepository implements VectorRepositoryInterface {
     // Implements the same interface with keyword-based matching
   }
   ```

4. **Vector Index Persistence**: Automatically saves and loads vector indices to/from disk:
   ```typescript
   // Save vector index
   const vectorDir = path.join(this.contextDir, 'vectors');
   const indexPath = path.join(vectorDir, 'vector-index.bin');
   this.vectorIndex.writeIndex(indexPath);
   ```

5. **Similarity Search**: Implements cosine similarity search with customizable thresholds:
   ```typescript
   public async findSimilarContexts(text: string, limit: number = 5): Promise<SimilarContext[]> {
     // Generate embedding for the query text
     const embedding = await this.generateEmbedding(text);
     
     // Search vector index for similar embeddings
     const result = this.vectorIndex.searchKnn(embedding, limit);
     
     // Map results back to context IDs with similarity scores
     // ...
   }
   ```

### Graph Database System

The graph database functionality is implemented in the `GraphRepository` class, providing relationship management between contexts:

1. **Graph Structure**: Maintains a graph of relationships using a custom implementation with potential integration with `graphology`:
   ```typescript
   export class GraphRepository implements GraphRepositoryInterface {
     private edges: ContextEdge[] = [];
     // ...
   }
   ```

2. **Relationship Types**: Defines various relationship types in the `ContextRelationshipType` enum:
   ```typescript
   export enum ContextRelationshipType {
     SIMILAR = 'similar',     // Contexts with similar content
     CONTINUES = 'continues', // Context continues from another
     REFERENCES = 'references', // One context references another
     PARENT = 'parent',       // Hierarchical parent relationship
     CHILD = 'child'          // Hierarchical child relationship
   }
   ```

3. **Path Finding**: Implements algorithms to find paths between related contexts:
   ```typescript
   public async findPath(sourceId: string, targetId: string): Promise<string[]> {
     // Attempt to use graphology if available
     try {
       const graphology = await import('graphology');
       const { dijkstra } = await import('graphology-shortest-path');
       // Use optimized graph algorithms
     } catch {
       // Fall back to basic BFS implementation
       return this.findPathBasic(sourceId, targetId);
     }
   }
   ```

4. **Relationship Strength**: Supports weighted relationships to represent the strength of connections:
   ```typescript
   public async addRelationship(
     source: string,
     target: string,
     type: ContextRelationshipType,
     weight: number,
     metadata?: any
   ): Promise<void> {
     // Add or update edge with weight information
   }
   ```

5. **Persistence**: Automatically saves and loads the graph structure to/from disk:
   ```typescript
   private async saveGraph(): Promise<void> {
     await fs.writeJson(this.graphPath, { edges: this.edges });
   }
   ```

### Hierarchical Context Management

The hierarchical context management system organizes information in multiple levels:

1. **Individual Contexts**: Basic context data for each file or topic stored in the repository:
   ```typescript
   public async saveContextData(contextId: string, data: ContextData): Promise<void> {
     // Save individual context data
   }
   ```

2. **Hierarchical Summaries**: Groups related contexts into hierarchical structures:
   ```typescript
   public async createHierarchicalSummary(contextIds: string[]): Promise<HierarchicalSummary> {
     // Create a summary that encompasses multiple related contexts
   }
   ```

3. **Meta-Summaries**: Top-level summaries that provide project-wide understanding:
   ```typescript
   public async createMetaSummary(hierarchicalIds: string[]): Promise<MetaSummary> {
     // Create a meta-summary from multiple hierarchical summaries
   }
   ```

### Message Importance Analysis

Messages are automatically analyzed for importance based on multiple factors:

1. **Content Analysis**: Analyzes message content for key indicators of importance:
   ```typescript
   private analyzeImportance(message: Message): ContextImportance {
     // Analyze message content for importance indicators
     // Check for questions, code blocks, decisions, etc.
   }
   ```

2. **Explicit Tagging**: Supports explicit importance levels through the `ContextImportance` enum:
   ```typescript
   export enum ContextImportance {
     LOW = 'low',
     MEDIUM = 'medium',
     HIGH = 'high',
     CRITICAL = 'critical'
   }
   ```

3. **Importance-Based Retention**: Higher importance messages are retained longer during summarization:
   ```typescript
   public async createSummary(messages: Message[]): Promise<string> {
     // Prioritize high importance messages in summaries
   }
   ```

### Automatic Relationship Detection

The MCP automatically detects relationships between contexts through multiple methods:

1. **Vector Similarity**: Uses vector embeddings to detect semantically similar contexts:
   ```typescript
   // Find similar contexts based on vector similarity
   const similarContexts = await this.vectorRepository.findSimilarContexts(
     summary.summary,
     this.config.maxSimilarContexts
   );
   ```

2. **Content References**: Detects explicit references between contexts:
   ```typescript
   private detectReferences(content: string, allContextIds: string[]): string[] {
     // Detect mentions of other context IDs in the content
   }
   ```

3. **Relationship Graph Construction**: Creates a graph of related contexts:
   ```typescript
   // Add relationship between contexts
   await this.graphRepository.addRelationship(
     sourceId,
     targetId,
     type,
     strength
   );
   ```

### Context Cleanup Process

The automatic context cleanup process removes irrelevant contexts:

1. **Relevance Analysis**: Identifies contexts that are relevant to the current conversation:
   ```typescript
   public async cleanupIrrelevantContexts(currentContextId: string): Promise<void> {
     // Find contexts similar to current context
     const similarContexts = await this.findSimilarContexts(currentContextId);
     
     // Get directly related contexts from graph
     const relatedContexts = this.graphRepository 
       ? await this.graphRepository.getRelatedContexts(currentContextId)
       : [];
     
     // Combine all relevant contexts
     const relevantContextIds = new Set([
       currentContextId,
       ...similarContexts.map(c => c.id),
       ...relatedContexts
     ]);
     
     // Remove irrelevant contexts
     // ...
   }
   ```

2. **Preservation Rules**: Applies rules to determine which contexts to preserve:
   - Contexts with high similarity scores are preserved
   - Contexts with explicit relationships are preserved
   - Contexts in the current hierarchical structure are preserved
   - Recent contexts are preserved regardless of similarity

3. **Cleanup Implementation**: Removes contexts that don't meet preservation criteria:
   ```typescript
   // Remove contexts that aren't relevant
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

## MCP Server and API Integration

The MCP exposes its functionality through a RESTful API server that provides various endpoints:

1. **Core Endpoints**:
   - `/add` - Add a message to a context
   - `/retrieve` - Retrieve context messages or summary
   - `/summarize` - Generate or retrieve a summary for a context

2. **Vector and Graph Functionality**:
   - `/find_similar` - Find contexts with similar content
   - `/add_relationship` - Add a relationship between contexts
   - `/find_path` - Find a path between related contexts
   - `/cleanup` - Clean up irrelevant contexts

3. **Hierarchical Management**:
   - `/get_hierarchical` - Get hierarchical summary
   - `/get_meta` - Get meta-summary

## Extensibility and Customization

The MCP is designed to be extensible and customizable through:

1. **Configuration Options**: Extensive configuration options in the `MCPConfig` interface:
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

2. **Pluggable Components**: The architecture supports alternative implementations:
   - The vector repository can be replaced with different vector database implementations
   - The graph repository can be replaced with different graph database implementations
   - The summarizer can be replaced with custom summarization logic

3. **Graceful Degradation**: Features automatically fall back to simpler implementations if dependencies are unavailable:
   ```typescript
   try {
     // Try to use advanced features
   } catch (error) {
     // Fall back to basic functionality
     this.fallbackMode = true;
   }
   ```

## .gitignore Integration

The MCP automatically respects `.gitignore` patterns when scanning directories:

1. **Ignore Pattern Loading**: Loads patterns from `.gitignore` files:
   ```typescript
   private async loadIgnorePatterns(): Promise<string[]> {
     // Load .gitignore patterns
   }
   ```

2. **Default Patterns**: Applies default patterns for common excluded directories:
   ```typescript
   const defaultPatterns = [
     'node_modules', '.git', 'dist', 'build', 'coverage',
     'tmp', '*.log', '*.lock', '*.min.*', '*.map'
   ];
   ```

3. **Pattern Matching**: Uses efficient pattern matching to ignore files:
   ```typescript
   public async shouldIgnore(filePath: string): Promise<boolean> {
     // Check if file matches any ignore patterns
   }
   ```

By combining these technologies and approaches, the Memory Context Protocol provides a sophisticated and autonomous context management system that helps AI agents maintain coherent, context-aware interactions across complex projects. 