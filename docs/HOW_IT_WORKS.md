# How Prompt Context Works

## Overview

Prompt Context is an intelligent system for managing and retrieving conversations and related information. This document explains the core components, why each technology was chosen, and how they work together to create a cohesive system.

## Key Components and Technology Choices

### Memory Context Protocol (MCP)

**Why This Technology**: MCP serves as the central coordinator because traditional database systems lack the contextual understanding needed for nuanced conversation management. We needed a protocol that could maintain relationship between conversation fragments while making intelligent decisions about what to keep and what to summarize.

**Connections to Other Components**: MCP orchestrates all other components, deciding when to:
- Request the Summarizer to condense conversations
- Trigger the Vector Store to index new content
- Use the File System Repository to persist data

### Vector Database

**Why This Technology**: Traditional relational databases excel at exact matches but struggle with semantic similarity. Vector databases were chosen because they can represent the meaning of text mathematically, allowing the system to find related concepts even when the exact wording differs.

**Connections to Other Components**: 
- Receives processed text from the MCP
- Stores embeddings generated from conversations and summaries
- Provides similarity results to the MCP for context retrieval
- Works alongside the Graph Database to create a web of related information

**How Vectors Work**:
1. **Embedding Creation**: Text is converted into vectors (embeddings) consisting of hundreds of numbers. These numbers mathematically represent the meaning of the text.
2. **Similarity Calculation**: The distance between two vectors is measured to calculate semantic similarity between texts. Closer distance means more similar meaning.
3. **Efficient Searching**: Special indexing methods (HNSW) are used to quickly find similar items among millions of vectors.

**Fallback Mode**: The system includes a fallback mode that switches to basic keyword matching if embedding generation fails, ensuring the system maintains at least minimal functionality in any situation.

### Graph Database

**Why This Technology**: While vector similarity finds related content, it doesn't capture explicit relationships between contexts. Graph databases excel at representing and traversing relationships, allowing the system to understand that context A is a continuation of context B, or that context C references context D.

**Connections to Other Components**:
- Receives relationship information from MCP
- Complements the Vector Database by adding explicit relationship structure
- Helps the MCP make decisions about hierarchical structuring of information

### Summarizer Service

**Why This Technology**: Storing complete conversations indefinitely would be inefficient and overwhelming. The summarization technology condenses information while preserving key points, making the system more scalable and focused.

**Connections to Other Components**:
- Receives conversations from MCP when they reach certain thresholds
- Produces summaries that are stored in the File System Repository
- Feeds these summaries to the Vector Database for efficient retrieval
- Enables hierarchical summarization when working with the Graph Database

### File System Repository

**Why This Technology**: Instead of using complex database solutions for everything, a simple file-based storage system provides reliability, easy backups, and compatibility with version control systems like Git. This choice prioritizes simplicity and robustness.

**Connections to Other Components**:
- Provides persistent storage for all other components
- Allows easy inspection and manual editing if needed
- Enables version control integration for tracking context history

## How These Technologies Work Together

1. **Initial Conversation Storage**: 
   - When a conversation begins, the MCP creates a unique context ID
   - Raw messages are stored in the File System Repository
   - The Graph Database begins tracking this as a new context node

2. **Content Processing and Embedding**: 
   - As content accumulates, the MCP sends it to be embedded
   - The Vector Database processes and stores these embeddings
   - This enables future semantic search capabilities

3. **Relationship Detection**:
   - The MCP analyzes content for references to other contexts
   - When found, the Graph Database creates relationship links
   - These relationships can be based on content similarity or explicit references

4. **Summarization Workflow**:
   - When conversations reach a threshold, the MCP triggers the Summarizer
   - The Summarizer analyzes the conversation, preserving important information
   - This summary is stored and embedded for future reference

5. **Hierarchical Organization**:
   - Using both vector similarity and graph relationships, the MCP builds hierarchical structures
   - Related contexts are grouped for higher-level understanding
   - This creates a multi-level knowledge structure that mimics human memory organization

6. **Context Retrieval Process**:
   - When information is needed, the Vector Database finds semantically similar content
   - The Graph Database provides relationship context
   - The MCP combines these inputs to retrieve the most relevant information
   - The File System Repository provides the actual content
