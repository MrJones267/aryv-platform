/**
 * @fileoverview ICE server configuration, including TURN credentials.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Calls shipped with public STUN and a commented-out `turn:your-turn-server.com`.
 * STUN alone only connects peers that are directly reachable once their public
 * address is known, which frequently fails on mobile networks behind
 * carrier-grade NAT — the call does not error, it just never connects.
 *
 * TURN credentials are minted per user with a short life, using coturn's
 * shared-secret scheme, so nothing long-lived ships inside the app binary.
 */

import crypto from 'crypto';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

const USER = 'user-1';

/**
 * The module reads its configuration at import time, so each case sets the
 * environment and then loads a fresh copy.
 */
const loadService = (env: Record<string, string | undefined>) => {
  jest.resetModules();

  const previous = { ...process.env };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('../../services/IceServerService');

  return {
    service: new module.IceServerService(),
    ttl: module.TURN_CREDENTIAL_TTL_SECONDS as number,
    isTurnConfigured: module.isTurnConfigured as () => boolean,
    restore: () => {
      process.env = previous;
    },
  };
};

const CLEAN_ENV = {
  TURN_URLS: undefined,
  TURN_SECRET: undefined,
  TURN_USERNAME: undefined,
  TURN_PASSWORD: undefined,
};

describe('IceServerService', () => {
  describe('with no TURN configured', () => {
    it('still returns STUN, so calls are attempted rather than refused', () => {
      const { service, restore } = loadService(CLEAN_ENV);

      const config = service.getConfiguration(USER);

      expect(config.iceServers.length).toBeGreaterThan(0);
      expect(config.iceServers[0].urls).toContain('stun:');
      restore();
    });

    it('reports that TURN is absent rather than implying it works', () => {
      // The client warns on this. Silently returning a STUN-only config is
      // exactly the state that made calls fail with nothing to point at.
      const { service, restore } = loadService(CLEAN_ENV);

      expect(service.getConfiguration(USER).turnConfigured).toBe(false);
      restore();
    });

    it('hands out no credentials', () => {
      const { service, restore } = loadService(CLEAN_ENV);

      const config = service.getConfiguration(USER);

      expect(config.iceServers.every((s: any) => !s.credential)).toBe(true);
      restore();
    });
  });

  describe('with the shared-secret scheme', () => {
    const env = {
      ...CLEAN_ENV,
      TURN_URLS: 'turn:turn.aryv-app.com:3478,turns:turn.aryv-app.com:5349',
      TURN_SECRET: 'a-shared-secret',
    };

    it('includes the TURN servers alongside STUN', () => {
      const { service, restore } = loadService(env);

      const config = service.getConfiguration(USER);
      const turn = config.iceServers.find((s: any) => s.credential);

      expect(turn.urls).toEqual([
        'turn:turn.aryv-app.com:3478',
        'turns:turn.aryv-app.com:5349',
      ]);
      expect(config.turnConfigured).toBe(true);
      restore();
    });

    it('builds the username as expiry:userId, which is what coturn expects', () => {
      const { service, ttl, restore } = loadService(env);

      const turn = service.getConfiguration(USER).iceServers.find((s: any) => s.credential);
      const [expiry, userId] = turn.username.split(':');

      expect(userId).toBe(USER);

      const secondsFromNow = Number(expiry) - Math.floor(Date.now() / 1000);
      expect(secondsFromNow).toBeGreaterThan(ttl - 60);
      expect(secondsFromNow).toBeLessThanOrEqual(ttl);
      restore();
    });

    it('signs the credential so the TURN server can verify it', () => {
      // coturn recomputes this from the username it receives; if the
      // derivation is wrong every relay attempt is rejected and calls fail
      // exactly where TURN was supposed to save them.
      const { service, restore } = loadService(env);

      const turn = service.getConfiguration(USER).iceServers.find((s: any) => s.credential);

      const expected = crypto
        .createHmac('sha1', 'a-shared-secret')
        .update(turn.username)
        .digest('base64');

      expect(turn.credential).toBe(expected);
      restore();
    });

    it('gives different users different credentials', () => {
      // So relay usage traces back to an account.
      const { service, restore } = loadService(env);

      const one = service.getConfiguration('user-a').iceServers.find((s: any) => s.credential);
      const two = service.getConfiguration('user-b').iceServers.find((s: any) => s.credential);

      expect(one.username).not.toBe(two.username);
      expect(one.credential).not.toBe(two.credential);
      restore();
    });

    it('tells the client how long the credentials last, so it can refresh', () => {
      const { service, ttl, restore } = loadService(env);

      expect(service.getConfiguration(USER).ttlSeconds).toBe(ttl);
      restore();
    });
  });

  describe('with static credentials', () => {
    const env = {
      ...CLEAN_ENV,
      TURN_URLS: 'turn:turn.example.com:3478',
      TURN_USERNAME: 'aryv',
      TURN_PASSWORD: 'password',
    };

    it('passes them through unchanged', () => {
      const { service, restore } = loadService(env);

      const turn = service.getConfiguration(USER).iceServers.find((s: any) => s.credential);

      expect(turn.username).toBe('aryv');
      expect(turn.credential).toBe('password');
      restore();
    });

    it('reports no expiry, since static credentials do not have one', () => {
      const { service, restore } = loadService(env);

      expect(service.getConfiguration(USER).ttlSeconds).toBe(0);
      restore();
    });
  });

  describe('with URLs but no credentials', () => {
    it('reports TURN as unconfigured, because the relay will refuse us', () => {
      // Handing back a config that looks complete would hide the misconfiguration
      // until calls started failing in the field.
      const { service, restore } = loadService({
        ...CLEAN_ENV,
        TURN_URLS: 'turn:turn.example.com:3478',
      });

      expect(service.getConfiguration(USER).turnConfigured).toBe(false);
      restore();
    });
  });

  describe('isTurnConfigured', () => {
    it('is false with nothing set', () => {
      const { isTurnConfigured, restore } = loadService(CLEAN_ENV);
      expect(isTurnConfigured()).toBe(false);
      restore();
    });

    it('is true once URLs and a secret are present', () => {
      const { isTurnConfigured, restore } = loadService({
        ...CLEAN_ENV,
        TURN_URLS: 'turn:turn.example.com:3478',
        TURN_SECRET: 'secret',
      });
      expect(isTurnConfigured()).toBe(true);
      restore();
    });
  });
});
