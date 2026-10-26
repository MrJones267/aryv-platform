/**
 * @fileoverview Unit tests for PaymentController's intent lifecycle.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * Two defects are pinned here.
 *
 * `createPaymentIntent` took `amount`, `currency` and `rideId` straight from
 * the request body with nothing binding them to a real booking and no
 * ownership check, so any signed-in user could raise an intent for any sum
 * against any ride.
 *
 * `confirmPayment` then wrote `status: 'completed'` for every method that was
 * not the wallet, without charging anything or consulting any provider — the
 * caller's own `cardToken` was stored and never used. Between them, a payment
 * could be declared settled by the person who owed it.
 */

import { Response } from 'express';
import { BookingStatus } from '../../types';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockStripe = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
};
jest.mock('stripe', () => jest.fn(() => mockStripe));

const redisStore = new Map<string, string>();
jest.mock('../../config/redis', () => ({
  redisClient: {
    get: jest.fn(async (k: string) => redisStore.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => { redisStore.set(k, v); }),
    del: jest.fn(async (k: string) => { redisStore.delete(k); }),
    increment: jest.fn(async () => 1),
    isConnected: jest.fn(() => true),
  },
}));

// Models are deliberately NOT automocked: they wire real associations at
// import time, and a mocked class is not a Sequelize.Model subclass, which
// breaks the association graph before any test runs. `Booking.findByPk` is
// spied on per-test instead.
jest.mock('../../services/CashWalletService', () => ({
  __esModule: true,
  default: { processPayment: jest.fn(), loadWallet: jest.fn(), getWallet: jest.fn() },
}));
jest.mock('../../services/MobileMoneyService', () => ({
  __esModule: true,
  default: { initiate: jest.fn(), generateReference: jest.fn(() => 'mm_ref') },
}));
// A real Sequelize instance, because several models in this import graph use
// `Model.init` which needs one — but with every query path rejecting, so no
// connection is ever attempted. Mirrors the contract suite's approach.
jest.mock('../../config/database', () => {
  const actual = jest.requireActual('../../config/database');
  const unavailable = () => Promise.reject(new Error('DB unavailable in unit tests'));
  (actual.sequelize as any).connectionManager.getConnection = jest.fn(unavailable);
  actual.sequelize.authenticate = jest.fn(unavailable);
  actual.sequelize.query = jest.fn(unavailable);
  actual.sequelize.transaction = jest.fn(unavailable);
  return actual;
});

import { PaymentController } from '../../controllers/PaymentController';
import Booking from '../../models/Booking';
import cashWalletService from '../../services/CashWalletService';

// ── Helpers ──────────────────────────────────────────────────────────────────

const PASSENGER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_USER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BOOKING_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const mockRes = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const mockReq = (body: Record<string, unknown>, userId: string | null = PASSENGER) =>
  ({ body, params: {}, user: userId ? { id: userId } : undefined }) as any;

const bookingRow = (overrides: Record<string, unknown> = {}) => ({
  id: BOOKING_ID,
  passengerId: PASSENGER,
  rideId: 'ride-1',
  totalAmount: 120.5,
  currency: 'BWP',
  status: BookingStatus.PENDING,
  paymentIntentId: null,
  update: jest.fn(),
  ...overrides,
});

const bodyOf = (res: Response) => (res.json as jest.Mock).mock.calls[0][0];
const statusOf = (res: Response) => (res.status as jest.Mock).mock.calls[0]?.[0];

