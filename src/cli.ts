#!/usr/bin/env node

import { MemoryContextProtocol } from './mcp';
import * as fs from 'fs-extra';
import * as path from 'path';
import { MCPConfig, Message } from './types';

// Default configuration
const DEFAULT_CONFIG: MCPConfig = {
  messageLimitThreshold: 10,
  tokenLimitPercentage: 80,
  contextDir: '.prompt-context',
  useGit: true,
  ignorePatterns: [],
  autoSummarize: true
};

// MCP instance
let mcp: MemoryContextProtocol;

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
 * Initialize MCP
 */
function initMCP(config?: MCPConfig): MemoryContextProtocol {
  const mcpConfig = config || loadConfig();
  return new MemoryContextProtocol(mcpConfig);
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
    
    case 'add':
      // Add message
      await handleAddMessage(args.slice(1));
      break;
    
    case 'summary':
      // Generate summary
      await handleSummary(args.slice(1));
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
  init                           Initialize MCP in current directory
  config [key] [value]           View or change configuration
  add <contextId> <role> <content>  Add message to context
  summary [contextId]            Generate summary (all contexts if ID omitted)
  help                           Show this help message

Examples:
  npx prompt-context init
  npx prompt-context config messageLimitThreshold 5
  npx prompt-context add file.js user "Please optimize this code"
  npx prompt-context summary file.js
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
  
  console.log(`✓ MCP initialized. Configuration file: ${getConfigPath()}`);
  console.log(`✓ Context directory: ${contextDir}`);
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
      } else if (key === 'useGit' || key === 'autoSummarize') {
        typedValue = value === 'true';
      } else if (key === 'messageLimitThreshold' || key === 'tokenLimitPercentage') {
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
    } catch (error) {
      console.error(`Error: Problem parsing value:`, error);
    }
  }
}

/**
 * Handle add message command
 */
async function handleAddMessage(args: string[]) {
  if (args.length < 3) {
    console.error('Error: contextId, role, and content are required.');
    console.log('Usage: npx prompt-context add <contextId> <role> <content>');
    return;
  }
  
  const [contextId, role, ...contentParts] = args;
  const content = contentParts.join(' ');
  
  if (role !== 'user' && role !== 'assistant') {
    console.error('Error: Role must be "user" or "assistant".');
    return;
  }
  
  // Initialize MCP
  mcp = initMCP();
  
  // Create message object
  const message: Message = {
    role: role as 'user' | 'assistant',
    content,
    timestamp: Date.now()
  };
  
  try {
    // Add message
    await mcp.addMessage(contextId, message);
    console.log(`✓ Message added to context '${contextId}'.`);
    
    // Check if auto-summarize is enabled
    const config = loadConfig();
    if (config.autoSummarize) {
      console.log('(Auto-summarize is enabled and will trigger when thresholds are reached)');
    }
  } catch (error) {
    console.error('Error adding message:', error);
  }
}

/**
 * Handle summary command
 */
async function handleSummary(args: string[]) {
  // Initialize MCP
  mcp = initMCP();
  
  const contextId = args[0];
  
  try {
    if (contextId) {
      // Summarize specific context
      console.log(`Generating summary for context '${contextId}'...`);
      const result = await mcp.summarizeContext(contextId);
      
      if (result) {
        console.log(`✓ Summary generated for context '${contextId}'.`);
        
        // Display summary
        const summary = await mcp.loadSummary(contextId);
        if (summary) {
          console.log('\nSummary:');
          console.log('-------------------------------------');
          console.log(`Last Updated: ${new Date(summary.lastUpdated).toLocaleString()}`);
          console.log(`Message Count: ${summary.messageCount}`);
          console.log(`Version: ${summary.version}`);
          console.log('\nSummary Text:');
          console.log(summary.summary);
          
          if (summary.codeBlocks.length > 0) {
            console.log('\nCode Blocks:');
            summary.codeBlocks.forEach((block, index) => {
              console.log(`\n-- Code Block #${index + 1} --`);
              console.log(`Language: ${block.language || 'Not specified'}`);
              console.log(`Code:\n${block.code}`);
            });
          }
          console.log('-------------------------------------');
        }
      } else {
        console.log(`✗ Could not generate summary for context '${contextId}'. There may not be enough messages.`);
      }
    } else {
      // Summarize all contexts
      console.log('Generating summaries for all contexts...');
      const count = await mcp.summarizeAllContexts();
      console.log(`✓ Generated ${count} context summaries.`);
    }
  } catch (error) {
    console.error('Error generating summary:', error);
  }
}

// Run CLI
run().catch(console.error); 