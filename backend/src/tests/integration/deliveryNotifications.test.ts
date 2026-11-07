/**
 * @fileoverview The sender hears about each step of their delivery.
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * Nobody was told anything during a delivery: not when a courier accepted,
 * not on collection, not on arrival. Each step now notifies the sender, with
 * the package id the app needs to open its tracking screen.
 */

import request from 'supertest';
import app from '../../index';
import { User, Package, CourierProfile } from '../../models';
import DeliveryQRCode from '../../models/DeliveryQRCode';
import { AuthService } from '../../services/AuthService';
import { notificationService } from '../../services/NotificationService';
import { UserRole } from '../../types';

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

describe('delivery notifications', () => {
  let sender: any;
  let courier: any;
  let pkg: any;
  let sent: jest.SpyInstance;

  const tokenFor = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
  const as = (u: any) => ({ Authorization: `Bearer ${tokenFor(u)}` });
  const eventsFor = (userId: string) => sent.mock.calls
    .filter((call) => call[0] === userId && call[1].type === 'delivery_update')
    .map((call) => call[1].data);

  beforeEach(async () => {
    // The setup file empties every table before each test.
    sent = jest.spyOn(notificationService, 'sendToUser').mockResolvedValue(undefined);
    sender = await User.create({
      email: 'sender@test.com', password: 'Integration-Test-Password-1!', firstName: 'Neo', lastName: 'Sender', role: UserRole.PASSENGER,
    } as any);
    courier = await User.create({
      email: 'courier@test.com', password: 'Integration-Test-Password-1!', firstName: 'Tumi', lastName: 'Courier', role: UserRole.DRIVER,
    } as any);
    await CourierProfile.create({ userId: courier.id, isCourierActive: true, isAvailableForDeliveries: true } as any);
    pkg = await Package.create({
      senderId: sender.id, title: 'Laptop', pickupAddress: 'Main Mall', dropoffAddress: 'Broadhurst',
      pickupCoordinates: point(25.92, -24.65), dropoffCoordinates: point(25.94, -24.63),
      dropoffContactPhone: '+26771111111', senderPriceOffer: 40, packageSize: 'small', isActive: true,
    } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('tells the sender when a courier accepts, collects and delivers', async () => {
    const accepted = await request(app).post(`/api/courier/packages/${pkg.id}/accept`).set(as(courier)).expect(201);
    const agreementId = accepted.body.data.deliveryAgreement.id;
    await request(app).post(`/api/courier/agreements/${agreementId}/pickup`).set(as(courier)).send({}).expect(200);
    const code = (await DeliveryQRCode.findOne({ where: { deliveryAgreementId: agreementId, status: 'active' } }))!.qrToken;
    await request(app).post(`/api/courier/verify-qr/${code}`).set(as(courier)).send({ location: [25.94, -24.63] }).expect(200);

    expect(eventsFor(sender.id)).toEqual([
      { event: 'accepted', packageId: pkg.id, deliveryAgreementId: agreementId },
      { event: 'picked_up', packageId: pkg.id, deliveryAgreementId: agreementId },
      { event: 'delivered', packageId: pkg.id, deliveryAgreementId: agreementId },
    ]);
    // The courier is not told about their own actions.
    expect(eventsFor(courier.id)).toEqual([]);
  });

  it('says nothing about a step that did not happen', async () => {
    await request(app).post(`/api/courier/packages/${pkg.id}/accept`).set(as(sender)).expect(409);
    expect(eventsFor(sender.id)).toEqual([]);
  });
});
