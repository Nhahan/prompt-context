#!/usr/bin/env node

import { loadConfig } from './config/config-loader';
import { FileSystemRepository } from './repositories/file-system.repository';
import { VectorRepository } from './repositories/vector.repository';
import { GraphRepository } from './repositories/graph.repository';
import { ContextService } from './services/context.service';
import { Summarizer } from './services/summarizer.service';
import { PromptContextMcpServer } from './presentation/mcp-server';
import { ApiAnalytics } from './utils/analytics';

/**
 * Main function to run the MCP server
 */
async function main() {
  try {
    console.error('[MCP Server] Starting Prompt Context MCP Server...');

    // Load configuration
    const config = loadConfig();
    console.error('[MCP Server] Configuration loaded.');

    // Initialize repositories
    const repository = new FileSystemRepository(config.contextDir);

    let vectorRepository;
    if (config.useVectorDb) {
      console.error('[MCP Server] Initializing Vector Repository...');
      vectorRepository = new VectorRepository(config.contextDir);
      console.error('[MCP Server] Vector Repository initialized.');
    }

    let graphRepository;
    if (config.useGraphDb) {
      console.error('[MCP Server] Initializing Graph Repository...');
      graphRepository = new GraphRepository(config.contextDir);
      console.error('[MCP Server] Graph Repository initialized.');
    }

    // Set up optional analytics
    let analytics = null;
    if (config.trackApiCalls) {
      console.error('[MCP Server] Initializing Analytics...');
      analytics = new ApiAnalytics(config.contextDir, config.apiAnalyticsRetention);
      console.error('[MCP Server] Analytics initialized.');
    }

    // Initialize summarizer if enabled
    const summarizer =
      config.autoSummarize || config.useVectorDb
        ? new Summarizer(config.tokenLimitPercentage, analytics, vectorRepository, graphRepository)
        : undefined;
    console.error('[MCP Server] Summarizer initialized.');

    // Initialize context service
    const contextService = new ContextService(
      {
        fs: repository,
        vector: vectorRepository,
        graph: graphRepository,
      },
      summarizer,
      config,
      analytics
    );
    console.error('[MCP Server] Context Service initialized.');

    // Initialize and start MCP server
    const mcpServer = new PromptContextMcpServer(contextService, config);
    await mcpServer.start();

    console.error('[MCP Server] MCP Server started successfully.');

    // Handle graceful shutdown
    const handleShutdown = async () => {
      console.error('[MCP Server] Shutting down...');
      process.exit(0);
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
  } catch (error) {
    console.error('[MCP Server] Fatal error starting server:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error('[MCP Server] Unhandled error in main function:', error);
  process.exit(1);
});
