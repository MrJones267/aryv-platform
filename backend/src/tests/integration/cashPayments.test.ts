/**
 * @fileoverview Integration tests for a cash ride payment, start to finish
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * Starting a cash payment wrote a trust hold through a model that was never
 * defined, so it always failed; completing one updated booking columns that
 * do not exist; and reporting a dispute used another undefined model. The
 * unit tests mocked each of these away. These run the routes the app calls,
 * against the real schema, and check the commission that results.
 */

import request from 'supertest';
import app from '../../index';
import { User, Ride, Booking, Vehicle } from '../../models';
import CashTransaction from '../../models/CashTransaction';
import CashDispute from '../../models/CashDispute';
import CommissionLedger from '../../models/CommissionLedger';
import TrustHold from '../../models/TrustHold';
import UserWallet from '../../models/UserWallet';
import { AuthService } from '../../services/AuthService';
import { BookingStatus, RideStatus, UserRole, VehicleType } from '../../types';

describe('Cash ride payments', () => {
  let rider: any;
  let driver: any;
  let booking: any;
  let riderToken: string;
  let driverToken: string;

  beforeEach(async () => {
    // The setup file empties every table before each test.
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
    riderToken = AuthService.generateAccessToken({ userId: rider.id, email: rider.email, role: UserRole.PASSENGER });
    driverToken = AuthService.generateAccessToken({ userId: driver.id, email: driver.email, role: UserRole.DRIVER });
  });

  const asRider = (p: string, body: object) => request(app).post(`/api/payments/cash${p}`).set('Authorization', `Bearer ${riderToken}`).send(body);
  const asDriver = (p: string, body: object) => request(app).post(`/api/payments/cash${p}`).set('Authorization', `Bearer ${driverToken}`).send(body);

  const start = async () => {
    const response = await asRider('/create', { bookingId: booking.id }).expect(201);
    return response.body.data as { transactionId: string; riderCode: string };
  };

  it('starts a payment and holds the fare against the rider', async () => {
    const { transactionId, riderCode } = await start();
    expect(riderCode).toMatch(/^\d{6}$/);
    const payment = await CashTransaction.findByPk(transactionId);
    expect(Number(payment!.amount)).toBe(26.25);
    expect(await TrustHold.count({ where: { transactionId } })).toBe(1);
  });

  it.each([
    ['driver first', true],
    ['rider first', false],
  ])('completes when both confirm (%s), charges the commission, and releases the hold', async (_label, driverFirst) => {
    const { transactionId, riderCode } = await start();
    const driverConfirms = () => asDriver(`/${transactionId}/confirm-received`, { actualAmount: 26.25 }).expect(200);
    const riderConfirms = () => asRider(`/${transactionId}/confirm-paid`, { confirmationCode: riderCode }).expect(200);
    if (driverFirst) { await driverConfirms(); await riderConfirms(); } else { await riderConfirms(); await driverConfirms(); }

    const payment = await CashTransaction.findByPk(transactionId);
    expect(payment!.status).toBe('completed');
    expect(await TrustHold.count({ where: { transactionId } })).toBe(0);

    const accruals = await CommissionLedger.findAll({ where: { cashTransactionId: transactionId } });
    expect(accruals).toHaveLength(1);
    expect(Number(accruals[0]!.amount)).toBe(Number(payment!.platformFee));
    const wallet = await UserWallet.findOne({ where: { userId: driver.id } });
    expect(Number(wallet!.commissionOwed)).toBe(Number(payment!.platformFee));

    // Wallet sums are numbers, not concatenated strings.
    const riderWallet = await UserWallet.findOne({ where: { userId: rider.id } });
    expect(Number(riderWallet!.totalTransactionValue)).toBe(26.25);
  });

  it('lists the payment for both people, with the ride and who it is with', async () => {
    const { transactionId } = await start();
    const asRiderGet = await request(app).get('/api/payments/cash/history').set('Authorization', `Bearer ${riderToken}`).expect(200);
    const asDriverGet = await request(app).get('/api/payments/cash/history').set('Authorization', `Bearer ${driverToken}`).expect(200);
    const mine = (res: any) => (res.body.data.transactions ?? res.body.data).find((t: any) => t.id === transactionId);
    expect(mine(asRiderGet)).toMatchObject({ userRole: 'rider', bookingId: booking.id, rideId: booking.rideId, otherPersonName: 'Kabo' });
    expect(mine(asDriverGet)).toMatchObject({ userRole: 'driver', otherPersonName: 'Lesedi', status: 'pending_verification' });
  });

  it('takes cash for a long, expensive ride from a brand-new rider: there is no limit', async () => {
    // P1,850 is far above the old P100 daily cap and the trust score it used to demand.
    await booking.update({ totalAmount: 1850, platformFee: 88.1 });
    const { transactionId } = await start();
    expect(Number((await CashTransaction.findByPk(transactionId))!.amount)).toBe(1850);

    const wallet = await request(app).get('/api/payments/cash/wallet').set('Authorization', `Bearer ${riderToken}`).expect(200);
    expect(wallet.body.data).toMatchObject({ dailyCashLimit: null, weeklyCashLimit: null, monthlyCashLimit: null });
  });

  it('still refuses a rider whose cash account is suspended', async () => {
    await UserWallet.create({ userId: rider.id, isSuspended: true, suspensionReason: 'Repeated non-payment' } as any);
    const response = await asRider('/create', { bookingId: booking.id }).expect(400);
    expect(JSON.stringify(response.body)).toContain('Repeated non-payment');
  });

  it('records a reported problem, marks the payment disputed, and refuses a second report', async () => {
    const { transactionId } = await start();
    const report = await asDriver(`/${transactionId}/dispute`, {
      reason: 'no_payment_received', description: 'Rider left without paying the fare',
    }).expect(201);

    const dispute = await CashDispute.findByPk(report.body.data.disputeId);
    expect(dispute).toMatchObject({ reporterId: driver.id, reason: 'no_payment_received', status: 'open', transactionStatusBefore: 'pending_verification' });
    expect((await CashTransaction.findByPk(transactionId))!.status).toBe('disputed');

    const again = await asRider(`/${transactionId}/dispute`, { reason: 'other', description: 'I did pay the driver in full' }).expect(409);
    expect(again.body.code).toBe('DISPUTE_EXISTS');
  });

  it('does not let someone outside the ride report a problem', async () => {
    const { transactionId } = await start();
    const stranger = await User.create({ email: 'x@test.com', password: 'Integration-Test-Password-1!', firstName: 'X', lastName: 'Y', role: UserRole.PASSENGER } as any);
    const token = AuthService.generateAccessToken({ userId: stranger.id, email: stranger.email, role: UserRole.PASSENGER });
    await request(app).post(`/api/payments/cash/${transactionId}/dispute`).set('Authorization', `Bearer ${token}`)
      .send({ reason: 'other', description: 'Not my ride at all, testing' }).expect(403);
  });
});
