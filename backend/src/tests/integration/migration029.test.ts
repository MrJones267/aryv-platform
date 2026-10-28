/**
 * @fileoverview Runs migration 029 against a bare schema, twice
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * Production may hold the reviewed_by foreign key under either of two names
 * (migration 013's inline constraint, or the cutover schema builder's). This
 * creates both on a stub table, applies the migration twice, and checks that
 * no foreign key on the column survives while the attribution CHECK does,
 * inside a transaction that is rolled back.
 */

import fs from 'fs';
import path from 'path';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database';

const MIGRATION = path.resolve(__dirname, '../../../migrations/029_driver_document_reviewer_any_admin.sql');

describe('migration 029_driver_document_reviewer_any_admin', () => {
  it('drops every foreign key on reviewed_by, keeps the attribution check, and is safe to re-run', async () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const transaction = await sequelize.transaction();
    const run = (statement: string) => sequelize.query(statement, { transaction });
    const q = (statement: string) => sequelize.query(statement, { transaction, type: QueryTypes.SELECT }) as Promise<any[]>;

    try {
      await run('CREATE SCHEMA mig029_test');
      await run('SET LOCAL search_path TO mig029_test');
      await run('CREATE TABLE users (id UUID PRIMARY KEY)');
      await run(`CREATE TABLE driver_documents (
                   id UUID PRIMARY KEY,
                   status VARCHAR(30) NOT NULL,
                   reviewed_by UUID NULL REFERENCES users(id),
                   reviewed_at TIMESTAMPTZ NULL,
                   CONSTRAINT chk_driver_documents_decision_attributed CHECK (
                     status NOT IN ('approved', 'rejected', 'requires_resubmission')
                     OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)))`);
      await run('ALTER TABLE driver_documents ADD CONSTRAINT fk_driver_documents_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id)');

      await run(sql);
      await run(sql);

      const constraints = (await q(
        `SELECT conname::text AS name, contype::text AS type FROM pg_constraint
          WHERE conrelid = 'mig029_test.driver_documents'::regclass ORDER BY 1`
      ));
      expect(constraints.filter(c => c.type === 'f')).toEqual([]);
      expect(constraints.map(c => c.name)).toContain('chk_driver_documents_decision_attributed');

      // A reviewer id that is not a users row is now accepted.
      await run(`INSERT INTO driver_documents (id, status, reviewed_by, reviewed_at)
                 VALUES ('00000000-0000-4000-8000-000000000001', 'approved', '00000000-0000-4000-8000-0000000000aa', NOW())`);
      // An unattributed decision is still refused. It aborts the transaction,
      // so it has to be last.
      await expect(run(`INSERT INTO driver_documents (id, status) VALUES ('00000000-0000-4000-8000-000000000002', 'approved')`))
        .rejects.toThrow();
    } finally {
      await transaction.rollback();
    }
  });
});
