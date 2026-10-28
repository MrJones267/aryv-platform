/**
 * @fileoverview Integration tests for an admin's own account
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * Covers what an admin can do to their own account: edit their name, change
 * their password, sign out every other device, and see their own activity.
 * The property that matters most: after a password change or a sign-out of
 * other devices, a token issued before it no longer works.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { AdminUser } from '../../models/AdminUser';
import AdminAuditLog from '../../models/AdminAuditLog';
import { base32Decode, timeStep, totpForStep } from '../../utils/totp';

const PASSWORD = 'Integration-Test-Password-1!';
const NEW_PASSWORD = 'A-Different-Password-2?';

describe('Admin profile', () => {
  let admin: AdminUser;
  let other: AdminUser;

  /** A token issued `secondsAgo` seconds in the past, as an older session would be. */
  const tokenFor = (a: AdminUser, secondsAgo = 0) =>
    jwt.sign(
      { id: a.id, email: a.email, role: a.role, permissions: a.permissions, type: 'admin', iat: Math.floor(Date.now() / 1000) - secondsAgo },
      process.env['ADMIN_JWT_SECRET']!,
      { expiresIn: '1h' }
    );

  const as = (token: string) => ({
    get: (p: string) => request(app).get(p).set('Authorization', `Bearer ${token}`),
    put: (p: string, body: object) => request(app).put(p).set('Authorization', `Bearer ${token}`).send(body),
    post: (p: string, body: object = {}) => request(app).post(p).set('Authorization', `Bearer ${token}`).send(body),
  });

  beforeEach(async () => {
    // The setup file empties every table before each test.
    admin = await AdminUser.createAdmin({
      email: 'me@test.com', password: PASSWORD, firstName: 'Neo', lastName: 'Admin', role: 'moderator', permissions: ['users.read'],
    });
    other = await AdminUser.createAdmin({
      email: 'other@test.com', password: PASSWORD, firstName: 'Other', lastName: 'Admin', role: 'admin', permissions: ['users.read'],
    });
  });

  afterEach(() => {
    delete process.env['TOTP_ENCRYPTION_KEY'];
  });

  describe('name', () => {
    it('updates the name, trimmed', async () => {
      const response = await as(tokenFor(admin)).put('/api/admin/auth/profile', { firstName: '  Neo ', lastName: 'Mokoena' }).expect(200);
      expect(response.body.data.user).toMatchObject({ firstName: 'Neo', lastName: 'Mokoena' });
    });

    it.each([[{ firstName: '' }], [{ lastName: 'x'.repeat(51) }], [{ firstName: 42 }]])('refuses %p', async body => {
      await as(tokenFor(admin)).put('/api/admin/auth/profile', body).expect(400);
    });
  });

  describe('password', () => {
    const change = (token: string, body: object) => as(token).post('/api/admin/auth/password', body);

    it('needs the current password', async () => {
      const response = await change(tokenFor(admin), { currentPassword: 'Wrong-Password-9!', newPassword: NEW_PASSWORD }).expect(400);
      expect(response.body.code).toBe('INVALID_PASSWORD');
    });

    it('refuses a weak or unchanged password', async () => {
      expect((await change(tokenFor(admin), { currentPassword: PASSWORD, newPassword: 'short' }).expect(400)).body.code).toBe('WEAK_PASSWORD');
      expect((await change(tokenFor(admin), { currentPassword: PASSWORD, newPassword: PASSWORD }).expect(400)).body.code).toBe('SAME_PASSWORD');
    });

    it('changes it, ends the other sessions, and keeps this one going', async () => {
      const older = tokenFor(admin, 30);
      const response = await change(tokenFor(admin, 5), { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }).expect(200);
      const fresh = response.body.data.accessToken;

      const refused = await as(older).get('/api/admin/auth/verify').expect(401);
      expect(refused.body.code).toBe('SESSION_REVOKED');
      await as(fresh).get('/api/admin/auth/verify').expect(200);

      await request(app).post('/api/admin/auth/login').send({ email: 'me@test.com', password: PASSWORD }).expect(401);
      await request(app).post('/api/admin/auth/login').send({ email: 'me@test.com', password: NEW_PASSWORD }).expect(200);
    });

    it('does not end anyone else\'s sessions', async () => {
      const othersSession = tokenFor(other, 30);
      await change(tokenFor(admin), { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }).expect(200);
      await as(othersSession).get('/api/admin/auth/verify').expect(200);
    });

    it('needs an authenticator code too when two-factor is on', async () => {
      process.env['TOTP_ENCRYPTION_KEY'] = 'integration-test-totp-encryption-key';
      const token = tokenFor(admin);
      const setup = await as(token).post('/api/admin/auth/2fa/setup').expect(200);
      const secret = setup.body.data.secret;
      await as(token).post('/api/admin/auth/2fa/confirm', { code: totpForStep(base32Decode(secret), timeStep()) }).expect(200);

      const without = await change(token, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }).expect(400);
      expect(without.body.code).toBe('TWO_FACTOR_REQUIRED');
      await change(token, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, code: totpForStep(base32Decode(secret), timeStep() + 1) }).expect(200);
    });

    it('never records either password in the audit trail', async () => {
      await change(tokenFor(admin), { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }).expect(200);
      let entry: AdminAuditLog | null = null;
      for (let i = 0; i < 40 && !entry; i++) {
        entry = await AdminAuditLog.findOne({ where: { action: 'admin.password_change' } });
        if (!entry) await new Promise(r => setTimeout(r, 50));
      }
      const stored = JSON.stringify(entry!.details);
      expect(stored).not.toContain(PASSWORD);
      expect(stored).not.toContain(NEW_PASSWORD);
    });
  });

  describe('other devices', () => {
    it('signs out every other session and keeps this one', async () => {
      const elsewhere = tokenFor(admin, 30);
      const response = await as(tokenFor(admin, 5)).post('/api/admin/auth/sessions/revoke-others').expect(200);

      expect((await as(elsewhere).get('/api/admin/auth/verify').expect(401)).body.code).toBe('SESSION_REVOKED');
      await as(response.body.data.accessToken).get('/api/admin/auth/verify').expect(200);
    });
  });

  describe('activity', () => {
    it('shows your own sign-ins and actions, and no one else\'s', async () => {
      await request(app).post('/api/admin/auth/login').send({ email: 'me@test.com', password: PASSWORD }).expect(200);
      await request(app).post('/api/admin/auth/login').send({ email: 'other@test.com', password: PASSWORD }).expect(200);
      await request(app).post('/api/admin/auth/login').send({ email: 'me@test.com', password: 'Wrong-Password-9!' }).expect(401);

      const response = await as(tokenFor(admin)).get('/api/admin/auth/activity').expect(200);
      const entries = response.body.data.entries;
      expect(entries).toHaveLength(2);
      expect(entries.map((e: any) => e.outcome)).toEqual(['refused', 'succeeded']);
      expect(entries[0]).toMatchObject({ action: 'admin.sign_in', reason: 'wrong_password' });
    });
  });
});
