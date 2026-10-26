/**
 * @fileoverview Changing a password must end sessions that predate it.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * None of the three password paths — change, reset by email link, reset by OTP
 * — cleared the refresh token or invalidated issued access tokens. Someone who
 * reset their password *because* their account was compromised kept the
 * attacker signed in: the access token stayed valid for its full 24 hours and
 * the refresh token worked indefinitely. That is the one moment a reset exists
 * to protect.
 */

import { Response } from 'express';
import { authenticateToken } from '../../middleware/auth';
import { AuthService } from '../../services/AuthService';
import { User as UserModel } from '../../models';
import { UserRole } from '../../types';

jest.mock('../../services/AuthService');
jest.mock('../../config/redis', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    del: jest.fn(),
    isConnected: () => true,
  },
}));

const USER_ID = 'user-1';
const HOUR = 60 * 60 * 1000;

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const reqWithToken = (): any => ({
  headers: { authorization: 'Bearer token' },
  url: '/api/users/profile',
  method: 'GET',
});

/** A user record whose password changed at the given time. */
const userWhosePasswordChangedAt = (changedAt: Date | null) => ({
  id: USER_ID,
  status: 'active',
  passwordChangedAt: changedAt,
  toSafeObject: () => ({ id: USER_ID, role: UserRole.PASSENGER }),
});

describe('sessions and password changes', () => {
  beforeEach(() => {
    (AuthService.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
  });

  /** Issued `hoursAgo` before now. */
  const tokenIssued = (hoursAgo: number) => {
    (AuthService.verifyToken as jest.Mock).mockReturnValue({
      userId: USER_ID,
      email: 'rider@example.com',
      role: UserRole.PASSENGER,
      iat: Math.floor((Date.now() - hoursAgo * HOUR) / 1000),
    });
  };

  it('refuses a token minted before the password changed', async () => {
    // The regression: this is the attacker's token after the victim resets.
    tokenIssued(2);
    jest.spyOn(UserModel, 'findByPk').mockResolvedValue(
      userWhosePasswordChangedAt(new Date(Date.now() - HOUR)) as any,
    );

    const res = mockRes();
    const next = jest.fn();

    await authenticateToken(reqWithToken(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PASSWORD_CHANGED' }),
    );
  });

  it('admits a token minted after the password changed', async () => {
    // The victim's own new session must keep working.
    tokenIssued(0);
    jest.spyOn(UserModel, 'findByPk').mockResolvedValue(
      userWhosePasswordChangedAt(new Date(Date.now() - HOUR)) as any,
    );

    const next = jest.fn();
    await authenticateToken(reqWithToken(), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('admits a token when the password has never been changed', async () => {
    // Existing rows are null, so a deploy must not sign everybody out.
    tokenIssued(5);
    jest.spyOn(UserModel, 'findByPk').mockResolvedValue(
      userWhosePasswordChangedAt(null) as any,
    );

    const next = jest.fn();
    await authenticateToken(reqWithToken(), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('still refuses a suspended account, whatever the timestamps say', async () => {
    tokenIssued(0);
    jest.spyOn(UserModel, 'findByPk').mockResolvedValue({
      ...userWhosePasswordChangedAt(null),
      status: 'suspended',
    } as any);

    const res = mockRes();
    const next = jest.fn();

    await authenticateToken(reqWithToken(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
