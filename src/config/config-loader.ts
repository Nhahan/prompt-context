import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import dotenv from 'dotenv';
import { MCPConfig, DEFAULT_CONFIG } from './config';

/**
 * Load MCP configuration from environment variables, config file, and CLI arguments
 * @returns Loaded configuration
 */
export function loadConfig(args: string[] = process.argv.slice(2)): MCPConfig {
  // Initialize with default config
  dotenv.config();

  // Set base directory
  const baseDir =
    process.env.MCP_SERVER_BASE_DIR || path.join(os.homedir(), '.mcp-servers', 'prompt-context');
  console.error(`[MCP Server] Determined baseDir: ${baseDir}`);

  try {
    fs.ensureDirSync(baseDir);
    console.error(`[MCP Server] Base directory ensured: ${baseDir}`);
  } catch (err: any) {
    console.error(`[MCP Server] CRITICAL ERROR ensuring base directory ${baseDir}:`, err);
    process.exit(1);
  }

  // Start with default config
  let config: typeof DEFAULT_CONFIG & Pick<MCPConfig, 'contextDir'> = {
    ...DEFAULT_CONFIG,
    contextDir: path.join(baseDir, 'context'),
  };

  // Load from config file if exists
  const configPath = path.join(baseDir, '.mcp-config.json');
  console.error(`[MCP Server] Config path: ${configPath}`);

  try {
    if (fs.existsSync(configPath)) {
      const loadedConfig = fs.readJsonSync(configPath);
      config = { ...config, ...loadedConfig };
      console.error('[MCP Server] Loaded config from .mcp-config.json');
    } else {
      console.error('[MCP Server] .mcp-config.json not found, using defaults/env vars.');
    }
  } catch (error) {
    console.error(
      `[MCP Server] Error reading config file ${configPath}, using defaults/env vars:`,
      error
    );
  }

  // Override with environment variables
  console.error('[MCP Server] Checking for environment variable overrides...');
  Object.keys(DEFAULT_CONFIG).forEach((key) => {
    if (key === 'ignorePatterns') return;

    const envVarKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
    const envValue = process.env[envVarKey];
    if (envValue !== undefined) {
      let parsedValue: any = envValue;
      try {
        parsedValue = JSON.parse(envValue);
      } catch (e) {
        if (envValue.toLowerCase() === 'true') parsedValue = true;
        else if (envValue.toLowerCase() === 'false') parsedValue = false;
        else if (!isNaN(Number(envValue))) parsedValue = Number(envValue);
        else parsedValue = envValue;
      }
      if (typeof parsedValue === typeof (DEFAULT_CONFIG as any)[key]) {
        (config as any)[key] = parsedValue;
        console.error(
          `[MCP Server] Overridden config with env var ${envVarKey}=${JSON.stringify(parsedValue)}`
        );
      } else if (key === 'ignorePatterns' && Array.isArray(parsedValue)) {
        (config as any)[key] = parsedValue;
        console.error(
          `[MCP Server] Overridden config with env var ${envVarKey}=${JSON.stringify(parsedValue)}`
        );
      } else {
        console.error(
          `[MCP Server] Env var ${envVarKey} type mismatch. Expected ${typeof (DEFAULT_CONFIG as any)[key]}, got ${typeof parsedValue}. Skipping.`
        );
      }
    }
  });

  // Override with CLI arguments
  console.error('[MCP Server] Checking for CLI argument overrides...');
  const portIndex = args.indexOf('--port');
  if (portIndex > -1 && args[portIndex + 1]) {
    const cliPort = parseInt(args[portIndex + 1], 10);
    if (!isNaN(cliPort)) {
      config.port = cliPort;
      console.error(`[MCP Server] Overridden port with CLI arg: ${config.port}`);
    }
  }

  const configIndex = args.indexOf('--config');
  if (configIndex > -1 && args[configIndex + 1]) {
    try {
      const cliConfig = JSON.parse(args[configIndex + 1]);
      config = { ...config, ...cliConfig };
      console.error('[MCP Server] Overridden config with CLI --config arg.');
    } catch (error) {
      console.error('[MCP Server] Error parsing --config CLI argument:', error);
    }
  }

  // Ensure context directory exists
  if (!path.isAbsolute(config.contextDir)) {
    config.contextDir = path.resolve(config.contextDir);
    console.error(`[MCP Server] Resolved contextDir to absolute path: ${config.contextDir}`);
  }

  try {
    fs.ensureDirSync(config.contextDir);
    console.error(`[MCP Server] Ensured final context directory exists: ${config.contextDir}`);
  } catch (err: any) {
    console.error(
      `[MCP Server] CRITICAL ERROR ensuring final context directory ${config.contextDir}:`,
      err
    );
    process.exit(1);
  }

  console.error('[MCP Server] Final configuration loaded:', JSON.stringify(config, null, 2));
  return config;
}
