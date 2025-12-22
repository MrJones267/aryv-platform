/**
 * @fileoverview Jest setup configuration for test environment
 * @author Oabona-Majoko
 * @created 2025-01-25
 */

const dotenv = require('dotenv');
const path = require('path');

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://hitch_user:hitch_secure_password@localhost:5433/hitch';

// Increase timeout for database operations
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Test database cleanup utility
  async cleanDatabase() {
    const { sequelize } = require('../src/config/database');
    
    try {
      await sequelize.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');
      await sequelize.query('TRUNCATE TABLE rides RESTART IDENTITY CASCADE;');
      await sequelize.query('TRUNCATE TABLE bookings RESTART IDENTITY CASCADE;');
      await sequelize.query('TRUNCATE TABLE vehicles RESTART IDENTITY CASCADE;');
      await sequelize.query('TRUNCATE TABLE reviews RESTART IDENTITY CASCADE;');
      await sequelize.query('TRUNCATE TABLE payments RESTART IDENTITY CASCADE;');
      await sequelize.query('TRUNCATE TABLE notifications RESTART IDENTITY CASCADE;');
      await sequelize.query('TRUNCATE TABLE messages RESTART IDENTITY CASCADE;');
    } catch (error) {
      console.warn('Database cleanup failed:', error.message);
    }
  },

  // Create test user utility
  async createTestUser(userData = {}) {
    const bcrypt = require('bcryptjs');
    const User = require('../src/models/User');
    
    const defaultUserData = {
      email: `test.${Date.now()}@hitch.com`,
      passwordHash: await bcrypt.hash('test123', 12),
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: `+123456${Date.now().toString().slice(-4)}`,
      role: 'passenger',
      isVerified: true,
      isActive: true
    };

    return await User.create({ ...defaultUserData, ...userData });
  },

  // Generate JWT token utility
  async generateTestToken(user) {
    const jwt = require('jsonwebtoken');
    
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '1h' }
    );
  },

  // Database transaction utility
  async withTransaction(callback) {
    const { sequelize } = require('../src/config/database');
    const transaction = await sequelize.transaction();
    
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  // Wait utility for async operations
  async wait(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Generate random test data
  generateRandomEmail() {
    return `test.${Math.random().toString(36).substr(2, 9)}@hitch.com`;
  },

  generateRandomPhone() {
    return `+1234567${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  },

  // Mock external services (placeholder for future implementation)
  mockExternalServices() {
    // External service mocking will be implemented when services are created
    console.log('External services mocking initialized');
  }
};

// Console log filtering for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  // Filter out known test-related warnings
  const message = args[0];
  if (typeof message === 'string') {
    if (message.includes('DeprecationWarning') || 
        message.includes('ExperimentalWarning') ||
        message.includes('warning: possible EventEmitter memory leak')) {
      return;
    }
  }
  originalConsoleError.apply(console, args);
};

console.warn = (...args) => {
  // Filter out known test-related warnings
  const message = args[0];
  if (typeof message === 'string') {
    if (message.includes('DeprecationWarning') || 
        message.includes('ExperimentalWarning')) {
      return;
    }
  }
  originalConsoleWarn.apply(console, args);
};

// Global setup for all tests
beforeAll(async () => {
  // Initialize test utilities
  global.testUtils.mockExternalServices();
});

// Global teardown for all tests
afterAll(async () => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Test lifecycle hooks
beforeEach(async () => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(async () => {
  // Clean up after each test
  jest.restoreAllMocks();
});