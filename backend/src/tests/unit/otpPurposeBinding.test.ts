/**
 * @fileoverview The account-takeover path, closed at the controller.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * `POST /api/auth/password-reset/otp` takes a recipient, a code and a new
 * password. There is no session, no old password and no emailed link — the
 * code is the entire proof of identity.
 *
 * It used to accept *any* live code for that recipient. `purpose` was a field
 * callers passed and the server echoed back without ever storing or checking
 * it, and every flow shared one key per recipient. So a code obtained through
 * the ordinary "verify your email address" flow could be spent here to set a
 * new password on the account.
 *
 * These run the real OtpService through the real controller, with only Redis
 * and the user lookup stubbed, because the defect lived in the seam between
 * them rather than inside either one.
 */

const redisStore = new Map<string, string>();
const counters = new Map<string, number>();

jest.mock('../../config/redis', () => ({
  redisClient: {
    connect: jest.fn(),
    get: jest.fn(async (k: string) => redisStore.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => { redisStore.set(k, v); }),
    del: jest.fn(async (k: string) => { redisStore.delete(k); }),
    increment: jest.fn(async (k: string) => {
      const next = (counters.get(k) ?? 0) + 1;
      counters.set(k, next);
      return next;
    }),
    isConnected: jest.fn().mockReturnValue(true),
  },
}));

import { Response } from 'express';
import { AuthController } from '../../controllers/AuthController';
import otpService from '../../services/OtpService';
import User from '../../models/User';

const VICTIM_EMAIL = 'victim@example.com';
const STRONG_PASSWORD = 'Attacker#Pass1'; // '#' is now accepted as the symbol

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (body: Record<string, unknown>): any => ({ body, query: {}, headers: {} });

const bodyOf = (res: Response) => (res.json as jest.Mock).mock.calls[0][0];
const statusOf = (res: Response) => (res.status as jest.Mock).mock.calls[0]?.[0];

describe('OTP purpose binding at the password-reset endpoint', () => {
  let update: jest.Mock;
  let findOne: jest.SpyInstance;

  beforeEach(() => {
    redisStore.clear();
    counters.clear();
    jest.clearAllMocks();

    update = jest.fn();
    findOne = jest.spyOn(User, 'findOne').mockResolvedValue({
      id: 'u-victim',
      email: VICTIM_EMAIL,
      role: 'passenger',
      status: 'active',
      update,
      toSafeObject: () => ({ id: 'u-victim' }),
    } as any);
  });

  afterEach(() => {
    findOne.mockRestore();
  });

  it('refuses an email-verification code at password reset', async () => {
    // Exactly the takeover: a code the attacker obtained through the ordinary
    // "confirm your email" flow, spent to set a new password.
    const issued = await otpService.issue('email', VICTIM_EMAIL, 'email_verification');

    const res = mockRes();
    await AuthController.resetPasswordWithOTP(
      mockReq({
        type: 'email',
        recipient: VICTIM_EMAIL,
        code: issued.code,
        newPassword: STRONG_PASSWORD,
      }),
      res,
    );

    expect(statusOf(res)).toBe(400);
    expect(bodyOf(res).code).toBe('INVALID_OTP');
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a login code at password reset', async () => {
    const issued = await otpService.issue('email', VICTIM_EMAIL, 'login');

    const res = mockRes();
    await AuthController.resetPasswordWithOTP(
      mockReq({
        type: 'email',
        recipient: VICTIM_EMAIL,
        code: issued.code,
        newPassword: STRONG_PASSWORD,
      }),
      res,
    );

    expect(statusOf(res)).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('accepts a code actually issued for password reset', async () => {
    const issued = await otpService.issue('email', VICTIM_EMAIL, 'password_reset');

    const res = mockRes();
    await AuthController.resetPasswordWithOTP(
      mockReq({
        type: 'email',
        recipient: VICTIM_EMAIL,
        code: issued.code,
        newPassword: STRONG_PASSWORD,
      }),
      res,
    );

    expect(bodyOf(res).success).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        password: STRONG_PASSWORD,
        refreshToken: null,
        passwordChangedAt: expect.any(Date),
      }),
    );
  });

  it('stops accepting guesses after the attempt limit', async () => {
    await otpService.issue('email', VICTIM_EMAIL, 'password_reset');

    for (let i = 0; i < 4; i += 1) {
      const res = mockRes();
      await AuthController.resetPasswordWithOTP(
        mockReq({ type: 'email', recipient: VICTIM_EMAIL, code: '000000', newPassword: STRONG_PASSWORD }),
        res,
      );
      expect(statusOf(res)).toBe(400);
    }

    const res = mockRes();
    await AuthController.resetPasswordWithOTP(
      mockReq({ type: 'email', recipient: VICTIM_EMAIL, code: '000000', newPassword: STRONG_PASSWORD }),
      res,
    );

    expect(statusOf(res)).toBe(429);
    expect(bodyOf(res).code).toBe('OTP_ATTEMPTS_EXCEEDED');
    expect(update).not.toHaveBeenCalled();
  });

  it('enforces the full password policy, not just a length check', async () => {
    const issued = await otpService.issue('email', VICTIM_EMAIL, 'password_reset');

    const res = mockRes();
    await AuthController.resetPasswordWithOTP(
      mockReq({
        type: 'email',
        recipient: VICTIM_EMAIL,
        code: issued.code,
        // Eight characters, so the old `length < 8` check passed it — but
        // weaker than registration allows, which let a reset downgrade an
        // account below the policy it was created under.
        newPassword: 'password',
      }),
      res,
    );

    expect(statusOf(res)).toBe(400);
    expect(bodyOf(res).code).toBe('WEAK_PASSWORD');
    expect(update).not.toHaveBeenCalled();
  });

  it('answers the same way for an unknown recipient as for a bad code', async () => {
    // Distinguishing the two turns this endpoint into an account-enumeration
    // oracle for phone numbers and email addresses.
    findOne.mockResolvedValue(null);
    const issued = await otpService.issue('email', 'stranger@example.com', 'password_reset');

    const res = mockRes();
    await AuthController.resetPasswordWithOTP(
      mockReq({
        type: 'email',
        recipient: 'stranger@example.com',
        code: issued.code,
        newPassword: STRONG_PASSWORD,
      }),
      res,
    );

    expect(statusOf(res)).toBe(400);
    expect(bodyOf(res).code).toBe('INVALID_OTP');
  });
});
