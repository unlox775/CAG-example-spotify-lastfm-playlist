// Test setup file
// This file runs before each test file

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  // Uncomment to suppress console output during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.REQUEST_LOG_GROUP = 'test_log_group';