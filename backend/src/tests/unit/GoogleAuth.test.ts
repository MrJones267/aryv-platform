/**
 * @fileoverview Unit tests for Google sign-in token verification
 * @author Oabona-Majoko
 * @created 2026-07-20
 * @lastModified 2026-07-20
 */

import { Response } from 'express';

const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

jest.mock('../../services/AuthService');
// NOTE: User is deliberately NOT jest.mock()'d. Auto-mocking it replaces the
// Sequelize model, and models/index.ts then throws at import time when
// UserCurrency.belongsTo(User) receives a non-model. We spy on the real class
// instead, which leaves the association graph intact.
jest.mock('../../config/redis', () => ({
  redisClient: {
    connect: jest.fn(),
    set: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
  },
}));

import { AuthController } from '../../controllers/AuthController';
import { AuthService } from '../../services/AuthService';
import User from '../../models/User';

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (body: any = {}): any => ({ body, headers: {}, get: () => undefined });

/** Shape a verified-Google-user ticket the way google-auth-library returns it. */
const ticketFor = (payload: Record<string, unknown>) => ({
  getPayload: () => payload,
});

const GOOGLE_PAYLOAD = {
  email: 'Rider@Example.com',
  email_verified: true,
  given_name: 'Rider',
  family_name: 'One',
  name: 'Rider One',
  picture: 'https://example.com/p.png',
};

