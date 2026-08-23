/**
 * @fileoverview Setup for the DB-free contract suite.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Only the edges are stubbed — Redis, and the model lookups that authentication
 * performs. Routing, middleware chains, validation, token verification and
 * authorisation all run for real, because those are the seams this suite
 * exists to cover.
 */

process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'contract-test-jwt-secret';
process.env['JWT_REFRESH_SECRET'] = 'contract-test-refresh-secret';
process.env['ADMIN_JWT_SECRET'] = 'contract-test-admin-secret';
process.env['SESSION_SECRET'] = 'contract-test-session-secret';
process.env['QR_CODE_SECRET'] = 'contract-test-qr-secret';
process.env['DATABASE_URL'] = 'postgresql://contract:contract@127.0.0.1:5432/contract';

jest.mock('../config/redis', () => ({
  redisClient: {
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    // rate-limit-redis runs SCRIPT LOAD (wants a sha) then EVALSHA (wants
    // [hits, ttl]); a bare number makes the store throw during init.
    sendCommand: jest.fn(async (args: string[]) => {
      const command = (args?.[0] ?? '').toUpperCase();
      if (command === 'SCRIPT') return 'a'.repeat(40);
      if (command === 'EVALSHA' || command === 'EVAL') return [1, 60000];
      return 1;
    }),
  },
}));

/**
 * Make database access fail immediately.
 *
 * Models still define themselves normally — the real Sequelize instance is
 * used, so associations wire up — but acquiring a connection rejects at once
 * instead of waiting on connect timeouts and pool retries. Without this the
 * suite spent ~5.6 seconds per route waiting for Postgres it is never going
 * to reach, and took twelve minutes.
 *
 * Controllers therefore return 500. That is the intended outcome here: this
 * suite asserts requests traverse the chain and get an answer, not what the
 * answer's body says.
 */
jest.mock('../config/database', () => {
  const actual = jest.requireActual('../config/database');
  const connectionManager = (actual.sequelize as any).connectionManager;
  const unavailable = () =>
    Promise.reject(new Error('Database is intentionally unavailable in contract tests'));

  connectionManager.getConnection = jest.fn(unavailable);
  actual.sequelize.authenticate = jest.fn(unavailable);
  // Model finders funnel through sequelize.query, so rejecting here avoids the
  // connection pool entirely — the pool's 30s acquire window with retries was
  // still costing over a second per request even with getConnection stubbed.
  actual.sequelize.query = jest.fn(unavailable);
  actual.sequelize.transaction = jest.fn(unavailable);

  return actual;
});

jest.setTimeout(30000);
