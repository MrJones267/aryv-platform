/**
 * @fileoverview Time-based one-time passwords (RFC 6238) for admin sign-in
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * The codes Google Authenticator, Microsoft Authenticator, Authy and 1Password
 * produce: HMAC-SHA1 over the 30-second time step, truncated to six digits
 * (RFC 4226 section 5.3). Written against node:crypto rather than adding a
 * dependency to the sign-in path; tested against the RFC's own vectors.
 */

import crypto from 'crypto';

// Constants
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Steps either side of now that are accepted, for clocks that drift. */
export const TOTP_WINDOW = 1;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32, unpadded: the form authenticator apps expect. */
export const base32Encode = (buffer: Buffer): string => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

export const base32Decode = (input: string): Buffer => {
  const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

/** A new random secret, 160 bits as RFC 4226 recommends, base32-encoded. */
export const generateTotpSecret = (): string => base32Encode(crypto.randomBytes(20));

/** The step number a moment falls in. */
export const timeStep = (at: Date | number = Date.now()): number =>
  Math.floor((typeof at === 'number' ? at : at.getTime()) / 1000 / TOTP_STEP_SECONDS);

/** The code for one time step (RFC 4226 HOTP with the step as the counter). */
export const totpForStep = (secret: Buffer, step: number, digits = TOTP_DIGITS): string => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac('sha1', secret).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!;
  return String(binary % 10 ** digits).padStart(digits, '0');
};

/**
 * The time step a code is valid for, within TOTP_WINDOW of now, or null.
 * Returning the step lets the caller refuse the same code twice.
 */
export const verifyTotp = (base32Secret: string, code: string, at: Date | number = Date.now()): number | null => {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(base32Secret);
  const now = timeStep(at);
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset++) {
    const candidate = Buffer.from(totpForStep(secret, now + offset));
    // Constant-time, so response time does not reveal how many digits matched.
    if (crypto.timingSafeEqual(candidate, Buffer.from(code))) return now + offset;
  }
  return null;
};

/** The otpauth:// URI an authenticator app reads from a QR code. */
export const otpauthUri = (issuer: string, account: string, base32Secret: string): string =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}` +
  `?secret=${base32Secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;

export default { generateTotpSecret, verifyTotp, otpauthUri, totpForStep, timeStep, base32Encode, base32Decode };
