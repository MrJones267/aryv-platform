/**
 * @fileoverview Applying a promo code when a ride is booked.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Promo codes were validated and never applied: /promos/validate computed a
 * discount and returned it, and nothing in the booking path consumed one.
 * Redemption lived in a Redis key, separate from the booking, so a code could
 * be spent without booking and a Redis eviction handed everyone their
 * one-per-user promo back.
 *
 * The discount is capped at the platform's fee, because on a cash ride the
 * passenger hands the fare to the driver — an uncapped discount takes money
 * from the driver rather than the platform. See PROMO_FUNDING in
 * RideController.
 */

import { sequelize } from '../../config/database';
import { RideController } from '../../controllers/RideController';

// bookRide is an instance method, not a static one.
import Ride from '../../models/Ride';
import Booking from '../../models/Booking';
import User from '../../models/User';
import PromoCode from '../../models/PromoCode';
import PromoRedemption from '../../models/PromoRedemption';
import { RideStatus, UserRole } from '../../types';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));
jest.mock('../../services/NotificationService', () => ({
  notificationService: { notifyNewBookingRequest: jest.fn().mockResolvedValue(undefined) },
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

const PASSENGER = 'passenger-1';
const DRIVER = 'driver-1';
const RIDE = '55555555-5555-4555-8555-555555555555';

/** 2 seats at 100 = 200 fare, 5% fee = 10, gross 210. */
const FARE_PER_SEAT = 100;
const SEATS = 2;
const GROSS = 210;
const PLATFORM_FEE = 10;

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const bookingRequest = (promoCode?: string): any => ({
  params: { id: RIDE },
  body: { seatsRequested: SEATS, ...(promoCode ? { promoCode } : {}) },
  user: { id: PASSENGER, role: UserRole.PASSENGER },
});

const makePromo = (overrides: Record<string, unknown> = {}): any => ({
  id: 'promo-1',
  code: 'ARYV2026',
  type: 'fixed',
  value: 20,
  maxDiscount: null,
  minOrderAmount: 0,
  usageLimit: null,
  usedCount: 0,
  isValid: () => ({ valid: true }),
  calculateDiscount: (amount: number) => Math.min(20, amount),
  increment: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('promo codes at booking', () => {
  const controller = new RideController();
  let mockTx: { commit: jest.Mock; rollback: jest.Mock };
  let created: any;

  beforeEach(() => {
    mockTx = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(sequelize, 'transaction').mockResolvedValue(mockTx as any);

    jest.spyOn(Ride, 'findByPk').mockResolvedValue({
      id: RIDE,
      driverId: DRIVER,
      status: RideStatus.PENDING,
      availableSeats: 4,
      pricePerSeat: FARE_PER_SEAT,
    } as any);

    jest.spyOn(Booking, 'sum').mockResolvedValue(0 as any);
    jest.spyOn(Booking, 'findOne').mockResolvedValue(null);
    jest.spyOn(Booking, 'create').mockImplementation((async (values: any) => {
      created = values;
      return { id: 'booking-1', ...values };
    }) as any);
    jest.spyOn(Booking, 'findByPk').mockResolvedValue({ id: 'booking-1' } as any);
    jest.spyOn(User, 'findByPk').mockResolvedValue({ id: PASSENGER } as any);
    jest.spyOn(PromoRedemption, 'findOne').mockResolvedValue(null);
    jest.spyOn(PromoRedemption, 'create').mockResolvedValue({} as any);
  });

  it('charges the full amount when no code is given', async () => {
    await controller.bookRide(bookingRequest(), mockRes());

    expect(created.totalAmount).toBe(GROSS);
    expect(created.discountAmount).toBe(0);
    expect(created.promoCode).toBeNull();
  });

  it('takes the discount off the total', async () => {
    jest.spyOn(PromoCode, 'findOne').mockResolvedValue(
      makePromo({ calculateDiscount: () => 8 }) as any,
    );

    await controller.bookRide(bookingRequest('ARYV2026'), mockRes());

    expect(created.discountAmount).toBe(8);
    expect(created.totalAmount).toBe(GROSS - 8);
    expect(created.promoCode).toBe('ARYV2026');
  });

  it('caps the discount at the platform fee, so the driver is never short-paid', async () => {
    // The seeded codes offer 20 and 50 off; the fee on this booking is 10.
    // Anything beyond that would come out of the driver's fare.
    jest.spyOn(PromoCode, 'findOne').mockResolvedValue(makePromo() as any);

    await controller.bookRide(bookingRequest('ARYV2026'), mockRes());

    expect(created.discountAmount).toBe(PLATFORM_FEE);
    expect(created.totalAmount).toBe(GROSS - PLATFORM_FEE);
  });

  it('records the redemption against the booking', async () => {
    jest.spyOn(PromoCode, 'findOne').mockResolvedValue(makePromo() as any);

    await controller.bookRide(bookingRequest('ARYV2026'), mockRes());

    expect(PromoRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({
        promoCodeId: 'promo-1',
        userId: PASSENGER,
        bookingId: 'booking-1',
        discountAmount: PLATFORM_FEE,
        orderAmount: GROSS,
      }),
      expect.anything(),
    );
  });

  it('is case-insensitive and ignores surrounding space', async () => {
    jest.spyOn(PromoCode, 'findOne').mockResolvedValue(makePromo() as any);

    await controller.bookRide(bookingRequest('  aryv2026 '), mockRes());

    expect(PromoCode.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'ARYV2026' } }),
    );
  });

  it('refuses a code the user has already redeemed', async () => {
    jest.spyOn(PromoCode, 'findOne').mockResolvedValue(makePromo() as any);
    jest.spyOn(PromoRedemption, 'findOne').mockResolvedValue({ id: 'redemption-1' } as any);

    const res = mockRes();
    await controller.bookRide(bookingRequest('ARYV2026'), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(Booking.create).not.toHaveBeenCalled();
    expect(mockTx.rollback).toHaveBeenCalled();
  });

  it('refuses an unknown code rather than booking without it', async () => {
    // Silently ignoring it would charge full price for a booking the passenger
    // thought was discounted.
    jest.spyOn(PromoCode, 'findOne').mockResolvedValue(null);

    const res = mockRes();
    await controller.bookRide(bookingRequest('NOPE'), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Booking.create).not.toHaveBeenCalled();
  });

  it('refuses an expired or exhausted code, with the reason', async () => {
    jest.spyOn(PromoCode, 'findOne').mockResolvedValue(
      makePromo({ isValid: () => ({ valid: false, reason: 'Promo code has expired' }) }) as any,
    );

    const res = mockRes();
    await controller.bookRide(bookingRequest('OLDCODE'), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Promo code has expired' }),
    );
  });

  it('counts the redemption against the code', async () => {
    const promo = makePromo();
    jest.spyOn(PromoCode, 'findOne').mockResolvedValue(promo as any);

    await controller.bookRide(bookingRequest('ARYV2026'), mockRes());

    expect(promo.increment).toHaveBeenCalledWith('usedCount', expect.anything());
  });
});
