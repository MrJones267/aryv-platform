/**
 * @fileoverview Integration tests for the admin audit trail
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * admin_audit_logs existed but nothing wrote to it. These cover what is now
 * recorded (sign-ins, and every admin request that changes something,
 * whether it succeeded or was refused), that credentials are never kept, and
 * the endpoint that reads the trail back.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { AdminUser } from '../../models/AdminUser';
import AdminAuditLog from '../../models/AdminAuditLog';
import { DeliveryTier, DeliveryTierType } from '../../models/DeliveryTier';
import DemandPricingEngine from '../../services/DemandPricingEngine';
import { sanitiseDetails } from '../../services/AuditService';

const PASSWORD = 'Integration-Test-Password-1!';

/** Entries are written once the response has gone, so wait for them. */
const entriesFor = async (where: Record<string, unknown>, expected = 1): Promise<AdminAuditLog[]> => {
  for (let i = 0; i < 40; i++) {
    const rows = await AdminAuditLog.findAll({ where, order: [['createdAt', 'ASC']] });
    if (rows.length >= expected) return rows;
    await new Promise(r => setTimeout(r, 50));
  }
  return AdminAuditLog.findAll({ where });
};

describe('Admin audit trail', () => {
  let superAdmin: AdminUser;
  let moderator: AdminUser;
  let superToken: string;
  let moderatorToken: string;
  let express: DeliveryTier;

  const tokenFor = (admin: AdminUser) =>
    jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions, type: 'admin' },
      process.env['ADMIN_JWT_SECRET']!,
      { expiresIn: '1h' }
    );

  beforeEach(async () => {
    // The setup file empties every table before each test.
    superAdmin = await AdminUser.createAdmin({
      email: 'super@test.com', password: PASSWORD, firstName: 'Sello', lastName: 'Super', role: 'super_admin', permissions: ['*'],
    });
    moderator = await AdminUser.createAdmin({
      email: 'mod@test.com', password: PASSWORD, firstName: 'Mpho', lastName: 'Mod', role: 'moderator', permissions: ['users.read'],
    });
    superToken = tokenFor(superAdmin);
    moderatorToken = tokenFor(moderator);
    await DemandPricingEngine.getInstance().initializeDefaultTiers();
    express = (await DeliveryTier.findOne({ where: { tierType: DeliveryTierType.EXPRESS } }))!;
  });

  describe('sign-in', () => {
    it('records a successful sign-in', async () => {
      await request(app).post('/api/admin/auth/login').send({ email: 'super@test.com', password: PASSWORD }).expect(200);
      const [entry] = await entriesFor({ action: 'admin.sign_in', adminUserId: superAdmin.id });
      expect(entry!.details).toMatchObject({ outcome: 'succeeded' });
      expect(entry!.ipAddress).toBeTruthy();
    });

    it('records a wrong password against the account, without the password', async () => {
      await request(app).post('/api/admin/auth/login').send({ email: 'super@test.com', password: 'Wrong-Password-9!' }).expect(401);
      const [entry] = await entriesFor({ action: 'admin.sign_in', adminUserId: superAdmin.id });
      expect(entry!.details).toMatchObject({ outcome: 'refused', reason: 'wrong_password' });
      expect(JSON.stringify(entry!.details)).not.toContain('Wrong-Password-9!');
    });

    it('records nothing for an email that is not an admin', async () => {
      await request(app).post('/api/admin/auth/login').send({ email: 'nobody@test.com', password: PASSWORD }).expect(401);
      await new Promise(r => setTimeout(r, 300));
      expect(await AdminAuditLog.count()).toBe(0);
    });
  });

  describe('changes', () => {
    it('records who changed what, to which record, and how it went', async () => {
      await request(app)
        .put(`/api/admin/delivery-tiers/${express.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .set('User-Agent', 'audit-test')
        .send({ platformFeePercentage: 30 })
        .expect(200);

      const [entry] = await entriesFor({ action: 'tier.update' });
      expect(entry).toMatchObject({ adminUserId: superAdmin.id, resourceType: 'delivery_tier', resourceId: express.id, userAgent: 'audit-test' });
      expect(entry!.details).toMatchObject({ outcome: 'succeeded', statusCode: 200, request: { platformFeePercentage: 30 } });
    });

    it('records a refused attempt too', async () => {
      await request(app)
        .put(`/api/admin/delivery-tiers/${express.id}`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ platformFeePercentage: 30 })
        .expect(403);

      const [entry] = await entriesFor({ action: 'tier.update' });
      expect(entry).toMatchObject({ adminUserId: moderator.id });
      expect(entry!.details).toMatchObject({ outcome: 'refused', statusCode: 403 });
    });

    it('never keeps a credential sent in a request', async () => {
      await request(app)
        .put(`/api/admin/delivery-tiers/${express.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ platformFeePercentage: 30, password: 'should-not-be-kept', refreshToken: 'nor-this' })
        .expect(200);

      const [entry] = await entriesFor({ action: 'tier.update' });
      const stored = JSON.stringify(entry!.details);
      expect(stored).not.toContain('should-not-be-kept');
      expect(stored).not.toContain('nor-this');
    });

    it('does not record reads', async () => {
      await request(app).get('/api/admin/delivery-tiers').set('Authorization', `Bearer ${superToken}`).expect(200);
      await new Promise(r => setTimeout(r, 300));
      expect(await AdminAuditLog.count()).toBe(0);
    });
  });

  describe('reading the trail', () => {
    it('lists entries newest first with who made them, and filters by action', async () => {
      await request(app).post('/api/admin/auth/login').send({ email: 'super@test.com', password: PASSWORD }).expect(200);
      await request(app).put(`/api/admin/delivery-tiers/${express.id}`).set('Authorization', `Bearer ${superToken}`).send({ isActive: false }).expect(200);
      await entriesFor({}, 2);

      const all = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${superToken}`).expect(200);
      expect(all.body.data.pagination.total).toBe(2);
      expect(all.body.data.entries[0]).toMatchObject({ action: 'tier.update', adminEmail: 'super@test.com', adminName: 'Sello Super' });

      const filtered = await request(app)
        .get('/api/admin/audit-logs?action=admin.sign_in')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);
      expect(filtered.body.data.entries.map((e: any) => e.action)).toEqual(['admin.sign_in']);
    });

    it('is not open to moderators', async () => {
      await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${moderatorToken}`).expect(403);
    });
  });

  describe('sanitiseDetails', () => {
    it('removes credentials but keeps fields that merely end in "code"', () => {
      expect(sanitiseDetails({ password: 'x', newPassword: 'y', otp: '123456', code: '9', countryCode: 'BW', note: 'ok' })).toEqual({
        password: '[redacted]', newPassword: '[redacted]', otp: '[redacted]', code: '[redacted]', countryCode: 'BW', note: 'ok',
      });
    });
  });
});
