/**
 * @fileoverview Integration tests for delivery disputes, from report to decision
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Nobody could raise a delivery dispute (its controller was never mounted),
 * the admin list returned rows the Disputes page could not show, and
 * resolving ignored the admin's decision. These run the app's route to raise
 * one, then the admin's routes to read and resolve it, and check the
 * delivery's status, the courier's commission and the notifications.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { User, Package, DeliveryAgreement, DeliveryDispute } from '../../models';
import { AdminUser } from '../../models/AdminUser';
import CommissionLedger from '../../models/CommissionLedger';
import UserWallet from '../../models/UserWallet';
import { AuthService } from '../../services/AuthService';
import { notificationService } from '../../services/NotificationService';
import { UserRole } from '../../types';

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

describe('Delivery disputes', () => {
  let sender: any;
  let courier: any;
  let agreement: any;
  let adminToken: string;
  let moderatorToken: string;
  let sent: jest.SpyInstance;

  const sign = (a: AdminUser) => jwt.sign(
    { id: a.id, email: a.email, role: a.role, permissions: a.permissions, type: 'admin' },
    process.env['ADMIN_JWT_SECRET']!,
    { expiresIn: '1h' },
  );
  const userToken = (u: any) => AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role });

  beforeEach(async () => {
    // The setup file empties every table before each test.
    sent = jest.spyOn(notificationService, 'sendToUser').mockResolvedValue(undefined);
    adminToken = sign(await AdminUser.createAdmin({
      email: 'ops@test.com', password: 'Integration-Test-Password-1!', firstName: 'Ops', lastName: 'Admin', role: 'admin', permissions: [],
    }));
    moderatorToken = sign(await AdminUser.createAdmin({
      email: 'mod@test.com', password: 'Integration-Test-Password-1!', firstName: 'Mod', lastName: 'Erator', role: 'moderator', permissions: [],
    }));
    sender = await User.create({
      email: 'sender@test.com', password: 'Integration-Test-Password-1!', firstName: 'Neo', lastName: 'Sender', role: UserRole.PASSENGER,
    } as any);
    courier = await User.create({
      email: 'courier@test.com', password: 'Integration-Test-Password-1!', firstName: 'Tumi', lastName: 'Courier', role: UserRole.DRIVER,
    } as any);
    const pkg = await Package.create({
      senderId: sender.id, title: 'Laptop', pickupAddress: 'Main Mall', dropoffAddress: 'Broadhurst',
      pickupCoordinates: point(25.92, -24.65), dropoffCoordinates: point(25.94, -24.63),
      senderPriceOffer: 40, packageSize: 'small', isActive: true,
    } as any);
    agreement = await DeliveryAgreement.create({
      packageId: pkg.id, courierId: courier.id, agreedPrice: 40, platformFee: 6, escrowAmount: 0,
      currency: 'BWP', status: 'in_transit', paymentMethod: 'cash_on_delivery', eventLog: [],
    } as any);
  });

  afterEach(() => sent.mockRestore());

  const raise = (as: any, body: object = { disputeType: 'package_damaged', description: 'Screen cracked on arrival' }) =>
    request(app).post(`/api/courier/deliveries/${agreement.id}/dispute`).set('Authorization', `Bearer ${userToken(as)}`).send(body);
  const resolve = (id: string, body: object, token = adminToken) =>
    request(app).post(`/api/admin/courier/disputes/${id}/resolve`).set('Authorization', `Bearer ${token}`).send(body);
  const owed = async () => Number((await UserWallet.findOne({ where: { userId: courier.id } }))?.commissionOwed ?? 0);

  describe('raising', () => {
    it('lets the sender report a problem, marks the delivery disputed, and tells the courier', async () => {
      const response = await raise(sender).expect(201);
      const dispute = await DeliveryDispute.findByPk(response.body.data.disputeId);
      expect(dispute).toMatchObject({ raisedByUserId: sender.id, disputeType: 'package_damaged', status: 'open' });

      await agreement.reload();
      expect(agreement.status).toBe('disputed');
      expect(agreement.eventLog.at(-1)).toMatchObject({ event_type: 'dispute_raised', data: { from: 'in_transit', raised_by: 'sender' } });
      expect(sent).toHaveBeenCalledWith(courier.id, expect.objectContaining({ type: 'delivery_dispute_raised' }));
    });

    it('lets the courier report one too, and refuses a second while one is open', async () => {
      await raise(courier, { disputeType: 'wrong_recipient', description: 'Nobody at the address would take it' }).expect(201);
      expect((await raise(sender).expect(409)).body.code).toBe('DISPUTE_EXISTS');
    });

    it('is not available to anyone else, nor before the courier has the package', async () => {
      const stranger = await User.create({ email: 'x@test.com', password: 'Integration-Test-Password-1!', firstName: 'X', lastName: 'Y', role: UserRole.PASSENGER } as any);
      await raise(stranger).expect(404);

      await agreement.update({ status: 'pending_pickup' });
      expect((await raise(sender).expect(409)).body.code).toBe('NOT_DISPUTABLE');
    });

    it('checks the type and description', async () => {
      expect((await raise(sender, { disputeType: 'vibes', description: 'Screen cracked on arrival' }).expect(400)).body.code).toBe('INVALID_TYPE');
      expect((await raise(sender, { disputeType: 'package_damaged', description: 'bad' }).expect(400)).body.code).toBe('INVALID_DESCRIPTION');
    });

    it('shows the sender the dispute and, later, the decision', async () => {
      const { body } = await raise(sender).expect(201);
      const before = await request(app).get(`/api/courier/deliveries/${agreement.id}/dispute`).set('Authorization', `Bearer ${userToken(sender)}`).expect(200);
      expect(before.body.data.dispute).toMatchObject({ id: body.data.disputeId, status: 'open', raisedBy: 'sender' });

      await resolve(body.data.disputeId, { outcome: 'part', courierEarned: 20, reason: 'Delivered, but the screen was cracked in transit' }).expect(200);
      const after = await request(app).get(`/api/courier/deliveries/${agreement.id}/dispute`).set('Authorization', `Bearer ${userToken(courier)}`).expect(200);
      expect(after.body.data.dispute).toMatchObject({ status: 'resolved', courierEarned: 20, resolutionNotes: 'Delivered, but the screen was cracked in transit' });
    });
  });

  describe('admin review', () => {
    it('lists the dispute with the package, both people and the price, and shows its timeline', async () => {
      const { body } = await raise(sender).expect(201);
      const list = await request(app).get('/api/admin/courier/disputes?status=open').set('Authorization', `Bearer ${moderatorToken}`).expect(200);
      expect(list.body.data.disputes[0]).toMatchObject({
        id: body.data.disputeId, packageTitle: 'Laptop', senderName: 'Neo Sender', courierName: 'Tumi Courier',
        raisedBy: 'sender', price: 40, currency: 'BWP', deliveryStatus: 'disputed',
      });
      const detail = await request(app).get(`/api/admin/courier/disputes/${body.data.disputeId}`).set('Authorization', `Bearer ${moderatorToken}`).expect(200);
      expect(detail.body.data.dispute.timeline.map((e: any) => e.type)).toEqual(['dispute_raised']);
    });
  });

  describe('resolving', () => {
    it('delivered, before commission was charged: completes the delivery and charges it', async () => {
      const { body } = await raise(courier, { disputeType: 'other', description: 'Sender says it never arrived; it did' }).expect(201);
      await resolve(body.data.disputeId, { outcome: 'delivered', reason: 'Recipient signed for it at the door' }).expect(200);

      await agreement.reload();
      expect(agreement.status).toBe('completed');
      expect(await owed()).toBe(6);
      await new Promise(r => setTimeout(r, 100));
      expect(sent.mock.calls.filter(c => c[1].type === 'delivery_dispute_resolved').map(c => c[0]).sort())
        .toEqual([sender.id, courier.id].sort());
    });

    it('not delivered, after commission was charged: cancels the delivery and reverses it', async () => {
      // As CourierEscrowService.completeDelivery leaves it: completed, commission charged.
      await agreement.update({ status: 'completed', deliveryConfirmedAt: new Date() });
      await UserWallet.create({ userId: courier.id, commissionOwed: 6 } as any);
      await CommissionLedger.create({
        driverId: courier.id, entryType: 'accrual', amount: 6, balanceAfter: 6, cashTransactionId: null,
        description: 'Platform commission on cash delivery', metadata: { deliveryAgreementId: agreement.id },
      } as any);

      const { body } = await raise(sender, { disputeType: 'package_not_delivered', description: 'Marked delivered but never arrived' }).expect(201);
      const response = await resolve(body.data.disputeId, { outcome: 'not_delivered', reason: 'Courier admitted the wrong house' }).expect(200);
      expect(response.body.data).toMatchObject({ commissionBefore: 6, commissionAfter: 0 });

      await agreement.reload();
      expect(agreement.status).toBe('cancelled');
      expect(await owed()).toBe(0);
    });

    it('part: charges commission on what the courier earned', async () => {
      const { body } = await raise(sender).expect(201);
      await resolve(body.data.disputeId, { outcome: 'part', courierEarned: 40, reason: 'That is the full price' }).expect(400);
      await resolve(body.data.disputeId, { outcome: 'part', courierEarned: 20, reason: 'Half, for the damage' }).expect(200);
      expect(await owed()).toBe(3);
    });

    it('needs an outcome and a reason, resolves once, and only for admins', async () => {
      const { body } = await raise(sender).expect(201);
      const id = body.data.disputeId;
      expect((await resolve(id, { decision: 'release_payment', reason: 'Old panel shape' }).expect(400)).body.code).toBe('INVALID_OUTCOME');
      expect((await resolve(id, { outcome: 'delivered' }).expect(400)).body.code).toBe('REASON_REQUIRED');
      await resolve(id, { outcome: 'delivered', reason: 'Moderators may not decide money' }, moderatorToken).expect(403);
      await resolve(id, { outcome: 'delivered', reason: 'Recipient signed for it at the door' }).expect(200);
      expect((await resolve(id, { outcome: 'not_delivered', reason: 'Changed my mind' }).expect(409)).body.code).toBe('ALREADY_RESOLVED');

      const detail = await request(app).get(`/api/admin/courier/disputes/${id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
      expect(detail.body.data.dispute).toMatchObject({ status: 'resolved', resolvedByEmail: 'ops@test.com', courierEarned: 40 });
    });

    it('refuses an escrow delivery, which needs a payment provider', async () => {
      await agreement.update({ paymentMethod: 'escrow' });
      const { body } = await raise(sender).expect(201);
      expect((await resolve(body.data.disputeId, { outcome: 'delivered', reason: 'Recipient signed for it' }).expect(409)).body.code).toBe('ESCROW_NOT_SUPPORTED');
    });
  });
});
