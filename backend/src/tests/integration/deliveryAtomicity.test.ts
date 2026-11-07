/**
 * @fileoverview A failed pickup or handover leaves the delivery as it was.
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * Status changes were saved outside the caller's transaction, so they
 * committed even when the rest of the step rolled back, and the delivery
 * could get stuck:
 *   - pickup: "in transit" committed though the handover code failed to
 *     issue, so nothing could ever confirm the delivery;
 *   - handover: the code was spent in its own transaction before the payment
 *     release ran, so a failed release left the recipient's only code used
 *     and the delivery in transit.
 * Each case is forced here, and the step is then retried successfully.
 *
 * These were also the first tests to confirm a delivery over HTTP, and they
 * found both confirmation routes refusing every real code: the routes
 * required 8 to 100 characters, and the code is 6.
 */

import request from 'supertest';
import app from '../../index';
import { User, Package, DeliveryAgreement } from '../../models';
import DeliveryQRCode from '../../models/DeliveryQRCode';
import { AuthService } from '../../services/AuthService';
import { notificationService } from '../../services/NotificationService';
import { deliveryHandoverService } from '../../services/DeliveryHandoverService';
import { CommissionService } from '../../services/CommissionService';
import { UserRole } from '../../types';

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

describe('delivery steps are all-or-nothing', () => {
  let courier: any;
  let agreement: any;

  const tokenFor = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });
  const pickup = () =>
    request(app).post(`/api/courier/agreements/${agreement.id}/pickup`)
      .set('Authorization', `Bearer ${tokenFor(courier)}`)
      .send({ location: [25.921, -24.651] });
  // Both confirmation routes: /verify-qr is the one the app calls. Each
  // refused every real (6-character) code until this change.
  const handOver = (code: string, route: 'verify-qr' | 'deliveries/verify' = 'verify-qr') =>
    request(app).post(`/api/courier/${route}/${code}`)
      .set('Authorization', `Bearer ${tokenFor(courier)}`)
      .send({ location: [25.94, -24.63] });
  const activeCode = async () =>
    (await DeliveryQRCode.findOne({ where: { deliveryAgreementId: agreement.id, status: 'active' } }))?.qrToken;

  beforeEach(async () => {
    // The setup file empties every table before each test.
    jest.spyOn(notificationService, 'sendToUser').mockResolvedValue(undefined);
    const sender = await User.create({
      email: 'sender@test.com', password: 'Integration-Test-Password-1!', firstName: 'Neo', lastName: 'Sender', role: UserRole.PASSENGER,
    } as any);
    courier = await User.create({
      email: 'courier@test.com', password: 'Integration-Test-Password-1!', firstName: 'Tumi', lastName: 'Courier', role: UserRole.DRIVER,
    } as any);
    const pkg = await Package.create({
      senderId: sender.id, title: 'Laptop', pickupAddress: 'Main Mall', dropoffAddress: 'Broadhurst',
      pickupCoordinates: point(25.92, -24.65), dropoffCoordinates: point(25.94, -24.63),
      dropoffContactPhone: '+26771111111', senderPriceOffer: 40, packageSize: 'small', isActive: false,
    } as any);
    agreement = await DeliveryAgreement.create({
      packageId: pkg.id, courierId: courier.id, agreedPrice: 40, platformFee: 6, escrowAmount: 0,
      currency: 'BWP', status: 'pending_pickup', paymentMethod: 'cash_on_delivery', eventLog: [],
    } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('leaves the delivery waiting for pickup when no handover code could be issued', async () => {
    jest.spyOn(deliveryHandoverService, 'issueCode')
      .mockResolvedValueOnce({ success: false, error: 'Could not allocate a handover code' } as any);

    const failed = await pickup();
    expect(failed.status).toBe(503);
    expect(failed.body.code).toBe('HANDOVER_CODE_UNAVAILABLE');

    await agreement.reload();
    expect(agreement.status).toBe('pending_pickup');
    expect(agreement.pickupConfirmedAt ?? null).toBeNull();
    expect(agreement.eventLog.some((e: any) => e.event_type === 'status_transition')).toBe(false);

    // The courier simply tries again.
    await pickup().expect(200);
    expect((await agreement.reload()).status).toBe('in_transit');
    expect(await activeCode()).toEqual(expect.any(String));
  });

  it('keeps the recipient\'s code usable when the payment release fails, and completes on retry', async () => {
    await pickup().expect(200);
    const code = (await activeCode())!;

    jest.spyOn(CommissionService.prototype, 'accrueCommission')
      .mockRejectedValueOnce(new Error('commission ledger unavailable'));

    const failed = await handOver(code);
    expect(failed.status).toBe(400);
    expect(failed.body.code).toBe('PAYMENT_RELEASE_FAILED');
    expect((await agreement.reload()).status).toBe('in_transit');
    expect(await activeCode()).toBe(code);

    const done = await handOver(code);
    expect(done.status).toBe(200);
    expect((await agreement.reload()).status).toBe('completed');
    expect(await activeCode()).toBeUndefined();
  });

  it('spends a code only once when it is submitted twice at the same moment', async () => {
    await pickup().expect(200);
    const code = (await activeCode())!;

    const [first, second] = await Promise.all([handOver(code, 'deliveries/verify'), handOver(code, 'deliveries/verify')]);
    const statuses = [first.status, second.status].sort();

    expect(statuses).toEqual([200, 400]);
    expect((await agreement.reload()).status).toBe('completed');
  });
});
