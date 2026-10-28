/**
 * @fileoverview Integration tests for admin two-factor sign-in
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * Admin accounts were protected by a password alone. These cover turning an
 * authenticator code on for an account, signing in with it, and the ways it
 * must refuse: no code, a wrong code, a reused code, no server key.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { AdminUser } from '../../models/AdminUser';
import AdminAuditLog from '../../models/AdminAuditLog';
import { base32Decode, timeStep, totpForStep } from '../../utils/totp';

const PASSWORD = 'Integration-Test-Password-1!';
const KEY = 'integration-test-totp-encryption-key';

const codeAt = (secret: string, offsetSteps = 0) => totpForStep(base32Decode(secret), timeStep() + offsetSteps);

describe('Admin two-factor sign-in', () => {
  let admin: AdminUser;
  let token: string;

  const signIn = (body: Record<string, unknown>) =>
    request(app).post('/api/admin/auth/login').send({ email: 'ops@test.com', password: PASSWORD, ...body });
  const authed = (method: 'get' | 'post', path: string, body: object = {}) =>
    (method === 'get' ? request(app).get(path) : request(app).post(path).send(body)).set('Authorization', `Bearer ${token}`);

  /** Sets two-factor up and on; returns the secret. */
  const enable = async (): Promise<string> => {
    const setup = await authed('post', '/api/admin/auth/2fa/setup').expect(200);
    const { secret } = setup.body.data;
    await authed('post', '/api/admin/auth/2fa/confirm', { code: codeAt(secret) }).expect(200);
    return secret;
  };

  beforeEach(async () => {
    process.env['TOTP_ENCRYPTION_KEY'] = KEY;
    // The setup file empties every table before each test.
    admin = await AdminUser.createAdmin({
      email: 'ops@test.com', password: PASSWORD, firstName: 'Ops', lastName: 'Admin', role: 'admin', permissions: ['users.read'],
    });
    token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions, type: 'admin' },
      process.env['ADMIN_JWT_SECRET']!,
      { expiresIn: '1h' }
    );
  });

  afterAll(() => {
    delete process.env['TOTP_ENCRYPTION_KEY'];
  });

  describe('setting up', () => {
    it('is unavailable until the server has an encryption key', async () => {
      delete process.env['TOTP_ENCRYPTION_KEY'];
      const status = await authed('get', '/api/admin/auth/2fa').expect(200);
      expect(status.body.data).toEqual({ enabled: false, available: false });
      const setup = await authed('post', '/api/admin/auth/2fa/setup').expect(503);
      expect(setup.body.code).toBe('NOT_CONFIGURED');
    });

    it('gives a QR code and the key, and stays off until a code is confirmed', async () => {
      const setup = await authed('post', '/api/admin/auth/2fa/setup').expect(200);
      expect(setup.body.data.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(setup.body.data.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(setup.body.data.otpauthUri).toContain('issuer=ARYV%20Admin');

      // Not on yet, so a password alone still signs in.
      await signIn({}).expect(200);
      expect((await authed('get', '/api/admin/auth/2fa').expect(200)).body.data.enabled).toBe(false);
    });

    it('refuses a wrong confirmation code, and accepts the right one', async () => {
      const setup = await authed('post', '/api/admin/auth/2fa/setup').expect(200);
      await authed('post', '/api/admin/auth/2fa/confirm', { code: '000000' }).expect(400);
      await authed('post', '/api/admin/auth/2fa/confirm', { code: codeAt(setup.body.data.secret) }).expect(200);
      expect((await authed('get', '/api/admin/auth/2fa').expect(200)).body.data.enabled).toBe(true);
    });

    it('stores the secret encrypted, never as the key the app was given', async () => {
      const secret = await enable();
      const stored = (await AdminUser.findByPk(admin.id))!.twoFactorSecret!;
      expect(stored.startsWith('v1:')).toBe(true);
      expect(stored).not.toContain(secret);
    });
  });

  describe('signing in', () => {
    it('asks for a code once two-factor is on', async () => {
      await enable();
      const response = await signIn({}).expect(401);
      expect(response.body.code).toBe('TWO_FACTOR_REQUIRED');
    });

    it('signs in with the right code', async () => {
      const secret = await enable();
      const response = await signIn({ code: codeAt(secret, 1) }).expect(200);
      expect(response.body.data.tokens.accessToken).toBeTruthy();
    });

    it('refuses a wrong code, counts it towards the lockout, and records it', async () => {
      await enable();
      const response = await signIn({ code: '000000' }).expect(401);
      expect(response.body.code).toBe('TWO_FACTOR_INVALID');
      expect((await AdminUser.findByPk(admin.id))!.failedLoginAttempts).toBe(1);

      const entry = await AdminAuditLog.findOne({ where: { action: 'admin.sign_in', adminUserId: admin.id } });
      expect(entry!.details).toMatchObject({ outcome: 'refused', reason: 'wrong_two_factor_code' });
    });

    it('refuses the same code twice', async () => {
      const secret = await enable();
      const code = codeAt(secret, 1);
      await signIn({ code }).expect(200);
      const again = await signIn({ code }).expect(401);
      expect(again.body.error).toContain('already been used');
    });

    it('fails closed when the server loses its key', async () => {
      const secret = await enable();
      delete process.env['TOTP_ENCRYPTION_KEY'];
      const response = await signIn({ code: codeAt(secret, 1) }).expect(503);
      expect(response.body.code).toBe('TWO_FACTOR_UNAVAILABLE');
    });
  });

  describe('turning it off', () => {
    it('needs the password and a current code', async () => {
      const secret = await enable();
      await authed('post', '/api/admin/auth/2fa/disable', { password: 'Wrong-Password-9!', code: codeAt(secret, 1) }).expect(400);
      await authed('post', '/api/admin/auth/2fa/disable', { password: PASSWORD, code: '000000' }).expect(400);
      await authed('post', '/api/admin/auth/2fa/disable', { password: PASSWORD, code: codeAt(secret, 1) }).expect(200);

      const reloaded = (await AdminUser.findByPk(admin.id))!;
      expect(reloaded.twoFactorEnabled).toBe(false);
      expect(reloaded.twoFactorSecret).toBeNull();
      await signIn({}).expect(200);
    });
  });
});
