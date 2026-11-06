/**
 * @fileoverview Runs migration 037 against a bare schema, twice
 * @author Oabona-Majoko
 * @created 2026-11-05
 * @lastModified 2026-11-05
 *
 * cash_wallets, cash_wallet_transactions and promo_codes had no migration, so
 * a database built from migrations had none of them. The migration must
 * create all three with the columns the models use, keep migration 025's
 * one-credit-per-reference guarantee, and be safe to re-run. Runs inside a
 * transaction that is rolled back.
 */

import fs from 'fs';
import path from 'path';
import { QueryTypes, UniqueConstraintError } from 'sequelize';
import { sequelize } from '../../config/database';
import { CashWallet, CashWalletTransaction } from '../../models/CashWallet';
import PromoCode from '../../models/PromoCode';

const MIGRATION = path.resolve(__dirname, '../../../migrations/037_cash_wallets_and_promo_codes.sql');
const SCHEMA = 'mig037_test';

const columnsOf = (model: any): string[] =>
  Object.values(model.rawAttributes as Record<string, any>).map((a) => a.field).sort();

describe('migration 037_cash_wallets_and_promo_codes', () => {
  it('creates the three tables as the models define them, and is safe to re-run', async () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const transaction = await sequelize.transaction();
    const run = (statement: string) => sequelize.query(statement, { transaction });
    const select = <T extends object>(statement: string) =>
      sequelize.query<T>(statement, { transaction, type: QueryTypes.SELECT });

    try {
      await run(`CREATE SCHEMA ${SCHEMA}`);
      await run(`SET LOCAL search_path TO ${SCHEMA}, public`);
      await run('CREATE TABLE users (id UUID PRIMARY KEY)');

      await run(sql);
      await run(sql);

      for (const [table, model] of [
        ['cash_wallets', CashWallet],
        ['cash_wallet_transactions', CashWalletTransaction],
        ['promo_codes', PromoCode],
      ] as const) {
        const rows = await select<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema = '${SCHEMA}' AND table_name = '${table}'`,
        );
        expect(rows.map((r) => r.column_name).sort()).toEqual(columnsOf(model));
      }

      const indexes = await select<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE schemaname = '${SCHEMA}'`,
      );
      expect(indexes.map((i) => i.indexname)).toContain('cash_wallet_transactions_load_reference_unique');

      // Foreign keys land on these tables even when a same-named constraint
      // already exists elsewhere, as it does in public in a model-built schema.
      const fks = await select<{ conname: string }>(
        `SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
          WHERE n.nspname = '${SCHEMA}' AND c.contype = 'f'`,
      );
      expect(fks.map((f) => f.conname).sort()).toEqual([
        'fk_cash_wallet_transactions_wallet_id',
        'fk_cash_wallets_user_id',
      ]);

      // The guarantee itself: a second credit for the same reference fails.
      await run(`INSERT INTO users (id) VALUES ('11111111-1111-4111-8111-111111111111')`);
      await run(`INSERT INTO cash_wallets (id, user_id, created_at, updated_at)
                 VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', NOW(), NOW())`);
      const load = (id: string) => run(
        `INSERT INTO cash_wallet_transactions
           (id, wallet_id, type, amount, balance_before, balance_after, source, source_reference, description, created_at, updated_at)
         VALUES ('${id}', '22222222-2222-4222-8222-222222222222', 'load', 50, 0, 50, 'mobile_money', 'mm_ref_1', 'Top-up', NOW(), NOW())`,
      );
      await load('33333333-3333-4333-8333-333333333333');
      await run('SAVEPOINT duplicate_load');
      await expect(load('44444444-4444-4444-8444-444444444444')).rejects.toBeInstanceOf(UniqueConstraintError);
      await run('ROLLBACK TO SAVEPOINT duplicate_load');
    } finally {
      await transaction.rollback();
    }
  });
});
