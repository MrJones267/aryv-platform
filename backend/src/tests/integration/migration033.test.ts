/**
 * @fileoverview Runs migration 033 against a bare schema, twice
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Production was built from the models and has no ride_requests table. The
 * migration must create it with every column the model uses and be safe to
 * re-run. Runs inside a transaction that is rolled back.
 */

import fs from 'fs';
import path from 'path';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database';

const MIGRATION = path.resolve(__dirname, '../../../migrations/033_ride_requests.sql');

describe('migration 033_ride_requests', () => {
  it('creates ride_requests, and is safe to re-run', async () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const transaction = await sequelize.transaction();
    const run = (statement: string) => sequelize.query(statement, { transaction });

    try {
      await run('CREATE SCHEMA mig033_test');
      // public stays on the path for uuid_generate_v4() and PostGIS types.
      await run('SET LOCAL search_path TO mig033_test, public');
      await run('CREATE TABLE users (id UUID PRIMARY KEY)');

      await run(sql);
      await run(sql);

      const columns = await sequelize.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'mig033_test' AND table_name = 'ride_requests'`,
        { transaction, type: QueryTypes.SELECT },
      );
      expect(columns.map(c => c.column_name).sort()).toEqual([
        'created_at', 'currency', 'departure_time', 'destination_address', 'destination_coordinates', 'expires_at',
        'id', 'max_price', 'note', 'notified_ride_ids', 'origin_address', 'origin_coordinates', 'passenger_id',
        'seats', 'status', 'updated_at',
      ]);
    } finally {
      await transaction.rollback();
    }
  });
});
