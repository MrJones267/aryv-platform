/**
 * @fileoverview Unit tests for socket handshake authentication.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * The bug these cover: the middleware read `decoded.id`, but access tokens
 * carry `userId` — `id` belongs to the separate admin token shape. Sequelize
 * short-circuits findByPk(undefined) to null, so every socket connection was
 * rejected as 'Invalid user' and the whole real-time layer was dead.
 */

import { authenticateSocketToken } from '../../services/SocketService';
import { AuthService } from '../../services/AuthService';
import User from '../../models/User';
import { UserRole } from '../../types';

jest.mock('../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../config/redis', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
  },
}));

const USER_ID = 'user-uuid-1';

const activeUser = (overrides: Record<string, unknown> = {}) => ({
  id: USER_ID,
  email: 'rider@example.com',
  status: 'active',
  ...overrides,
});

describe('authenticateSocketToken', () => {
  let findByPk: jest.SpyInstance;
  let verifyToken: jest.SpyInstance;
  let isBlacklisted: jest.SpyInstance;

  beforeEach(() => {
    // Faithful to Sequelize: findByPk(null|undefined) short-circuits to null
    // without querying. A mock that returns a user for any argument would let
    // the original decoded.id bug pass most of these tests.
    findByPk = jest.spyOn(User, 'findByPk').mockImplementation((async (pk: unknown) =>
      pk === USER_ID ? activeUser() : null) as any);
    verifyToken = jest.spyOn(AuthService, 'verifyToken').mockReturnValue({
      userId: USER_ID,
      email: 'rider@example.com',
      role: UserRole.PASSENGER,
    });
    isBlacklisted = jest.spyOn(AuthService, 'isTokenBlacklisted').mockResolvedValue(false);
  });

  it('accepts a valid token', async () => {
    const result = await authenticateSocketToken('good-token');

    expect(result.ok).toBe(true);
    expect(result.ok && result.user.id).toBe(USER_ID);
  });

  it('looks the user up by userId, not id', async () => {
    // The regression itself. `id` is undefined on an access token payload, and
    // findByPk(undefined) resolves to null without querying — so the original
    // code rejected every connection.
    await authenticateSocketToken('good-token');

    expect(findByPk).toHaveBeenCalledWith(USER_ID);
    expect(findByPk).not.toHaveBeenCalledWith(undefined);
  });

  it('rejects a missing token', async () => {
    const result = await authenticateSocketToken(undefined);

    expect(result).toEqual({ ok: false, error: 'Authentication token required' });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('rejects a token invalidated at logout', async () => {
    isBlacklisted.mockResolvedValue(true);

    const result = await authenticateSocketToken('logged-out-token');

    expect(result).toEqual({ ok: false, error: 'Token has been invalidated' });
    expect(findByPk).not.toHaveBeenCalled();
  });

  it('rejects a suspended account', async () => {
    findByPk.mockImplementation((async () => activeUser({ status: 'suspended' })) as any);

    const result = await authenticateSocketToken('good-token');

    expect(result).toEqual({ ok: false, error: 'Account is suspended or deactivated' });
  });

  it('rejects a deactivated account', async () => {
    findByPk.mockImplementation((async () => activeUser({ status: 'deactivated' })) as any);

    const result = await authenticateSocketToken('good-token');

    expect(result).toEqual({ ok: false, error: 'Account is suspended or deactivated' });
  });

  it('rejects a token whose user no longer exists', async () => {
    findByPk.mockImplementation((async () => null) as any);

    const result = await authenticateSocketToken('good-token');

    expect(result).toEqual({ ok: false, error: 'Invalid user' });
  });

  it('rejects an unverifiable token without leaking the reason', async () => {
    verifyToken.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    const result = await authenticateSocketToken('rubbish');

    expect(result).toEqual({ ok: false, error: 'Authentication failed' });
  });
});
