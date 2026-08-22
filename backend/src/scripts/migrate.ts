/**
 * @fileoverview Applies the raw SQL migrations in migrations/ in order, once
 *               each, recording what has run.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Why this exists: nothing applied these. `run-migrations.sh` is a stale local
 * Docker script that only covers 001–003, and `npm run db:migrate` invoked
 * sequelize-cli, which cannot execute plain .sql files. Migrations 004 onward
 * were therefore applied by hand, with no record of which had run against
 * which environment — so nobody could answer whether a given database was up
 * to date.
 *
 * Run: npm run db:migrate        (apply everything outstanding)
 *      npm run db:migrate:status (list applied vs pending, change nothing)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { sequelize } from '../config/database';
import { QueryTypes } from 'sequelize';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

/**
 * Files that are not sequential migrations: a duplicated 003, plus one-off
 * helper scripts. Skipped rather than deleted so their history stays visible.
 */
const EXCLUDED = new Set([
  '003_fix_rides_schema.sql',
  'add-google-auth.sql',
  'simple_schema.sql',
]);

interface AppliedRow {
  filename: string;
  checksum: string;
}

const listMigrationFiles = (): string[] =>
  fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !EXCLUDED.has(f))
    .sort();

const checksumOf = (filePath: string): string =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const ensureTrackingTable = async (): Promise<void> => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);
};

const getApplied = async (): Promise<Map<string, string>> => {
  const rows = await sequelize.query<AppliedRow>(
    'SELECT filename, checksum FROM schema_migrations',
    { type: QueryTypes.SELECT },
  );
  return new Map(rows.map((r) => [r.filename, r.checksum]));
};

/**
 * Marks everything up to and including 012 as applied without running it, for
 * a database that predates this runner. The existing migrations are written
 * with IF NOT EXISTS throughout, so re-running them is close to harmless — but
 * "close to" is not a basis on which to re-run DDL against production.
 */
const baseline = async (upTo: string): Promise<void> => {
  await ensureTrackingTable();
  const files = listMigrationFiles().filter((f) => f <= upTo);

  for (const filename of files) {
    const checksum = checksumOf(path.join(MIGRATIONS_DIR, filename));
    await sequelize.query(
      `INSERT INTO schema_migrations (filename, checksum)
       VALUES ($filename, $checksum)
       ON CONFLICT (filename) DO NOTHING`,
      { bind: { filename, checksum } },
    );
    console.log(`  baselined  ${filename}`);
  }
};

const status = async (): Promise<void> => {
  await ensureTrackingTable();
  const applied = await getApplied();

  console.log('\nMigration status\n');
  for (const filename of listMigrationFiles()) {
    const recorded = applied.get(filename);
    if (!recorded) {
      console.log(`  PENDING    ${filename}`);
      continue;
    }
    const current = checksumOf(path.join(MIGRATIONS_DIR, filename));
    if (current !== recorded) {
      console.log(`  CHANGED    ${filename}  (file edited after it was applied)`);
    } else {
      console.log(`  applied    ${filename}`);
    }
  }
  console.log('');
};

const migrate = async (): Promise<void> => {
  await ensureTrackingTable();
  const applied = await getApplied();
  const files = listMigrationFiles();

  // A migration edited after being applied means the database and the file no
  // longer agree. Stop rather than guess which is right.
  const drifted = files.filter((f) => {
    const recorded = applied.get(f);
    return recorded && recorded !== checksumOf(path.join(MIGRATIONS_DIR, f));
  });

  if (drifted.length > 0) {
    throw new Error(
      `These migrations were modified after being applied: ${drifted.join(', ')}. ` +
        'Add a new migration instead of editing an applied one.',
    );
  }

  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('Nothing to apply; the database is up to date.');
    return;
  }

  console.log(`Applying ${pending.length} migration(s)\n`);

  for (const filename of pending) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = checksumOf(filePath);

    // Each migration runs in its own transaction: a failure rolls that file
    // back whole rather than leaving the schema half-changed.
    const transaction = await sequelize.transaction();
    try {
      await sequelize.query(sql, { transaction });
      await sequelize.query(
        `INSERT INTO schema_migrations (filename, checksum) VALUES ($filename, $checksum)`,
        { bind: { filename, checksum }, transaction },
      );
      await transaction.commit();
      console.log(`  applied    ${filename}`);
    } catch (error) {
      await transaction.rollback();
      console.error(`  FAILED     ${filename}`);
      throw error;
    }
  }

  console.log('\nDone.');
};

const main = async (): Promise<void> => {
  const command = process.argv[2] ?? 'up';

  try {
    await sequelize.authenticate();

    if (command === 'status') {
      await status();
    } else if (command === 'baseline') {
      const upTo = process.argv[3];
      if (!upTo) {
        throw new Error('Usage: migrate baseline <filename-to-mark-through>');
      }
      await baseline(upTo);
    } else {
      await migrate();
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error(`\nMigration error: ${(error as Error).message}`);
    await sequelize.close().catch(() => undefined);
    process.exit(1);
  }
};

void main();
