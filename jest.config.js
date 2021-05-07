module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  roots: ['<rootDir>/src'],
  modulePathIgnorePatterns: ['<rootDir>/.test-space/*'],
  collectCoverageFrom: ['<rootDir>/**/*.ts', '!<rootDir>/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
