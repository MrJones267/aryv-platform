/**
 * @fileoverview Integration tests for the admin-set session length
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * Admin sessions were fixed at 24 hours in code. A super admin now chooses
 * the length, from 1 to 24 hours, starting at 1. The properties that matter:
 * a sign-in gets a token that lives exactly that long, invalid lengths are
 * refused, and a change that was not stored is not reported as saved.
 *
 * This suite connects to the CI Redis: the setting lives there. Jest gives
 * each test file its own modules, so the connection does not reach the other
 * suites, whose rate limiters count in memory.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { AdminUser } from '../../models/AdminUser';
import { redisClient } from '../../config/redis';
import { SETTINGS_KEY } from '../../services/PlatformSettingsService';

const PASSWORD = 'Integration-Test-Password-1!';

describe('Admin session length', () => {
  let superToken: string;
  let adminToken: string;

  const tokenFor = (admin: AdminUser) =>
    jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions, type: 'admin' },
      process.env['ADMIN_JWT_SECRET']!,
      { expiresIn: '1h' }
    );

  /** Signs in through the real endpoint and returns the token's lifetime in hours. */
  const signInLifetimeHours = async (email: string): Promise<number> => {
    const response = await request(app).post('/api/admin/auth/login').send({ email, password: PASSWORD }).expect(200);
    const decoded = jwt.decode(response.body.data.tokens.accessToken) as { iat: number; exp: number };
    return (decoded.exp - decoded.iat) / 3600;
  };

  const saveHours = (token: string, adminSessionHours: unknown) =>
    request(app).put('/api/admin/settings').set('Authorization', `Bearer ${token}`).send({ adminSessionHours });

  beforeAll(async () => {
    await redisClient.connect();
  });

  afterAll(async () => {
    await redisClient.del(SETTINGS_KEY);
    await redisClient.quit();
  });

  beforeEach(async () => {
    // The setup file empties every table before each test; settings live in
    // Redis, so they are cleared here.
    await redisClient.del(SETTINGS_KEY);
    superToken = tokenFor(await AdminUser.createAdmin({
      email: 'super@test.com', password: PASSWORD, firstName: 'Super', lastName: 'Admin', role: 'super_admin', permissions: ['*'],
    }));
    adminToken = tokenFor(await AdminUser.createAdmin({
      email: 'admin@test.com', password: PASSWORD, firstName: 'Plain', lastName: 'Admin', role: 'admin', permissions: ['analytics.read'],
    }));
  });

  it('starts at the 1-hour minimum', async () => {
    expect(redisClient.isConnected()).toBe(true);
    expect(await signInLifetimeHours('admin@test.com')).toBe(1);
  });

  it('issues sessions of the length a super admin sets, and reports it', async () => {
    await saveHours(superToken, 8).expect(200);

    expect(await signInLifetimeHours('admin@test.com')).toBe(8);

    const platform = await request(app)
      .get('/api/admin/settings/platform')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(platform.body.data.adminSecurity).toMatchObject({ sessionHours: 8, sessionHoursMin: 1, sessionHoursMax: 24 });
  });

  it.each([0, 25, 1.5, '8', null])('refuses %p hours', async value => {
    const response = await saveHours(superToken, value).expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('accepts both limits', async () => {
    await saveHours(superToken, 1).expect(200);
    await saveHours(superToken, 24).expect(200);
    expect(await signInLifetimeHours('admin@test.com')).toBe(24);
  });

  it('only lets a super admin change it', async () => {
    await saveHours(adminToken, 8).expect(403);
  });

  it('does not report a change as saved when the settings store is down', async () => {
    await redisClient.quit();
    try {
      const response = await saveHours(superToken, 8).expect(503);
      expect(response.body.code).toBe('SETTINGS_STORE_UNAVAILABLE');
    } finally {
      await redisClient.connect();
    }
  });

  describe('SOS on-call numbers', () => {
    const save = (token: string, onCallPhones: unknown) =>
      request(app).put('/api/admin/settings').set('Authorization', `Bearer ${token}`).send({ onCallPhones });
    const platform = async () =>
      (await request(app).get('/api/admin/settings/platform').set('Authorization', `Bearer ${adminToken}`).expect(200))
        .body.data.sos;

    it('starts empty', async () => {
      expect((await platform()).onCallPhones).toEqual([]);
    });

    it('stores numbers in E.164, reading local ones as Botswana, without duplicates', async () => {
      await save(superToken, ['71234567', '+27 82 123 4567', '+26771234567']).expect(200);
      expect((await platform()).onCallPhones).toEqual(['+26771234567', '+27821234567']);
    });

    it.each([['not a phone'], 'not a list', [42], Array.from({ length: 11 }, (_, i) => `7100000${i}`)])(
      'refuses %p',
      async value => {
        await save(superToken, value).expect(400);
      }
    );

    it('only lets a super admin change them', async () => {
      await save(adminToken, ['71234567']).expect(403);
    });

    it('says when SMS is not configured, rather than claiming a test was sent', async () => {
      // CI has no Twilio credentials.
      await save(superToken, ['71234567']).expect(200);
      expect((await platform()).smsConfigured).toBe(false);
      const response = await request(app)
        .post('/api/admin/settings/on-call/test')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(503);
      expect(response.body.code).toBe('SMS_NOT_CONFIGURED');
    });

    it('refuses a test with no numbers set', async () => {
      await request(app).post('/api/admin/settings/on-call/test').set('Authorization', `Bearer ${superToken}`).expect(400);
    });
  });
});
