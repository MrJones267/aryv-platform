/**
 * @fileoverview Unit tests for AuthController
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import { Response } from 'express';
import { AuthController } from '../../controllers/AuthController';
import { AppError } from '../../types';

jest.mock('../../services/AuthService');
jest.mock('../../config/redis', () => ({
  redisClient: {
    connect: jest.fn(),
    set: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
  },
}));

import { AuthService } from '../../services/AuthService';
import User from '../../models/User';

// User is not module-mocked: automocking AuthService still loads models/index,
// and a stubbed User class breaks the association wiring that runs on import.
// Spying on the real model keeps that intact.
const MockedUser = {
  findByPk: jest.fn(),
};
// restoreMocks: true tears spies down after every test, so this is re-applied
// per test rather than once in beforeAll.
beforeEach(() => {
  jest.spyOn(User, 'findByPk').mockImplementation(((...args: any[]) =>
    MockedUser.findByPk(...args)) as any);
});

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (body: any = {}, user?: any, headers: any = {}): any => ({
  body,
  user,
  headers,
  get: (h: string) => headers[h.toLowerCase()],
});

describe('AuthController', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── register ────────────────────────────────────────────────────────────────
  describe('register', () => {
    it('returns 201 with user data on success', async () => {
      const payload = { id: 'u1', email: 'a@b.com' };
      (AuthService.register as jest.Mock).mockResolvedValue(payload);

      const req = mockReq({ email: 'a@b.com', password: 'pass', firstName: 'A', lastName: 'B' });
      const res = mockRes();

      await AuthController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: payload }));
    });

    it('returns 409 when AppError is thrown (duplicate email)', async () => {
      (AuthService.register as jest.Mock).mockRejectedValue(
        new AppError('Email already registered', 409, 'EMAIL_EXISTS'),
      );

      const req = mockReq({ email: 'dup@b.com' });
      const res = mockRes();

      await AuthController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, code: 'EMAIL_EXISTS' }));
    });

    it('returns 500 on unexpected error', async () => {
      (AuthService.register as jest.Mock).mockRejectedValue(new Error('DB down'));

      const req = mockReq({});
      const res = mockRes();

      await AuthController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, code: 'INTERNAL_SERVER_ERROR' }));
    });
  });

  // ── login ───────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns 200 with tokens on valid credentials', async () => {
      const tokens = { user: { id: 'u1' }, accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 };
      (AuthService.login as jest.Mock).mockResolvedValue(tokens);

      const req = mockReq({ email: 'a@b.com', password: 'pass' });
      const res = mockRes();

      await AuthController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: tokens }));
    });

    it('returns 401 on invalid credentials', async () => {
      (AuthService.login as jest.Mock).mockRejectedValue(
        new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS'),
      );

      const req = mockReq({ email: 'a@b.com', password: 'wrong' });
      const res = mockRes();

      await AuthController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, code: 'INVALID_CREDENTIALS' }));
    });
  });

  // ── refreshToken ─────────────────────────────────────────────────────────────
  describe('refreshToken', () => {
    it('returns 200 with new tokens', async () => {
      const newTokens = { accessToken: 'new-tok', refreshToken: 'new-ref', expiresIn: 3600 };
      (AuthService.refreshToken as jest.Mock).mockResolvedValue(newTokens);

      const req = mockReq({ refreshToken: 'old-ref' });
      const res = mockRes();

      await AuthController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 400 when refreshToken is missing', async () => {
      const req = mockReq({});
      const res = mockRes();

      await AuthController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 401 on reuse-detection AppError', async () => {
      (AuthService.refreshToken as jest.Mock).mockRejectedValue(
        new AppError('Refresh token already used', 401, 'REFRESH_TOKEN_REUSE'),
      );

      const req = mockReq({ refreshToken: 'used-ref' });
      const res = mockRes();

      await AuthController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'REFRESH_TOKEN_REUSE' }));
    });
  });

  // ── logout ──────────────────────────────────────────────────────────────────
  describe('logout', () => {
    it('returns 200 and calls AuthService.logout', async () => {
      (AuthService.logout as jest.Mock).mockResolvedValue(undefined);

      const req = mockReq({}, { id: 'u1' }, { authorization: 'Bearer token123' });
      const res = mockRes();

      await AuthController.logout(req, res);

      expect(AuthService.logout).toHaveBeenCalledWith('u1', 'token123');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 401 when user not authenticated', async () => {
      const req = mockReq({}, undefined);
      const res = mockRes();

      await AuthController.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ── deleteAccount ───────────────────────────────────────────────────────────
  describe('deleteAccount', () => {
    const makeUser = (overrides: any = {}) => ({
      id: 'u1',
      email: 'rider@example.com',
      comparePassword: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    });

    it('rejects when no re-authentication is supplied', async () => {
      const req = mockReq({}, { id: 'u1' });
      const res = mockRes();

      await AuthController.deleteAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'REAUTH_REQUIRED' }),
      );
    });

    it('rejects an incorrect password', async () => {
      MockedUser.findByPk.mockResolvedValue(
        makeUser({ comparePassword: jest.fn().mockResolvedValue(false) }),
      );

      const req = mockReq({ password: 'wrong' }, { id: 'u1' });
      const res = mockRes();

      await AuthController.deleteAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_PASSWORD' }),
      );
    });

    it('erases personal data on success', async () => {
      const user = makeUser();
      MockedUser.findByPk.mockResolvedValue(user);

      const req = mockReq({ password: 'correct' }, { id: 'u1' }, { authorization: 'Bearer tok' });
      const res = mockRes();

      await AuthController.deleteAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      const written = user.update.mock.calls[0][0];
      expect(written.email).toBe('deleted-u1@deleted.aryv-app.com');
      expect(written.phone).toBeNull();
      expect(written.firstName).toBe('Deleted');
      expect(written.profilePicture).toBeNull();
      expect(written.emergencyContactPhone).toBeNull();
      expect(written.dateOfBirth).toBeNull();
      expect(written.refreshToken).toBeNull();
      expect(written.deactivationReason).toBe('account_deleted_by_user');
      // The password is replaced, not left as the caller supplied it.
      expect(written.password).not.toBe('correct');
      expect(written.password).toHaveLength(128);
    });

    it('accepts a Google token as re-authentication for federated accounts', async () => {
      const user = makeUser({
        comparePassword: jest.fn().mockResolvedValue(false),
      });
      MockedUser.findByPk.mockResolvedValue(user);
      process.env['GOOGLE_WEB_CLIENT_ID'] = 'web-client-id';

      const verifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => ({ email: 'rider@example.com', email_verified: true }),
      });
      // The controller holds a private module-scoped OAuth client, so patch
      // the library prototype rather than reaching into the module.
      const { OAuth2Client } = require('google-auth-library');
      const original = OAuth2Client.prototype.verifyIdToken;
      OAuth2Client.prototype.verifyIdToken = verifyIdToken;

      try {
        const req = mockReq({ googleIdToken: 'google-token' }, { id: 'u1' }, { authorization: 'Bearer tok' });
        const res = mockRes();

        await AuthController.deleteAccount(req, res);

        expect(verifyIdToken).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(user.update).toHaveBeenCalled();
      } finally {
        OAuth2Client.prototype.verifyIdToken = original;
      }
    });

    it('refuses a Google token belonging to a different account', async () => {
      const user = makeUser();
      MockedUser.findByPk.mockResolvedValue(user);
      process.env['GOOGLE_WEB_CLIENT_ID'] = 'web-client-id';

      const { OAuth2Client } = require('google-auth-library');
      const original = OAuth2Client.prototype.verifyIdToken;
      OAuth2Client.prototype.verifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => ({ email: 'someone.else@example.com', email_verified: true }),
      });

      try {
        const req = mockReq({ googleIdToken: 'google-token' }, { id: 'u1' });
        const res = mockRes();

        await AuthController.deleteAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(user.update).not.toHaveBeenCalled();
      } finally {
        OAuth2Client.prototype.verifyIdToken = original;
      }
    });
  });
});
