# How Prompt Context Works

## Overview

Prompt Context is an intelligent MCP implementation designed to efficiently manage conversation context for AI agents. This document explains the core architecture, components, and technical decisions of the system.

## Core Components

### Context Service

The Context Service is the heart of the implementation, responsible for:

- Managing message storage and retrieval
- Triggering automatic summarization when thresholds are reached
- Coordinating between other components
- Applying importance-based retention policies
- Handling relationship tracking between contexts

The Context Service implements a stateless design, making it suitable for distributed environments while maintaining all state in the repository layer.

### Repository System

The repository layer provides persistent storage through:

- **File System Repository**: Stores raw context data and metadata in JSON format
- **Vector Repository**: Manages vector embeddings for semantic search capabilities
- **Graph Repository**: Tracks relationships between different contexts

These repositories work together to create a complete picture of the conversation history and relationships between different topics. All repositories implement an embedded design pattern, eliminating the need for external database services.

### Tool Implementation

The MCP server exposes several tools for AI agents to use:

- **Context Management**: `add_message`, `retrieve_context`, `summarize_context`
- **Relationship Tools**: `add_relationship`, `get_related_contexts`
- **Discovery Tools**: `get_similar_contexts`, `visualize_context`
- **Analytics Tools**: `get_context_metrics`

Each tool maps to specific functionalities in the Context Service and repositories.

## Key Features

### Automatic Summarization

When a context reaches a configurable threshold (default: 10 messages):

1. The summarization process is triggered
2. Important messages are identified based on tags and importance levels
3. A summary is generated and stored with the context
4. This summary becomes available for future retrieval

The summarization ensures ongoing conversations don't lose critical context as they grow longer. The system prioritizes important information in summaries based on explicit importance flags and heuristic analysis.

### Vector Similarity Search

The semantic search capability works by:

1. Converting text into numerical vector representations (embeddings)
2. Indexing these embeddings for efficient retrieval using HNSW
3. Calculating similarity scores between queries and stored contexts
4. Returning the most relevant contexts based on semantic meaning

The system uses the Hierarchical Navigable Small World (HNSW) algorithm for efficient approximate nearest neighbor search, providing sub-linear search time complexity.

### Graph Relationships

The relationship tracking system:

1. Stores explicit relationships between contexts (similar, references, continues, parent/child)
2. Enables navigation between related contexts
3. Builds a knowledge graph of conversational history
4. Supports bidirectional traversal of connections

Relationship weights influence search results, helping surface the most relevant contexts based on both semantic similarity and explicit relationships.

## Technical Implementation

### Embedded Database Strategy

The system uses fully embedded databases requiring no external services:

- **Vector store**: Implemented using HNSW algorithm with in-memory indexing and file-based persistence
- **Graph database**: Uses the graphology library for managing relationships with file-based JSON storage

This approach ensures:
- Zero external dependencies beyond the Node.js runtime
- Simple deployment without complex setup
- Portability between environments
- Compatibility with MCP server requirements

### Model Loading and Embedding Generation

Text embeddings are generated using transformer models:

1. ONNX models are used for efficient inference
2. Lazy loading ensures models are only loaded when needed
3. Embedding cache reduces redundant computations
4. Fallback mechanisms ensure the system works even when models are unavailable

### Performance Considerations

Several optimization techniques ensure good performance:

- Asynchronous processing for non-blocking operations
- Intelligent caching for frequently accessed data
- Batch processing for efficiency when possible
- Incremental updates to avoid reprocessing entire contexts
- Configurable pruning policies to manage storage growth

## Configuration

The system can be configured through various methods (CLI arguments, environment variables, configuration files) with sensible defaults. See the [README](../README.md) for detailed configuration options.

## Security

The system is designed with security considerations:

- No external network calls are made by default
- Data is stored locally within the specified directories
- No authentication data is stored in plain text
- Context data can be encrypted at rest (with appropriate configuration)

## Deployment Options

Prompt Context supports multiple deployment scenarios:

1. **As an MCP server**: The primary deployment mode for use with MCP clients
2. **As a standalone service**: Running as an HTTP server
3. **As a Docker container**: For containerized environments
4. **As a library**: Embedded within another Node.js application

See the installation and deployment sections in the [README](../README.md) for specific instructions.
