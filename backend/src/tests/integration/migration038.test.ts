/**
 * @fileoverview Runs migration 038 (the aryv_app role) twice, then acts as it
 * @author Oabona-Majoko
 * @created 2026-11-06
 * @lastModified 2026-11-06
 *
 * The API is meant to connect as aryv_app instead of the postgres superuser.
 * The role must be able to do everything the API does to data, nothing to
 * the schema, and must still pass the API's startup statement. Tables that
 * later migrations create must be usable without another grant. Everything
 * runs in a transaction that is rolled back, including the role itself.
 */

import fs from 'fs';
import path from 'path';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database';

const MIGRATION = path.resolve(__dirname, '../../../migrations/038_app_role.sql');

describe('migration 038_app_role', () => {
  it('creates a role that can use the data but not change the schema, and is safe to re-run', async () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const transaction = await sequelize.transaction();
    const run = (statement: string) => sequelize.query(statement, { transaction });
    const one = async <T extends object>(statement: string): Promise<T> =>
      (await sequelize.query<T>(statement, { transaction, type: QueryTypes.SELECT }))[0]!;
    const refused = async (statement: string): Promise<boolean> => {
      await run('SAVEPOINT attempt');
      try {
        await run(statement);
        await run('RELEASE SAVEPOINT attempt');
        return false;
      } catch {
        await run('ROLLBACK TO SAVEPOINT attempt');
        return true;
      }
    };

    try {
      await run(sql);
      await run(sql);

      const role = await one<{ rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean; rolcanlogin: boolean }>(
        `SELECT rolsuper, rolcreatedb, rolcreaterole, rolcanlogin FROM pg_roles WHERE rolname = 'aryv_app'`,
      );
      expect(role).toEqual({ rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolcanlogin: false });

      // A table created after the migration, as a later migration would.
      await run('CREATE TABLE mig038_later (id INT PRIMARY KEY)');

      await run('SET LOCAL ROLE aryv_app');

      // Data: yes, including the table created afterwards.
      await run('SELECT count(*) FROM users');
      await run('INSERT INTO mig038_later (id) VALUES (1)');
      await run('UPDATE mig038_later SET id = 2');
      await run('DELETE FROM mig038_later');

      // The API's startup statement is a no-op for it once PostGIS exists.
      expect(await refused('CREATE EXTENSION IF NOT EXISTS postgis')).toBe(false);

      // Schema and server: no.
      expect(await refused('CREATE TABLE mig038_denied (id INT)')).toBe(true);
      expect(await refused('DROP TABLE mig038_later')).toBe(true);
      expect(await refused('ALTER TABLE users ADD COLUMN mig038 INT')).toBe(true);
      expect(await refused('CREATE ROLE mig038_other')).toBe(true);
    } finally {
      await transaction.rollback();
    }
  });
});
