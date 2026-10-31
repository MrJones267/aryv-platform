/**
 * @fileoverview Runs migration 035 against a bare schema, twice
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Production was built from the models and has no user_blocks table. The
 * migration must create it with every column the model uses and be safe to
 * re-run. Runs inside a transaction that is rolled back.
 */

import fs from 'fs';
import path from 'path';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database';

const MIGRATION = path.resolve(__dirname, '../../../migrations/035_user_blocks.sql');

describe('migration 035_user_blocks', () => {
  it('creates user_blocks, and is safe to re-run', async () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const transaction = await sequelize.transaction();
    const run = (statement: string) => sequelize.query(statement, { transaction });

    try {
      await run('CREATE SCHEMA mig035_test');
      // public stays on the path for uuid_generate_v4() and PostGIS types.
      await run('SET LOCAL search_path TO mig035_test, public');
      await run('CREATE TABLE users (id UUID PRIMARY KEY)');

      await run(sql);
      await run(sql);

      const columns = await sequelize.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'mig035_test' AND table_name = 'user_blocks'`,
        { transaction, type: QueryTypes.SELECT },
      );
      expect(columns.map(c => c.column_name).sort()).toEqual(['blocked_id', 'blocker_id', 'created_at', 'id', 'updated_at']);
    } finally {
      await transaction.rollback();
    }
  });
});
