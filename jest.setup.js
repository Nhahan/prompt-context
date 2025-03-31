// Mock for hnswlib-node
jest.mock('hnswlib-node', () => {
  // Log functions and methods in use
  const debugLog = (method) => {
    if (process.env.DEBUG_MOCKS) {
      console.log(`[Mock] Called: ${method}`);
    }
  };

  const mockHierarchicalNSW = jest.fn().mockImplementation(() => {
    const instance = {
      // Basic methods
      initIndex: jest.fn().mockImplementation((maxElements, efConstruction, M) => {
        debugLog('initIndex');
      }),
      
      // Init method alias for supporting different library versions
      init: jest.fn().mockImplementation((maxElements, efConstruction, M) => {
        debugLog('init');
      }),
      
      readIndex: jest.fn().mockImplementation((filename, allowReplaceDeleted) => {
        debugLog('readIndex');
        return true;
      }),
      
      writeIndex: jest.fn().mockImplementation((filename) => {
        debugLog('writeIndex');
      }),
      
      addPoint: jest.fn().mockImplementation((point, label) => {
        debugLog('addPoint');
      }),
      
      markDelete: jest.fn().mockImplementation((label) => {
        debugLog('markDelete');
      }),
      
      // Important: implement searchKnn function more robustly
      searchKnn: jest.fn().mockImplementation((query, k) => {
        debugLog('searchKnn');
        // Always return valid neighbors and distances arrays
        const kValue = Math.max(1, k || 1); // Ensure default value
        return {
          neighbors: Array.from({ length: kValue }, (_, i) => i),
          distances: Array.from({ length: kValue }, () => 0.1)
        };
      }),
      
      // Additional required properties
      getMaxElements: jest.fn().mockReturnValue(1000),
      getCurrentCount: jest.fn().mockReturnValue(10),
      getNumDimensions: jest.fn().mockReturnValue(384),
      setEf: jest.fn(),
      saveIndex: jest.fn(),
      loadIndex: jest.fn(),
      getIdsList: jest.fn().mockReturnValue(new Int32Array(10))
    };
    
    return instance;
  });

  return {
    HierarchicalNSW: mockHierarchicalNSW
  };
}); 