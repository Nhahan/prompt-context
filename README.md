# Prompt Context MCP Server

An MCP protocol that helps AI agents efficiently remember and utilize previous conversation context. This protocol tracks conversation history for each file or context, periodically summarizes it, and saves the summaries to enhance the AI agent's contextual understanding.

> *Read this in [Korean](README_KOR.md)*

## Key Features

- **Intelligent Context Memory**: AI agents automatically remember conversation history and recall it when needed
- **Importance-Based Context Retention**: Automatically identifies and preserves important information
- **Automatic Summarization**: Generates context summaries when message count reaches thresholds
- **Context Relationship Tracking**: Connects related conversations using vector similarity and graph relationships to maintain knowledge context
- **API Call Analytics**: Tracks and analyzes API calls to vector and graph databases and LLM services for performance monitoring and optimization

## Usage

### NPX Installation

```json
{
  "mcpServers": {
    "Prompt Context": {
      "command": "npx",
      "args": [
        "-y",
        "prompt-context",
        "--config",
        "{}"
      ]
    }
  }
}
```

### Docker

```bash
docker build -t prompt-context .
```

```json
{
  "mcpServers": {
    "Prompt Context": {
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

## MCP Tool

Provides various tools for managing conversation context and relationships.

**Available Tools:**

*   **`ping`**: Simple ping/pong test to check server connectivity.
    *   *No arguments needed.*

*   **`add_message`**: Add a message (user or assistant) to a specific context. Creates the context if it doesn't exist.
    *   `contextId` (string, required): Unique identifier for the context.
    *   `message` (string, required): Message content to add.
    *   `role` (enum, required): Role of the message sender ('user' or 'assistant').
    *   `importance` (enum, optional, default: 'medium'): Importance level ('low', 'medium', 'high', 'critical').
    *   `tags` (array of strings, optional, default: []): Tags associated with the message.

*   **`retrieve_context`**: Retrieve all messages and the latest summary for a given context ID.
    *   `contextId` (string, required): Unique identifier for the context to retrieve.

*   **`get_similar_contexts`**: Find contexts that are semantically similar to a given query string using vector search.
    *   `query` (string, required): Text to find similar contexts for.
    *   `limit` (number, optional, default: 5): Maximum number of contexts to return.

*   **`add_relationship`**: Add a directed relationship (e.g., similar, continues) between two contexts in the knowledge graph.
    *   `sourceContextId` (string, required): Source context ID.
    *   `targetContextId` (string, required): Target context ID.
    *   `relationshipType` (enum, required): Type of relationship ('similar', 'continues', 'references', 'parent', 'child').
    *   `weight` (number, optional, default: 0.8): Weight of the relationship (0.0 to 1.0).

*   **`get_related_contexts`**: Get a list of context IDs that are related to a specific context, optionally filtering by relationship type and direction.
    *   `contextId` (string, required): Context ID to find related contexts for.
    *   `relationshipType` (enum, optional): Filter by relationship type ('similar', 'continues', 'references', 'parent', 'child').
    *   `direction` (enum, optional, default: 'both'): Direction of relationships ('incoming', 'outgoing', 'both').

*   **`summarize_context`**: Generate or update the summary for a given context ID. Returns the generated summary.
    *   `contextId` (string, required): Context ID to generate summary for.

## Documentation

For more detailed information, please refer to the documentation in the `docs` directory:

- [How It Works](docs/HOW_IT_WORKS.md) - Detailed explanation of the system architecture and technology choices
- [Contributing](docs/CONTRIBUTING.md) - Guidelines for contributing to the project

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
| `useVectorDb` | Enable vector similarity search | true |
| `useGraphDb` | Enable graph-based context relationships | true |
| `similarityThreshold` | Minimum similarity threshold for related contexts | 0.6 |
| `autoCleanupContexts` | Enable automatic cleanup of irrelevant contexts | true |
| `trackApiCalls` | Enable API call tracking and analytics | true |
| `apiAnalyticsRetention` | Number of days to retain API call data | 30 |
| `fallbackToKeywordMatch` | Whether to use keyword matching when vector search fails | true |
| `port` | Port number for the server (if not running in MCP mode) | 6789 |

## Using MCP in Team Environment

When using MCP in a team environment, it's important to consider how context data is managed:

### Git Management Recommendations

By default, MCP saves all context data in the `.prompt-context` directory within your project. In team environments, you should add this directory to your `.gitignore` file to avoid:

1. Bloating your Git repository with conversation context
2. Potential merge conflicts when multiple team members modify context
3. Inadvertently sharing private or sensitive conversations
4. Polluting commit history with context changes

Add the following to your project's `.gitignore` file:

```
# MCP
.prompt-context/
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
