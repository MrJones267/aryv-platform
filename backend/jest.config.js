// Shared configuration applied to every Jest project below.
const sharedConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/'],

  // Mock hygiene between tests
  clearMocks: true,
  restoreMocks: true,
};

module.exports = {
  // Coverage configuration (root-level; applies across projects)
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts}',
    '!src/**/*.spec.{js,ts}',
    '!src/index.ts',
    '!src/config/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Force exit / open-handle detection at the runner level
  forceExit: true,
  detectOpenHandles: true,

  projects: [
    {
      ...sharedConfig,
      // Pure unit tests — fully mocked, no database or Redis required.
      displayName: 'unit',
      testMatch: ['**/src/tests/unit/**/*.test.ts', '**/src/tests/unit/**/*.spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup-unit.ts'],
      testTimeout: 10000,
    },
    {
      ...sharedConfig,
      // Integration tests — require a live PostgreSQL (and optionally Redis).
      displayName: 'integration',
      testMatch: [
        '**/src/tests/integration/**/*.test.ts',
        '**/src/tests/integration/**/*.spec.ts',
        '**/src/tests/demand-pricing.test.ts',
      ],
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
      testTimeout: 30000,
    },
  ],
};
