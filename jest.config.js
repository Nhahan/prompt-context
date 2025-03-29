/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
  transformIgnorePatterns: [
    '/node_modules/(?!(@xenova/transformers)/)'
  ],
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleNameMapper: {
    // ESM 모듈을 모킹
    '@xenova/transformers': '<rootDir>/src/__mocks__/transformers.js'
  }
}; 