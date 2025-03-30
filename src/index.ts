// Export core classes and types
export { MemoryContextProtocol } from './mcp';
export * from './types';
export { initializeRepositories } from './repository';

// Create convenient access to enums and specific types
import { ContextImportance } from './types';
export const Importance = ContextImportance;

// Export default instance
import { MemoryContextProtocol } from './mcp';

// Default export
export default MemoryContextProtocol; 