describe('PaymentController', () => {
  let controller: PaymentController;

  let findByPk: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    redisStore.clear();
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_123';
    findByPk = jest.spyOn(Booking, 'findByPk').mockResolvedValue(null as never);
    controller = new PaymentController();
  });

  afterEach(() => {
    findByPk.mockRestore();
  });

  // ── createPaymentIntent ────────────────────────────────────────────────────

  describe('createPaymentIntent', () => {
    it('ignores a client-supplied amount and bills the booking total', async () => {
      const booking = bookingRow();
      findByPk.mockResolvedValue(booking);
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_stripe_1', client_secret: 'cs_1',
      });

      const res = mockRes();
      await controller.createPaymentIntent(
        // A caller trying to pay 1 unit for a 120.50 booking.
        mockReq({ bookingId: BOOKING_ID, paymentMethod: 'card', amount: 1, currency: 'usd' }),
        res,
      );

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 12050, currency: 'bwp' }),
      );
      expect(bodyOf(res).data.amount).toBe(120.5);
      expect(bodyOf(res).data.currency).toBe('BWP');
    });

    it('refuses to raise a payment against someone else’s booking', async () => {
      findByPk.mockResolvedValue(bookingRow({ passengerId: OTHER_USER }));

      const res = mockRes();
      await controller.createPaymentIntent(
        mockReq({ bookingId: BOOKING_ID, paymentMethod: 'wallet' }),
        res,
      );

      expect(statusOf(res)).toBe(403);
      expect(bodyOf(res).code).toBe('FORBIDDEN');
      expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('requires a bookingId', async () => {
      const res = mockRes();
      await controller.createPaymentIntent(mockReq({ paymentMethod: 'card' }), res);

      expect(statusOf(res)).toBe(400);
      expect(bodyOf(res).code).toBe('BOOKING_ID_REQUIRED');
    });

    it('refuses a cancelled booking', async () => {
      findByPk.mockResolvedValue(
        bookingRow({ status: BookingStatus.CANCELLED }),
      );

      const res = mockRes();
      await controller.createPaymentIntent(
        mockReq({ bookingId: BOOKING_ID, paymentMethod: 'wallet' }),
        res,
      );

      expect(statusOf(res)).toBe(400);
      expect(bodyOf(res).code).toBe('BOOKING_NOT_PAYABLE');
    });

    // ── Compatibility with app builds already on people's phones ────────────
    // Those builds raise the intent BEFORE they book, so there is no booking to
    // bind to yet, and their client throws on a 4xx — rejecting them would
    // break booking outright for every installed app, cash included.

    it('accepts the legacy rideId shape without a bookingId', async () => {
      const res = mockRes();
      await controller.createPaymentIntent(
        mockReq({ rideId: 'ride-1', paymentMethod: 'cash', amount: 999, currency: 'usd' }),
        res,
      );

      expect(statusOf(res)).toBe(201);
      expect(bodyOf(res).data.deferred).toBe(true);
      // Nothing about the money is settled yet, and the client's amount is
      // discarded exactly as it is on the modern path.
      expect(bodyOf(res).data.amount).toBeNull();
      expect(bodyOf(res).data.bookingId).toBeNull();
      expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('still requires one of bookingId or rideId', async () => {
      const res = mockRes();
      await controller.createPaymentIntent(mockReq({ paymentMethod: 'wallet' }), res);

      expect(statusOf(res)).toBe(400);
      expect(bodyOf(res).code).toBe('BOOKING_ID_REQUIRED');
    });

    it('refuses a card payment when Stripe is not configured, rather than faking one', async () => {
      delete process.env['STRIPE_SECRET_KEY'];
      findByPk.mockResolvedValue(bookingRow());

      const res = mockRes();
      await controller.createPaymentIntent(
        mockReq({ bookingId: BOOKING_ID, paymentMethod: 'card' }),
        res,
      );

      expect(statusOf(res)).toBe(503);
      expect(bodyOf(res).code).toBe('CARD_PAYMENTS_UNAVAILABLE');
    });
  });

  // ── confirmPayment ─────────────────────────────────────────────────────────

  describe('confirmPayment', () => {
    const seedIntent = (intent: Record<string, unknown>) => {
      redisStore.set(`payment_intent:${intent['id']}`, JSON.stringify(intent));
    };

    it('does not settle a card payment that Stripe has not settled', async () => {
      seedIntent({
        id: 'pi_local', userId: PASSENGER, amount: 120.5, currency: 'BWP',
        paymentMethod: 'card', stripeIntentId: 'pi_stripe_1', status: 'pending',
        bookingId: BOOKING_ID,
      });
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ status: 'requires_payment_method' });

      const res = mockRes();
      await controller.confirmPayment(
        mockReq({ paymentIntentId: 'pi_local', cardToken: 'tok_attacker' }),
        res,
      );

      expect(statusOf(res)).toBe(402);
      expect(bodyOf(res).code).toBe('PAYMENT_NOT_SETTLED');

      const stored = JSON.parse(redisStore.get('payment_intent:pi_local') as string);
      expect(stored.status).toBe('pending');
      // The caller's card token must never be persisted.
      expect(stored.cardToken).toBeUndefined();
    });

    it('settles a card payment only once Stripe reports success', async () => {
      seedIntent({
        id: 'pi_local', userId: PASSENGER, amount: 120.5, currency: 'BWP',
        paymentMethod: 'card', stripeIntentId: 'pi_stripe_1', status: 'pending',
        bookingId: BOOKING_ID,
      });
      mockStripe.paymentIntents.retrieve.mockResolvedValue({ status: 'succeeded' });
      const booking = bookingRow();
      findByPk.mockResolvedValue(booking);

      const res = mockRes();
      await controller.confirmPayment(mockReq({ paymentIntentId: 'pi_local' }), res);

      expect(bodyOf(res).success).toBe(true);
      expect(bodyOf(res).data.status).toBe('completed');
      // A settled payment confirms its booking, so the two cannot disagree.
      expect(booking.update).toHaveBeenCalledWith({ status: BookingStatus.CONFIRMED });
    });

    it('refuses to settle a mobile-money payment from the app', async () => {
      seedIntent({
        id: 'pi_mm', userId: PASSENGER, amount: 50, currency: 'BWP',
        paymentMethod: 'mobile_money', status: 'pending', bookingId: BOOKING_ID,
      });

      const res = mockRes();
      await controller.confirmPayment(mockReq({ paymentIntentId: 'pi_mm' }), res);

      expect(statusOf(res)).toBe(400);
      expect(bodyOf(res).code).toBe('CONFIRMATION_NOT_APPLICABLE');

      const stored = JSON.parse(redisStore.get('payment_intent:pi_mm') as string);
      expect(stored.status).toBe('pending');
    });

    it('refuses an intent belonging to another user', async () => {
      seedIntent({
        id: 'pi_theirs', userId: OTHER_USER, amount: 50, currency: 'BWP',
        paymentMethod: 'wallet', status: 'pending',
      });

      const res = mockRes();
      await controller.confirmPayment(mockReq({ paymentIntentId: 'pi_theirs' }), res);

      expect(statusOf(res)).toBe(403);
      expect(cashWalletService.processPayment).not.toHaveBeenCalled();
    });

    it('settles a wallet payment against the wallet ledger', async () => {
      seedIntent({
        id: 'pi_wallet', userId: PASSENGER, amount: 50, currency: 'BWP',
        paymentMethod: 'wallet', status: 'pending', bookingId: BOOKING_ID,
      });
      (cashWalletService.processPayment as jest.Mock).mockResolvedValue({ success: true });
      findByPk.mockResolvedValue(bookingRow());

      const res = mockRes();
      await controller.confirmPayment(mockReq({ paymentIntentId: 'pi_wallet' }), res);

      expect(cashWalletService.processPayment).toHaveBeenCalledWith(
        expect.objectContaining({ userId: PASSENGER, amount: 50 }),
      );
      expect(bodyOf(res).data.status).toBe('completed');
    });

    it('leaves a wallet payment failed when the debit is refused', async () => {
      seedIntent({
        id: 'pi_wallet', userId: PASSENGER, amount: 50, currency: 'BWP',
        paymentMethod: 'wallet', status: 'pending', bookingId: BOOKING_ID,
      });
      (cashWalletService.processPayment as jest.Mock).mockResolvedValue({
        success: false, error: 'Insufficient balance',
      });

      const res = mockRes();
      await controller.confirmPayment(mockReq({ paymentIntentId: 'pi_wallet' }), res);

      expect(statusOf(res)).toBe(400);
      const stored = JSON.parse(redisStore.get('payment_intent:pi_wallet') as string);
      expect(stored.status).toBe('failed');
    });

    it('binds a deferred intent to the real booking and charges its total', async () => {
      seedIntent({
        id: 'pi_legacy', userId: PASSENGER, amount: null, currency: null,
        paymentMethod: 'wallet', status: 'pending', bookingId: null,
        rideId: 'ride-1', deferred: true,
      });
      // The booking the old client made at its step 2.
      jest.spyOn(Booking, 'findOne').mockResolvedValue({
        id: BOOKING_ID, totalAmount: 120.5, currency: 'BWP', status: BookingStatus.PENDING,
      } as never);
      (cashWalletService.processPayment as jest.Mock).mockResolvedValue({ success: true });
      findByPk.mockResolvedValue(bookingRow());

      const res = mockRes();
      await controller.confirmPayment(mockReq({ paymentIntentId: 'pi_legacy' }), res);

      // The amount comes from the booking, never from whatever the legacy
      // client originally claimed.
      expect(cashWalletService.processPayment).toHaveBeenCalledWith(
        expect.objectContaining({ userId: PASSENGER, amount: 120.5 }),
      );
      expect(bodyOf(res).data.status).toBe('completed');
    });

    it('refuses a deferred intent when the caller has no booking on that ride', async () => {
      seedIntent({
        id: 'pi_legacy', userId: PASSENGER, amount: null, currency: null,
        paymentMethod: 'wallet', status: 'pending', bookingId: null,
        rideId: 'ride-1', deferred: true,
      });
      jest.spyOn(Booking, 'findOne').mockResolvedValue(null as never);

      const res = mockRes();
      await controller.confirmPayment(mockReq({ paymentIntentId: 'pi_legacy' }), res);

      expect(statusOf(res)).toBe(400);
      expect(bodyOf(res).code).toBe('BOOKING_NOT_FOUND');
      expect(cashWalletService.processPayment).not.toHaveBeenCalled();
    });

    it('does not let a deferred intent reach another passenger’s booking', async () => {
      seedIntent({
        id: 'pi_legacy', userId: PASSENGER, amount: null, currency: null,
        paymentMethod: 'wallet', status: 'pending', bookingId: null,
        rideId: 'ride-1', deferred: true,
      });
      const findOne = jest.spyOn(Booking, 'findOne').mockResolvedValue(null as never);

      const res = mockRes();
      await controller.confirmPayment(mockReq({ paymentIntentId: 'pi_legacy' }), res);

      // The lookup is scoped to the caller, so someone else's booking on the
      // same ride is not reachable.
      expect(findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ passengerId: PASSENGER, rideId: 'ride-1' }),
        }),
      );
      expect(statusOf(res)).toBe(400);
    });

    it('is idempotent — re-confirming does not debit the wallet twice', async () => {
      seedIntent({
        id: 'pi_done', userId: PASSENGER, amount: 50, currency: 'BWP',
        paymentMethod: 'wallet', status: 'completed', bookingId: BOOKING_ID,
      });

      const res = mockRes();
      await controller.confirmPayment(mockReq({ paymentIntentId: 'pi_done' }), res);

      expect(bodyOf(res).success).toBe(true);
      expect(cashWalletService.processPayment).not.toHaveBeenCalled();
    });
  });
});
