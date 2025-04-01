# Prompt Context

An MCP protocol that helps AI agents efficiently remember and utilize previous conversation context.

## Features

- Contextual memory for AI agents
- MCP (Model Context Protocol) compliant
- Vector similarity search for semantic retrieval
- Hierarchical context storage
- Graph-based relationship tracking
- Efficient resource utilization

## Installation

```bash
npm install prompt-context
```

## Usage

```javascript
const { initializeMcpServer } = require('prompt-context');

async function main() {
  const services = await initializeMcpServer();
  // MCP server is now running
}

main();
```

## Documentation

For detailed documentation, see the [docs](docs) directory.

## License

MIT
