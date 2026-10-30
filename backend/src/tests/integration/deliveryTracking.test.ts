/**
 * @fileoverview Integration tests for live delivery tracking
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * The courier's position is recorded at pickup and while in transit, and the
 * sender's tracking view gets the pickup and drop-off points and the
 * courier's recent trail, as [lng, lat], only while the package is on its way.
 */

import request from 'supertest';
import app from '../../index';
import { User, Package, DeliveryAgreement } from '../../models';
import CourierLocation from '../../models/CourierLocation';
import { AuthService } from '../../services/AuthService';
import { notificationService } from '../../services/NotificationService';
import { UserRole } from '../../types';

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

describe('Delivery tracking', () => {
  let sender: any;
  let courier: any;
  let pkg: any;
  let agreement: any;
  let sent: jest.SpyInstance;

  const tokenFor = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
  const track = (as: any) =>
    request(app).get(`/api/courier/packages/${pkg.id}/tracking`).set('Authorization', `Bearer ${tokenFor(as)}`);
  const report = (location: [number, number]) =>
    request(app).post(`/api/courier/agreements/${agreement.id}/location`).set('Authorization', `Bearer ${tokenFor(courier)}`)
      .send({ location, accuracy: 8, speed: 12 });

  beforeEach(async () => {
    // The setup file empties every table before each test.
    sent = jest.spyOn(notificationService, 'sendToUser').mockResolvedValue(undefined);
    sender = await User.create({
      email: 'sender@test.com', password: 'Integration-Test-Password-1!', firstName: 'Neo', lastName: 'Sender', role: UserRole.PASSENGER,
    } as any);
    courier = await User.create({
      email: 'courier@test.com', password: 'Integration-Test-Password-1!', firstName: 'Tumi', lastName: 'Courier', role: UserRole.DRIVER,
    } as any);
    pkg = await Package.create({
      senderId: sender.id, title: 'Laptop', pickupAddress: 'Main Mall', dropoffAddress: 'Broadhurst',
      pickupCoordinates: point(25.92, -24.65), dropoffCoordinates: point(25.94, -24.63),
      dropoffContactPhone: '+26771111111',
      senderPriceOffer: 40, packageSize: 'small', isActive: true,
    } as any);
    agreement = await DeliveryAgreement.create({
      packageId: pkg.id, courierId: courier.id, agreedPrice: 40, platformFee: 6, escrowAmount: 0,
      currency: 'BWP', status: 'pending_pickup', paymentMethod: 'cash_on_delivery', eventLog: [],
    } as any);
  });

  afterEach(() => sent.mockRestore());

  it('confirms a pickup that carries the courier\'s position', async () => {
    await request(app).post(`/api/courier/agreements/${agreement.id}/pickup`).set('Authorization', `Bearer ${tokenFor(courier)}`)
      .send({ location: [25.921, -24.651] })
      .expect(200);

    expect((await agreement.reload()).status).toBe('in_transit');
    const recorded = await CourierLocation.findAll({ where: { deliveryAgreementId: agreement.id } });
    expect(recorded).toHaveLength(1);
    expect((recorded[0]!.location as any).coordinates).toEqual([25.921, -24.651]);
  });

  it('shows the sender the route and the courier\'s trail while in transit', async () => {
    await agreement.update({ status: 'in_transit' });
    await report([25.925, -24.645]).expect(201);
    await report([25.93, -24.64]).expect(201);

    const res = await track(sender).expect(200);
    expect(res.body.data.pickupLocation).toEqual([25.92, -24.65]);
    expect(res.body.data.dropoffLocation).toEqual([25.94, -24.63]);
    expect(res.body.data.courierLocations.map((l: any) => l.location)).toEqual([[25.925, -24.645], [25.93, -24.64]]);
  });

  it('hides the courier\'s position before pickup and after delivery', async () => {
    await CourierLocation.create({
      deliveryAgreementId: agreement.id, courierId: courier.id, location: point(25.93, -24.64), timestamp: new Date(),
    } as any);

    expect((await track(sender).expect(200)).body.data.courierLocations).toEqual([]);
    await agreement.update({ status: 'completed' });
    expect((await track(sender).expect(200)).body.data.courierLocations).toEqual([]);
  });

  it('tracks the live delivery, not an older cancelled one', async () => {
    await agreement.update({ status: 'cancelled' });
    const other = await User.create({
      email: 'second@test.com', password: 'Integration-Test-Password-1!', firstName: 'Kago', lastName: 'Courier', role: UserRole.DRIVER,
    } as any);
    const current = await DeliveryAgreement.create({
      packageId: pkg.id, courierId: other.id, agreedPrice: 40, platformFee: 6, escrowAmount: 0,
      currency: 'BWP', status: 'in_transit', paymentMethod: 'cash_on_delivery', eventLog: [],
    } as any);

    const res = await track(sender).expect(200);
    expect(res.body.data.deliveryAgreement.id).toBe(current.id);
    // The cancelled courier no longer sees the package.
    await track(courier).expect(403);
  });

  it('refuses positions from anyone but the courier on the job', async () => {
    await agreement.update({ status: 'in_transit' });
    await request(app).post(`/api/courier/agreements/${agreement.id}/location`).set('Authorization', `Bearer ${tokenFor(sender)}`)
      .send({ location: [25.93, -24.64] })
      .expect(404);
  });
});
