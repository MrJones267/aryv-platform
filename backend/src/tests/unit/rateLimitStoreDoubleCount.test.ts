/**
 * @fileoverview Two limiters on one request are not a double count.
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * express-rate-limit checks that a request is counted once per store, and
 * tells stores apart by their `prefix`. ResilientStore had none, so the
 * global limiter and a route's own limiter on the same request looked like
 * one store counting twice: ERR_ERL_DOUBLE_COUNT on every such request (93
 * in one CI run), though each counts in its own store.
 */

import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../../config/rateLimitStore';

jest.mock('../../config/redis', () => ({
  // RedisStore loads its script on creation and wants a SHA back; the
  // limiters then fall back to memory, as with Redis down.
  redisClient: { isConnected: () => false, sendCommand: jest.fn().mockResolvedValue('0123456789abcdef') },
}));
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const limiter = (prefix: string) =>
  rateLimit({ windowMs: 60_000, limit: 100, store: makeStore(prefix), standardHeaders: true, legacyHeaders: false });

describe('ResilientStore and the double-count check', () => {
  let errors: jest.SpyInstance;

  beforeEach(() => {
    errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const doubleCountReported = () =>
    errors.mock.calls.some((call) => String(call[0]?.code ?? call[0]).includes('ERR_ERL_DOUBLE_COUNT'));

  it('raises nothing for a global limiter and a route limiter on the same request', async () => {
    const app = express();
    app.use(limiter('global-test'));
    app.get('/x', limiter('route-test'), (_req, res) => { res.send('ok'); });

    await request(app).get('/x').expect(200);
    expect(doubleCountReported()).toBe(false);
  });

});
