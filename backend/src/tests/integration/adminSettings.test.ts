/**
 * @fileoverview Integration tests for the admin settings the platform really uses
 * @author Oabona-Majoko
 * @created 2026-10-27
 * @lastModified 2026-10-27
 *
 * The admin Settings page showed invented commission rates and security
 * options nothing read. What it shows now comes from two places: read-only
 * values taken from the constants the code runs on, and the delivery tiers,
 * which courier pricing reads from the database and admins can change.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { AdminUser } from '../../models/AdminUser';
import { DeliveryTier, DeliveryTierType } from '../../models/DeliveryTier';
import DemandPricingEngine from '../../services/DemandPricingEngine';

const tokenFor = (admin: AdminUser) =>
  jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions, type: 'admin' },
    process.env['ADMIN_JWT_SECRET']!,
    { expiresIn: '1h' }
  );

const makeAdmin = (role: 'super_admin' | 'admin') =>
  AdminUser.createAdmin({
    email: `${role}@test.com`,
    password: 'Integration-Test-Password-1!',
    firstName: 'Test',
    lastName: role,
    role,
    permissions: role === 'super_admin' ? ['*'] : ['analytics.read'],
  });

describe('Admin settings', () => {
  let superToken: string;
  let adminToken: string;
  let express: DeliveryTier;

  beforeEach(async () => {
    // The setup file empties every table before each test.
    superToken = tokenFor(await makeAdmin('super_admin'));
    adminToken = tokenFor(await makeAdmin('admin'));
    await DemandPricingEngine.getInstance().initializeDefaultTiers();
    express = (await DeliveryTier.findOne({ where: { tierType: DeliveryTierType.EXPRESS } }))!;
  });

  describe('GET /api/admin/settings/platform', () => {
    it('reports the fee and sign-in values the code runs on', async () => {
      const response = await request(app)
        .get('/api/admin/settings/platform')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toEqual({
        platformCurrency: 'BWP',
        fees: { bookingPlatformFeePercent: 5, cashCommissionPercent: 10, defaultCourierFeePercent: 25 },
        adminSecurity: {
          // The default when no super admin has set it: the 1-hour minimum.
          sessionHours: 1,
          sessionHoursMin: 1,
          sessionHoursMax: 24,
          loginAttemptsPerWindow: 5,
          loginWindowMinutes: 15,
          passwordMinLength: 8,
          twoFactorAvailable: false,
        },
        // CI has no Twilio credentials and no on-call numbers.
        sos: { onCallPhones: [], serverOnCallPhones: 0, maxOnCallPhones: 10, smsConfigured: false, reminderMinutes: [3, 8, 13] },
      });
    });

    it('requires an admin', async () => {
      await request(app).get('/api/admin/settings/platform').expect(401);
    });
  });

  describe('delivery tiers', () => {
    it('lists all four tiers, fastest first', async () => {
      const response = await request(app)
        .get('/api/admin/delivery-tiers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.map((t: { tierType: string }) => t.tierType)).toEqual([
        'lightning', 'express', 'standard', 'economy',
      ]);
    });

    it('lets a super admin change a tier\'s fee, window and availability', async () => {
      const response = await request(app)
        .put(`/api/admin/delivery-tiers/${express.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ platformFeePercentage: 30, maxDeliveryHours: 5, isActive: false })
        .expect(200);

      expect(Number(response.body.data.platformFeePercentage)).toBe(30);
      const reloaded = await DeliveryTier.findByPk(express.id);
      expect(Number(reloaded!.platformFeePercentage)).toBe(30);
      expect(reloaded!.maxDeliveryHours).toBe(5);
      expect(reloaded!.isActive).toBe(false);
    });

    it('refuses an admin who is not a super admin', async () => {
      await request(app)
        .put(`/api/admin/delivery-tiers/${express.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ platformFeePercentage: 30 })
        .expect(403);
    });

    it('rejects a window whose minimum exceeds its maximum', async () => {
      const response = await request(app)
        .put(`/api/admin/delivery-tiers/${express.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ minDeliveryHours: 6, maxDeliveryHours: 3 })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect((await DeliveryTier.findByPk(express.id))!.minDeliveryHours).toBe(2);
    });

    it('rejects a fee outside 5-50%', async () => {
      await request(app)
        .put(`/api/admin/delivery-tiers/${express.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ platformFeePercentage: 80 })
        .expect(400);
    });

    it('ignores fields that are not editable, and refuses a request with none that are', async () => {
      await request(app)
        .put(`/api/admin/delivery-tiers/${express.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ tierType: 'lightning', basePriceMultiplier: 9 })
        .expect(400);

      const reloaded = await DeliveryTier.findByPk(express.id);
      expect(reloaded!.tierType).toBe('express');
      expect(Number(reloaded!.basePriceMultiplier)).toBe(2);
    });

    it('rejects a value of the wrong type', async () => {
      await request(app)
        .put(`/api/admin/delivery-tiers/${express.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ platformFeePercentage: '30' })
        .expect(400);
    });

    it('answers 404 for a tier that does not exist', async () => {
      await request(app)
        .put('/api/admin/delivery-tiers/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ platformFeePercentage: 30 })
        .expect(404);
    });
  });
});
