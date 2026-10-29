/**
 * @fileoverview Integration tests for an admin's verification review of a user
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * The panel sent { verified } and the server read { verificationType }, so
 * approving and revoking both reported success and changed nothing. The
 * review itself showed an invented ID card. These cover the explicit flags,
 * the reason, and the user's real documents.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { User } from '../../models';
import { AdminUser } from '../../models/AdminUser';
import DriverDocument, { DocumentType } from '../../models/DriverDocument';
import { UserRole } from '../../types';

describe('Admin user verification', () => {
  let token: string;
  let moderatorToken: string;
  let user: any;

  const sign = (a: AdminUser) => jwt.sign(
    { id: a.id, email: a.email, role: a.role, permissions: a.permissions, type: 'admin' },
    process.env['ADMIN_JWT_SECRET']!,
    { expiresIn: '1h' },
  );

  beforeEach(async () => {
    // The setup file empties every table before each test.
    token = sign(await AdminUser.createAdmin({
      email: 'ops@test.com', password: 'Integration-Test-Password-1!', firstName: 'Ops', lastName: 'Admin', role: 'admin', permissions: [],
    }));
    moderatorToken = sign(await AdminUser.createAdmin({
      email: 'mod@test.com', password: 'Integration-Test-Password-1!', firstName: 'Mod', lastName: 'Erator', role: 'moderator', permissions: [],
    }));
    user = await User.create({
      email: 'driver@test.com', password: 'Integration-Test-Password-1!', phone: '+26771234567',
      firstName: 'Kabo', lastName: 'Driver', role: UserRole.DRIVER, countryCode: 'BW',
    } as any);
  });

  const verify = (body: object, as = token) =>
    request(app).put(`/api/admin/users/${user.id}/verify`).set('Authorization', `Bearer ${as}`).send(body);

  it('marks email and phone verified, and revokes them, with a reason', async () => {
    const on = await verify({ email: true, phone: true, reason: 'Called them and confirmed both' }).expect(200);
    expect(on.body.data).toMatchObject({ isEmailVerified: true, isPhoneVerified: true });

    await verify({ phone: false, reason: 'Number now belongs to someone else' }).expect(200);
    const reloaded = await User.findByPk(user.id);
    expect(reloaded).toMatchObject({ isEmailVerified: true, isPhoneVerified: false });
  });

  it('refuses without a reason, without a change, or with a non-boolean', async () => {
    expect((await verify({ email: true }).expect(400)).body.code).toBe('REASON_REQUIRED');
    expect((await verify({ reason: 'Nothing to change here' }).expect(400)).body.code).toBe('NOTHING_TO_CHANGE');
    await verify({ email: 'yes', reason: 'Called them and confirmed' }).expect(400);
    // The old body shape no longer reports a success that changed nothing.
    await verify({ verified: true }).expect(400);
  });

  it('cannot verify a phone the user does not have', async () => {
    await user.update({ phone: null });
    expect((await verify({ phone: true, reason: 'Called them and confirmed' }).expect(400)).body.code).toBe('NO_PHONE');
  });

  it('is for admins, not moderators', async () => {
    await verify({ email: true, reason: 'Called them and confirmed' }, moderatorToken).expect(403);
  });

  it('lists and shows users with safe fields only, and filters by status', async () => {
    await user.update({ refreshToken: 'stored-hash' });
    const blocked = await User.create({
      email: 'blocked@test.com', password: 'Integration-Test-Password-1!', firstName: 'B', lastName: 'L',
      role: UserRole.PASSENGER, status: 'suspended',
    } as any);

    const list = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${moderatorToken}`).expect(200);
    expect(list.body.data.pagination.total).toBe(2);
    const listed = list.body.data.users.find((u: any) => u.id === user.id);
    expect(listed).toMatchObject({ phone: '+26771234567', status: 'active', isEmailVerified: false });
    expect(listed).not.toHaveProperty('refreshToken');
    expect(listed).not.toHaveProperty('password');

    // Choosing a status filtered on a column that did not exist, and failed.
    const onlyBlocked = await request(app).get('/api/admin/users?status=blocked').set('Authorization', `Bearer ${moderatorToken}`).expect(200);
    expect(onlyBlocked.body.data.users.map((u: any) => u.id)).toEqual([blocked.id]);
    await request(app).get('/api/admin/users?status=active&sortBy=password').set('Authorization', `Bearer ${moderatorToken}`).expect(200);

    const detail = await request(app).get(`/api/admin/users/${user.id}`).set('Authorization', `Bearer ${moderatorToken}`).expect(200);
    expect(detail.body.data.user).not.toHaveProperty('refreshToken');
    expect(detail.body.data.user.email).toBe('driver@test.com');
  });

  it("lists the user's own documents, newest first, without storage paths", async () => {
    await DriverDocument.create({
      userId: user.id, documentType: DocumentType.DRIVERS_LICENSE, storageKey: 'a.jpg',
      originalFilename: 'licence.jpg', mimeType: 'image/jpeg', fileSizeBytes: 9, submittedAt: new Date(Date.now() - 60_000),
    } as any);
    await DriverDocument.create({
      userId: user.id, documentType: DocumentType.NATIONAL_ID, storageKey: 'b.jpg',
      originalFilename: 'omang.jpg', mimeType: 'image/jpeg', fileSizeBytes: 9,
    } as any);
    const other = await User.create({ email: 'o@test.com', password: 'Integration-Test-Password-1!', firstName: 'O', lastName: 'T', role: UserRole.DRIVER } as any);
    await DriverDocument.create({
      userId: other.id, documentType: DocumentType.PASSPORT, storageKey: 'c.jpg', mimeType: 'image/jpeg', fileSizeBytes: 9,
    } as any);

    const response = await request(app).get(`/api/admin/users/${user.id}/documents`).set('Authorization', `Bearer ${moderatorToken}`).expect(200);
    const documents = response.body.data.documents;
    expect(documents.map((d: any) => d.documentType)).toEqual(['national_id', 'drivers_license']);
    expect(JSON.stringify(documents)).not.toContain('storage');
  });
});
