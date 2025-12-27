/**
 * @fileoverview Cash payment routes with validation
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import CashPaymentController from '../controllers/CashPaymentController';
import { authenticateToken } from '../middleware/auth';
import { validateInput } from '../middleware/validation';

const router = Router();
const cashPaymentController = new CashPaymentController();

// Rate limiting for cash payment operations
const cashPaymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each user to 10 cash payment operations per 15 minutes
  message: 'Too many cash payment attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const confirmationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit confirmation attempts to prevent brute force
  message: 'Too many confirmation attempts, please try again later',
});

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/payments/cash/create
 * @desc    Create a new cash payment transaction
 * @access  Private
 */
router.post('/create',
  cashPaymentRateLimit,
  [
    body('bookingId')
      .isUUID()
      .withMessage('Valid booking ID is required'),

    body('driverId')
      .isUUID()
      .withMessage('Valid driver ID is required'),

    body('amount')
      .isFloat({ min: 0.01, max: 10000.00 })
      .withMessage('Amount must be between $0.01 and $10,000.00'),

    validateInput,
  ],
  (req: Request, res: Response) => cashPaymentController.createCashPayment(req as any, res),
);

/**
 * @route   POST /api/payments/cash/:transactionId/confirm-received
 * @desc    Driver confirms cash received
 * @access  Private (Driver only)
 */
router.post('/:transactionId/confirm-received',
  confirmationRateLimit,
  [
    param('transactionId')
      .isUUID()
      .withMessage('Valid transaction ID is required'),

    body('actualAmount')
      .isFloat({ min: 0.01, max: 10000.00 })
      .withMessage('Actual amount must be between $0.01 and $10,000.00'),

    body('location')
      .optional()
      .isObject()
      .withMessage('Location must be an object'),

    body('location.lat')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),

    body('location.lng')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),

    body('location.accuracy')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Accuracy must be a positive number'),

    validateInput,
  ],
  (req: Request, res: Response) => cashPaymentController.confirmCashReceived(req as any, res),
);

/**
 * @route   POST /api/payments/cash/:transactionId/confirm-paid
 * @desc    Rider confirms cash payment made
 * @access  Private (Rider only)
 */
router.post('/:transactionId/confirm-paid',
  confirmationRateLimit,
  [
    param('transactionId')
      .isUUID()
      .withMessage('Valid transaction ID is required'),

    body('confirmationCode')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('Confirmation code must be a 6-digit number'),

    validateInput,
  ],
  (req: Request, res: Response) => cashPaymentController.confirmCashPaid(req as any, res),
);

/**
 * @route   GET /api/payments/cash/:transactionId
 * @desc    Get cash transaction details
 * @access  Private
 */
router.get('/:transactionId',
  [
    param('transactionId')
      .isUUID()
      .withMessage('Valid transaction ID is required'),

    validateInput,
  ],
  ((req: any, res: any) => cashPaymentController.getCashTransaction(req, res)) as any,
);

/**
 * @route   GET /api/payments/cash/history
 * @desc    Get user's cash transaction history
 * @access  Private
 */
router.get('/history',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),

    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),

    query('status')
      .optional()
      .isIn([
        'pending_verification',
        'driver_confirmed',
        'rider_confirmed',
        'both_confirmed',
        'disputed',
        'completed',
        'failed',
        'expired',
      ])
      .withMessage('Invalid status filter'),

    validateInput,
  ],
  ((req: any, res: any) => cashPaymentController.getCashTransactionHistory(req, res)) as any,
);

/**
 * @route   GET /api/payments/cash/wallet
 * @desc    Get user's wallet information and trust score
 * @access  Private
 */
router.get('/wallet',
  (req: Request, res: Response) => cashPaymentController.getWalletInfo(req as any, res),
);

/**
 * @route   POST /api/payments/cash/:transactionId/dispute
 * @desc    Report a dispute with cash transaction
 * @access  Private
 */
router.post('/:transactionId/dispute',
  [
    param('transactionId')
      .isUUID()
      .withMessage('Valid transaction ID is required'),

    body('reason')
      .isIn([
        'amount_discrepancy',
        'no_payment_received',
        'no_cash_provided',
        'driver_fraud',
        'rider_fraud',
        'wrong_amount',
        'driver_issue',
        'rider_issue',
        'other',
      ])
      .withMessage('Invalid dispute reason'),

    body('description')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),

    body('evidence')
      .optional()
      .isArray()
      .withMessage('Evidence must be an array'),

    validateInput,
  ],
  ((req: any, res: any) => cashPaymentController.reportDispute(req, res)) as any,
);

export default router;
