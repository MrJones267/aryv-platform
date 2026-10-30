/**
 * @fileoverview Integration tests for saved payment methods
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Cards are not accepted: the server refuses card details without storing
 * them, and cards saved before that are no longer offered. Mobile money
 * accounts still save as before.
 */

import request from 'supertest';
import app from '../../index';
import { User } from '../../models';
import { AuthService } from '../../services/AuthService';
import { UserRole } from '../../types';

describe('Payment methods', () => {
  let user: any;
  let token: string;

  beforeEach(async () => {
    // The setup file empties every table before each test.
    user = await User.create({
      email: 'neo@test.com', password: 'Integration-Test-Password-1!', phone: '+26771234567',
      firstName: 'Neo', lastName: 'Kgosi', role: UserRole.PASSENGER, countryCode: 'BW',
    } as any);
    token = AuthService.generateAccessToken({ userId: user.id, email: user.email, role: UserRole.PASSENGER });
  });

  it('refuses card details and stores nothing', async () => {
    const res = await request(app).post('/api/payments/methods/card').set('Authorization', `Bearer ${token}`)
      .send({ cardNumber: '4242424242424242', expiryMonth: 12, expiryYear: 2030, cvv: '123', cardholderName: 'Neo Kgosi' })
      .expect(410);
    expect(res.body.code).toBe('CARDS_NOT_ACCEPTED');
    expect(JSON.stringify(res.body)).not.toContain('4242');

    const stored = await User.findByPk(user.id, { attributes: ['preferences'] });
    expect(JSON.stringify(stored!.preferences || {})).not.toContain('4242');
  });

  it('no longer offers a card saved before cards were refused', async () => {
    await user.update({
      preferences: {
        paymentMethods: [
          { id: 'card_old', type: 'card', provider: 'stripe', label: '•••• 4242', last4: '4242', isDefault: true },
          { id: 'mm_1', type: 'mobile_money', provider: 'orange_money', label: 'Orange Money', phone: '+26771234567', isDefault: false },
        ],
      },
    });

    const res = await request(app).get('/api/payments/methods').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.data.map((m: any) => m.id)).toEqual(['mm_1']);
  });

  it('still saves a mobile money account', async () => {
    await request(app).post('/api/payments/methods/mobile-money').set('Authorization', `Bearer ${token}`)
      .send({ phone: '+26771234567', provider: 'orange_money' })
      .expect(201);

    const res = await request(app).get('/api/payments/methods').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ type: 'mobile_money', phone: '+26771234567' });
  });
});
