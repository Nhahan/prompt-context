// Mock for @xenova/transformers
jest.mock('@xenova/transformers', () => {
  return {
    pipeline: jest.fn().mockImplementation(() => {
      return async (text) => {
        // 간단한 모의 임베딩 반환
        return {
          data: new Float32Array(384).fill(0.1)
        };
      };
    })
  };
});

// Mock for hnswlib-node
jest.mock('hnswlib-node', () => {
  // 사용 중인 함수와 메서드를 로깅
  const debugLog = (method) => {
    if (process.env.DEBUG_MOCKS) {
      console.log(`[Mock] Called: ${method}`);
    }
  };

  const mockHierarchicalNSW = jest.fn().mockImplementation(() => {
    const instance = {
      // 기본 메서드
      initIndex: jest.fn().mockImplementation((maxElements, efConstruction, M) => {
        debugLog('initIndex');
      }),
      
      // 다양한 라이브러리 버전 지원을 위한 init 메서드 별칭
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
      
      // 중요: searchKnn 함수를 더 견고하게 구현
      searchKnn: jest.fn().mockImplementation((query, k) => {
        debugLog('searchKnn');
        // 항상 유효한 neighbors와 distances 배열 반환
        const kValue = Math.max(1, k || 1); // 기본값 보장
        return {
          neighbors: Array.from({ length: kValue }, (_, i) => i),
          distances: Array.from({ length: kValue }, () => 0.1)
        };
      }),
      
      // 추가 필요한 속성
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