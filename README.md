# Memory Context Protocol (MCP) for AI Agents

`prompt-context` is a TypeScript library that helps AI agents efficiently remember and utilize previous conversation context. This protocol tracks conversation history for each file or context, periodically summarizes it, and saves the summaries to enhance the AI agent's contextual understanding.

## Key Features

- **Context-based Memory Management**: Organize conversations separately by file or topic.
- **Automatic Summary Generation**: Automatically generate summaries when message count or token count reaches thresholds.
- **Code Block Preservation**: Preserve code blocks in summaries to maintain important information.
- **Git Integration**: Manage summary files with Git for version control.
- **Efficient Storage and Loading**: Store summaries in JSON format for quick loading.
- **Customizable Settings**: Allow users to adjust summary trigger thresholds and other settings.
- **Extensible Design**: Provide flexible architecture for integration with various AI models.
- **CLI Tool**: Configure and use MCP easily from the command line.

## Installation

```bash
npm install prompt-context
```

## CLI Usage

After installation, you can use it directly from the command line:

```bash
# Initialize MCP in the current directory
npx prompt-context init

# Check configuration
npx prompt-context config

# Change configuration (e.g., set message threshold)
npx prompt-context config messageLimitThreshold 5

# Add messages
npx prompt-context add file.js user "Please optimize this code"
npx prompt-context add file.js assistant "The optimized code is as follows: ..."

# Generate summary
npx prompt-context summary file.js

# Summarize all contexts
npx prompt-context summary

# Display help
npx prompt-context help
```

## Integrating MCP

While using the CLI tool is the simplest approach, you can also use MCP programmatically:

```typescript
import { MemoryContextProtocol } from 'prompt-context';

// Create MCP instance
const mcp = new MemoryContextProtocol({
  messageLimitThreshold: 10,
  tokenLimitPercentage: 80,
  contextDir: '.prompt-context',
  useGit: true,
  autoSummarize: true
});

// Add message
await mcp.addMessage('file.ts', {
  role: 'user',
  content: 'Please add a React component to this file.',
  timestamp: Date.now()
});

// Summarize context (automatic or manual)
await mcp.summarizeContext('file.ts');

// Load summary
const summary = await mcp.loadSummary('file.ts');
console.log(summary);
```

## Custom AI Summary Integration

To generate summaries using your own AI model or external AI service, you can implement a custom summarizer service:

```typescript
import { CustomAISummarizer, MemoryContextProtocol } from 'prompt-context';

// Custom AI summarization function
const myAISummarizer = async (messages) => {
  // Call external AI API or custom summarization logic
  // Example: OpenAI API, Anthropic API, etc.
  return 'This is a summary of the conversation...';
};

// Create custom summarizer service
const summarizer = new CustomAISummarizer(myAISummarizer);

// Pass custom summarizer when creating MCP instance
const mcp = new MemoryContextProtocol({}, summarizer);
```

## Advanced Configuration

### Configuration Options

Options that can be passed to the `MemoryContextProtocol` constructor:

| Option | Description | Default |
|------|------|--------|
| `messageLimitThreshold` | Message count threshold to trigger summary | 10 |
| `tokenLimitPercentage` | Token count threshold as percentage of model limit | 80 |
| `contextDir` | Context storage directory | '.prompt-context' |
| `useGit` | Whether to use Git repository | true |
| `ignorePatterns` | Patterns for files and directories to ignore | [] |
| `autoSummarize` | Whether to enable automatic summarization | true |

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

## License

MIT 