/**
 * @fileoverview Integration test setup: a real schema in a throwaway database
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2026-10-27
 *
 * This used to call syncDatabase(true), i.e. sequelize.sync({ force: true }).
 * sync() cannot build this schema (model indexes name attributes such as
 * driverId instead of columns such as user_id), so it threw on the first
 * index and every integration suite failed before running a single test.
 * The schema is now built the way production's was, by buildSchemaFromModels.
 */

import { sequelize } from '../config/database';
import '../models';
import { buildSchemaFromModels } from '../database/schemaBuilder';
import { resetAllRateLimits } from '../config/rateLimitStore';

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] || 'test-jwt-secret';

// Global test setup
beforeAll(async () => {
  // The next statement drops every table. Refuse unless this is plainly a
  // test database, so a DATABASE_URL left pointing at production cannot be
  // wiped by running the test suite.
  const [{ db }] = (await sequelize.query('SELECT current_database() AS db', {
    type: 'SELECT',
  })) as Array<{ db: string }>;
  if (!/test/i.test(db)) {
    throw new Error(`Refusing to rebuild "${db}": integration tests only run against a database whose name contains "test"`);
  }

  await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  const result = await buildSchemaFromModels(sequelize);
  if (result.skipped.length) {
    console.warn(`Schema built with ${result.skipped.length} skipped item(s):\n  ${result.skipped.join('\n  ')}`);
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
  // Truncate all tables but keep structure
  await sequelize.truncate({ cascade: true });
  // Each test starts with fresh rate-limit counters, as it does with an
  // empty database.
  await resetAllRateLimits();
});

// Increase test timeout for database operations
jest.setTimeout(30000);
