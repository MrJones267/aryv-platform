/**
 * @fileoverview Runs migration 030 against a bare schema, twice
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * commission_ledger.recorded_by may carry a users foreign key (migration
 * 011) under its inline name. This creates it on a stub table, applies the
 * migration twice, and checks no foreign key on the column survives, inside
 * a transaction that is rolled back.
 */

import fs from 'fs';
import path from 'path';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database';

const MIGRATION = path.resolve(__dirname, '../../../migrations/030_commission_ledger_recorded_by_any_admin.sql');

describe('migration 030_commission_ledger_recorded_by_any_admin', () => {
  it('drops the foreign key on recorded_by and is safe to re-run', async () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const transaction = await sequelize.transaction();
    const run = (statement: string) => sequelize.query(statement, { transaction });
    const q = (statement: string) => sequelize.query(statement, { transaction, type: QueryTypes.SELECT }) as Promise<any[]>;

    try {
      await run('CREATE SCHEMA mig030_test');
      await run('SET LOCAL search_path TO mig030_test');
      await run('CREATE TABLE users (id UUID PRIMARY KEY)');
      await run(`CREATE TABLE commission_ledger (
                   id UUID PRIMARY KEY,
                   driver_id UUID NOT NULL REFERENCES users(id),
                   recorded_by UUID NULL REFERENCES users(id))`);

      await run(sql);
      await run(sql);

      const keys = await q(
        `SELECT a.attname::text AS col FROM pg_constraint c
           JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
          WHERE c.conrelid = 'mig030_test.commission_ledger'::regclass AND c.contype = 'f' ORDER BY 1`
      );
      // driver_id keeps its foreign key; only recorded_by loses its own.
      expect(keys.map(k => k.col)).toEqual(['driver_id']);
    } finally {
      await transaction.rollback();
    }
  });
});
