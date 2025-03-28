# Memory Context Protocol (MCP) for AI Agents

`prompt-context` is a TypeScript library that helps AI agents efficiently remember and utilize previous conversation context. This protocol tracks conversation history for each file or context, periodically summarizes it, and saves the summaries to enhance the AI agent's contextual understanding.

*Read this in [Korean](README_KOR.md)*

## Key Features

- **Intelligent Context Management**: AI agents can autonomously record and retrieve conversation context as needed
- **Context-based Memory Management**: Organize conversations separately by file or topic
- **Automatic Summary Generation**: Automatically generate summaries when message count or token count reaches thresholds
- **Hierarchical Summarization**: Maintains both detailed context and high-level summaries for efficient memory usage
- **Importance-Based Retention**: Identifies and retains critical information based on intelligent importance analysis
- **Related Context Detection**: Automatically detects and links related contexts for comprehensive understanding
- **Meta Summaries**: Creates project-wide meta-summaries that connect related hierarchies of information
- **Code Block Preservation**: Preserve code blocks in summaries to maintain important information
- **Git Integration**: Manage summary files with Git for version control
- **Zero Configuration**: Simply add the MCP to your AI tool configuration and it works automatically
- **Vector Similarity Search**: Finds semantically similar conversations across different contexts
- **Graph-based Relationships**: Maintains a knowledge graph connecting related conversations
- **Autonomous Operation**: Cleans up irrelevant contexts automatically

## Installation

> **Note:** This package is currently in beta. You can install the beta version using the `@beta` tag.

```bash
# Global installation
npm install -g prompt-context@beta
```

## MCP Server Usage

This library is designed to be used as an MCP (Model Context Protocol) server with AI tools like Claude, Cursor, etc. The AI agent will autonomously manage context through the MCP when needed.

### Using with Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "prompt-context": {
      "command": "npx",
      "args": [
        "-y",
        "prompt-context-mcp"
      ]
    }
  }
}
```

### Using with Cursor Editor

To use the Memory Context Protocol with Cursor:

1. Install the package globally:
```bash
npm install -g prompt-context@beta
```

2. Create a `.cursor/mcps.json` file in your home directory:
```bash
mkdir -p ~/.cursor && touch ~/.cursor/mcps.json
```

3. Add the following configuration to the `.cursor/mcps.json` file:
```json
{
  "prompt-context": {
    "command": "npx",
    "args": [
      "prompt-context-mcp"
    ]
  }
}
```

4. Restart Cursor to apply the changes.

5. To enable the MCP for a specific project, create a `.cursor-settings.json` file in your project root with:
```json
{
  "mcps": [
    "prompt-context"
  ]
}
```

This will allow Cursor to maintain context across your coding sessions, with automatic summarization based on your configuration.

### Using with Docker

```json
{
  "mcpServers": {
    "prompt-context": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "prompt-context"
      ]
    }
  }
}
```

### Available MCP Tool

#### context_memory

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

## Advanced Features

### Vector Similarity Search

MCP uses vector embeddings to find semantically similar contexts, allowing AI agents to:

- Find contexts that discuss similar topics, even with different wording
- Automatically detect relationships between conversations
- Create a more coherent knowledge structure
- Clean up irrelevant contexts to maintain focus

Example of using similarity search:

```javascript
// Find contexts similar to a query
const response = await fetch('http://localhost:3000/similar?text=machine learning&limit=5');
const { similarContexts } = await response.json();
```

Or through the MCP tool:

```json
{
  "action": "find_similar",
  "contextId": "current-context",
  "searchText": "transformer models for natural language processing",
  "limit": 5
}
```

### Graph-based Relationships

MCP maintains a graph structure of context relationships, with different relationship types:

- **similar**: Contexts that discuss similar topics
- **continues**: One context continues the topic from another
- **references**: One context explicitly references another
- **parent/child**: Hierarchical relationship between contexts

This allows more sophisticated context navigation and retrieval, such as:

```javascript
// Add a relationship between contexts
await fetch('http://localhost:3000/tools/context_memory', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'add_relationship',
    contextId: 'context-1',
    targetId: 'context-2',
    relationshipType: 'similar',
    strength: 0.8
  })
});

// Find a path between contexts
const response = await fetch('http://localhost:3000/tools/context_memory', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'find_path',
    contextId: 'context-1',
    targetId: 'context-3'
  })
});
```

### Automatic Context Cleanup

MCP can automatically remove irrelevant contexts to maintain a focused and manageable context space:

```javascript
// Trigger cleanup relative to the current context
await fetch('http://localhost:3000/tools/context_memory', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'cleanup',
    contextId: 'current-context'
  })
});
```

The cleanup process:
1. Identifies contexts that are relevant to the current conversation
2. Preserves contexts with high similarity or explicit relationships
3. Maintains the hierarchical structure by preserving parent-child relationships
4. Removes contexts that are unrelated or no longer relevant

## Configuration

The MCP comes with reasonable defaults and works with zero configuration. However, if needed, you can initialize and configure the MCP:

```bash
# Initialize MCP in current directory (creates .mcp-config.json)
npx prompt-context init

# View current configuration
npx prompt-context config

# Update a specific setting
npx prompt-context config hierarchicalContext true
```

### Configuration Options

The MCP server recognizes these configuration options:

| Option | Description | Default |
|------|------|--------|
| `messageLimitThreshold` | Message count threshold to trigger summary | 10 |
| `tokenLimitPercentage` | Token count threshold as percentage of model limit | 80 |
| `contextDir` | Context storage directory | '.prompt-context' |
| `useGit` | Whether to use Git repository | true |
| `ignorePatterns` | Patterns for files and directories to ignore | [] |
| `autoSummarize` | Whether to enable automatic summarization | true |
| `hierarchicalContext` | Enable hierarchical context management | true |
| `metaSummaryThreshold` | Number of contexts before creating a meta-summary | 5 |
| `maxHierarchyDepth` | Maximum hierarchical depth for meta-summaries | 3 |
| `useVectorDb` | Enable vector database for similarity search | true |
| `useGraphDb` | Enable graph database for context relationships | true |
| `similarityThreshold` | Threshold for automatic relationship detection | 0.6 |
| `autoCleanupContexts` | Automatically clean up irrelevant contexts | true |

The `tokenLimitPercentage` of 80% serves as a guideline rather than a rigid limit. The AI agent intelligently decides when to store context based on relevance and importance, while using this threshold to prevent context windows from becoming too large.

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

## Contributing

Interested in contributing to the Memory Context Protocol? Please see our [contributing guidelines](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
