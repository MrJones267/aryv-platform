/**
 * @fileoverview Unit tests for CashPaymentService.createCashPayment — booking
 *               ownership, server-side fare derivation, and duplicate guards.
 * @author Oabona-Majoko
 * @created 2026-08-22
 * @lastModified 2026-08-22
 */

import { sequelize } from '../../config/database';
import { CashPaymentService } from '../../services/CashPaymentService';
import { Booking } from '../../models';
import CashTransaction, { CashPaymentStatus } from '../../models/CashTransaction';
import { BookingStatus } from '../../types';

jest.mock('../../models', () => ({
  Booking: { findByPk: jest.fn() },
  Ride: {},
}));
jest.mock('../../models/CashTransaction', () => {
  const actual = jest.requireActual('../../models/CashTransaction');
  return {
    __esModule: true,
    ...actual,
    default: { findOne: jest.fn(), create: jest.fn() },
  };
});
jest.mock('../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../services/CommissionService', () => ({
  CommissionService: jest.fn().mockImplementation(() => ({
    isBlockedForUnpaidCommission: jest.fn().mockResolvedValue({ blocked: false, owed: 0, threshold: 50 }),
  })),
}));

const MockedBooking = Booking as unknown as { findByPk: jest.Mock };
const MockedCashTransaction = CashTransaction as unknown as { findOne: jest.Mock; create: jest.Mock };

const RIDER = 'rider-uuid-1';
const DRIVER = 'driver-uuid-1';
const BOOKING = 'booking-uuid-1';

/** A booking owned by RIDER, on a ride driven by DRIVER, fare 120. */
const makeBooking = (overrides: Record<string, unknown> = {}) => ({
  id: BOOKING,
  passengerId: RIDER,
  totalAmount: 120,
  status: BookingStatus.CONFIRMED,
  currency: 'BWP',
  ride: { driverId: DRIVER },
  ...overrides,
});

describe('CashPaymentService.createCashPayment', () => {
  let service: CashPaymentService;
  let mockTx: { commit: jest.Mock; rollback: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CashPaymentService();
    mockTx = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(sequelize, 'transaction').mockResolvedValue(mockTx as any);

    MockedCashTransaction.findOne.mockResolvedValue(null);
    MockedCashTransaction.create.mockResolvedValue({ id: 'cash-tx-1' });

    // Bypass wallet/trust plumbing — these paths are exercised elsewhere and
    // are not what these cases are about.
    jest
      .spyOn(service as any, 'checkCashPaymentEligibility')
      .mockResolvedValue({ eligible: true, trustScore: 90 });
    jest.spyOn(service as any, 'createTrustHold').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'sendCashPaymentNotifications').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'logSuspiciousActivity').mockResolvedValue(undefined);
  });

  it('refuses a booking the caller does not own', async () => {
    MockedBooking.findByPk.mockResolvedValue(makeBooking({ passengerId: 'someone-else' }));

    const result = await service.createCashPayment(BOOKING, RIDER);

    expect(result.success).toBe(false);
    expect(MockedCashTransaction.create).not.toHaveBeenCalled();
    expect(mockTx.rollback).toHaveBeenCalled();
    expect(mockTx.commit).not.toHaveBeenCalled();
  });

  it('logs an ownership mismatch as suspicious activity', async () => {
    MockedBooking.findByPk.mockResolvedValue(makeBooking({ passengerId: 'someone-else' }));
    const spy = jest.spyOn(service as any, 'logSuspiciousActivity');

    await service.createCashPayment(BOOKING, RIDER);

    expect(spy).toHaveBeenCalledWith(
      RIDER,
      'cash_payment_booking_ownership_mismatch',
      expect.objectContaining({ bookingId: BOOKING }),
    );
  });

  it('takes the amount and driver from the booking, not the caller', async () => {
    MockedBooking.findByPk.mockResolvedValue(makeBooking());

    const result = await service.createCashPayment(BOOKING, RIDER);

    expect(result.success).toBe(true);
    expect(MockedCashTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: BOOKING,
        riderId: RIDER,
        driverId: DRIVER,
        amount: 120,
        expectedAmount: 120,
      }),
      expect.anything(),
    );
  });

  it('computes the platform fee from the booking fare', async () => {
    MockedBooking.findByPk.mockResolvedValue(makeBooking({ totalAmount: 120 }));
    const feeSpy = jest.spyOn(service as any, 'calculatePlatformFee');

    await service.createCashPayment(BOOKING, RIDER);

    // The fee is now computed against the booking's currency, because a bare
    // cap meant ten Pula in Botswana and ten dollars elsewhere.
    expect(feeSpy).toHaveBeenCalledWith(120, 'BWP');
  });

  it('refuses a booking that is already cancelled', async () => {
    MockedBooking.findByPk.mockResolvedValue(makeBooking({ status: BookingStatus.CANCELLED }));

    const result = await service.createCashPayment(BOOKING, RIDER);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cancelled/);
    expect(MockedCashTransaction.create).not.toHaveBeenCalled();
  });

  it('refuses a second cash payment while one is live', async () => {
    MockedBooking.findByPk.mockResolvedValue(makeBooking());
    MockedCashTransaction.findOne.mockResolvedValue({
      id: 'cash-tx-existing',
      status: CashPaymentStatus.PENDING_VERIFICATION,
    });

    const result = await service.createCashPayment(BOOKING, RIDER);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already in progress/);
    expect(MockedCashTransaction.create).not.toHaveBeenCalled();
  });

  it('refuses a booking whose ride has no driver assigned', async () => {
    MockedBooking.findByPk.mockResolvedValue(makeBooking({ ride: null }));

    const result = await service.createCashPayment(BOOKING, RIDER);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no assigned driver/);
  });

  it('refuses a booking with a non-payable amount', async () => {
    MockedBooking.findByPk.mockResolvedValue(makeBooking({ totalAmount: 0 }));

    const result = await service.createCashPayment(BOOKING, RIDER);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no payable amount/);
  });

  it('reports a missing booking without leaking its existence', async () => {
    MockedBooking.findByPk.mockResolvedValue(null);

    const result = await service.createCashPayment(BOOKING, RIDER);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Booking not found/);
  });
});
