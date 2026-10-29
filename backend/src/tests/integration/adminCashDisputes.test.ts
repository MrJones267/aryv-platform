/**
 * @fileoverview Integration tests for resolving cash payment disputes
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * An admin records what happened to the cash; the payment's status and the
 * driver's commission follow. Covers each outcome, both before and after
 * commission was charged, and the rules around resolving.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { User, Ride, Booking, Vehicle } from '../../models';
import { AdminUser } from '../../models/AdminUser';
import CashTransaction from '../../models/CashTransaction';
import CommissionLedger from '../../models/CommissionLedger';
import TrustHold from '../../models/TrustHold';
import UserWallet from '../../models/UserWallet';
import { AuthService } from '../../services/AuthService';
import { BookingStatus, RideStatus, UserRole, VehicleType } from '../../types';

describe('Admin cash payment disputes', () => {
  let adminToken: string;
  let moderatorToken: string;
  let rider: any;
  let driver: any;
  let booking: any;

  const adminTokenFor = (a: AdminUser) => jwt.sign(
    { id: a.id, email: a.email, role: a.role, permissions: a.permissions, type: 'admin' },
    process.env['ADMIN_JWT_SECRET']!,
    { expiresIn: '1h' },
  );

  beforeEach(async () => {
    // The setup file empties every table before each test.
    const admin = await AdminUser.createAdmin({
      email: 'ops@test.com', password: 'Integration-Test-Password-1!', firstName: 'Ops', lastName: 'Admin', role: 'admin', permissions: [],
    });
    const moderator = await AdminUser.createAdmin({
      email: 'mod@test.com', password: 'Integration-Test-Password-1!', firstName: 'Mod', lastName: 'Erator', role: 'moderator', permissions: [],
    });
    adminToken = adminTokenFor(admin);
    moderatorToken = adminTokenFor(moderator);

    driver = await User.create({
      email: 'driver@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Kabo', lastName: 'Driver', role: UserRole.DRIVER, countryCode: 'BW',
    } as any);
    rider = await User.create({
      email: 'rider@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Lesedi', lastName: 'Rider', role: UserRole.PASSENGER, countryCode: 'BW',
    } as any);
    const vehicle = await Vehicle.create({
      driverId: driver.id, make: 'Toyota', model: 'Corolla', year: 2019, color: 'White',
      licensePlate: 'B123ABC', capacity: 4, type: VehicleType.SEDAN, isVerified: true,
    } as any);
    const ride = await Ride.create({
      driverId: driver.id, vehicleId: vehicle.id,
      originAddress: 'Main Mall, Gaborone', originCoordinates: { type: 'Point', coordinates: [25.9086, -24.6541] },
      destinationAddress: 'Game City, Gaborone', destinationCoordinates: { type: 'Point', coordinates: [25.8800, -24.6780] },
      departureTime: new Date(Date.now() + 60 * 60 * 1000), availableSeats: 3, pricePerSeat: 25,
      status: RideStatus.PENDING, currency: 'BWP',
    } as any);
    booking = await Booking.create({
      rideId: ride.id, passengerId: rider.id, seatsBooked: 1, totalAmount: 26.25, platformFee: 1.25,
      currency: 'BWP', status: BookingStatus.CONFIRMED,
    } as any);
  });

  const riderToken = () => AuthService.generateAccessToken({ userId: rider.id, email: rider.email, role: UserRole.PASSENGER });
  const driverToken = () => AuthService.generateAccessToken({ userId: driver.id, email: driver.email, role: UserRole.DRIVER });
  const app_ = (token: string) => ({
    post: (p: string, body: object = {}) => request(app).post(p).set('Authorization', `Bearer ${token}`).send(body),
    get: (p: string) => request(app).get(p).set('Authorization', `Bearer ${token}`),
  });

  /** A cash payment through the app's own routes, optionally completed, then disputed by the driver. */
  const disputedPayment = async (completeFirst: boolean) => {
    const started = await app_(riderToken()).post('/api/payments/cash/create', { bookingId: booking.id }).expect(201);
    const { transactionId, riderCode } = started.body.data;
    if (completeFirst) {
      await app_(driverToken()).post(`/api/payments/cash/${transactionId}/confirm-received`, { actualAmount: 26.25 }).expect(200);
      await app_(riderToken()).post(`/api/payments/cash/${transactionId}/confirm-paid`, { confirmationCode: riderCode }).expect(200);
    }
    const report = await app_(driverToken()).post(`/api/payments/cash/${transactionId}/dispute`, {
      reason: 'wrong_amount', description: 'Rider paid less than the fare shown',
    }).expect(201);
    const payment = await CashTransaction.findByPk(transactionId);
    return { transactionId, disputeId: report.body.data.disputeId as string, fee: Number(payment!.platformFee) };
  };

  const owed = async () => Number((await UserWallet.findOne({ where: { userId: driver.id } }))?.commissionOwed ?? 0);
  const resolve = (disputeId: string, body: object, token = adminToken) =>
    app_(token).post(`/api/admin/cash-disputes/${disputeId}/resolve`, body);

  it('lists the dispute with both people and the ride, and never the confirmation codes', async () => {
    const { disputeId } = await disputedPayment(false);
    const list = await app_(adminToken).get('/api/admin/cash-disputes?status=open').expect(200);
    expect(list.body.data.openCount).toBe(1);
    expect(list.body.data.disputes[0]).toMatchObject({
      id: disputeId, reportedBy: 'driver', riderName: 'Lesedi Rider', driverName: 'Kabo Driver',
      amount: 26.25, currency: 'BWP', origin: 'Main Mall, Gaborone',
    });
    const detail = await app_(moderatorToken).get(`/api/admin/cash-disputes/${disputeId}`).expect(200);
    expect(JSON.stringify(detail.body)).not.toMatch(/confirmation_?code/i);

    const alerts = await app_(adminToken).get('/api/admin/alerts').expect(200);
    expect(alerts.body.data.counts.cashDisputes).toBe(1);
  });

  it('paid in full, before commission was charged: completes the payment and charges it', async () => {
    const { transactionId, disputeId, fee } = await disputedPayment(false);
    await resolve(disputeId, { outcome: 'paid_in_full', reason: 'Rider sent a photo of the cash handover' }).expect(200);

    expect((await CashTransaction.findByPk(transactionId))!.status).toBe('completed');
    expect(await owed()).toBe(fee);
    expect(await TrustHold.count({ where: { transactionId } })).toBe(0);
  });

  it('not paid, after commission was charged: fails the payment and reverses the commission', async () => {
    const { transactionId, disputeId, fee } = await disputedPayment(true);
    expect(await owed()).toBe(fee);

    const response = await resolve(disputeId, { outcome: 'not_paid', reason: 'Driver confirmed by mistake; no cash changed hands' }).expect(200);
    expect(response.body.data).toMatchObject({ commissionBefore: fee, commissionAfter: 0 });

    expect((await CashTransaction.findByPk(transactionId))!.status).toBe('failed');
    expect(await owed()).toBe(0);
    const entries = await CommissionLedger.findAll({ where: { cashTransactionId: transactionId }, order: [['createdAt', 'ASC']] });
    expect(entries.map(e => [e.entryType, Number(e.amount)])).toEqual([['accrual', fee], ['waiver', fee]]);
  });

  it('part paid: charges commission on the part paid only', async () => {
    const { disputeId, fee } = await disputedPayment(true);
    await resolve(disputeId, { outcome: 'part_paid', amountPaid: 26.25, reason: 'Paid in full after all' }).expect(400);
    await resolve(disputeId, { outcome: 'part_paid', amountPaid: 13.125, reason: 'Rider paid half; both agree' }).expect(200);
    expect(await owed()).toBe(Math.round(fee * 0.5 * 100) / 100);
  });

  it('needs an outcome and a reason, resolves once, and only for admins', async () => {
    const { disputeId } = await disputedPayment(false);
    expect((await resolve(disputeId, { outcome: 'driver_wins', reason: 'Because reasons' }).expect(400)).body.code).toBe('INVALID_OUTCOME');
    expect((await resolve(disputeId, { outcome: 'paid_in_full' }).expect(400)).body.code).toBe('REASON_REQUIRED');
    await resolve(disputeId, { outcome: 'paid_in_full', reason: 'Moderators may not decide money' }, moderatorToken).expect(403);

    await resolve(disputeId, { outcome: 'paid_in_full', reason: 'Rider sent a photo of the cash handover' }).expect(200);
    expect((await resolve(disputeId, { outcome: 'not_paid', reason: 'Changed my mind' }).expect(409)).body.code).toBe('ALREADY_RESOLVED');

    const detail = await app_(adminToken).get(`/api/admin/cash-disputes/${disputeId}`).expect(200);
    expect(detail.body.data.dispute).toMatchObject({
      status: 'resolved', outcome: 'paid_in_full', resolvedByEmail: 'ops@test.com',
      resolutionNotes: 'Rider sent a photo of the cash handover',
    });
  });
});
