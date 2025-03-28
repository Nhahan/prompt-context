# How Memory Context Protocol (MCP) Works

The Memory Context Protocol (MCP) is designed to provide intelligent and autonomous context management for AI agents. This document explains the internal mechanisms and processes that make MCP work effectively.

## Core Mechanisms

Once configured, the Memory Context Protocol works autonomously with your AI tool:

1. **Intelligent Context Recording**: The AI agent decides when to record context based on importance
2. **File-Level Context**: Each file gets its own dedicated context storage
3. **Adaptive Summarization**: As conversation grows, the MCP automatically creates summaries at optimal points
4. **Hierarchical Memory**: For extensive projects, MCP creates multi-level hierarchical summaries:
   - **Level 1**: Individual file contexts with detailed information
   - **Level 2**: Hierarchical summaries that group related contexts
   - **Level 3**: Meta-summaries that provide project-wide understanding
5. **Importance Analysis**: Messages are analyzed for importance, with critical information retained longer
6. **Relationship Detection**: The MCP automatically detects when different contexts are related and builds connections
7. **Zero User Intervention**: No need for manual context management - it all happens automatically

## Available MCP Tool

### context_memory

Allows AI agents to maintain and retrieve conversation context for different files or topics.

**Inputs:**

- `action` (string): The action to perform - 'add', 'retrieve', 'summarize', 'get_related', 'get_hierarchy', 'get_meta', 'find_similar', 'add_relationship', 'find_path', or 'cleanup'
- `contextId` (string): The identifier for the context (typically a file path or topic name)
- `role` (string, for 'add' action): Role of the message sender ('user' or 'assistant')
- `content` (string, for 'add' action): Content of the message
- `importance` (string, for 'add' action): Importance level ('low', 'medium', 'high', or 'critical')
- `tags` (array of strings, for 'add' action): Tags for message categorization
- `metaId` (string, for 'get_meta' action): Meta-summary ID to retrieve
- `searchText` (string, for 'find_similar' action): Text to search for similar contexts
- `limit` (number, for 'find_similar' action): Maximum number of results to return
- `targetId` (string, for relationship actions): Target context ID for relationship operations
- `relationshipType` (string, for 'add_relationship' action): Type of relationship ('similar', 'continues', 'references', 'parent', 'child')
- `strength` (number, for 'add_relationship' action): Strength of relationship (0-1)

## Technical Implementation

### Hierarchical Context Management

When hierarchical context management is enabled, the MCP organizes context information in a tree structure:

1. **Individual Contexts**: Basic context data for each file or topic
2. **Hierarchical Summaries**: Groups related contexts into hierarchical structures
3. **Meta-Summaries**: Top-level summaries that provide project-wide understanding

This approach allows the AI to quickly navigate between detailed, local context and broad, project-wide understanding.

### Message Importance Analysis

Messages are automatically analyzed for importance based on:

- **Content patterns**: Questions, exclamations, critical terms
- **Length and complexity**: More detailed messages may contain more important information
- **Explicit marking**: Messages can be explicitly marked with importance levels

Higher importance messages are retained longer during summarization and have a stronger influence on hierarchical summaries.

### Relationship Detection

The MCP automatically detects relationships between contexts by:

1. Analyzing semantic similarity between contexts using vector embeddings
2. Identifying shared code blocks or key insights
3. Recognizing references between contexts
4. Building a graph structure with different relationship types

When enough relationships are detected, a hierarchical structure is created to connect related contexts.

### Vector Similarity Search Implementation

MCP implements vector embeddings for semantic search using:

- **Embedding Generation**: Converts context text into vector embeddings using `@xenova/transformers`
- **Efficient Vector Storage**: Uses `hnswlib-node` for fast approximate nearest neighbor search
- **Fallback Mechanism**: Falls back to keyword matching if vector libraries are unavailable

### Graph Database Implementation

The relationship management system uses:

- **Graph Structure**: Maintains a graph of relationships using `graphology` 
- **Relationship Types**: Defines various relationship types (similar, continues, references, parent, child)
- **Path Finding**: Implements algorithms to find paths between related contexts
- **Community Detection**: Identifies clusters of related contexts

### Context Cleanup Process

The automatic context cleanup process:

1. Identifies contexts that are relevant to the current conversation
2. Preserves contexts with high similarity or explicit relationships
3. Maintains the hierarchical structure by preserving parent-child relationships
4. Removes contexts that are unrelated or no longer relevant

### .gitignore Integration

Patterns defined in the `.gitignore` file are automatically loaded and used as ignore patterns. Additionally, the following default patterns are applied:

- node_modules
- .git
- dist
- build
- coverage
- tmp
- *.log
- *.lock
- *.min.*
- *.map 