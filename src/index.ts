// Export core classes and types for external use

// Removed export { MemoryContextProtocol } from './mcp';

export { FileSystemRepository } from './repository';
export { BaseSummarizer, SimpleTextSummarizer, AIModelSummarizer, CustomAISummarizer, Summarizer } from './summarizer';
export { VectorRepository } from './vector-repository';
export { GraphRepository } from './graph-repository';
export { ApiAnalytics } from './analytics';
export { ContextService } from './services/context.service';
export * from './types'; // Export all types

// Removed import { MemoryContextProtocol } from './mcp';
// Removed export { MemoryContextProtocol };

// Create convenient access to enums and specific types
import { ContextImportance } from './types';
export const Importance = ContextImportance;

// Remove default export related to MemoryContextProtocol
// If a default export is needed, it should be something else
// export default SomethingElse; 