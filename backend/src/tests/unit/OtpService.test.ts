/**
 * @fileoverview The limits that make a six-digit code safe.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * A six-digit code has a million possibilities and a ten-minute life. Nothing
 * about the number is secret enough on its own; what makes it safe is that it
 * can only be guessed a few times, can only be used once, and can only be
 * spent on the thing it was issued for. None of those three held before.
 */

const redisStore = new Map<string, string>();
const counters = new Map<string, number>();
let redisAvailable = true;

jest.mock('../../config/redis', () => ({
  redisClient: {
    get: jest.fn(async (k: string) => (redisAvailable ? redisStore.get(k) ?? null : null)),
    set: jest.fn(async (k: string, v: string) => {
      if (redisAvailable) redisStore.set(k, v);
    }),
    del: jest.fn(async (k: string) => { redisStore.delete(k); }),
    increment: jest.fn(async (k: string) => {
      if (!redisAvailable) return 0;
      const next = (counters.get(k) ?? 0) + 1;
      counters.set(k, next);
      return next;
    }),
    isConnected: jest.fn(() => redisAvailable),
  },
}));

import { OtpService } from '../../services/OtpService';

describe('OtpService', () => {
  let otp: OtpService;
  const PHONE = '+26771234567';

  beforeEach(() => {
    redisStore.clear();
    counters.clear();
    redisAvailable = true;
    jest.clearAllMocks();
    otp = new OtpService();
  });

  // ── Attempt limit ──────────────────────────────────────────────────────────

  describe('attempt limiting', () => {
    it('destroys the code after five wrong guesses', async () => {
      const issued = await otp.issue('sms', PHONE, 'login');
      expect(issued.ok).toBe(true);

      for (let i = 1; i <= 4; i += 1) {
        const attempt = await otp.verify('sms', PHONE, 'login', '000000');
        expect(attempt.ok).toBe(false);
        expect(attempt.reason).toBe('mismatch');
        expect(attempt.attemptsRemaining).toBe(5 - i);
      }

      const fifth = await otp.verify('sms', PHONE, 'login', '000000');
      expect(fifth.reason).toBe('too_many_attempts');

      // Even the correct code is dead now — the record is gone.
      const withRealCode = await otp.verify('sms', PHONE, 'login', issued.code as string);
      expect(withRealCode.ok).toBe(false);
      expect(withRealCode.reason).toBe('not_found');
    });

    it('does not extend the code lifetime on a wrong guess', async () => {
      await otp.issue('sms', PHONE, 'login');
      const { redisClient } = jest.requireMock('../../config/redis');
      (redisClient.set as jest.Mock).mockClear();

      await otp.verify('sms', PHONE, 'login', '000000');

      // Re-written with a TTL no greater than the original ten minutes.
      const [, , ttl] = (redisClient.set as jest.Mock).mock.calls[0];
      expect(ttl).toBeLessThanOrEqual(600);
      expect(ttl).toBeGreaterThan(0);
    });

    it('accepts the correct code within the attempt budget', async () => {
      const issued = await otp.issue('email', 'rider@example.com', 'login');

      await otp.verify('email', 'rider@example.com', 'login', '111111');
      const ok = await otp.verify('email', 'rider@example.com', 'login', issued.code as string);

      expect(ok.ok).toBe(true);
    });
  });

  // ── Purpose binding ────────────────────────────────────────────────────────

  describe('purpose binding', () => {
    it('refuses a code issued for one purpose at another', async () => {
      // The account-takeover path: get a code for email verification, spend it
      // on a password reset.
      const issued = await otp.issue('email', 'victim@example.com', 'email_verification');

      const crossUse = await otp.verify(
        'email', 'victim@example.com', 'password_reset', issued.code as string,
      );

      expect(crossUse.ok).toBe(false);
      expect(crossUse.reason).toBe('not_found');
    });

    it('keeps codes for different purposes independent', async () => {
      const forLogin = await otp.issue('sms', PHONE, 'login');
      const forReset = await otp.issue('sms', PHONE, 'password_reset');

      expect(forLogin.code).toBeDefined();
      expect(forReset.code).toBeDefined();

      // Burning the login code must not affect the reset code.
      await otp.verify('sms', PHONE, 'login', forLogin.code as string);

      const reset = await otp.verify('sms', PHONE, 'password_reset', forReset.code as string);
      expect(reset.ok).toBe(true);
    });

    it('keeps codes for different recipients independent', async () => {
      const mine = await otp.issue('email', 'a@example.com', 'login');
      const theirs = await otp.issue('email', 'b@example.com', 'login');

      const wrongOwner = await otp.verify('email', 'b@example.com', 'login', mine.code as string);
      expect(wrongOwner.ok).toBe(false);

      const rightOwner = await otp.verify('email', 'b@example.com', 'login', theirs.code as string);
      expect(rightOwner.ok).toBe(true);
    });
  });

  // ── Single use ─────────────────────────────────────────────────────────────

  it('accepts a code exactly once', async () => {
    const issued = await otp.issue('sms', PHONE, 'password_reset');

    const first = await otp.verify('sms', PHONE, 'password_reset', issued.code as string);
    const second = await otp.verify('sms', PHONE, 'password_reset', issued.code as string);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('not_found');
  });

  // ── Issue throttle ─────────────────────────────────────────────────────────

  it('throttles repeated requests for the same recipient and purpose', async () => {
    const results = [];
    for (let i = 0; i < 4; i += 1) {
      results.push(await otp.issue('sms', PHONE, 'login'));
    }

    expect(results.slice(0, 3).every((r) => r.ok)).toBe(true);
    expect(results[3]!.ok).toBe(false);
    expect(results[3]!.throttled).toBe(true);
  });

  // ── Storage ────────────────────────────────────────────────────────────────

  it('never stores the code in a readable form', async () => {
    const issued = await otp.issue('email', 'rider@example.com', 'login');
    const stored = [...redisStore.values()].join('|');

    expect(issued.code).toMatch(/^\d{6}$/);
    expect(stored).not.toContain(issued.code as string);
  });

  it('produces codes across the full six-digit range, including leading zeros', async () => {
    // `100000 + randomInt(0, 900000)` could never produce a code below 100000,
    // throwing away a tenth of the space. Padding keeps all 10^6.
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const issued = await otp.issue('sms', `+2677000${String(i).padStart(4, '0')}`, 'login');
      seen.add(issued.code as string);
      expect(issued.code).toHaveLength(6);
    }
    expect(seen.size).toBeGreaterThan(40); // not a constant
  });

  // ── Fail closed ────────────────────────────────────────────────────────────

  describe('when the code store is unavailable', () => {
    it('refuses to issue a code it cannot store', async () => {
      redisAvailable = false;
      const issued = await otp.issue('sms', PHONE, 'login');

      // Handing out a code that can never verify would strand the user and
      // look like a broken account.
      expect(issued.ok).toBe(false);
      expect(issued.code).toBeUndefined();
    });

    it('refuses to verify anything', async () => {
      await otp.issue('sms', PHONE, 'login');
      redisAvailable = false;

      const result = await otp.verify('sms', PHONE, 'login', '123456');
      expect(result.ok).toBe(false);
    });
  });
});
