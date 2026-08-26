/**
 * @fileoverview Payment controller — Stripe cards, mobile money, and wallet operations
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { AuthenticatedRequest, BookingStatus } from '../types';
import { redisClient } from '../config/redis';
import User from '../models/User';
import Booking from '../models/Booking';
import cashWalletService from '../services/CashWalletService';
import mobileMoneyService from '../services/MobileMoneyService';
import { PLATFORM_DEFAULT_CURRENCY } from '../services/CurrencyService';
import logger from '../utils/logger';

const INTENT_PREFIX = 'payment_intent:';
const INTENT_TTL = 3600; // 1 hour
const MM_PREFIX = 'mm_tx:';
const MM_TTL = 86400; // 24 hours

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStripe(): any | null {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) return null;
  try {
    return require('stripe')(key);
  } catch {
    return null;
  }
}

async function saveIntent(id: string, data: Record<string, any>): Promise<void> {
  await redisClient.set(`${INTENT_PREFIX}${id}`, JSON.stringify(data), INTENT_TTL);
}

async function loadIntent(id: string): Promise<Record<string, any> | null> {
  const raw = await redisClient.get(`${INTENT_PREFIX}${id}`);
  return raw ? JSON.parse(raw) : null;
}

function getUserPaymentMethods(user: any): any[] {
  const prefs = (user.preferences as Record<string, any>) || {};
  return prefs['paymentMethods'] || [];
}

async function updateUserPaymentMethods(user: any, methods: any[]): Promise<void> {
  const prefs = (user.preferences as Record<string, any>) || {};
  await user.update({ preferences: { ...prefs, paymentMethods: methods } });
}

// ─── Controller ──────────────────────────────────────────────────────────────

export class PaymentController {
  // ─── Payment Methods ───────────────────────────────────────────────────────

  async getPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) { res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      res.json({ success: true, data: getUserPaymentMethods(user), timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('getPaymentMethods error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async addCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName, setAsDefault } = req.body;
      if (!cardNumber || !expiryMonth || !expiryYear || !cvv || !cardholderName) {
        res.status(400).json({ success: false, error: 'All card fields are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) { res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      // In production: tokenise via Stripe and store the token, never raw card data
      const stripe = getStripe();
      let stripePaymentMethodId: string | null = null;

      if (stripe) {
        try {
          const pm = await stripe.paymentMethods.create({
            type: 'card',
            card: { number: cardNumber, exp_month: expiryMonth, exp_year: expiryYear, cvc: cvv },
            billing_details: { name: cardholderName },
          });
          stripePaymentMethodId = pm.id;
        } catch (stripeErr: any) {
          res.status(400).json({ success: false, error: stripeErr.message || 'Card declined', code: 'CARD_DECLINED', timestamp: new Date().toISOString() });
          return;
        }
      }

      const last4 = String(cardNumber).slice(-4);
      const methods = getUserPaymentMethods(user);
      const newMethod = {
        id: stripePaymentMethodId || `card_${crypto.randomBytes(8).toString('hex')}`,
        type: 'card' as const,
        provider: 'stripe' as const,
        label: `•••• ${last4}`,
        last4,
        expiryDate: `${String(expiryMonth).padStart(2, '0')}/${expiryYear}`,
        isDefault: setAsDefault || methods.length === 0,
        createdAt: new Date().toISOString(),
      };

      if (newMethod.isDefault) {
        methods.forEach((m) => { m.isDefault = false; });
      }
      methods.push(newMethod);
      await updateUserPaymentMethods(user, methods);

      res.status(201).json({ success: true, data: newMethod, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('addCard error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async addMobileMoney(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { phone, provider, accountName, setAsDefault } = req.body;
      if (!phone || !provider) {
        res.status(400).json({ success: false, error: 'phone and provider are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) { res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      const methods = getUserPaymentMethods(user);
      const newMethod = {
        id: `mm_${crypto.randomBytes(8).toString('hex')}`,
        type: 'mobile_money' as const,
        provider,
        label: accountName || phone,
        phone,
        isDefault: setAsDefault || methods.length === 0,
        createdAt: new Date().toISOString(),
      };

      if (newMethod.isDefault) {
        methods.forEach((m) => { m.isDefault = false; });
      }
      methods.push(newMethod);
      await updateUserPaymentMethods(user, methods);

      res.status(201).json({ success: true, data: newMethod, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('addMobileMoney error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async removePaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) { res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      const methods = getUserPaymentMethods(user).filter((m) => m.id !== id);
      await updateUserPaymentMethods(user, methods);

      res.json({ success: true, message: 'Payment method removed', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('removePaymentMethod error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async setDefaultPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) { res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      const methods = getUserPaymentMethods(user);
      const target = methods.find((m) => m.id === id);
      if (!target) { res.status(404).json({ success: false, error: 'Payment method not found', code: 'METHOD_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      methods.forEach((m) => { m.isDefault = m.id === id; });
      await updateUserPaymentMethods(user, methods);

      res.json({ success: true, data: target, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('setDefaultPaymentMethod error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  // ─── Payment Intents ───────────────────────────────────────────────────────

  async createPaymentIntent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { paymentMethod, provider, bookingId, metadata } = req.body;
      if (!paymentMethod) {
        res.status(400).json({ success: false, error: 'paymentMethod is required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      // The amount is never taken from the request.
      //
      // This endpoint used to accept `amount`, `currency` and `rideId` from the
      // body with nothing tying them to a real booking and no ownership check,
      // so a caller could mint an intent for any sum against any ride. Both
      // figures now come from the booking row the platform itself calculated,
      // and the caller must be the passenger on it.
      if (!bookingId) {
        // Compatibility path for app builds already on people's phones.
        //
        // Those builds call this endpoint *before* they book — the booking does
        // not exist yet, so there is nothing to bind to. Rejecting them would
        // break booking outright for every installed app, including cash, which
        // is the one method that has always genuinely worked: the client throws
        // on a 4xx here and never reaches its booking call.
        //
        // So a legacy caller gets a deferred intent: no amount, no Stripe
        // intent, nothing that could authorise money. It records only who asked
        // and which ride, and `confirmPayment` resolves it to the real booking —
        // and the real total — once one exists. The client's `amount` is read
        // and discarded, exactly as it is on the modern path.
        //
        // Remove this once the store build carrying `bookingId` is the floor.
        const legacyRideId = req.body.rideId;

        if (!legacyRideId) {
          res.status(400).json({
            success: false,
            error: 'bookingId is required — create the booking first, then pay for it',
            code: 'BOOKING_ID_REQUIRED',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        logger.warn('Deprecated payment intent shape — client sent rideId without bookingId', {
          userId, rideId: legacyRideId, paymentMethod,
        });

        const deferredId = `pi_${crypto.randomBytes(16).toString('hex')}`;
        const deferred = {
          id: deferredId,
          amount: null,
          currency: null,
          status: 'pending' as const,
          paymentMethod,
          provider: provider || paymentMethod,
          metadata: (metadata && typeof metadata === 'object' ? metadata : {}),
          userId,
          bookingId: null,
          rideId: legacyRideId,
          deferred: true,
          createdAt: new Date().toISOString(),
        };

        await saveIntent(deferredId, deferred);

        res.status(201).json({ success: true, data: deferred, timestamp: new Date().toISOString() });
        return;
      }

      const booking = await Booking.findByPk(bookingId, {
        attributes: ['id', 'passengerId', 'rideId', 'totalAmount', 'currency', 'status', 'paymentIntentId'],
      });

      if (!booking) {
        res.status(404).json({ success: false, error: 'Booking not found', code: 'BOOKING_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      if (booking.passengerId !== userId) {
        res.status(403).json({ success: false, error: 'You can only pay for your own booking', code: 'FORBIDDEN', timestamp: new Date().toISOString() });
        return;
      }

      if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
        res.status(400).json({
          success: false,
          error: `This booking is ${booking.status} and cannot be paid for`,
          code: 'BOOKING_NOT_PAYABLE',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const amount = Number(booking.totalAmount);
      const currency = booking.currency || PLATFORM_DEFAULT_CURRENCY;

      const id = `pi_${crypto.randomBytes(16).toString('hex')}`;
      let clientSecret: string | undefined;
      let stripeIntentId: string | undefined;

      // Stripe payment intent
      const stripe = getStripe();
      if (paymentMethod === 'card') {
        if (!stripe) {
          // Previously this fell through to a local "intent" with no provider
          // behind it, which confirmPayment would then happily mark completed.
          // An unconfigured processor has to be an error, not a shortcut.
          res.status(503).json({
            success: false,
            error: 'Card payments are not available right now. Choose another payment method.',
            code: 'CARD_PAYMENTS_UNAVAILABLE',
            timestamp: new Date().toISOString(),
          });
          return;
        }
        try {
          const stripeIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // cents
            currency: currency.toLowerCase(),
            metadata: {
              userId,
              bookingId: booking.id,
              rideId: booking.rideId ?? '',
              ...(metadata && typeof metadata === 'object' ? metadata : {}),
            },
          });
          clientSecret = stripeIntent.client_secret;
          stripeIntentId = stripeIntent.id;
        } catch (stripeErr: any) {
          logger.error('Stripe intent creation failed', { error: stripeErr.message, bookingId: booking.id });
          res.status(502).json({
            success: false,
            error: 'Could not reach the card processor. Please try again.',
            code: 'CARD_PROCESSOR_ERROR',
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const intent = {
        id,
        clientSecret,
        stripeIntentId,
        amount,
        currency,
        status: 'pending' as const,
        paymentMethod,
        provider: provider || (paymentMethod === 'card' ? 'stripe' : paymentMethod),
        metadata: (metadata && typeof metadata === 'object' ? metadata : {}),
        userId,
        bookingId: booking.id,
        rideId: booking.rideId ?? null,
        createdAt: new Date().toISOString(),
      };

      await saveIntent(id, intent);

      if (stripeIntentId) {
        await booking.update({ paymentIntentId: stripeIntentId });
      }

      res.status(201).json({ success: true, data: intent, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('createPaymentIntent error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async confirmPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      // `cardToken` is deliberately not read. It used to be stored verbatim on
      // the intent and never used for anything — raw card material has no
      // business being persisted here, and Stripe already holds the payment
      // method against the intent we retrieve.
      const { paymentIntentId, paymentMethodId, mobileMoneyPhone, mobileMoneyProvider } = req.body;
      if (!paymentIntentId) {
        res.status(400).json({ success: false, error: 'paymentIntentId is required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const intent = await loadIntent(paymentIntentId);
      if (!intent) {
        res.status(404).json({ success: false, error: 'Payment intent not found or expired', code: 'INTENT_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      if (intent['userId'] !== userId) {
        res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN', timestamp: new Date().toISOString() });
        return;
      }

      if (intent['status'] === 'completed') {
        // Idempotent: re-confirming an already-settled payment returns the
        // settled record rather than repeating the wallet debit.
        res.json({ success: true, data: intent, timestamp: new Date().toISOString() });
        return;
      }

      // A deferred intent from an older app build carries a ride but no
      // booking, because the client raised it before booking. By now the
      // booking exists, so bind to it and take the amount from it — the same
      // authority the modern path uses, just resolved a step later.
      if (intent['deferred'] && !intent['bookingId']) {
        const booking = await Booking.findOne({
          where: {
            rideId: intent['rideId'],
            passengerId: userId,
            status: { [Op.in]: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          },
          order: [['createdAt', 'DESC']],
          attributes: ['id', 'totalAmount', 'currency', 'status'],
        });

        if (!booking) {
          res.status(400).json({
            success: false,
            error: 'No booking found to pay for. Book the ride first.',
            code: 'BOOKING_NOT_FOUND',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        intent['bookingId'] = booking.id;
        intent['amount'] = Number(booking.totalAmount);
        intent['currency'] = booking.currency || PLATFORM_DEFAULT_CURRENCY;
      }

      const method = intent['paymentMethod'];

      // Nothing below fabricates a settled payment.
      //
      // This handler used to write `status: 'completed'` for every method that
      // was not the wallet — no charge attempted, no provider consulted, the
      // caller's own `cardToken` stored and never used. A payment's terminal
      // state has to come from whoever actually holds the money.
      if (method === 'wallet') {
        // The wallet is our own ledger, so we are the authority and can settle
        // synchronously. A failed debit leaves the intent failed, not completed.
        const walletResult = await cashWalletService.processPayment({
          userId,
          amount: intent['amount'],
          description: `Payment for ride ${intent['rideId'] ?? intent['bookingId'] ?? ''}`.trim(),
          metadata: { paymentIntentId, rideId: intent['rideId'], bookingId: intent['bookingId'] },
        });
        if (!walletResult.success) {
          await saveIntent(paymentIntentId, { ...intent, status: 'failed' });
          res.status(400).json({ success: false, error: walletResult.error || 'Wallet payment failed', code: 'WALLET_PAYMENT_FAILED', timestamp: new Date().toISOString() });
          return;
        }
      } else if (method === 'card') {
        // Stripe is the authority. Retrieve the intent and believe only what it
        // says; the client cannot talk us into a success.
        const stripe = getStripe();
        if (!stripe || !intent['stripeIntentId']) {
          res.status(503).json({ success: false, error: 'Card payments are not available right now', code: 'CARD_PAYMENTS_UNAVAILABLE', timestamp: new Date().toISOString() });
          return;
        }

        let stripeStatus: string | undefined;
        try {
          const stripeIntent = await stripe.paymentIntents.retrieve(intent['stripeIntentId']);
          stripeStatus = stripeIntent?.status;
        } catch (stripeErr: any) {
          logger.error('Could not retrieve Stripe intent during confirmation', {
            error: stripeErr.message, paymentIntentId,
          });
          res.status(502).json({ success: false, error: 'Could not reach the card processor. Please try again.', code: 'CARD_PROCESSOR_ERROR', timestamp: new Date().toISOString() });
          return;
        }

        if (stripeStatus !== 'succeeded') {
          await saveIntent(paymentIntentId, { ...intent, status: 'pending', stripeStatus });
          res.status(402).json({
            success: false,
            error: 'This payment has not been completed with the card processor yet',
            code: 'PAYMENT_NOT_SETTLED',
            data: { status: 'pending', stripeStatus },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      } else {
        // Mobile money settles through the provider's signed webhook, which is
        // the only place a mobile-money payment is ever marked paid. Cash is
        // settled by the driver confirming receipt, not here.
        // Worded for a passenger, not a developer: older app builds surface
        // this string to the user verbatim in an alert.
        res.status(400).json({
          success: false,
          error: method === 'mobile_money'
            ? 'Your seat is booked. Approve the payment prompt on your phone to confirm it, or cancel the booking for a full refund.'
            : 'Your seat is booked. Pay the driver directly when you meet.',
          code: 'CONFIRMATION_NOT_APPLICABLE',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updated = {
        ...intent,
        status: 'completed',
        confirmedAt: new Date().toISOString(),
        paymentMethodId,
        mobileMoneyPhone,
        mobileMoneyProvider,
      };
      await saveIntent(paymentIntentId, updated);

      // Payment state and booking state used to be entirely independent, so a
      // booking could sit CONFIRMED with nothing paid against it and no way to
      // tell from the booking alone. A settled payment now confirms its booking.
      if (intent['bookingId']) {
        try {
          const booking = await Booking.findByPk(intent['bookingId']);
          if (booking && booking.status === BookingStatus.PENDING) {
            await booking.update({ status: BookingStatus.CONFIRMED });
          }
        } catch (bookingErr) {
          // The money moved; failing to reflect it must not tell the payer the
          // payment failed. Loud log, successful response.
          logger.error('Payment settled but the booking could not be confirmed', {
            paymentIntentId, bookingId: intent['bookingId'], error: (bookingErr as Error).message,
          });
        }
      }

      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('confirmPayment error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async cancelPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const intent = await loadIntent(id);
      if (!intent) { res.status(404).json({ success: false, error: 'Payment intent not found', code: 'INTENT_NOT_FOUND', timestamp: new Date().toISOString() }); return; }
      if (intent['userId'] !== userId) { res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN', timestamp: new Date().toISOString() }); return; }

      if (intent['status'] === 'completed') {
        res.status(400).json({ success: false, error: 'Cannot cancel a completed payment', code: 'ALREADY_COMPLETED', timestamp: new Date().toISOString() });
        return;
      }

      const updated = { ...intent, status: 'cancelled', cancelledAt: new Date().toISOString() };
      await saveIntent(id, updated);

      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('cancelPayment error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async getPaymentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const intent = await loadIntent(id);
      if (!intent || intent['userId'] !== userId) {
        res.status(404).json({ success: false, error: 'Payment intent not found', code: 'INTENT_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      res.json({ success: true, data: intent, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('getPaymentStatus error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  // ─── Mobile Money ──────────────────────────────────────────────────────────

  async initiateMobileMoney(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { paymentIntentId, phone, provider } = req.body;
      if (!paymentIntentId || !phone || !provider) {
        res.status(400).json({ success: false, error: 'paymentIntentId, phone, and provider are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      if (!mobileMoneyService.isSupportedProvider(provider)) {
        res.status(400).json({ success: false, error: `Unsupported provider: ${provider}`, code: 'UNSUPPORTED_PROVIDER', timestamp: new Date().toISOString() });
        return;
      }

      // The intent has to exist and has to be the caller's. Previously a
      // missing intent silently became `amount = 0` and a push for nothing,
      // and no check tied the intent to the person initiating the payment.
      const intentRaw = await redisClient.get(`${INTENT_PREFIX}${paymentIntentId}`);
      const intent = intentRaw ? JSON.parse(intentRaw) : null;

      if (!intent) {
        res.status(404).json({ success: false, error: 'Payment intent not found or expired', code: 'INTENT_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      if (intent.userId !== userId) {
        res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN', timestamp: new Date().toISOString() });
        return;
      }

      if (intent.status === 'completed') {
        res.status(400).json({ success: false, error: 'This payment has already been completed', code: 'ALREADY_COMPLETED', timestamp: new Date().toISOString() });
        return;
      }

      const amount = Number(intent.amount);
      const currency = intent.currency ?? PLATFORM_DEFAULT_CURRENCY;

      if (!Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ success: false, error: 'This payment has no amount to collect', code: 'INVALID_AMOUNT', timestamp: new Date().toISOString() });
        return;
      }

      const reference = mobileMoneyService.generateReference();

      const result = await mobileMoneyService.initiate({
        phone, provider, reference,
        amount, currency,
        description: intent?.metadata?.rideId ? `ARYV ride payment` : `ARYV payment`,
      });

      // `purpose` is what tells the webhook what to do when the provider
      // confirms. Without it these records were indistinguishable from wallet
      // top-ups, and the webhook — which only acts on 'wallet_topup' — ignored
      // them, so a mobile-money ride payment could be initiated but could never
      // settle. The amount and booking are recorded here rather than re-read
      // later, so settlement cannot be steered by a subsequent request.
      await redisClient.set(
        `${MM_PREFIX}${reference}`,
        JSON.stringify({
          reference,
          phone,
          provider,
          paymentIntentId,
          userId,
          purpose: 'ride_payment',
          bookingId: intent?.bookingId ?? null,
          amount,
          currency,
          status: 'pending',
          createdAt: new Date().toISOString(),
        }),
        MM_TTL,
      );

      logger.info('Mobile money payment initiated', { phone, provider, reference });

      res.json({
        success: true,
        data: { reference, status: 'pending', ussdCode: result.ussdCode, deepLink: result.deepLink, instructions: result.instructions },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('initiateMobileMoney error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async checkMobileMoneyStatus(req: Request, res: Response): Promise<void> {
    try {
      const { reference } = req.params;
      if (!reference) {
        res.status(400).json({ success: false, error: 'reference is required', code: 'MISSING_REFERENCE', timestamp: new Date().toISOString() });
        return;
      }

      const raw = await redisClient.get(`${MM_PREFIX}${reference}`);
      if (!raw) {
        res.status(404).json({ success: false, error: 'Transaction not found or expired', code: 'TX_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const tx = JSON.parse(raw);

      // Poll the provider for current status
      let providerStatus = tx;
      if (mobileMoneyService.isSupportedProvider(tx.provider)) {
        const liveStatus = await mobileMoneyService.checkStatus(tx.provider, reference);
        providerStatus = { ...tx, ...liveStatus };
        // Persist updated status back to Redis
        if (liveStatus.status !== tx.status) {
          await redisClient.set(`${MM_PREFIX}${reference}`, JSON.stringify(providerStatus), MM_TTL);
        }
      }

      res.json({ success: true, data: providerStatus, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('checkMobileMoneyStatus error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  // ─── Wallet ────────────────────────────────────────────────────────────────

  async getWalletBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const result = await cashWalletService.getWalletBalance(userId);
      if (!result.success) {
        // Wallet might not exist yet — return zero balance
        res.json({ success: true, data: { available: 0, pending: 0, currency: 'USD', lastUpdated: new Date().toISOString() }, timestamp: new Date().toISOString() });
        return;
      }

      const w = result.data;
      res.json({
        success: true,
        data: {
          available: w?.availableBalance ?? 0,
          pending: w?.escrowBalance ?? 0,
          currency: w?.currency || 'USD',
          lastUpdated: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('getWalletBalance error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async topUpWallet(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { amount, currency, provider, phone } = req.body as {
        amount: number; currency?: string; provider?: string; phone?: string;
      };

      if (!amount || amount <= 0) {
        res.status(400).json({ success: false, error: 'Valid amount is required', code: 'INVALID_AMOUNT', timestamp: new Date().toISOString() });
        return;
      }

      // This used to credit the wallet immediately from the amount in the
      // request body, without taking a payment or verifying that one had been
      // made — so any authenticated user could mint balance from nothing. That
      // balance is real: settleCommission spends it, so a driver could clear
      // what they owe the platform for free.
      //
      // A top-up now only *initiates* a payment. The wallet is credited when
      // the provider confirms it, through the signed webhook.
      if (!provider) {
        res.status(400).json({ success: false, error: 'A mobile money provider is required', code: 'PROVIDER_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      // Ensure the wallet exists so the credit has somewhere to land later.
      const walletResult = await cashWalletService.getWalletBalance(userId);
      if (!walletResult.success || !walletResult.data) {
        await cashWalletService.createWallet(userId);
      }

      const reference = mobileMoneyService.generateReference();

      let initiated;
      try {
        initiated = await mobileMoneyService.initiate({
          provider: provider as any,
          amount,
          currency: currency || PLATFORM_DEFAULT_CURRENCY,
          reference,
          phone: phone || '',
          description: 'ARYV wallet top-up',
        } as any);
      } catch (initiateError) {
        res.status(400).json({ success: false, error: (initiateError as Error).message, code: 'PROVIDER_UNSUPPORTED', timestamp: new Date().toISOString() });
        return;
      }

      // Park the intent so the webhook can find it and know who to credit.
      await redisClient.set(
        `mm_tx:${reference}`,
        JSON.stringify({
          userId,
          amount,
          currency: currency || PLATFORM_DEFAULT_CURRENCY,
          provider,
          purpose: 'wallet_topup',
          status: 'pending',
          createdAt: new Date().toISOString(),
        }),
        86400,
      );

      logger.info('Wallet top-up initiated', { userId, reference, provider, amount });

      res.status(201).json({
        success: true,
        data: {
          id: reference,
          amount,
          currency: currency || PLATFORM_DEFAULT_CURRENCY,
          // Pending, not completed: nothing has been paid yet.
          status: 'pending',
          paymentMethod: 'mobile_money',
          provider,
          instructions: initiated.instructions,
          ussdCode: initiated.ussdCode,
          deepLink: initiated.deepLink,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('topUpWallet error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async requestPayout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { amount, currency, paymentMethodId } = req.body;
      if (!amount || amount <= 0) {
        res.status(400).json({ success: false, error: 'Valid amount is required', code: 'INVALID_AMOUNT', timestamp: new Date().toISOString() });
        return;
      }

      // Payouts are not built. This used to mint a payout id, log "queued for
      // processing", and tell the driver their money would arrive in two
      // business days — while debiting nothing, queueing nothing, and paying
      // nothing. Someone waiting on earnings would have waited forever, with a
      // reference number that meant nothing.
      //
      // Saying so is the only honest answer until there is a payout rail.
      logger.warn('Payout requested but payouts are not implemented', {
        userId, amount, currency, paymentMethodId,
      });

      res.status(501).json({
        success: false,
        error: 'Payouts are not available yet. Contact support to arrange a withdrawal.',
        code: 'PAYOUTS_NOT_AVAILABLE',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('requestPayout error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  // ─── Transactions ──────────────────────────────────────────────────────────

  async getTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const page = parseInt(req.query['page'] as string) || 1;
      const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);

      const offset = (page - 1) * limit;
      const result = await cashWalletService.getTransactionHistory(userId, limit, offset);
      if (!result.success) {
        res.status(500).json({ success: false, error: result.error || 'Failed to fetch transactions', code: 'FETCH_TRANSACTIONS_FAILED', timestamp: new Date().toISOString() });
        return;
      }

      // Map CashTransaction shape to PaymentTransaction shape expected by mobile app
      const transactions = (result.data?.transactions || []).map((t: any) => ({
        id: t.id,
        amount: t.amount,
        fee: t.fee || 0,
        netAmount: t.amount - (t.fee || 0),
        currency: 'USD',
        status: t.status || 'completed',
        type: t.type === 'payment' ? 'ride_payment' : t.type === 'load' ? 'wallet_topup' : t.type,
        paymentMethod: 'wallet',
        provider: 'cash',
        description: t.description || '',
        createdAt: t.createdAt,
        completedAt: t.updatedAt,
      }));

      res.json({
        success: true,
        data: { transactions, total: result.data?.total || transactions.length, page },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('getTransactions error', { error: (error as Error).message, userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async getTransactionDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const result = await cashWalletService.getTransactionHistory(userId, 1000, 0);
      const tx = (result.data?.transactions || []).find((t: any) => t.id === id);
      if (!tx) { res.status(404).json({ success: false, error: 'Transaction not found', code: 'TX_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      res.json({ success: true, data: tx, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('getTransactionDetails error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  // ─── Refunds ───────────────────────────────────────────────────────────────

  async requestRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { transactionId, reason, amount } = req.body;
      if (!transactionId || !reason) {
        res.status(400).json({ success: false, error: 'transactionId and reason are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      // This wrote a log line and returned a generated id with status
      // 'pending'. Nothing was recorded anywhere, so a user was told their
      // refund request had been accepted and no human would ever see it.
      // Answering honestly is better than a receipt for something that did not
      // happen.
      const refundId = `refund_${crypto.randomBytes(8).toString('hex')}`;

      await redisClient.set(
        `refund_request:${refundId}`,
        JSON.stringify({
          refundId,
          userId,
          transactionId,
          reason,
          amount: amount ?? null,
          status: 'awaiting_review',
          requestedAt: new Date().toISOString(),
        }),
        30 * 24 * 60 * 60,
      );

      logger.warn('Refund requested — no automated refund path exists; needs manual handling', {
        userId, transactionId, reason, amount, refundId,
      });

      res.json({
        success: true,
        data: {
          refundId,
          status: 'awaiting_review',
          amount: amount ?? null,
          message: 'Your request has been recorded. Refunds are handled manually; '
            + 'our team will contact you.',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('requestRefund error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }
}

export default PaymentController;
