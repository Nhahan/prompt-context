// Export core classes and types for external use

// Repositories
export { FileSystemRepository } from './repositories/file-system.repository';
export { VectorRepository } from './repositories/vector.repository';
export { GraphRepository } from './repositories/graph.repository';

// Services
export { Summarizer } from './services/summarizer.service';

// Utils
export { ApiAnalytics } from './utils/analytics';

// Services
export { ContextService } from './services/context.service';

// Types
export * from './domain/types';

// Create convenient access to enums and specific types
import { ContextImportance } from './domain/types';
export const Importance = ContextImportance;

// Removed export { MemoryContextProtocol } from './mcp';
// Removed export { MemoryContextProtocol };

// Remove default export related to MemoryContextProtocol
// If a default export is needed, it should be something else
// export default SomethingElse;
