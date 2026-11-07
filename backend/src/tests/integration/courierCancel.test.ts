/**
 * @fileoverview Cancelling a courier delivery, by the sender or the courier.
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * Nothing could be cancelled: a package nobody took could not be withdrawn,
 * a courier who never came could not be dropped, and a courier could not
 * hand a delivery back. Once picked up, cancelling stays refused (that is a
 * dispute). Also: nobody may accept their own package, and only the sender
 * and courier see the live delivery on the package screen.
 */

import request from 'supertest';
import app from '../../index';
import { User, Package, DeliveryAgreement, CourierProfile } from '../../models';
import { AuthService } from '../../services/AuthService';
import { notificationService } from '../../services/NotificationService';
import { UserRole } from '../../types';

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

describe('cancelling courier deliveries', () => {
  let sender: any;
  let courier: any;
  let otherCourier: any;
  let stranger: any;
  let pkg: any;
  let sent: jest.SpyInstance;

  const tokenFor = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
  const as = (u: any) => ({ Authorization: `Bearer ${tokenFor(u)}` });
  const accept = (who: any) => request(app).post(`/api/courier/packages/${pkg.id}/accept`).set(as(who));
  const cancelPackage = (who: any, body: Record<string, unknown> = {}) =>
    request(app).post(`/api/courier/packages/${pkg.id}/cancel`).set(as(who)).send(body);
  const handBack = (who: any, agreementId: string) =>
    request(app).post(`/api/courier/deliveries/${agreementId}/cancel`).set(as(who)).send({ reason: 'Car broke down' });
  const notifiedUsers = () => sent.mock.calls.map((call) => call[0]);

  beforeEach(async () => {
    // The setup file empties every table before each test.
    sent = jest.spyOn(notificationService, 'sendToUser').mockResolvedValue(undefined);
    const make = (email: string, firstName: string) => User.create({
      email, password: 'Integration-Test-Password-1!', firstName, lastName: 'Test', role: UserRole.PASSENGER,
    } as any);
    sender = await make('sender@test.com', 'Neo');
    courier = await make('courier@test.com', 'Tumi');
    otherCourier = await make('courier2@test.com', 'Kgosi');
    stranger = await make('stranger@test.com', 'Kabo');
    for (const c of [courier, otherCourier, sender]) {
      await CourierProfile.create({ userId: c.id, isCourierActive: true, isAvailableForDeliveries: true } as any);
    }
    pkg = await Package.create({
      senderId: sender.id, title: 'Laptop', pickupAddress: 'Main Mall', dropoffAddress: 'Broadhurst',
      pickupCoordinates: point(25.92, -24.65), dropoffCoordinates: point(25.94, -24.63),
      dropoffContactPhone: '+26771111111', senderPriceOffer: 40, packageSize: 'small', isActive: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('the sender', () => {
    it('withdraws a package nobody has accepted, once', async () => {
      const res = await cancelPackage(sender).expect(200);
      expect(res.body.data.packageState).toBe('withdrawn');
      expect((await pkg.reload()).isActive).toBe(false);

      // No longer acceptable, and not withdrawable twice.
      await accept(courier).expect(404);
      expect((await cancelPackage(sender)).body.code).toBe('PACKAGE_ALREADY_WITHDRAWN');
    });

    it('drops a courier who has not collected, and reopens the package for another', async () => {
      const accepted = await accept(courier).expect(201);
      const agreementId = accepted.body.data.deliveryAgreement.id;

      const res = await cancelPackage(sender, { findAnotherCourier: true }).expect(200);
      expect(res.body.data).toMatchObject({ packageState: 'reopened', cancelledDeliveryId: agreementId });
      expect((await DeliveryAgreement.findByPk(agreementId))!.status).toBe('cancelled');
      expect(notifiedUsers()).toContain(courier.id);

      // Visible for at least a day, though it was due to expire within the hour.
      await pkg.reload();
      expect(pkg.isActive).toBe(true);
      expect(new Date(pkg.expiresAt).getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
      await accept(otherCourier).expect(201);
    });

    it('drops a courier and withdraws the package', async () => {
      await accept(courier).expect(201);
      const res = await cancelPackage(sender).expect(200);

      expect(res.body.data.packageState).toBe('withdrawn');
      expect((await pkg.reload()).isActive).toBe(false);
    });

    it('cannot cancel once the courier has the package', async () => {
      const accepted = await accept(courier).expect(201);
      const agreementId = accepted.body.data.deliveryAgreement.id;
      await request(app).post(`/api/courier/agreements/${agreementId}/pickup`).set(as(courier)).send({}).expect(200);

      const res = await cancelPackage(sender);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DELIVERY_IN_TRANSIT');
      expect((await DeliveryAgreement.findByPk(agreementId))!.status).toBe('in_transit');
    });

    it('is the only one who can cancel the package', async () => {
      for (const who of [courier, stranger]) {
        expect((await cancelPackage(who)).status).toBe(404);
      }
      expect((await pkg.reload()).isActive).toBe(true);
    });
  });

  describe('the courier', () => {
    it('hands back a delivery before pickup, and the package reopens', async () => {
      const accepted = await accept(courier).expect(201);
      const agreementId = accepted.body.data.deliveryAgreement.id;

      const res = await handBack(courier, agreementId).expect(200);
      expect(res.body.data.packageState).toBe('reopened');
      expect((await DeliveryAgreement.findByPk(agreementId))!.status).toBe('cancelled');
      expect((await pkg.reload()).isActive).toBe(true);
      expect(notifiedUsers()).toContain(sender.id);
      await accept(otherCourier).expect(201);
    });

    it('cannot hand back someone else\'s delivery, or one already collected', async () => {
      const accepted = await accept(courier).expect(201);
      const agreementId = accepted.body.data.deliveryAgreement.id;

      expect((await handBack(otherCourier, agreementId)).status).toBe(404);
      await request(app).post(`/api/courier/agreements/${agreementId}/pickup`).set(as(courier)).send({}).expect(200);
      expect((await handBack(courier, agreementId)).body.code).toBe('DELIVERY_IN_TRANSIT');
    });
  });

  it('refuses a sender accepting their own package', async () => {
    const res = await accept(sender);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OWN_PACKAGE');
  });

  it('shows the live delivery to the sender and courier only', async () => {
    const accepted = await accept(courier).expect(201);
    const agreementId = accepted.body.data.deliveryAgreement.id;
    const view = (who: any) => request(app).get(`/api/courier/packages/${pkg.id}`).set(as(who));

    expect((await view(sender)).body.data.delivery).toMatchObject({ id: agreementId, status: 'pending_pickup' });
    expect((await view(courier)).body.data.delivery).toMatchObject({ id: agreementId });
    expect((await view(otherCourier)).status).toBe(404);
  });
});
