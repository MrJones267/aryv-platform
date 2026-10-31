/**
 * @fileoverview Phone and email verification, and the password reset email
 * @author Oabona-Majoko
 * @created 2026-10-31
 * @lastModified 2026-10-31
 *
 * - POST /verify-phone accepted any code: verifyCode returns { ok }, and the
 *   controller tested the object, which is always truthy.
 * - POST /verify-email compared against a hand-rolled Redis key with no limit
 *   on guesses.
 * - With no mail server, production answered "sent" to email codes and wrote
 *   password reset links, token included, into the logs.
 * - POST /otp/verify said "verified" and recorded nothing.
 *
 * The real controller and OtpService run here; only Redis and the user
 * lookups are stubbed.
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

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  getErrorStack: (e: unknown) => (e instanceof Error ? e.stack : undefined),
}));

import { Response } from 'express';
import { AuthController } from '../../controllers/AuthController';
import otpService from '../../services/OtpService';
import User from '../../models/User';
import logger from '../../utils/logger';

const PHONE = '+26771234567';
const EMAIL = 'neo@example.com';

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const bodyOf = (res: Response) => (res.json as jest.Mock).mock.calls[0][0];
const statusOf = (res: Response) => (res.status as jest.Mock).mock.calls[0]?.[0];
const wrongCodeFor = (code: string) => (code === '000000' ? '111111' : '000000');

describe('verification codes and the reset email', () => {
  let update: jest.Mock;
  const env = { ...process.env };

  beforeEach(() => {
    redisStore.clear();
    counters.clear();
    jest.clearAllMocks();
    update = jest.fn();
    const user = { id: 'u1', email: EMAIL, phone: PHONE, isEmailVerified: false, status: 'active', update };
    jest.spyOn(User, 'findByPk').mockResolvedValue(user as any);
    jest.spyOn(User, 'findOne').mockResolvedValue(user as any);
  });

  afterEach(() => {
    process.env = { ...env };
  });

  describe('verifying a phone while signed in', () => {
    const verify = async (code: string) => {
      const res = mockRes();
      await AuthController.verifyPhone({ user: { id: 'u1' }, body: { phone: PHONE, code } } as any, res);
      return res;
    };

    it('refuses a wrong code and leaves the account alone', async () => {
      const issued = await otpService.issue('sms', PHONE, 'phone_verification');
      const res = await verify(wrongCodeFor(issued.code!));
      expect(statusOf(res)).toBe(400);
      expect(bodyOf(res).code).toBe('INVALID_OTP');
      expect(update).not.toHaveBeenCalled();
    });

    it('refuses any code when none was sent', async () => {
      const res = await verify('123456');
      expect(statusOf(res)).toBe(400);
      expect(update).not.toHaveBeenCalled();
    });

    it('verifies the number with the right code', async () => {
      const issued = await otpService.issue('sms', PHONE, 'phone_verification');
      const res = await verify(issued.code!);
      expect(statusOf(res)).toBe(200);
      expect(update).toHaveBeenCalledWith({ isPhoneVerified: true, phone: PHONE });
    });
  });

  describe('verifying an email while signed in', () => {
    const verify = async (token: string) => {
      const res = mockRes();
      await AuthController.verifyEmailToken({ user: { id: 'u1' }, body: { token } } as any, res);
      return res;
    };

    it('destroys the code after five wrong guesses', async () => {
      const { code } = await otpService.issue('email', EMAIL, 'email_verification');
      for (let i = 0; i < 5; i++) {await verify(wrongCodeFor(code!));}
      const res = await verify(code!);
      expect(statusOf(res)).not.toBe(200);
      expect(update).not.toHaveBeenCalled();
    });

    it('verifies the address with the right code', async () => {
      const { code } = await otpService.issue('email', EMAIL, 'email_verification');
      const res = await verify(code!);
      expect(statusOf(res)).toBe(200);
      expect(update).toHaveBeenCalledWith({ isEmailVerified: true });
    });
  });

  describe('with no mail server in production', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
      delete process.env['SMTP_HOST'];
    });

    it('says email codes are unavailable instead of claiming to send one', async () => {
      const res = mockRes();
      await AuthController.sendEmailOTP({ body: { email: EMAIL, purpose: 'password_reset' } } as any, res);
      expect(statusOf(res)).toBe(503);
      expect(bodyOf(res).code).toBe('EMAIL_UNAVAILABLE');
    });

    it('never writes a reset link into the logs', async () => {
      const res = mockRes();
      await AuthController.forgotPassword({ body: { email: EMAIL } } as any, res);
      expect(statusOf(res)).toBe(200);
      const logged = JSON.stringify([(logger.info as jest.Mock).mock.calls, (logger.warn as jest.Mock).mock.calls]);
      expect(logged).not.toContain('reset-password?token=');
    });
  });

  it('records a code verified without signing in on the account it belongs to', async () => {
    const { code } = await otpService.issue('email', EMAIL, 'email_verification');
    const res = mockRes();
    await AuthController.verifyOTP({ body: { type: 'email', recipient: EMAIL, code } } as any, res);
    expect(statusOf(res)).toBe(200);
    expect(update).toHaveBeenCalledWith({ isEmailVerified: true });
  });

  it('holds the link-based reset to the same password rules as registration', async () => {
    redisStore.set('pw_reset:tok', 'u1');
    const res = mockRes();
    await AuthController.resetPassword({ body: { token: 'tok', newPassword: 'aaaaaaaa' } } as any, res);
    expect(statusOf(res)).toBe(400);
    expect(bodyOf(res).code).toBe('WEAK_PASSWORD');
  });
});
