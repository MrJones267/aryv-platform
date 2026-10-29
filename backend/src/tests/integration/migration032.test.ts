/**
 * @fileoverview Runs migration 032 against a bare schema, twice
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * Two starting points: neither cash table exists (production, built without
 * them), or migration 004's cash_disputes does, with its users foreign key on
 * assigned_to. Either way the migration must leave both tables with every
 * column the models use, no users foreign key on an admin column, and be
 * safe to re-run. Runs inside a transaction that is rolled back.
 */

import fs from 'fs';
import path from 'path';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database';

const MIGRATION = path.resolve(__dirname, '../../../migrations/032_cash_payment_holds_and_disputes.sql');

describe('migration 032_cash_payment_holds_and_disputes', () => {
  it.each([
    ['neither table exists', false],
    ["004's cash_disputes exists", true],
  ])('creates what is missing when %s, and is safe to re-run', async (_label, withOld) => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const transaction = await sequelize.transaction();
    const run = (statement: string) => sequelize.query(statement, { transaction });
    const q = (statement: string) => sequelize.query(statement, { transaction, type: QueryTypes.SELECT }) as Promise<any[]>;

    try {
      await run('CREATE SCHEMA mig032_test');
      // public stays on the path for uuid_generate_v4().
      await run('SET LOCAL search_path TO mig032_test, public');
      await run('CREATE TABLE users (id UUID PRIMARY KEY)');
      await run('CREATE TABLE cash_transactions (id UUID PRIMARY KEY)');
      await run(`CREATE TABLE delivery_disputes (id UUID PRIMARY KEY, resolved_by_admin_id UUID REFERENCES users(id))`);
      if (withOld) {
        await run(`CREATE TABLE cash_disputes (
                     id UUID PRIMARY KEY, transaction_id UUID NOT NULL REFERENCES cash_transactions(id),
                     reporter_id UUID NOT NULL REFERENCES users(id), reason VARCHAR(100) NOT NULL,
                     description TEXT, evidence JSONB, priority INTEGER NOT NULL DEFAULT 50,
                     status VARCHAR(20) NOT NULL DEFAULT 'open', assigned_to UUID REFERENCES users(id),
                     resolution_notes TEXT, resolved_at TIMESTAMPTZ,
                     created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())`);
      }

      await run(sql);
      await run(sql);

      const columns = await q(
        `SELECT column_name::text AS c FROM information_schema.columns
          WHERE table_schema = 'mig032_test' AND table_name = 'cash_disputes' ORDER BY 1`
      );
      expect(columns.map(c => c.c)).toEqual(expect.arrayContaining([
        'amount_paid', 'outcome', 'resolved_by', 'transaction_status_before', 'transaction_id', 'reporter_id',
      ]));
      const holds = await q(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'mig032_test' AND table_name = 'trust_holds'`
      );
      expect(holds).toHaveLength(1);

      const keys = await q(
        `SELECT c.conrelid::regclass::text AS t, a.attname::text AS col FROM pg_constraint c
           JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
          WHERE c.contype = 'f' AND c.connamespace = 'mig032_test'::regnamespace ORDER BY 1, 2`
      );
      // Only the foreign keys to real users and payments survive.
      expect(keys.map(k => `${k.t}.${k.col}`)).toEqual([
        'cash_disputes.reporter_id', 'cash_disputes.transaction_id',
        'trust_holds.transaction_id', 'trust_holds.user_id',
      ]);
    } finally {
      await transaction.rollback();
    }
  });
});
