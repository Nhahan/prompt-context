#!/usr/bin/env node

import { loadConfig } from './config/config-loader';
import { FileSystemRepository } from './repositories/file-system.repository';
import { VectorRepository } from './repositories/vector.repository';
import { GraphRepository } from './repositories/graph.repository';
import { ContextService } from './services/context.service';
import { Summarizer } from './services/summarizer.service';
import { PromptContextMcpServer } from './presentation/mcp-server';
import { ApiAnalytics } from './utils/analytics';
import path from 'path';

// Object to store initialized services and repositories
export interface InitializedServices {
  vectorRepository?: VectorRepository;
  graphRepository?: GraphRepository;
  contextService?: ContextService;
  mcpServer?: PromptContextMcpServer;
}

/**
 * MCP Server initialization function
 * Loads configuration and initializes necessary services and repositories
 */
export async function initializeMcpServer(): Promise<InitializedServices> {
  try {
    console.error('[MCP Server] Starting Prompt Context MCP Server...');

    // Load configuration
    const config = loadConfig();
    console.error('[MCP Server] Configuration loaded.');

    // Object to store services and repositories
    const services: InitializedServices = {};

    // Initialize repositories
    const fileSystemRepository = new FileSystemRepository(config.contextDir);

    let vectorRepository;
    if (config.useVectorDb) {
      console.error('[MCP Server] Initializing Vector Repository...');
      // Specify clear vector DB file path
      const vectorDbPath = path.join(config.contextDir, 'vector-db.json');
      vectorRepository = new VectorRepository(vectorDbPath);
      await vectorRepository.ensureInitialized();
      services.vectorRepository = vectorRepository;
      console.error('[MCP Server] Vector Repository initialized.');
    }

    let graphRepository;
    if (config.useGraphDb) {
      console.error('[MCP Server] Initializing Graph Repository...');
      graphRepository = new GraphRepository(config.contextDir);
      await graphRepository.ensureInitialized();
      services.graphRepository = graphRepository;
      console.error('[MCP Server] Graph Repository initialized.');
    }

    // Set up optional analytics
    let analytics: ApiAnalytics | null = null;
    if (config.trackApiCalls) {
      console.error('[MCP Server] Initializing Analytics...');
      analytics = new ApiAnalytics(config.contextDir, config.apiAnalyticsRetention);
      console.error('[MCP Server] Analytics initialized.');
    }

    // Initialize summarizer if enabled
    const summarizer: Summarizer | undefined =
      config.autoSummarize || config.useVectorDb
        ? new Summarizer(config.tokenLimitPercentage, analytics, vectorRepository, graphRepository)
        : undefined;
    console.error('[MCP Server] Summarizer initialized.');

    // Initialize context service
    const repositories = {
      fs: fileSystemRepository,
      vector: vectorRepository,
      graph: graphRepository,
    };

    const contextService = new ContextService(repositories, summarizer, config, analytics);
    services.contextService = contextService;
    console.error('[MCP Server] Context Service initialized.');

    // Initialize MCP server
    const mcpServer = new PromptContextMcpServer(contextService, config);
    services.mcpServer = mcpServer;

    return services;
  } catch (error) {
    console.error('[MCP Server] Fatal error initializing server:', error);
    throw error;
  }
}

/**
 * Main function - Start server
 */
async function main() {
  try {
    const services = await initializeMcpServer();

    if (services.mcpServer) {
      // Start MCP server
      await services.mcpServer.start();

      console.error('[MCP Server] MCP Server started successfully.');

      // Handle termination signals
      process.on('SIGINT', async () => {
        console.error('Termination signal received. Cleaning up resources...');
        if (services.vectorRepository) {
          await services.vectorRepository.close();
        }
        process.exit(0);
      });
    } else {
      throw new Error('MCP server initialization failed');
    }
  } catch (error) {
    console.error('Server start failed:', error);
    process.exit(1);
  }
}

// Run main function only when this file is executed directly
if (require.main === module) {
  main();
}
