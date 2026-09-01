/**
 * @fileoverview No migration may seed an account with a knowable password.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * Migration 003 seeded `admin@aryv-app.com` as a `super_admin` with
 * permissions `["*"]`, using the bcrypt hash of `admin123` — and the comment
 * on the line above spelled the password out. In a public repository, that is
 * a working super-administrator login for anyone who reads it.
 *
 * Migration 026 disables any account still holding that hash. This test stops
 * the next one being added: a seeded password is a credential, and a
 * credential in version control is public.
 */

import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'migrations');

/**
 * The hash migration 003 used. Kept here so the test still recognises it if
 * someone copies that INSERT into a new file.
 */
const KNOWN_BAD_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm';

/**
 * 003 is the file that introduced the problem and cannot be edited — the
 * migration runner checksums applied files and refuses to run if one changes.
 * 026 and 027 neutralise it, and necessarily name the hash to find the rows.
 */
const ALLOWED_TO_MENTION = new Set([
  '003_admin_users_table.sql',
  '026_disable_seeded_admin_accounts.sql',
  '027_admin_tables_without_seed.sql',
]);

/**
 * Naming the hash is only acceptable in order to *close* those accounts.
 * A blanket allowlist would let a future edit turn one of these files back
 * into something that creates them, so the permitted files are checked for
 * how they use it rather than merely excused from the check.
 *
 * 003 is exempt from this narrower rule too: it is the file that seeds them,
 * it is already applied everywhere, and it cannot be edited without breaking
 * the runner's checksum.
 */
const MUST_ONLY_DISABLE = new Set([
  '026_disable_seeded_admin_accounts.sql',
  '027_admin_tables_without_seed.sql',
]);

const migrationFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort();

describe('migrations must not seed usable credentials', () => {
  it('has migrations to check', () => {
    expect(migrationFiles.length).toBeGreaterThan(0);
  });

  it.each(migrationFiles)('%s does not reuse the published admin hash', (file) => {
    if (ALLOWED_TO_MENTION.has(file)) return;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    expect(sql).not.toContain(KNOWN_BAD_HASH);
  });

  it.each(migrationFiles)('%s does not write a password next to its hash', (file) => {
    if (ALLOWED_TO_MENTION.has(file)) return;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    // A comment naming the plaintext beside a hash is what turned migration
    // 003 from "a seeded account" into "a published password".
    expect(sql).not.toMatch(/hash\s+for\s+['"][^'"]+['"]/i);
    expect(sql).not.toMatch(/password\s+is\s+['"][^'"]+['"]/i);
  });

  it.each([...MUST_ONLY_DISABLE])('%s names the hash only to disable, never to insert', (file) => {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    // Comments are stripped first: both files explain the problem in prose and
    // necessarily quote the hash while doing so, which is not a use of it.
    const executable = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    // The rule these files must satisfy: they may name the hash to find and
    // close those rows, but must never create a row in admin_users. An INSERT
    // here would be seeding the account the whole guard exists to prevent.
    expect(executable).not.toMatch(/INSERT\s+INTO\s+admin_users/i);

    // And the reference must actually be doing the closing.
    expect(executable).toContain(KNOWN_BAD_HASH);
    expect(executable).toMatch(/UPDATE\s+admin_users/i);
    expect(executable).toMatch(/is_active\s*=\s*false/i);
  });

  it('migration 026 disables anything still holding the published hash', () => {
    const sql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '026_disable_seeded_admin_accounts.sql'),
      'utf8',
    );

    expect(sql).toContain(KNOWN_BAD_HASH);
    expect(sql).toMatch(/is_active\s*=\s*false/i);
    // And replaces the password, so reactivating the row is not enough to use it.
    expect(sql).toMatch(/password_hash\s*=/i);
  });
});
