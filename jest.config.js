module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__', '<rootDir>/src'],
  modulePathIgnorePatterns: ['<rootDir>/.test-space/*'],
  collectCoverageFrom: ['<rootDir>/**/*.ts', '!<rootDir>/node_modules/'],
};
