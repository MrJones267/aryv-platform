/**
 * @fileoverview Test setup and configuration
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-20
 */

import { sequelize } from '../config/database';
import { syncDatabase } from '../models';

// Set test environment
// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret';
process.env['DB_NAME'] = 'hitch_test_db';

// Global test setup
beforeAll(async () => {
  try {
    // Sync database for tests
    await syncDatabase(true); // Force recreate for clean slate
  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
});

// Global test teardown
afterAll(async () => {
  try {
    await sequelize.close();
  } catch (error) {
    console.error('Test teardown failed:', error);
  }
});

// Clean database before each test
beforeEach(async () => {
  try {
    // Truncate all tables but keep structure
    await sequelize.truncate({ cascade: true });
  } catch (error) {
    console.error('Test cleanup failed:', error);
  }
});

// Increase test timeout for database operations
jest.setTimeout(30000);
