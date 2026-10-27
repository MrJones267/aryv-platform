/**
 * @fileoverview Model-derived schema builder for the ARYV TypeScript backend.
 *
 * Builds a complete, correct PostgreSQL schema from the Sequelize models without
 * relying on sequelize.sync(), whose index/FK generation is broken in this
 * codebase (index `fields` reference attribute names, not columns; partial-index
 * `where` clauses reference attributes; FK auto-indexes use attribute names).
 *
 * Strategy:
 *   1. Drop & recreate the public schema (+ required extensions).
 *   2. Create every table via queryInterface.createTable (no FK refs, so no
 *      ordering or auto-index issues), using the model's own column definitions.
 *   3. Add indexes + unique constraints from each model, resolving every field
 *      to its REAL column name via rawAttributes (handles arbitrary mappings
 *      like driverId -> user_id) and resolving partial-index where-clause keys.
 *   4. Add foreign keys from belongsTo associations, resolved the same way.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/build-schema.ts
 * Safe to re-run (drops and rebuilds). Intended for fresh databases only.
 *
 * The builder itself lives in src/database/schemaBuilder.ts, where the
 * integration tests use it too.
 *
 * @author Oabona-Majoko
 * @created 2026-06-20
 */

import { sequelize, testConnection } from '../src/models';
import { buildSchemaFromModels } from '../src/database/schemaBuilder';

(async () => {
  try {
    await testConnection();
    await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    const result = await buildSchemaFromModels(sequelize);

    console.log(`SCHEMA_BUILD_OK tables=${result.tables} uniques=${result.uniques} indexes=${result.indexes} fks=${result.fks} skipped=${result.skipped.length}`);
    if (result.skipped.length) {
      console.log('--- skipped (review) ---');
      result.skipped.forEach((s) => console.log('  - ' + s));
    }
    await sequelize.close();
    process.exit(0);
  } catch (e: any) {
    console.error('SCHEMA_BUILD_FATAL:', e.message);
    process.exit(1);
  }
})();
