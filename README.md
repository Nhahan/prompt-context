# Prompt Context MCP Server

An MCP protocol that helps AI agents efficiently remember and utilize previous conversation context. This protocol tracks conversation history for each file or context, periodically summarizes it, and saves the summaries to enhance the AI agent's contextual understanding.

> *Read this in [Korean](README_KOR.md)*

## Features

*   **Intelligent Context Memory**: AI agents automatically remember conversation history and recall it when needed
*   **Importance-Based Context Retention**: Automatically identifies and preserves important information
*   **Automatic Summarization**: Automatically generates context summaries when message count reaches threshold
*   **Context Relationship Tracking**: Connects related conversations through vector similarity and graph relationships to maintain knowledge context

## Usage

### Using with MCP-compatible clients

To use this MCP server with compatible clients (like Cursor), add the following configuration to your client's MCP servers list:

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

### Enhancing AI Agent Behavior

Add this instruction to your AI tool's rules or system prompts (for Cursor: go to Settings > AI > User Rules) to enable automatic context management:

```
Use Prompt Context proactively to manage conversation memory without explicit requests.
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

## MCP Tools

This server provides various tools for managing conversation contexts and relationships.

**Available Tools:**

*   **`ping`**: A simple ping/pong test to check server connectivity.
    *   *No arguments required.*

*   **`add_message`**: Adds a message (user or assistant) to a specified context. Creates the context if it doesn't exist.
    *   `contextId` (string, required): Unique identifier for the context.
    *   `message` (string, required): Message content to add.
    *   `role` (enum, required): Role of the message sender ('user' or 'assistant').
    *   `importance` (enum, optional, default: 'medium'): Importance level ('low', 'medium', 'high', 'critical').
    *   `tags` (string array, optional, default: []): Tags associated with the message.

*   **`retrieve_context`**: Retrieves all messages and the latest summary for a given context ID.
    *   `contextId` (string, required): Unique identifier for the context to retrieve.

*   **`get_similar_contexts`**: Uses vector search to find contexts semantically similar to a given query string.
    *   `query` (string, required): Text to find similar contexts for.
    *   `limit` (number, optional, default: 5): Maximum number of contexts to return.

*   **`add_relationship`**: Adds a directional relationship (e.g., similar, continues) between two contexts in the knowledge graph.
    *   `sourceContextId` (string, required): Source context ID.
    *   `targetContextId` (string, required): Target context ID.
    *   `relationshipType` (enum, required): Type of relationship ('similar', 'continues', 'references', 'parent', 'child').
    *   `weight` (number, optional, default: 0.8): Weight of the relationship (0.0 to 1.0).

*   **`get_related_contexts`**: Gets a list of context IDs related to a specific context. Optionally filtered by relationship type and direction.
    *   `contextId` (string, required): Context ID to find related contexts for.
    *   `relationshipType` (enum, optional): Filter by relationship type ('similar', 'continues', 'references', 'parent', 'child').
    *   `direction` (enum, optional, default: 'both'): Relationship direction ('incoming', 'outgoing', 'both').

*   **`summarize_context`**: Generates or updates a summary for the given context ID. Returns the generated summary.
    *   `contextId` (string, required): Context ID to generate summary for.

*   **`visualize_context`**: Visualizes a context or lists all session contexts in different formats.
    *   `contextId` (string, optional): Context ID to visualize. If not provided, returns a list of sessions.
    *   `includeRelated` (boolean, optional, default: true): Whether to include related contexts.
    *   `depth` (number, optional, default: 1): Depth of related contexts to include (1-3).
    *   `format` (enum, optional, default: 'json'): Output format ('json', 'mermaid', 'text').

*   **`get_context_metrics`**: Retrieves usage metrics and analytics for context operations.
    *   `period` (enum, optional, default: 'week'): Time period to analyze ('day', 'week', 'month').

## Documentation

For more detailed information, refer to the documentation in the `docs` directory:

- [How It Works](docs/HOW_IT_WORKS.md) - Detailed explanation of system architecture and technical choices
- [Contributing Guide](docs/CONTRIBUTING.md) - Guidelines for contributing to the project

## Configuration

MCP comes with sensible defaults and works without additional configuration. The server can be configured through multiple methods, prioritized in the following order:

1. **CLI Arguments:**
   ```bash
   # Run with specific configuration options
   npx prompt-context --config '{"messageLimitThreshold": 15, "useVectorDb": true}'
   
   # Using node directly for more complex configurations
   node -e "require('prompt-context').start({messageLimitThreshold: 15, contextDir: './custom-contexts'})"
   
   # Run as an mcp server with specific configuration
   npx prompt-context --mcp --config '{"messageLimitThreshold": 15}'
   
   # Initialize MCP in the current directory (creates .mcp-config.json)
   npx prompt-context init
   
   # View current configuration
   npx prompt-context config
   
   # Update specific settings
   npx prompt-context config hierarchicalContext true
   ```

2. **Environment Variables:**
   ```bash
   # Set environment variables for configuration
   CONTEXT_DIR=/custom/path AUTO_SUMMARIZE=false npx prompt-context
   
   # Using multiple environment variables
   MESSAGE_LIMIT_THRESHOLD=15 TOKEN_LIMIT_PERCENTAGE=70 AUTO_SUMMARIZE=true npx prompt-context
   ```

3. **`.mcp-config.json` File:** 
   ```json
   {
     "messageLimitThreshold": 15,
     "useVectorDb": true,
     "contextDir": "./custom-contexts"
   }
   ```

4. **Default Configuration:** If no other configuration is provided, the server uses default values.

### Configuration Options

| Option | Description | Default | Example |
|------|------|--------|--------|
| `messageLimitThreshold` | Message count threshold to trigger summarization | 10 | `{"messageLimitThreshold": 15}` |
| `tokenLimitPercentage` | Token count threshold as percentage of model limit | 80 | `{"tokenLimitPercentage": 70}` |
| `contextDir` | Directory for context storage | '.prompt-context' | `{"contextDir": "./contexts"}` |
| `ignorePatterns` | Patterns of files and directories to ignore | [] | `{"ignorePatterns": ["temp/*"]}` |
| `autoSummarize` | Whether to enable automatic summarization | true | `{"autoSummarize": false}` |
| `hierarchicalContext` | Enable hierarchical context management | true | `{"hierarchicalContext": true}` |
| `metaSummaryThreshold` | Number of contexts before generating a meta-summary | 5 | `{"metaSummaryThreshold": 10}` |
| `maxHierarchyDepth` | Maximum hierarchy depth for meta-summaries | 3 | `{"maxHierarchyDepth": 5}` |
| `useVectorDb` | Enable vector similarity search | true | `{"useVectorDb": true}` |
| `useGraphDb` | Enable graph-based context relationships | true | `{"useGraphDb": true}` |
| `similarityThreshold` | Minimum similarity threshold for related contexts | 0.6 | `{"similarityThreshold": 0.7}` |
| `autoCleanupContexts` | Enable automatic cleanup of unrelated contexts | true | `{"autoCleanupContexts": false}` |
| `trackApiCalls` | Enable tracking and analytics of API calls | true | `{"trackApiCalls": true}` |
| `apiAnalyticsRetention` | Number of days to retain API call data | 30 | `{"apiAnalyticsRetention": 15}` |
| `fallbackToKeywordMatch` | Whether to use keyword matching when vector search fails | true | `{"fallbackToKeywordMatch": true}` |
| `port` | Server port number (for non-MCP mode) | 6789 | `{"port": 8080}` |

**Example with Multiple Options:**
```bash
npx prompt-context --config '{
  "messageLimitThreshold": 15,
  "contextDir": "./project-contexts",
  "useVectorDb": true,
  "similarityThreshold": 0.7,
  "autoCleanupContexts": false
}'
```

**Multiple Option Configuration with MCP Client:**
```json
{
  "mcpServers": {
    "Prompt Context": {
      "command": "npx",
      "args": [
        "-y",
        "prompt-context",
        "--config",
        "{\"messageLimitThreshold\": 15, \"contextDir\": \"./project-contexts\"}"
      ]
    }
  }
}
```

## Using MCP in Team Environments

When using MCP in team environments, it's important to consider how context data is managed:

### Git Management Recommendations

By default, MCP stores all context data in a `.prompt-context` directory within your project. In team environments, you should add this directory to your `.gitignore` file to prevent:

1. Bloating your Git repository with conversation contexts
2. Merge conflicts when multiple team members modify contexts
3. Unintentionally sharing personal or sensitive conversations
4. Polluting commit history with context changes

Add the following to your project's `.gitignore` file:

```
# MCP
.prompt-context/
```

## License

This project is distributed under the MIT License. See the [LICENSE](LICENSE) file for more details.
