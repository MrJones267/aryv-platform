/**
 * @fileoverview Unit tests for AuthController
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import { Request, Response } from 'express';
import { AuthController } from '../../controllers/AuthController';
import { AuthenticatedRequest, AppError } from '../../types';

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
});
