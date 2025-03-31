# How Prompt Context Works

## Overview

Prompt Context is an intelligent MCP implementation designed to efficiently manage conversation context for AI agents. This document explains the core architecture and components of the system.

## Core Components

### Context Service

The Context Service is the heart of the implementation, responsible for:

- Managing message storage and retrieval
- Triggering automatic summarization when thresholds are reached
- Coordinating between other components
- Applying importance-based retention policies
- Handling relationship tracking between contexts

### Repository System

The repository layer provides persistent storage through:

- **File System Repository**: Stores raw context data and metadata in JSON format
- **Vector Repository**: Manages vector embeddings for semantic search capabilities
- **Graph Repository**: Tracks relationships between different contexts

These repositories work together to create a complete picture of the conversation history and relationships between different topics.

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

### Vector Similarity Search

The semantic search capability works by:

1. Converting text into numerical vector representations (embeddings)
2. Indexing these embeddings for efficient retrieval
3. Calculating similarity scores between queries and stored contexts
4. Returning the most relevant contexts based on semantic meaning

### Graph Relationships

The relationship tracking system:

1. Stores explicit relationships between contexts (similar, references, continues, parent/child)
2. Enables navigation between related concepts
3. Builds a knowledge graph of conversational history
4. Supports bidirectional traversal of connections

## Configuration

The system can be configured through various methods (CLI arguments, environment variables, configuration files) with sensible defaults. See the [README](../../README.md) for detailed configuration options.
