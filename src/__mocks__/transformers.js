// Mock for @xenova/transformers
module.exports = {
  pipeline: jest.fn().mockImplementation((task, model) => {
    return async (text, options) => {
      // 간단한 모의 임베딩 반환
      return {
        data: new Float32Array(384).fill(0.1)
      };
    };
  })
}; 