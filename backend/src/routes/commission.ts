/**
 * @fileoverview Commission routes — driver commission balance, settlement,
 *               and ledger history.
 * @author Oabona-Majoko
 * @created 2026-06-17
 * @lastModified 2026-06-17
 */

import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import CommissionController from '../controllers/CommissionController';
import { authenticateToken } from '../middleware/auth';
import { validateInput } from '../middleware/validation';
import { SettlementMethod } from '../models/CommissionLedger';

const router = Router();
const commissionController = new CommissionController();

const settlementRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many settlement attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('commission-settle'),
});

router.use(authenticateToken);

/**
 * @route   GET /api/payments/commission/balance
 * @desc    Get the authenticated driver's outstanding commission balance
 * @access  Private (Driver)
 */
router.get('/balance',
  (req: Request, res: Response) => commissionController.getBalance(req as any, res),
);

/**
 * @route   GET /api/payments/commission/ledger
 * @desc    Get the authenticated driver's commission ledger history
 * @access  Private (Driver)
 */
router.get('/ledger',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    validateInput,
  ],
  ((req: any, res: any) => commissionController.getLedger(req, res)) as any,
);

/**
 * @route   POST /api/payments/commission/settle
 * @desc    Settle owed commission. Drivers settle their own via wallet
 *          deduction; admins may record offline settlements for any driver.
 * @access  Private (Driver / Admin)
 */
router.post('/settle',
  settlementRateLimit,
  [
    body('amount')
      .isFloat({ min: 0.01, max: 100000.00 })
      .withMessage('Amount must be greater than 0'),
    body('method')
      .optional()
      .isIn(Object.values(SettlementMethod))
      .withMessage('Invalid settlement method'),
    body('driverId')
      .optional()
      .isUUID()
      .withMessage('driverId must be a valid UUID'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be at most 500 characters'),
    validateInput,
  ],
  (req: Request, res: Response) => commissionController.settle(req as any, res),
);

export default router;