describe('AuthController.verifyGoogleToken', () => {
  const ORIGINAL_ENV = process.env;
  let findOneSpy: jest.SpyInstance;
  let createSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, GOOGLE_WEB_CLIENT_ID: 'web-client-id.apps.googleusercontent.com' };
    (AuthService.generateAccessToken as jest.Mock).mockReturnValue('access-token');
    (AuthService.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token');
    findOneSpy = jest.spyOn(User, 'findOne').mockResolvedValue(null);
    createSpy = jest.spyOn(User, 'create').mockResolvedValue({} as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 400 when idToken is missing', async () => {
    const res = mockRes();
    await AuthController.verifyGoogleToken(mockReq({}), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, code: 'IDTOKEN_REQUIRED' }),
    );
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('returns 503 when no Google client ID is configured', async () => {
    delete process.env['GOOGLE_WEB_CLIENT_ID'];
    const res = mockRes();

    await AuthController.verifyGoogleToken(mockReq({ idToken: 'x' }), res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'GOOGLE_NOT_CONFIGURED' }),
    );
    // Must not attempt verification with an empty audience list, which would
    // accept tokens minted for any Google client.
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('returns 401 when Google rejects the token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token signature'));
    const res = mockRes();

    await AuthController.verifyGoogleToken(mockReq({ idToken: 'forged' }), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_GOOGLE_TOKEN' }),
    );
  });

  it('verifies the token against the configured audience', async () => {
    mockVerifyIdToken.mockResolvedValue(ticketFor(GOOGLE_PAYLOAD));
    findOneSpy.mockResolvedValue(null as any);
    createSpy.mockResolvedValue({
      id: 'u1',
      email: 'rider@example.com',
      role: 'passenger',
      update: jest.fn(),
      toSafeObject: () => ({ id: 'u1' }),
    });

    await AuthController.verifyGoogleToken(mockReq({ idToken: 'good' }), mockRes());

    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'good',
      audience: ['web-client-id.apps.googleusercontent.com'],
    });
  });

  // ── the account-takeover guard ──────────────────────────────────────────────
  it('refuses to link an UNVERIFIED Google email to an existing account', async () => {
    mockVerifyIdToken.mockResolvedValue(
      ticketFor({ ...GOOGLE_PAYLOAD, email_verified: false }),
    );
    const existing = { id: 'victim', email: 'rider@example.com', update: jest.fn() };
    findOneSpy.mockResolvedValue(existing as any);

    const res = mockRes();
    await AuthController.verifyGoogleToken(mockReq({ idToken: 'unverified' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'GOOGLE_EMAIL_UNVERIFIED' }),
    );
    // Critically: no session was minted for the victim's account.
    expect(existing.update).not.toHaveBeenCalled();
    expect(AuthService.generateAccessToken).not.toHaveBeenCalled();
  });

  it('refuses to create an account from an unverified Google email', async () => {
    mockVerifyIdToken.mockResolvedValue(
      ticketFor({ ...GOOGLE_PAYLOAD, email_verified: false }),
    );
    findOneSpy.mockResolvedValue(null as any);

    const res = mockRes();
    await AuthController.verifyGoogleToken(mockReq({ idToken: 'unverified' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('rejects a token with no email claim', async () => {
    mockVerifyIdToken.mockResolvedValue(ticketFor({ email_verified: true }));
    const res = mockRes();

    await AuthController.verifyGoogleToken(mockReq({ idToken: 'noemail' }), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'GOOGLE_EMAIL_MISSING' }),
    );
  });

  it('creates a new user with a normalised email and an unusable password', async () => {
    mockVerifyIdToken.mockResolvedValue(ticketFor(GOOGLE_PAYLOAD));
    findOneSpy.mockResolvedValue(null as any);
    const created = {
      id: 'u-new',
      email: 'rider@example.com',
      role: 'passenger',
      update: jest.fn(),
      toSafeObject: () => ({ id: 'u-new', email: 'rider@example.com' }),
    };
    createSpy.mockResolvedValue(created as any);

    const res = mockRes();
    await AuthController.verifyGoogleToken(mockReq({ idToken: 'good' }), res);

    const createArg = createSpy.mock.calls[0][0];
    expect(createArg.email).toBe('rider@example.com'); // lowercased
    expect(createArg.isEmailVerified).toBe(true);
    expect(createArg.firstName).toBe('Rider');
    expect(createArg.lastName).toBe('One');
    // Password must be long, random, and never a predictable placeholder.
    expect(createArg.password).toMatch(/^[0-9a-f]{128}$/);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ accessToken: 'access-token', refreshToken: 'refresh-token' }),
      }),
    );
  });

  it('generates a different password for each Google account created', async () => {
    mockVerifyIdToken.mockResolvedValue(ticketFor(GOOGLE_PAYLOAD));
    findOneSpy.mockResolvedValue(null as any);
    createSpy.mockResolvedValue({
      id: 'u', email: 'r@e.com', role: 'passenger',
      update: jest.fn(), toSafeObject: () => ({}),
    });

    await AuthController.verifyGoogleToken(mockReq({ idToken: 'a' }), mockRes());
    await AuthController.verifyGoogleToken(mockReq({ idToken: 'b' }), mockRes());

    const first = createSpy.mock.calls[0][0].password;
    const second = createSpy.mock.calls[1][0].password;
    expect(first).not.toBe(second);
  });

  it('links a verified Google email to an existing account and issues tokens', async () => {
    mockVerifyIdToken.mockResolvedValue(ticketFor(GOOGLE_PAYLOAD));
    const existing = {
      id: 'u-existing',
      email: 'rider@example.com',
      role: 'driver',
      status: 'active',
      update: jest.fn(),
      toSafeObject: () => ({ id: 'u-existing' }),
    };
    findOneSpy.mockResolvedValue(existing as any);

    const res = mockRes();
    await AuthController.verifyGoogleToken(mockReq({ idToken: 'good' }), res);

    expect(createSpy).not.toHaveBeenCalled();
    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: 'refresh-token' }),
    );
    expect(AuthService.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-existing', role: 'driver' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('refuses to issue tokens for a suspended account', async () => {
    mockVerifyIdToken.mockResolvedValue(ticketFor(GOOGLE_PAYLOAD));
    const suspended = {
      id: 'u-susp',
      email: 'rider@example.com',
      role: 'passenger',
      status: 'suspended',
      update: jest.fn(),
      toSafeObject: () => ({}),
    };
    findOneSpy.mockResolvedValue(suspended as any);

    const res = mockRes();
    await AuthController.verifyGoogleToken(mockReq({ idToken: 'good' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ACCOUNT_SUSPENDED' }),
    );
    expect(suspended.update).not.toHaveBeenCalled();
  });

  it('returns 500 without leaking internals when the database fails', async () => {
    mockVerifyIdToken.mockResolvedValue(ticketFor(GOOGLE_PAYLOAD));
    findOneSpy.mockRejectedValue(new Error('connection terminated'));

    const res = mockRes();
    await AuthController.verifyGoogleToken(mockReq({ idToken: 'good' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(JSON.stringify(body)).not.toContain('connection terminated');
  });
});
