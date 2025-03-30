# Prompt Context MCP Server

This project implements an MCP Server—a server that uses the standardized [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/specification) to enable LLMs to communicate seamlessly with external data sources and tools. Specifically, this server focuses on managing and providing conversational context to language models.

## Features

*   **Context Storage:** Stores conversational context (messages, summaries) locally on the filesystem.
*   **MCP Compliance:** Implements core MCP tool specifications for context management.
*   **Message Handling:** Adds new messages to specific context conversations.
*   **Context Retrieval:** Fetches full context including messages and summaries.
*   **Automatic Summarization:** (Optional) Automatically summarizes long conversations based on message count thresholds using AI.
*   **Similarity Search:** (Optional, requires Vector DB) Finds contexts similar to a given query.
*   **Relationship Management:** (Optional, requires Graph DB) Manages relationships (e.g., similar, continues, references) between different contexts.
*   **Configuration:** Load configuration from `.mcp-config.json`, environment variables, or CLI arguments.
*   **Analytics:** (Optional) Tracks API calls for usage analysis.

## Tools Implemented

*   `ping`: Checks if the server is running.
*   `add_message`: Adds a message to a specified context.
*   `retrieve_context`: Retrieves messages, summary, and metadata for a context.
*   `get_similar_contexts`: Finds contexts semantically similar to a query (requires `useVectorDb: true`).
*   `add_relationship`: Adds a typed relationship between two contexts (requires `useGraphDb: true`).
*   `get_related_contexts`: Retrieves contexts related to a given context based on type and direction (requires `useGraphDb: true`).
*   `summarize_context`: Manually triggers summarization for a specified context (requires `autoSummarize: true` or `useVectorDb: true`).

## Setup and Installation

1.  **Prerequisites:** Node.js (v18 or later recommended) and npm/yarn.
2.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/prompt-context.git
    cd prompt-context
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```
4.  **Build the project:**
    ```bash
    npm run build
    ```

## Running the Server

```bash
node dist/mcp-server.js
```

The server will start and listen for MCP requests via standard input/output.

## Configuration

The server can be configured through multiple methods, prioritized in the following order:

1.  **CLI Arguments:**
    *   `--port <number>`: Specify the HTTP port (if an HTTP transport is added later).
    *   `--config '{"key": "value"}'`: Provide a JSON string to override specific configurations.
2.  **Environment Variables:** Set environment variables corresponding to configuration keys (e.g., `CONTEXT_DIR`, `AUTO_SUMMARIZE=false`). Boolean values are parsed from `true`/`false`, numbers are parsed, and arrays/objects should be JSON strings.
3.  **`.mcp-config.json` File:** Create a `.mcp-config.json` file in the base directory (`~/.mcp-servers/prompt-context` by default, or defined by `MCP_SERVER_BASE_DIR` env var). Example:
    ```json
    {
      "contextDir": "/path/to/your/context/storage",
      "autoSummarize": true,
      "messageLimitThreshold": 15,
      "useVectorDb": true,
      "useGraphDb": true
      // Add other config options here
    }
    ```
4.  **Default Configuration:** If no other configuration is provided, the server uses default values defined in `src/mcp-server.ts`.

**Key Configuration Options:**

*   `contextDir`: (Required) Path to the directory where context data will be stored.
*   `autoSummarize`: Enable/disable automatic background summarization.
*   `messageLimitThreshold`: Number of messages before triggering auto-summarization.
*   `tokenLimitPercentage`: Percentage of the model's token limit to use for summarization context.
*   `useVectorDb`: Enable/disable vector database features (similarity search).
*   `useGraphDb`: Enable/disable graph database features (context relationships).
*   `trackApiCalls`: Enable/disable API call tracking for analytics.

See `src/types.ts` (`MCPConfig` interface) for all available options.

## Development

*   **Run in development mode (with auto-rebuild):** `npm run dev`
*   **Run tests:** `npm test` (Note: requires a running server instance if testing against a live server)
*   **Lint code:** `npm run lint`
*   **Clean build artifacts:** `npm run clean`

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

[MIT](./LICENSE)
