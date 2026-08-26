/**
 * @fileoverview One-time codes: issue, verify, and the limits that make them
 *               worth anything.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * There were two OTP implementations before this — one for SMS in SMSService,
 * one for email inlined in AuthController — and both shared the same three
 * defects.
 *
 * **No attempt limit.** A wrong code returned false and changed nothing. The
 * code stayed live for its full ten minutes, so a six-digit secret could be
 * guessed as fast as requests could be made. The only brake was a per-IP rate
 * limiter, which does not survive an attacker with more than one IP.
 *
 * **No purpose binding.** A single key per recipient served every flow, and the
 * `purpose` field callers passed was echoed back but never stored or checked.
 * A code issued to verify an email address could be redeemed at
 * `/api/auth/password-reset/otp` to set a new password on that account.
 *
 * **Codes stored in the clear.** Anyone who could read Redis could read live
 * codes for every pending login and password reset.
 *
 * All three are addressed here, in one place, so the SMS and email paths cannot
 * drift apart again.
 */

import crypto from 'crypto';
import { redisClient } from '../config/redis';
import logger from '../utils/logger';

// Constants
const OTP_TTL_SECONDS = 10 * 60;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_ISSUES_PER_WINDOW = 3;
const ISSUE_WINDOW_SECONDS = 15 * 60;
const CODE_DIGITS = 6;

/**
 * What a code may be redeemed for. A code is bound to exactly one of these at
 * issue time and is rejected anywhere else, so no flow can spend another
 * flow's code.
 */
export type OtpPurpose =
  | 'login'
  | 'registration'
  | 'password_reset'
  | 'phone_verification'
  | 'email_verification';

export const OTP_PURPOSES: readonly OtpPurpose[] = [
  'login',
  'registration',
  'password_reset',
  'phone_verification',
  'email_verification',
];

export const isOtpPurpose = (value: unknown): value is OtpPurpose =>
  typeof value === 'string' && (OTP_PURPOSES as readonly string[]).includes(value);

export type OtpChannel = 'sms' | 'email';

export type OtpFailureReason =
  | 'not_found'
  | 'mismatch'
  | 'too_many_attempts'
  | 'unavailable';

export interface OtpVerifyResult {
  ok: boolean;
  reason?: OtpFailureReason;
  /** Attempts left before the code is destroyed. Present on a mismatch. */
  attemptsRemaining?: number;
}

export interface OtpIssueResult {
  ok: boolean;
  code?: string;
  expiresAt?: Date;
  /** Set when the recipient has asked for too many codes too quickly. */
  throttled?: boolean;
  retryAfterSeconds?: number;
}

interface OtpRecord {
  codeHash: string;
  purpose: OtpPurpose;
  attempts: number;
  issuedAt: number;
}

/**
 * Codes are stored hashed, never in the clear.
 *
 * A six-digit space is small enough to brute-force offline in microseconds, so
 * the hash is not protecting the code from someone who already has the digest
 * — it is limiting what a *read* of the datastore yields, so a leaked Redis
 * snapshot is not a list of live login codes. The attempt limit is what
 * actually protects the code online.
 */
const hashCode = (code: string, identifier: string, purpose: OtpPurpose): string =>
  crypto.createHash('sha256').update(`${purpose}:${identifier}:${code}`).digest('hex');

/** Compare digests without leaking where they diverge. */
const digestsMatch = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * The recipient is part of the key, so codes never collide between users, and
 * so is the purpose, which is what stops a code being redeemed in the wrong
 * flow. Email identifiers are lowercased by the caller; phone numbers arrive
 * already normalised to E.164.
 */
const recordKey = (channel: OtpChannel, identifier: string, purpose: OtpPurpose): string =>
  `otp:${channel}:${purpose}:${identifier}`;

const issueCountKey = (channel: OtpChannel, identifier: string, purpose: OtpPurpose): string =>
  `otp-issued:${channel}:${purpose}:${identifier}`;

