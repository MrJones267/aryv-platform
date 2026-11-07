/**
 * @fileoverview The sender can read the handover code, and either party can
 * have a new one sent.
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * The code reached the recipient by SMS only and could not be replaced, so a
 * text that never arrived, a code that expired after a day, or one locked by
 * wrong guesses left the delivery impossible to complete. The sender can now
 * read the code in the app, and the sender or courier can have it replaced.
 * The courier must still never be shown a code.
 */

import request from 'supertest';
import app from '../../index';
import { User, Package, DeliveryAgreement } from '../../models';
import DeliveryQRCode from '../../models/DeliveryQRCode';
import { AuthService } from '../../services/AuthService';
import { notificationService } from '../../services/NotificationService';
import { MAX_CODES_PER_DELIVERY } from '../../services/DeliveryHandoverService';
import { UserRole } from '../../types';

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

describe('handover code for the sender, and new codes on request', () => {
  let sender: any;
  let courier: any;
  let stranger: any;
  let agreement: any;

  const tokenFor = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
  const as = (u: any) => ({ Authorization: `Bearer ${tokenFor(u)}` });
  const path = () => `/api/courier/deliveries/${agreement.id}/handover-code`;
  const codes = () => DeliveryQRCode.findAll({ where: { deliveryAgreementId: agreement.id }, order: [['generatedAt', 'ASC']] });

  beforeEach(async () => {
    // The setup file empties every table before each test.
    jest.spyOn(notificationService, 'sendToUser').mockResolvedValue(undefined);
    const make = (email: string, firstName: string) => User.create({
      email, password: 'Integration-Test-Password-1!', firstName, lastName: 'Test', role: UserRole.PASSENGER,
    } as any);
    sender = await make('sender@test.com', 'Neo');
    courier = await make('courier@test.com', 'Tumi');
    stranger = await make('stranger@test.com', 'Kabo');
    const pkg = await Package.create({
      senderId: sender.id, title: 'Laptop', pickupAddress: 'Main Mall', dropoffAddress: 'Broadhurst',
      pickupCoordinates: point(25.92, -24.65), dropoffCoordinates: point(25.94, -24.63),
      dropoffContactPhone: '+26771111111', senderPriceOffer: 40, packageSize: 'small', isActive: false,
    } as any);
    agreement = await DeliveryAgreement.create({
      packageId: pkg.id, courierId: courier.id, agreedPrice: 40, platformFee: 6, escrowAmount: 0,
      currency: 'BWP', status: 'pending_pickup', paymentMethod: 'cash_on_delivery', eventLog: [],
    } as any);
    await request(app).post(`/api/courier/agreements/${agreement.id}/pickup`).set(as(courier)).send({}).expect(200);
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows the sender the code the recipient was sent', async () => {
    const [issued] = await codes();
    const res = await request(app).get(path()).set(as(sender)).expect(200);

    expect(res.body.data.code).toBe(issued!.qrToken);
    expect(res.body.data.sentVia).toBe('recipient_sms');
  });

  it('tells the courier and anyone else that there is nothing there', async () => {
    for (const who of [courier, stranger]) {
      const res = await request(app).get(path()).set(as(who));
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain((await codes())[0]!.qrToken);
    }
  });

  it('replaces the code at the courier\'s request without showing it to them', async () => {
    const [old] = await codes();
    const res = await request(app).post(path()).set(as(courier)).expect(201);

    expect(res.body.data.code).toBeUndefined();
    const all = await codes();
    expect(all).toHaveLength(2);
    expect(all[0]!.status).toBe('expired');
    expect(all[1]!.status).toBe('active');
    expect(JSON.stringify(res.body)).not.toContain(all[1]!.qrToken);

    // The old code no longer completes the delivery; the new one does.
    await request(app).post(`/api/courier/deliveries/verify/${old!.qrToken}`).set(as(courier)).send({}).expect(400);
    await request(app).post(`/api/courier/deliveries/verify/${all[1]!.qrToken}`).set(as(courier)).send({}).expect(200);
    expect((await agreement.reload()).status).toBe('completed');
  });

  it('gives the sender the new code when they ask for it', async () => {
    const res = await request(app).post(path()).set(as(sender)).expect(201);
    const latest = (await codes()).pop()!;

    expect(res.body.data.code).toBe(latest.qrToken);
    expect(res.body.data.codesLeft).toBe(MAX_CODES_PER_DELIVERY - 2);
  });

  it('refuses a stranger, without issuing anything', async () => {
    await request(app).post(path()).set(as(stranger)).expect(404);
    expect(await codes()).toHaveLength(1);
  });

  it('stops after the per-delivery limit', async () => {
    for (let i = 1; i < MAX_CODES_PER_DELIVERY; i += 1) {
      await request(app).post(path()).set(as(sender)).expect(201);
    }
    const res = await request(app).post(path()).set(as(sender));

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('CODE_LIMIT_REACHED');
    expect(await codes()).toHaveLength(MAX_CODES_PER_DELIVERY);
  });

  it('has no code to show or replace once the delivery is complete', async () => {
    await agreement.update({ status: 'completed' });

    expect((await request(app).get(path()).set(as(sender))).body.code).toBe('DELIVERY_NOT_IN_TRANSIT');
    expect((await request(app).post(path()).set(as(sender))).body.code).toBe('DELIVERY_NOT_IN_TRANSIT');
  });
});
