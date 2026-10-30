/**
 * @fileoverview Runs migration 034 against a bare schema, twice
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Production was built from the models and has no content_reports table. The
 * migration must create it with every column the model uses and be safe to
 * re-run. Runs inside a transaction that is rolled back.
 */

import fs from 'fs';
import path from 'path';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database';

const MIGRATION = path.resolve(__dirname, '../../../migrations/034_content_reports.sql');

describe('migration 034_content_reports', () => {
  it('creates content_reports, and is safe to re-run', async () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const transaction = await sequelize.transaction();
    const run = (statement: string) => sequelize.query(statement, { transaction });

    try {
      await run('CREATE SCHEMA mig034_test');
      // public stays on the path for uuid_generate_v4() and PostGIS types.
      await run('SET LOCAL search_path TO mig034_test, public');
      await run('CREATE TABLE users (id UUID PRIMARY KEY)');

      await run(sql);
      await run(sql);

      const columns = await sequelize.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'mig034_test' AND table_name = 'content_reports'`,
        { transaction, type: QueryTypes.SELECT },
      );
      expect(columns.map(c => c.column_name).sort()).toEqual([
        'created_at', 'details', 'group_chat_id', 'id', 'message_excerpt', 'message_id', 'reason', 'reported_user_id',
        'reporter_id', 'resolution_notes', 'resolved_at', 'resolved_by', 'status', 'updated_at',
      ]);
    } finally {
      await transaction.rollback();
    }
  });
});
