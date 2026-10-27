/**
 * @fileoverview Runs migration 028 against a bare schema, twice
 * @author Oabona-Majoko
 * @created 2026-10-27
 * @lastModified 2026-10-27
 *
 * The integration schema is built from the models, so nothing else here
 * executes the migration file production will run. This applies it to an
 * empty schema holding only a stub `packages` table, which is the state
 * production is in, then applies it again, since every statement in it is
 * meant to be a no-op the second time. All of it happens inside a
 * transaction that is rolled back, so the test database is left untouched.
 */

import fs from 'fs';
import path from 'path';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database';

const MIGRATION = path.resolve(__dirname, '../../../migrations/028_courier_delivery_tiers.sql');

describe('migration 028_courier_delivery_tiers', () => {
  it('creates the tier and metrics tables, seeds four tiers, and is safe to re-run', async () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const transaction = await sequelize.transaction();
    const q = (statement: string) => sequelize.query(statement, { transaction, type: QueryTypes.SELECT }) as Promise<any[]>;
    const run = (statement: string) => sequelize.query(statement, { transaction });

    try {
      // A schema of its own, pinned to this transaction's connection.
      await run('CREATE SCHEMA mig028_test');
      await run('SET LOCAL search_path TO mig028_test');
      await run('CREATE TABLE packages (id UUID PRIMARY KEY)');

      await run(sql);
      await run(sql);

      const tables = (await q(
        "SELECT table_name::text AS name FROM information_schema.tables WHERE table_schema = 'mig028_test' ORDER BY 1"
      )).map(r => r.name);
      expect(tables).toEqual(['delivery_tiers', 'demand_metrics', 'packages']);

      const tiers = await q('SELECT tier_type, min_delivery_hours, max_delivery_hours FROM delivery_tiers ORDER BY min_delivery_hours');
      expect(tiers).toEqual([
        { tier_type: 'lightning', min_delivery_hours: 1, max_delivery_hours: 2 },
        { tier_type: 'express', min_delivery_hours: 2, max_delivery_hours: 4 },
        { tier_type: 'standard', min_delivery_hours: 4, max_delivery_hours: 8 },
        { tier_type: 'economy', min_delivery_hours: 8, max_delivery_hours: 12 },
      ]);

      const packageColumns = (await q(
        "SELECT column_name::text AS name FROM information_schema.columns WHERE table_schema = 'mig028_test' AND table_name = 'packages' ORDER BY 1"
      )).map(r => r.name);
      expect(packageColumns).toEqual(
        expect.arrayContaining(['delivery_tier_id', 'requested_delivery_time', 'urgency_level', 'demand_multiplier_applied'])
      );

      // The window constraint the model now also enforces. The seeded row is
      // removed first so tier_type's UNIQUE cannot be what rejects this. It
      // aborts the transaction, so it has to be the last statement.
      await run("DELETE FROM delivery_tiers WHERE tier_type = 'express'");
      await expect(
        run(`INSERT INTO delivery_tiers (tier_type, tier_name, description, min_delivery_hours, max_delivery_hours,
               base_price_multiplier, platform_fee_percentage, sla_guarantee)
             VALUES ('express', 'Bad', 'Bad', 10, 5, 1, 20, 90)`)
      ).rejects.toThrow();
    } finally {
      await transaction.rollback();
    }
  });
});
