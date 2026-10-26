/**
 * @fileoverview What the platform does when Redis goes away.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * Three protections hung off one Redis client that was written to fail open,
 * so a Redis outage switched all of them off at once and said nothing:
 *
 *   - every rate limiter answered "first hit, allow" for every request,
 *     including the login and password-reset limiters;
 *   - `isTokenBlacklisted` read a null and reported "not revoked", so every
 *     logged-out token worked again;
 *   - and `redisClient.set` swallows its own errors, so a logout during the
 *     outage revoked nothing at all.
 *
 * Nothing in the logs distinguished "no limit was hit" from "limiting was
 * off". These pin the replacement behaviour: keep counting locally, keep
 * honouring revocations this process made, and say so.
 */

let redisUp = true;
const redisStore = new Map<string, string>();

jest.mock('../../config/redis', () => ({
  redisClient: {
    isConnected: jest.fn(() => redisUp),
    get: jest.fn(async (k: string) => (redisUp ? redisStore.get(k) ?? null : null)),
    set: jest.fn(async (k: string, v: string) => { if (redisUp) redisStore.set(k, v); }),
    del: jest.fn(async (k: string) => { redisStore.delete(k); }),
    increment: jest.fn(async () => (redisUp ? 1 : 0)),
    sendCommand: jest.fn(async (args: string[]) => {
      const cmd = (args[0] || '').toUpperCase();
      if (!redisUp) {
        if (cmd === 'SCRIPT') return '0'.repeat(40);
        throw new Error('Redis is unavailable');
      }
      if (cmd === 'SCRIPT') return 'a'.repeat(40);
      if (cmd === 'EVAL' || cmd === 'EVALSHA') return [1, 60000];
      return 1;
    }),
  },
}));

jest.mock('../../models', () => ({
  User: { findOne: jest.fn(), findByPk: jest.fn(), update: jest.fn() },
}));

import jwt from 'jsonwebtoken';
import { AuthService } from '../../services/AuthService';
import { makeStore } from '../../config/rateLimitStore';

/**
 * A distinct token per call. Two `jwt.sign` calls with the same payload in the
 * same second produce byte-identical tokens, which would let one test's
 * revocation leak into the next.
 */
let tokenCounter = 0;
const tokenWithExpiry = (secondsFromNow: number): string =>
  jwt.sign(
    { userId: 'u1', email: 'a@b.c', role: 'passenger', jti: `t${(tokenCounter += 1)}` },
    process.env['JWT_SECRET'] as string,
    { expiresIn: secondsFromNow, issuer: 'hitch-api', audience: 'hitch-app' },
  );

describe('behaviour when Redis is unreachable', () => {
  beforeEach(() => {
    redisUp = true;
    redisStore.clear();
    jest.clearAllMocks();
    delete process.env['REDIS_FAIL_CLOSED'];
  });

  describe('rate limiting', () => {
    it('keeps counting locally instead of allowing everything', async () => {
      const store = makeStore('test-fallback');
      store.init?.({ windowMs: 60_000 } as never);

      redisUp = false;

      // The regression: this used to answer totalHits: 1 forever, because the
      // offline reply pretended every request was the first one.
      //
      // Read immediately rather than kept — MemoryStore hands back a live
      // reference to its own record, so holding all three and comparing at the
      // end would compare one object with itself three times.
      const hits: number[] = [];
      hits.push((await store.increment('1.2.3.4')).totalHits);
      hits.push((await store.increment('1.2.3.4')).totalHits);
      hits.push((await store.increment('1.2.3.4')).totalHits);

      expect(hits).toEqual([1, 2, 3]);
    });

    it('keeps separate callers in separate buckets while degraded', async () => {
      const store = makeStore('test-separate');
      store.init?.({ windowMs: 60_000 } as never);
      redisUp = false;

      await store.increment('1.1.1.1');
      await store.increment('1.1.1.1');
      const other = await store.increment('2.2.2.2');

      expect(other.totalHits).toBe(1);
    });

    it('goes back to Redis once it recovers, without a restart', async () => {
      const store = makeStore('test-recovery');
      store.init?.({ windowMs: 60_000 } as never);

      redisUp = false;
      await store.increment('9.9.9.9');

      redisUp = true;
      const afterRecovery = await store.increment('9.9.9.9');

      // Served by the (mocked) Redis path again, which reports a first hit.
      expect(afterRecovery.totalHits).toBe(1);
    });
  });

  describe('token revocation', () => {
    it('still refuses a token this instance revoked', async () => {
      const token = tokenWithExpiry(3600);

      await AuthService.logout('u1', token);
      expect(await AuthService.isTokenBlacklisted(token)).toBe(true);

      // The outage begins. The revocation was made here, so it must hold here.
      redisUp = false;
      expect(await AuthService.isTokenBlacklisted(token)).toBe(true);
    });

    it('does not invent a revocation for a token nobody logged out', async () => {
      redisUp = false;
      const token = tokenWithExpiry(3600);

      // Availability matters too: an outage must not reject every request.
      expect(await AuthService.isTokenBlacklisted(token)).toBe(false);
    });

    it('refuses everything when the operator asks for fail-closed', async () => {
      process.env['REDIS_FAIL_CLOSED'] = 'true';
      jest.resetModules();

      // Re-imported so the module-level flag is re-read.
      const { AuthService: StrictAuthService } = await import('../../services/AuthService');
      redisUp = false;

      expect(await StrictAuthService.isTokenBlacklisted(tokenWithExpiry(3600))).toBe(true);
    });

    it('honours a revocation recorded before an outage that began mid-flight', async () => {
      const token = tokenWithExpiry(3600);

      // Logout succeeds locally even though the Redis write is swallowed.
      redisUp = false;
      await AuthService.logout('u1', token);

      expect(await AuthService.isTokenBlacklisted(token)).toBe(true);
    });
  });
});
