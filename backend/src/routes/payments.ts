/**
 * @fileoverview Payment API routes — cards, mobile money, wallet, transactions
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { PaymentController } from '../controllers/PaymentController';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const controller = new PaymentController();

const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many payment requests, please try again later', code: 'RATE_LIMIT_EXCEEDED' },
});

// All payment routes require authentication
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

router.post(
  '/intents',
  paymentRateLimit,
  [
    body('amount').isFloat({ min: 0.01 }),
    body('currency').isLength({ min: 3, max: 3 }).isAlpha(),
    body('paymentMethod').notEmpty(),
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

export default router;
