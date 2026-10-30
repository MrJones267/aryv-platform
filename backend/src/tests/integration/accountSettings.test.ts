/**
 * @fileoverview Integration tests for the account settings the app offers
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Sign out of all devices, download my data, and notification settings,
 * which used to be switches that saved nothing.
 */

import request from 'supertest';
import app from '../../index';
import { User } from '../../models';
import EmergencyContact from '../../models/EmergencyContact';
import { AuthService } from '../../services/AuthService';
import { UserRole } from '../../types';

describe('Account settings', () => {
  let user: any;
  let other: any;
  const token = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });

  beforeEach(async () => {
    // The setup file empties every table before each test.
    user = await User.create({
      email: 'neo@test.com', password: 'Integration-Test-Password-1!', phone: '+26771234567',
      firstName: 'Neo', lastName: 'Kgosi', role: UserRole.PASSENGER,
      preferences: { pushToken: 'device-token-secret', paymentMethods: [{ type: 'mobile_money', provider: 'orange_money', label: 'Orange', phone: '+26771234567', isDefault: true }] },
    } as any);
    other = await User.create({
      email: 'tumi@test.com', password: 'Integration-Test-Password-1!', firstName: 'Tumi', lastName: 'Other', role: UserRole.PASSENGER,
    } as any);
    await EmergencyContact.create({ userId: user.id, name: 'Mma Kgosi', phone: '+26772222222' } as any);
    await EmergencyContact.create({ userId: other.id, name: 'Not yours', phone: '+26773333333' } as any);
  });

  it('signs out of every device, the current one included', async () => {
    const before = token(user);
    await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${before}`).expect(200);
    // A token issued in the same second as the sign-out would still pass.
    await new Promise(r => setTimeout(r, 1100));
    await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${before}`).expect(200);
    await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${before}`).expect(401);
  });

  it('exports the person\'s own data, without secrets or other people\'s records', async () => {
    const res = await request(app).get('/api/auth/export').set('Authorization', `Bearer ${token(user)}`).expect(200);
    const data = res.body.data;
    expect(data.profile).toMatchObject({ email: 'neo@test.com', firstName: 'Neo' });
    expect(data.emergencyContacts.map((c: any) => c.name)).toEqual(['Mma Kgosi']);
    expect(data.paymentMethods).toEqual([{ type: 'mobile_money', provider: 'orange_money', label: 'Orange', isDefault: true }]);
    const text = JSON.stringify(data);
    expect(text).not.toContain('device-token-secret');
    expect(text).not.toContain('Not yours');
    expect(data.profile).not.toHaveProperty('password');
    expect(data.profile).not.toHaveProperty('refreshToken');
  });

  it('saves notification settings, and refuses unknown ones', async () => {
    const auth = { Authorization: `Bearer ${token(user)}` };
    expect((await request(app).get('/api/auth/notification-preferences').set(auth).expect(200)).body.data)
      .toEqual({ pushNotifications: true, rideUpdates: true, messages: true, payments: true, promotions: false });

    await request(app).patch('/api/auth/notification-preferences').set(auth).send({ rideUpdates: false }).expect(200);
    expect((await request(app).get('/api/auth/notification-preferences').set(auth).expect(200)).body.data.rideUpdates).toBe(false);

    expect((await request(app).patch('/api/auth/notification-preferences').set(auth).send({ isAdmin: true }).expect(400)).body.code).toBe('INVALID_PREFERENCES');
    expect((await request(app).patch('/api/auth/notification-preferences').set(auth).send({ messages: 'off' }).expect(400)).body.code).toBe('INVALID_PREFERENCES');
    // The push token stored alongside is untouched.
    expect(((await User.findByPk(user.id))!.preferences as any).pushToken).toBe('device-token-secret');
  });
});
