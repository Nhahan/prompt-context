// Export types
export * from './types';

// Export core classes
export { MemoryContextProtocol } from './mcp';
export { FileSystemRepository } from './repository';
export { 
  BaseSummarizer, 
  SimpleTextSummarizer, 
  AIModelSummarizer,
  CustomAISummarizer
} from './summarizer';

// Export MCP server
export { server as mcpServer } from './mcp-server';

// Create convenient access to enums and specific types
import { ContextImportance } from './types';
export const Importance = ContextImportance;

// Export default instance
import { MemoryContextProtocol } from './mcp';

// Default export
export default MemoryContextProtocol; 