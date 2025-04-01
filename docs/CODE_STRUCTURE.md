# Code Structure

This document provides an overview of the Prompt Context MCP Server codebase structure, explaining key files and their responsibilities.

## Main Components

### Core Modules

| File | Description |
|------|-------------|
| `src/main.ts` | Entry point for the MCP server, initializes the MCP protocol handlers |
| `src/index.ts` | Main package exports, providing public API for programmatic usage |

### Domain Layer

The domain layer contains core business logic and entities.

| File | Description |
|------|-------------|
| `src/domain/context.service.ts` | Core service implementing context management logic |
| `src/domain/message.service.ts` | Handles message processing, tagging, and importance evaluation |
| `src/domain/relationship.service.ts` | Manages relationships between different contexts |
| `src/domain/summarizer.service.ts` | Implements summarization logic for contexts |

### Repository Layer

The repository layer handles data persistence and storage.

| File | Description |
|------|-------------|
| `src/repositories/repository.interface.ts` | Defines repository interfaces and common types |
| `src/repositories/file-system.repository.ts` | Implements file-based storage for context data |
| `src/repositories/vector.repository.ts` | Manages vector embeddings and similarity search with HNSW |
| `src/repositories/graph.repository.ts` | Implements graph-based storage for context relationships |

### Presentation Layer

The presentation layer handles user interfaces and external communication.

| File | Description |
|------|-------------|
| `src/presentation/mcp-tools.ts` | Implements the MCP protocol tools API |
| `src/presentation/http-api.ts` | HTTP API endpoints for non-MCP clients |
| `src/presentation/cli.ts` | Command-line interface for configuration and direct usage |

### Configuration

| File | Description |
|------|-------------|
| `src/config/config.ts` | Configuration management system with defaults and overrides |
| `src/config/schema.ts` | JSON schema definitions for configuration validation |

### Utilities

| File | Description |
|------|-------------|
| `src/utils/embedding.ts` | Handles text embedding generation with transformer models |
| `src/utils/tokenizer.ts` | Utilities for token counting and text tokenization |
| `src/utils/logger.ts` | Logging utilities |
| `src/utils/file.ts` | File system helper functions |

## Database Implementation

### Vector Database

The vector database is implemented in `vector.repository.ts` using the HNSW (Hierarchical Navigable Small World) algorithm from the `hnswlib-node` package. Key features include:

- Zero external database dependencies
- Efficient similarity search for semantic queries
- Persistence to flat files for portability
- Automatic embedding generation using transformer models

### Graph Database

The graph database is implemented in `graph.repository.ts` using the `graphology` library. It provides:

- Relationship tracking between contexts
- Traversal capabilities for finding related contexts
- Persistent storage without external dependencies
- Support for weighted relationships

## Tests

| Directory | Description |
|-----------|-------------|
| `src/__tests__/integration-tests/` | Integration tests simulating real usage scenarios |

## Integrations

The server can be used in various modes:

1. **MCP Protocol Mode**: Used by MCP-compatible clients like Cursor
2. **Standalone Mode**: Run as an HTTP server for non-MCP clients
3. **Library Mode**: Used programmatically in other Node.js applications 