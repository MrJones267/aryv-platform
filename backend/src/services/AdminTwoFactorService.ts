/**
 * @fileoverview Two-factor sign-in for admin panel accounts
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * An admin token can block users, release payments and change fees, and a
 * password alone protected it. This adds an authenticator-app code.
 *
 * - Secrets are stored encrypted (AES-256-GCM) under TOTP_ENCRYPTION_KEY,
 *   which is deliberately not one of the JWT secrets: those are due to be
 *   rotated, and rotating them must not lock every admin out. Without the
 *   key, two-factor cannot be turned on, and accounts that already use it
 *   cannot sign in (they fail closed, rather than skipping the second step).
 * - Setting up stores the secret while two-factor stays off; it turns on
 *   only once a code from the app is confirmed, so a half-finished setup
 *   cannot lock anyone out.
 * - A code is accepted once: the time step it was used for is remembered.
 * - Recovery from a lost phone is `npm run admin:create` for that email,
 *   which resets the password and turns two-factor off.
 */

import crypto from 'crypto';
import QRCode from 'qrcode';
import { AdminUser } from '../models/AdminUser';
import { redisClient } from '../config/redis';
import { generateTotpSecret, otpauthUri, verifyTotp, TOTP_STEP_SECONDS, TOTP_WINDOW } from '../utils/totp';

// Constants
const ISSUER = 'ARYV Admin';
const KEY_ENV = 'TOTP_ENCRYPTION_KEY';
const LAST_STEP_KEY = (adminId: string) => `admin2fa:last-step:${adminId}`;
const LAST_STEP_TTL_SECONDS = (2 * TOTP_WINDOW + 2) * TOTP_STEP_SECONDS;

const encryptionKey = (): Buffer | null => {
  const raw = process.env[KEY_ENV];
  // Any string of reasonable length; hashed to the 32 bytes AES-256 needs.
  return raw && raw.length >= 16 ? crypto.createHash('sha256').update(raw).digest() : null;
};

/** Whether the server can encrypt and read two-factor secrets. */
export const isTwoFactorConfigured = (): boolean => encryptionKey() !== null;

const encrypt = (plain: string): string => {
  const key = encryptionKey();
  if (!key) throw new Error(`${KEY_ENV} is not set`);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  // v1:<iv>:<tag>:<ciphertext>, so a future change of scheme can be told apart.
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
};

const decrypt = (stored: string): string => {
  const key = encryptionKey();
  if (!key) throw new Error(`${KEY_ENV} is not set`);
  const [version, iv, tag, data] = stored.split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognised two-factor secret format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
};

export type TwoFactorError = 'NOT_CONFIGURED' | 'ALREADY_ENABLED' | 'NOT_STARTED' | 'NOT_ENABLED' | 'INVALID_CODE' | 'CODE_REUSED' | 'INVALID_PASSWORD';

export class AdminTwoFactorService {
  // The last accepted step per admin, for when Redis is unreachable.
  private lastSteps = new Map<string, number>();

  /** Starts setup: a new secret, kept while two-factor stays off until confirmed. */
  async beginSetup(admin: AdminUser): Promise<{ ok: true; secret: string; otpauthUri: string; qrCodeDataUrl: string } | { ok: false; error: TwoFactorError }> {
    if (!isTwoFactorConfigured()) return { ok: false, error: 'NOT_CONFIGURED' };
    if (admin.twoFactorEnabled) return { ok: false, error: 'ALREADY_ENABLED' };

    const secret = generateTotpSecret();
    admin.twoFactorSecret = encrypt(secret);
    await admin.save();

    const uri = otpauthUri(ISSUER, admin.email, secret);
    return { ok: true, secret, otpauthUri: uri, qrCodeDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 240 }) };
  }

  /** Finishes setup once the admin proves their app produces the right codes. */
  async confirmSetup(admin: AdminUser, code: string): Promise<{ ok: true } | { ok: false; error: TwoFactorError }> {
    if (!isTwoFactorConfigured()) return { ok: false, error: 'NOT_CONFIGURED' };
    if (admin.twoFactorEnabled) return { ok: false, error: 'ALREADY_ENABLED' };
    if (!admin.twoFactorSecret) return { ok: false, error: 'NOT_STARTED' };

    const step = verifyTotp(decrypt(admin.twoFactorSecret), code);
    if (step === null) return { ok: false, error: 'INVALID_CODE' };

    await this.rememberStep(admin.id, step);
    admin.twoFactorEnabled = true;
    await admin.save();
    return { ok: true };
  }

  /** Turns two-factor off; needs the password and a current code. */
  async disable(admin: AdminUser, password: string, code: string): Promise<{ ok: true } | { ok: false; error: TwoFactorError }> {
    if (!admin.twoFactorEnabled) return { ok: false, error: 'NOT_ENABLED' };
    if (!(await admin.validatePassword(password))) return { ok: false, error: 'INVALID_PASSWORD' };
    const check = await this.verifySignInCode(admin, code);
    if (!check.ok) return check;

    admin.twoFactorEnabled = false;
    admin.twoFactorSecret = null;
    await admin.save();
    return { ok: true };
  }

  /** Checks the code given at sign-in, and refuses one already used. */
  async verifySignInCode(admin: AdminUser, code: string): Promise<{ ok: true } | { ok: false; error: TwoFactorError }> {
    if (!isTwoFactorConfigured()) return { ok: false, error: 'NOT_CONFIGURED' };
    if (!admin.twoFactorSecret) return { ok: false, error: 'NOT_ENABLED' };

    const step = verifyTotp(decrypt(admin.twoFactorSecret), code);
    if (step === null) return { ok: false, error: 'INVALID_CODE' };
    if (step <= (await this.lastStep(admin.id))) return { ok: false, error: 'CODE_REUSED' };

    await this.rememberStep(admin.id, step);
    return { ok: true };
  }

  private async lastStep(adminId: string): Promise<number> {
    const stored = Number(await redisClient.get(LAST_STEP_KEY(adminId))) || 0;
    return Math.max(stored, this.lastSteps.get(adminId) ?? 0);
  }

  private async rememberStep(adminId: string, step: number): Promise<void> {
    this.lastSteps.set(adminId, step);
    await redisClient.set(LAST_STEP_KEY(adminId), String(step), LAST_STEP_TTL_SECONDS);
  }
}

export const adminTwoFactorService = new AdminTwoFactorService();
export default adminTwoFactorService;