export class OtpService {
  /**
   * Mint a code for one recipient and one purpose.
   *
   * Any code previously outstanding for that pair is replaced, which also
   * resets the attempt counter — that is deliberate: a legitimate user who
   * mistyped and re-requested should not inherit a burnt counter, and an
   * attacker gains nothing because re-requesting is itself throttled.
   */
  async issue(
    channel: OtpChannel,
    identifier: string,
    purpose: OtpPurpose,
  ): Promise<OtpIssueResult> {
    // Per-recipient throttle. The per-IP limiter on the route does not cover
    // this: it is what stops one address being used to mail-bomb or SMS-bomb a
    // victim, and what stops an attacker cycling fresh codes to widen the
    // window they are guessing against.
    const issues = await redisClient.increment(
      issueCountKey(channel, identifier, purpose),
      ISSUE_WINDOW_SECONDS,
    );

    // `increment` answers 0 when Redis is unavailable. Issuing a code we cannot
    // store means the user gets a code that can never verify, so refuse.
    if (issues === 0) {
      logger.error('OTP could not be issued: the code store is unavailable', {
        channel, purpose,
      });
      return { ok: false };
    }

    if (issues > MAX_ISSUES_PER_WINDOW) {
      return { ok: false, throttled: true, retryAfterSeconds: ISSUE_WINDOW_SECONDS };
    }

    const code = crypto.randomInt(0, 10 ** CODE_DIGITS).toString().padStart(CODE_DIGITS, '0');

    const record: OtpRecord = {
      codeHash: hashCode(code, identifier, purpose),
      purpose,
      attempts: 0,
      issuedAt: Date.now(),
    };

    await redisClient.set(
      recordKey(channel, identifier, purpose),
      JSON.stringify(record),
      OTP_TTL_SECONDS,
    );

    return {
      ok: true,
      code,
      expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
    };
  }

  /**
   * Redeem a code. Single-use, purpose-bound, and self-destructing after
   * MAX_VERIFY_ATTEMPTS wrong guesses.
   */
  async verify(
    channel: OtpChannel,
    identifier: string,
    purpose: OtpPurpose,
    submittedCode: string,
  ): Promise<OtpVerifyResult> {
    const key = recordKey(channel, identifier, purpose);
    const raw = await redisClient.get(key);

    // No record: either never issued, expired, already used, or destroyed by
    // too many wrong guesses. The caller must not be told which — that
    // distinction is useful only to someone probing.
    if (!raw) return { ok: false, reason: 'not_found' };

    let record: OtpRecord;
    try {
      record = JSON.parse(raw) as OtpRecord;
    } catch {
      await redisClient.del(key);
      return { ok: false, reason: 'not_found' };
    }

    // Belt and braces: the key already encodes the purpose, so this can only
    // fire if a record were written under the wrong key.
    if (record.purpose !== purpose) {
      logger.warn('OTP record purpose did not match its key', { channel, purpose });
      await redisClient.del(key);
      return { ok: false, reason: 'not_found' };
    }

    const submittedHash = hashCode(String(submittedCode ?? ''), identifier, purpose);

    if (!digestsMatch(record.codeHash, submittedHash)) {
      const attempts = record.attempts + 1;

      if (attempts >= MAX_VERIFY_ATTEMPTS) {
        // Destroy rather than lock: the user can request a fresh code, and the
        // guesser has to start over against a new secret and a new counter.
        await redisClient.del(key);
        logger.warn('OTP destroyed after too many failed attempts', { channel, purpose });
        return { ok: false, reason: 'too_many_attempts', attemptsRemaining: 0 };
      }

      // Preserve the original TTL — a wrong guess must not extend the window.
      const elapsed = Math.floor((Date.now() - record.issuedAt) / 1000);
      const remainingTtl = Math.max(1, OTP_TTL_SECONDS - elapsed);
      await redisClient.set(key, JSON.stringify({ ...record, attempts }), remainingTtl);

      return {
        ok: false,
        reason: 'mismatch',
        attemptsRemaining: MAX_VERIFY_ATTEMPTS - attempts,
      };
    }

    // Single use.
    await redisClient.del(key);
    return { ok: true };
  }

  /** How many verification attempts a live code has left, for status endpoints. */
  async attemptsRemaining(
    channel: OtpChannel,
    identifier: string,
    purpose: OtpPurpose,
  ): Promise<number | null> {
    const raw = await redisClient.get(recordKey(channel, identifier, purpose));
    if (!raw) return null;
    try {
      const record = JSON.parse(raw) as OtpRecord;
      return Math.max(0, MAX_VERIFY_ATTEMPTS - record.attempts);
    } catch {
      return null;
    }
  }

  /** Exposed for tests and for callers that need to describe the policy. */
  static get limits() {
    return {
      ttlSeconds: OTP_TTL_SECONDS,
      maxVerifyAttempts: MAX_VERIFY_ATTEMPTS,
      maxIssuesPerWindow: MAX_ISSUES_PER_WINDOW,
      issueWindowSeconds: ISSUE_WINDOW_SECONDS,
      codeDigits: CODE_DIGITS,
    };
  }
}

export const otpService = new OtpService();
export default otpService;
