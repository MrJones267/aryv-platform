/**
 * @fileoverview What accepting a package stores and returns.
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * Accepting generated a token from an older handover scheme on every
 * delivery and sent it to the courier, though nothing accepted it as proof
 * any more; and the platform fee was stored unrounded (25% of P33.33 as
 * 8.3325). Now no token is made or returned, and the fee is to the cent.
 */

import request from 'supertest';
import app from '../../index';
import { User, Package, DeliveryAgreement, CourierProfile } from '../../models';
import { AuthService } from '../../services/AuthService';
import { notificationService } from '../../services/NotificationService';
import { UserRole } from '../../types';

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

describe('accepting a package', () => {
  let courier: any;
  let pkg: any;

  const tokenFor = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });

  beforeEach(async () => {
    // The setup file empties every table before each test.
    jest.spyOn(notificationService, 'sendToUser').mockResolvedValue(undefined);
    const sender = await User.create({
      email: 'sender@test.com', password: 'Integration-Test-Password-1!', firstName: 'Neo', lastName: 'Sender', role: UserRole.PASSENGER,
    } as any);
    courier = await User.create({
      email: 'courier@test.com', password: 'Integration-Test-Password-1!', firstName: 'Tumi', lastName: 'Courier', role: UserRole.DRIVER,
    } as any);
    await CourierProfile.create({ userId: courier.id, isCourierActive: true, isAvailableForDeliveries: true } as any);
    pkg = await Package.create({
      senderId: sender.id, title: 'Laptop', pickupAddress: 'Main Mall', dropoffAddress: 'Broadhurst',
      pickupCoordinates: point(25.92, -24.65), dropoffCoordinates: point(25.94, -24.63),
      dropoffContactPhone: '+26771111111', senderPriceOffer: 33.33, packageSize: 'small', isActive: true,
    } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('stores the platform fee to the cent', async () => {
    const res = await request(app).post(`/api/courier/packages/${pkg.id}/accept`)
      .set('Authorization', `Bearer ${tokenFor(courier)}`).expect(201);

    const stored = await DeliveryAgreement.findByPk(res.body.data.deliveryAgreement.id);
    expect(Number(stored!.platformFee)).toBe(8.33);
  });

  it('neither creates nor returns the old handover token', async () => {
    const res = await request(app).post(`/api/courier/packages/${pkg.id}/accept`)
      .set('Authorization', `Bearer ${tokenFor(courier)}`).expect(201);

    expect(JSON.stringify(res.body)).not.toMatch(/qrCode(Token|ExpiresAt)|qr_code_generated/);
    const stored = await DeliveryAgreement.findByPk(res.body.data.deliveryAgreement.id);
    expect(stored!.get('qrCodeToken') ?? null).toBeNull();

    const list = await request(app).get('/api/courier/deliveries')
      .set('Authorization', `Bearer ${tokenFor(courier)}`).expect(200);
    expect(JSON.stringify(list.body)).not.toMatch(/qrCodeToken/);
  });
});
