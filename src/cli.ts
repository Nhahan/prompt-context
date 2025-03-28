#!/usr/bin/env node

import { MemoryContextProtocol } from './mcp';
import * as fs from 'fs-extra';
import * as path from 'path';
import { MCPConfig } from './types';

// Default configuration
const DEFAULT_CONFIG: MCPConfig = {
  messageLimitThreshold: 10,
  tokenLimitPercentage: 80,
  contextDir: '.prompt-context',
  useGit: true,
  ignorePatterns: [],
  autoSummarize: true,
  hierarchicalContext: true,
  metaSummaryThreshold: 5,
  maxHierarchyDepth: 3,
  useVectorDb: false, // Disable by default for CLI
  useGraphDb: false, // Disable by default for CLI
  similarityThreshold: 0.6,
  autoCleanupContexts: false // Disable by default for CLI
};

/**
 * Get configuration file path
 */
const getConfigPath = () => path.join(process.cwd(), '.mcp-config.json');

/**
 * Load configuration
 */
function loadConfig(): MCPConfig {
  const configPath = getConfigPath();
  
  try {
    if (fs.existsSync(configPath)) {
      const config = fs.readJsonSync(configPath);
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (error) {
    console.error('Error loading configuration file:', error);
  }
  
  return DEFAULT_CONFIG;
}

/**
 * Save configuration
 */
function saveConfig(config: MCPConfig): void {
  const configPath = getConfigPath();
  fs.writeJsonSync(configPath, config, { spaces: 2 });
}

/**
 * Process CLI commands
 */
async function run() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'init':
      // Initialize MCP
      await handleInit();
      break;
    
    case 'config':
      // Manage configuration
      await handleConfig(args.slice(1));
      break;
    
    case 'help':
    default:
      showHelp();
      break;
  }
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
Memory Context Protocol (MCP) CLI

Usage:
  npx prompt-context <command> [options]

Commands:
  init                     Initialize MCP in current directory
  config [key] [value]     View or change configuration
  help                     Show this help message

Examples:
  npx prompt-context init
  npx prompt-context config                     # View all settings
  npx prompt-context config messageLimitThreshold 5
  npx prompt-context config hierarchicalContext true
  `);
}

/**
 * Handle init command
 */
async function handleInit() {
  console.log('Initializing MCP in current directory...');
  
  // Create default configuration file
  saveConfig(DEFAULT_CONFIG);
  
  // Create context directory
  const contextDir = path.join(process.cwd(), DEFAULT_CONFIG.contextDir);
  await fs.ensureDir(contextDir);
  
  // Create hierarchical directories if enabled
  if (DEFAULT_CONFIG.hierarchicalContext) {
    await fs.ensureDir(path.join(contextDir, 'hierarchical'));
    await fs.ensureDir(path.join(contextDir, 'meta'));
  }
  
  console.log(`✓ MCP initialized. Configuration file: ${getConfigPath()}`);
  console.log(`✓ Context directory: ${contextDir}`);
  
  if (DEFAULT_CONFIG.hierarchicalContext) {
    console.log('✓ Hierarchical context management is enabled');
  }
}

/**
 * Handle config command
 */
async function handleConfig(args: string[]) {
  const config = loadConfig();
  
  // Show all settings if no arguments
  if (args.length === 0) {
    console.log('Current MCP Configuration:');
    console.log(JSON.stringify(config, null, 2));
    return;
  }
  
  const [key, value] = args;
  
  // Show specific setting if key provided without value
  if (key && !value) {
    if (key in config) {
      console.log(`${key}: ${JSON.stringify(config[key as keyof MCPConfig], null, 2)}`);
    } else {
      console.error(`Error: Setting key '${key}' does not exist`);
    }
    return;
  }
  
  // Update setting if key and value provided
  if (key && value) {
    if (!(key in config)) {
      console.error(`Error: Setting key '${key}' does not exist`);
      return;
    }
    
    // Parse value based on type
    let typedValue: any;
    try {
      if (key === 'ignorePatterns') {
        typedValue = JSON.parse(value);
      } else if (
        key === 'useGit' || 
        key === 'autoSummarize' || 
        key === 'hierarchicalContext'
      ) {
        typedValue = value === 'true';
      } else if (
        key === 'messageLimitThreshold' || 
        key === 'tokenLimitPercentage' ||
        key === 'metaSummaryThreshold' ||
        key === 'maxHierarchyDepth'
      ) {
        typedValue = parseInt(value, 10);
      } else {
        typedValue = value;
      }
      
      const updatedConfig = {
        ...config,
        [key]: typedValue
      };
      
      saveConfig(updatedConfig);
      console.log(`✓ Configuration updated: ${key} = ${JSON.stringify(typedValue)}`);
      
      // Special handling for enabling hierarchical context
      if (key === 'hierarchicalContext' && typedValue === true) {
        const contextDir = path.join(process.cwd(), config.contextDir);
        await fs.ensureDir(path.join(contextDir, 'hierarchical'));
        await fs.ensureDir(path.join(contextDir, 'meta'));
        console.log('✓ Created directories for hierarchical context management');
      }
    } catch (error) {
      console.error(`Error: Problem parsing value:`, error);
    }
  }
}

// Run CLI
run().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 