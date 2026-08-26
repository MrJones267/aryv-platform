/**
 * @fileoverview Create or reset an administrator account.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * Migration 003 seeded `admin@aryv-app.com` with the bcrypt hash of the string
 * `admin123`, in a public repository, and migration 026 disables any account
 * still holding it. That leaves a gap: there was no other way to make an
 * administrator, so this exists to fill it deliberately rather than by seeding
 * a known password into the schema again.
 *
 * Usage:
 *
 *   ADMIN_EMAIL=you@aryv-app.com ADMIN_ROLE=super_admin \
 *     npm run admin:create --workspace backend
 *
 * The password is generated here and printed once. Passing one in via
 * ADMIN_PASSWORD is supported for automated provisioning, but avoid it
 * interactively — it lands in shell history.
 *
 * Re-running for an existing email resets that account's password and
 * reactivates it, which is the recovery path when nobody can sign in.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import { AdminUser } from '../models/AdminUser';
import { sequelize } from '../config/database';
import { validatePasswordStrength } from '../utils/password';

dotenv.config();

// Constants
const VALID_ROLES = ['super_admin', 'admin', 'moderator'] as const;
type AdminRole = (typeof VALID_ROLES)[number];

const PERMISSIONS_BY_ROLE: Record<AdminRole, string[]> = {
  super_admin: ['*'],
  admin: ['users.read', 'users.block', 'rides.manage', 'disputes.manage', 'analytics.read'],
  moderator: ['users.read', 'users.block', 'disputes.manage', 'analytics.read'],
};

/**
 * A password long and random enough that its strength does not depend on the
 * policy check below — the policy is applied anyway, so a supplied password is
 * held to the same standard as one a user would choose.
 */
const generatePassword = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const symbols = '!@#$%^&*-_=+';
  const pick = (set: string) => set[crypto.randomInt(0, set.length)] as string;

  // Guarantee one of each class, then fill to length from the full alphabet.
  const required = [
    pick('ABCDEFGHJKLMNPQRSTUVWXYZ'),
    pick('abcdefghijkmnopqrstuvwxyz'),
    pick('23456789'),
    pick(symbols),
  ];
  const rest = Array.from({ length: 20 }, () => pick(alphabet));

  // Shuffle so the required characters are not always in the same positions.
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join('');
};

const main = async (): Promise<void> => {
  const email = process.env['ADMIN_EMAIL']?.trim().toLowerCase();
  const roleInput = (process.env['ADMIN_ROLE'] ?? 'admin').trim() as AdminRole;
  const suppliedPassword = process.env['ADMIN_PASSWORD'];

  if (!email) {
    console.error('ADMIN_EMAIL is required.');
    console.error('  ADMIN_EMAIL=you@aryv-app.com ADMIN_ROLE=super_admin npm run admin:create --workspace backend');
    process.exit(1);
  }

  if (!VALID_ROLES.includes(roleInput)) {
    console.error(`ADMIN_ROLE must be one of: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  const password = suppliedPassword ?? generatePassword();
  const strength = validatePasswordStrength(password);
  if (!strength.ok) {
    console.error(`ADMIN_PASSWORD rejected: ${strength.message}`);
    process.exit(1);
  }

  await sequelize.authenticate();

  const [firstName, ...lastNameParts] = (process.env['ADMIN_NAME'] ?? 'Platform Admin').split(' ');
  const lastName = lastNameParts.join(' ') || 'Admin';

  const existing = await AdminUser.findOne({ where: { email } });

  if (existing) {
    await existing.setPassword(password);
    existing.isActive = true;
    existing.role = roleInput;
    existing.permissions = PERMISSIONS_BY_ROLE[roleInput];
    existing.failedLoginAttempts = 0;
    existing.lockoutUntil = null;
    await existing.save();
    console.log(`Reset the existing ${roleInput} account for ${email}.`);
  } else {
    const admin = AdminUser.build({
      email,
      passwordHash: 'placeholder',
      firstName: firstName || 'Platform',
      lastName,
      role: roleInput,
      permissions: PERMISSIONS_BY_ROLE[roleInput],
      isActive: true,
      failedLoginAttempts: 0,
      twoFactorEnabled: false,
    } as never);
    await admin.setPassword(password);
    await admin.save();
    console.log(`Created a ${roleInput} account for ${email}.`);
  }

  if (!suppliedPassword) {
    console.log('');
    console.log('  Password (shown once — store it in your password manager now):');
    console.log(`  ${password}`);
    console.log('');
  }

  await sequelize.close();
};

main().catch(async (error) => {
  console.error('Could not create the administrator:', (error as Error).message);
  try {
    await sequelize.close();
  } catch {
    // already closed
  }
  process.exit(1);
});
