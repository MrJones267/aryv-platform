/**
 * @fileoverview Payment API routes — cards, mobile money, wallet, transactions
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { rateLimitKey } from '../config/rateLimitKey';
import { PaymentController } from '../controllers/PaymentController';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { verifyOrangeMoneyWebhook, verifyMyZakaWebhook, verifySmegaWebhook } from '../services/MobileMoneyService';
import cashWalletService from '../services/CashWalletService';
import { redisClient } from '../config/redis';
import Booking from '../models/Booking';
import { BookingStatus } from '../types';
import logger from '../utils/logger';

const router = Router();
const controller = new PaymentController();

const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many payment requests, please try again later', code: 'RATE_LIMIT_EXCEEDED' },
  store: makeStore('payments'),
  keyGenerator: rateLimitKey,
});

// ─── Mobile Money Webhooks (no auth — providers call these) ──────────────────
//
// Registered BEFORE the authentication middleware below, which is the whole
// point. They used to be declared at the bottom of this file, underneath
// `router.use(authenticateToken)`, so every provider callback was answered with
// 401 ACCESS_TOKEN_REQUIRED — a payment provider has no user token to send.
// Nothing could settle: not a wallet top-up, not a ride paid by mobile money.
// Their own signature check is what authenticates them, and it fails closed.
router.post('/mobile-money/webhook/orange', webhookHandler(verifyOrangeMoneyWebhook, 'OrangeMoney'));
router.post('/mobile-money/webhook/myzaka', webhookHandler(verifyMyZakaWebhook, 'MyZaka'));
router.post('/mobile-money/webhook/smega', webhookHandler(verifySmegaWebhook, 'Smega'));

// Every remaining payment route requires authentication.
router.use(authenticateToken);

// ─── Payment Methods ──────────────────────────────────────────────────────────

router.get('/methods', paymentRateLimit, controller.getPaymentMethods.bind(controller));

router.post(
  '/methods/card',
  paymentRateLimit,
  [
    body('cardNumber').notEmpty().withMessage('Card number is required'),
    body('expiryMonth').isInt({ min: 1, max: 12 }),
    body('expiryYear').isInt({ min: new Date().getFullYear() }),
    body('cvv').isLength({ min: 3, max: 4 }).isNumeric(),
    body('cardholderName').notEmpty(),
  ],
  validateInput,
  controller.addCard.bind(controller),
);

router.post(
  '/methods/mobile-money',
  paymentRateLimit,
  [
    body('phone').isMobilePhone('any'),
    body('provider').notEmpty(),
  ],
  validateInput,
  controller.addMobileMoney.bind(controller),
);

router.delete(
  '/methods/:id',
  paymentRateLimit,
  [param('id').notEmpty()],
  validateInput,
  controller.removePaymentMethod.bind(controller),
);

router.put(
  '/methods/:id/default',
  paymentRateLimit,
  [param('id').notEmpty()],
  validateInput,
  controller.setDefaultPaymentMethod.bind(controller),
);

// ─── Payment Intents ──────────────────────────────────────────────────────────

// `amount` and `currency` are intentionally not accepted: both are read from
// the booking server-side. Sending them has no effect.
//
// `bookingId` is what a current client sends. `rideId` is accepted only for the
// app builds already on people's phones, which raise the intent before they
// book — see the compatibility path in createPaymentIntent. One of the two is
// required; neither carries any authority over the amount.
router.post(
  '/intents',
  paymentRateLimit,
  [
    body('bookingId').optional().isUUID().withMessage('bookingId must be a valid booking UUID'),
    body('rideId').optional().isUUID().withMessage('rideId must be a valid ride UUID'),
    body('paymentMethod').isIn(['card', 'wallet', 'mobile_money', 'cash'])
      .withMessage('paymentMethod must be one of card, wallet, mobile_money, cash'),
  ],
  validateInput,
  controller.createPaymentIntent.bind(controller),
);

router.post(
  '/confirm',
  paymentRateLimit,
  [body('paymentIntentId').notEmpty()],
  validateInput,
  controller.confirmPayment.bind(controller),
);

router.post(
  '/intents/:id/cancel',
  paymentRateLimit,
  [param('id').notEmpty()],
  validateInput,
  controller.cancelPayment.bind(controller),
);

router.get(
  '/intents/:id',
  paymentRateLimit,
  [param('id').notEmpty()],
  validateInput,
  controller.getPaymentStatus.bind(controller),
);

// ─── Mobile Money ─────────────────────────────────────────────────────────────

router.post(
  '/mobile-money/initiate',
  paymentRateLimit,
  [body('paymentIntentId').notEmpty(), body('phone').isMobilePhone('any'), body('provider').notEmpty()],
  validateInput,
  controller.initiateMobileMoney.bind(controller),
);

router.get('/mobile-money/status/:reference', paymentRateLimit, controller.checkMobileMoneyStatus.bind(controller));

// ─── Wallet ───────────────────────────────────────────────────────────────────

router.get('/wallet/balance', paymentRateLimit, controller.getWalletBalance.bind(controller));

router.post(
  '/wallet/topup',
  paymentRateLimit,
  [body('amount').isFloat({ min: 0.01 }), body('currency').optional().isLength({ min: 3, max: 3 })],
  validateInput,
  controller.topUpWallet.bind(controller),
);

router.post(
  '/wallet/payout',
  paymentRateLimit,
  [body('amount').isFloat({ min: 0.01 }), body('paymentMethodId').notEmpty()],
  validateInput,
  controller.requestPayout.bind(controller),
);

// ─── Transactions ─────────────────────────────────────────────────────────────

router.get(
  '/transactions',
  paymentRateLimit,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateInput,
  controller.getTransactions.bind(controller),
);

router.get(
  '/transactions/:id',
  paymentRateLimit,
  [param('id').isUUID().withMessage('Transaction ID must be a valid UUID')],
  validateInput,
  controller.getTransactionDetails.bind(controller),
);

// ─── Refunds ─────────────────────────────────────────────────────────────────

router.post(
  '/refunds',
  paymentRateLimit,
  [body('transactionId').notEmpty(), body('reason').notEmpty().isLength({ min: 5, max: 500 })],
  validateInput,
  controller.requestRefund.bind(controller),
);

// ─── Mobile Money Webhooks (no auth — provider calls these) ──────────────────

function webhookHandler(
  verifyFn: (payload: string, sig: string) => boolean,
  providerName: string,
) {
  return async (req: Request, res: Response): Promise<void> => {
  try {
    const sig = (req.headers['x-signature'] || req.headers['x-webhook-signature'] || '') as string;
    const payload = JSON.stringify(req.body);

    let signatureValid = false;
    try {
      signatureValid = verifyFn(payload, sig);
    } catch {
      // timingSafeEqual throws when the buffers differ in length, so a
      // malformed signature reached the catch below as a 500 rather than
      // being refused.
      signatureValid = false;
    }

    if (!signatureValid) {
      logger.warn(`${providerName} webhook signature invalid`);
      res.status(401).json({ success: false, error: 'Invalid signature' });
      return;
    }

    const { reference, status, providerRef } = req.body as {
      reference: string; status: string; providerRef?: string;
    };

    if (reference) {
      const MM_PREFIX = 'mm_tx:';
      const raw = await redisClient.get(`${MM_PREFIX}${reference}`);
      if (raw) {
        const tx = JSON.parse(raw);

        // Credit the wallet here, and only here: this is the one point where
        // the provider has told us — over a signed webhook — that money
        // actually moved. The top-up endpoint no longer credits anything.
        const isSuccess = ['success', 'successful', 'completed', 'paid'].includes(
          String(status).toLowerCase(),
        );
        const alreadyCredited = tx.status === 'credited';

        if (isSuccess && !alreadyCredited && tx.purpose === 'wallet_topup' && tx.userId) {
          const load = await cashWalletService.loadWallet({
            userId: tx.userId,
            amount: Number(tx.amount),
            source: 'mobile_money',
            sourceReference: providerRef || reference,
            metadata: { description: `Wallet top-up via ${providerName}`, reference },
          });

          if (load.success) {
            // `alreadyCredited` means the ledger's unique index refused a
            // repeat — the provider is retrying a webhook we already handled.
            // Either way this reference is settled and must not be credited
            // again, whatever the Redis record happens to say.
            tx.status = 'credited';
            logger.info(
              load.alreadyCredited
                ? 'Mobile money webhook replayed — already credited, ignoring'
                : 'Wallet credited from confirmed mobile money payment',
              { reference, userId: tx.userId, amount: tx.amount },
            );
          } else {
            // Left uncredited deliberately: a retry of the same webhook can
            // pick it up, and the alternative is losing a real payment.
            logger.error('Confirmed payment could not be credited to the wallet', {
              reference, userId: tx.userId, error: load.error,
            });
          }
        }

        // A mobile-money payment for a ride settles here and only here, for the
        // same reason a top-up does: this is where the provider tells us, over
        // a signed webhook, that money actually moved. Before this the record
        // carried no purpose, so it fell through both branches and a ride paid
        // by mobile money never completed.
        if (isSuccess && !alreadyCredited && tx.purpose === 'ride_payment' && tx.paymentIntentId) {
          const intentRaw = await redisClient.get(`payment_intent:${tx.paymentIntentId}`);
          const intent = intentRaw ? JSON.parse(intentRaw) : null;

          if (intent && intent.status !== 'completed') {
            await redisClient.set(
              `payment_intent:${tx.paymentIntentId}`,
              JSON.stringify({
                ...intent,
                status: 'completed',
                confirmedAt: new Date().toISOString(),
                providerRef: providerRef || reference,
              }),
              3600,
            );

            if (intent.bookingId) {
              const booking = await Booking.findByPk(intent.bookingId);
              if (booking && booking.status === BookingStatus.PENDING) {
                await booking.update({ status: BookingStatus.CONFIRMED });
              }
            }

            tx.status = 'credited';
            logger.info('Ride payment settled from confirmed mobile money payment', {
              reference, userId: tx.userId, bookingId: intent.bookingId, amount: tx.amount,
            });
          }
        }

        const updated = {
          ...tx,
          status: tx.status === 'credited' ? 'credited' : status,
          providerRef,
          updatedAt: new Date().toISOString(),
        };
        await redisClient.set(`${MM_PREFIX}${reference}`, JSON.stringify(updated), 86400);
        logger.info(`${providerName} webhook processed`, { reference, status });
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error(`${providerName} webhook error`, { error: (error as Error).message });
    res.status(500).json({ success: false });
    }
  };
}

export default router;
