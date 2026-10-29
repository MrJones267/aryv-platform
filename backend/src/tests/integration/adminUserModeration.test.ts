/**
 * @fileoverview Integration tests for blocking, unblocking and editing users
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * A block's reason was only written to a log line, unblocking took no reason
 * at all, and the edit endpoint let status be changed without either. It
 * also returned the whole row, refresh-token hash included. These cover the
 * reasons, the moderation history read back from the audit trail, and the
 * edit endpoint's rules.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { User } from '../../models';
import { AdminUser } from '../../models/AdminUser';
import AdminAuditLog from '../../models/AdminAuditLog';
import { AuthService } from '../../services/AuthService';
import { UserRole } from '../../types';

const waitForAudit = async (expected: number) => {
  for (let i = 0; i < 40; i++) {
    if ((await AdminAuditLog.count({ where: { resourceType: 'user' } })) >= expected) return;
    await new Promise(r => setTimeout(r, 50));
  }
};

describe('Admin user moderation', () => {
  let token: string;
  let user: any;

  beforeEach(async () => {
    // The setup file empties every table before each test.
    const admin = await AdminUser.createAdmin({
      email: 'mod@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Mpho', lastName: 'Moderator', role: 'admin', permissions: ['users.read', 'users.block'],
    });
    token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions, type: 'admin' },
      process.env['ADMIN_JWT_SECRET']!,
      { expiresIn: '1h' }
    );
    user = await User.create({
      email: 'rider@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Lesedi', lastName: 'Rider', role: UserRole.PASSENGER, countryCode: 'BW',
    } as any);
  });

  const as = {
    post: (p: string, body: object = {}) => request(app).post(p).set('Authorization', `Bearer ${token}`).send(body),
    put: (p: string, body: object) => request(app).put(p).set('Authorization', `Bearer ${token}`).send(body),
    get: (p: string) => request(app).get(p).set('Authorization', `Bearer ${token}`),
  };
  const riderToken = () => AuthService.generateAccessToken({ userId: user.id, email: user.email, role: UserRole.PASSENGER });

  describe('blocking and unblocking', () => {
    it('needs a reason to block', async () => {
      await as.post(`/api/admin/users/${user.id}/block`, {}).expect(400);
      await as.post(`/api/admin/users/${user.id}/block`, { reason: 'bad' }).expect(400);
    });

    it('blocks with a reason, and the user is locked out at once', async () => {
      await as.post(`/api/admin/users/${user.id}/block`, { reason: 'Repeated no-shows on booked rides' }).expect(200);
      const refused = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${riderToken()}`).expect(403);
      expect(refused.body.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('needs a reason to unblock too', async () => {
      await as.post(`/api/admin/users/${user.id}/block`, { reason: 'Repeated no-shows on booked rides' }).expect(200);
      await as.post(`/api/admin/users/${user.id}/unblock`, {}).expect(400);
      await as.post(`/api/admin/users/${user.id}/unblock`, { reason: 'Spoke to them; it was a phone fault' }).expect(200);
      await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${riderToken()}`).expect(200);
    });

    it('keeps both decisions in the moderation history, with who and why', async () => {
      await as.post(`/api/admin/users/${user.id}/block`, { reason: 'Repeated no-shows on booked rides' }).expect(200);
      await as.post(`/api/admin/users/${user.id}/unblock`, { reason: 'Spoke to them; it was a phone fault' }).expect(200);
      await waitForAudit(2);

      const response = await as.get(`/api/admin/users/${user.id}/moderation`).expect(200);
      const entries = response.body.data.entries;
      expect(entries.map((e: any) => [e.action, e.reason, e.adminEmail])).toEqual([
        ['user.unblock', 'Spoke to them; it was a phone fault', 'mod@test.com'],
        ['user.block', 'Repeated no-shows on booked rides', 'mod@test.com'],
      ]);
    });
  });

  describe('editing', () => {
    it('refuses to change status, which must go through block or unblock', async () => {
      const response = await as.put(`/api/admin/users/${user.id}`, { status: 'suspended' }).expect(400);
      expect(response.body.code).toBe('STATUS_NOT_EDITABLE');
    });

    it('updates names and returns only safe fields', async () => {
      const response = await as.put(`/api/admin/users/${user.id}`, { firstName: ' Lesedi ', lastName: 'Molefe' }).expect(200);
      const returned = response.body.data.user;
      expect(returned).toMatchObject({ firstName: 'Lesedi', lastName: 'Molefe' });
      expect(returned).not.toHaveProperty('password');
      expect(returned).not.toHaveProperty('refreshToken');
      expect(Object.keys(returned).sort()).toEqual(
        ['email', 'firstName', 'id', 'isEmailVerified', 'isPhoneVerified', 'lastName', 'phone', 'role', 'status', 'updatedAt'],
      );
    });

    it('normalises a local phone number, and refuses one already in use', async () => {
      const response = await as.put(`/api/admin/users/${user.id}`, { phone: '71234567' }).expect(200);
      expect(response.body.data.user.phone).toBe('+26771234567');

      const other = await User.create({ email: 'other@test.com', password: 'Integration-Test-Password-1!', firstName: 'O', lastName: 'T', role: UserRole.PASSENGER } as any);
      await as.put(`/api/admin/users/${other.id}`, { phone: '+267 7123 4567' }).expect(409);
      await as.put(`/api/admin/users/${other.id}`, { phone: 'not a phone' }).expect(400);
    });

    it('lower-cases email, and refuses an invalid or taken one', async () => {
      const response = await as.put(`/api/admin/users/${user.id}`, { email: ' Lesedi@Example.COM ' }).expect(200);
      expect(response.body.data.user.email).toBe('lesedi@example.com');

      const other = await User.create({ email: 'other@test.com', password: 'Integration-Test-Password-1!', firstName: 'O', lastName: 'T', role: UserRole.PASSENGER } as any);
      await as.put(`/api/admin/users/${other.id}`, { email: 'LESEDI@example.com' }).expect(409);
      await as.put(`/api/admin/users/${other.id}`, { email: 'not-an-email' }).expect(400);
    });

    it('changes a role between rider, driver and courier, but never to admin', async () => {
      await as.put(`/api/admin/users/${user.id}`, { role: 'driver' }).expect(200);
      await as.put(`/api/admin/users/${user.id}`, { role: 'admin' }).expect(400);
    });

    it('refuses an empty edit', async () => {
      await as.put(`/api/admin/users/${user.id}`, {}).expect(400);
    });
  });
});
