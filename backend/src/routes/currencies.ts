/**
 * @fileoverview Currency routes for multi-currency support
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, query } from 'express-validator';
import { CurrencyController } from '../controllers/CurrencyController';
import { authenticateToken } from '../middleware/auth';
import { validateInput } from '../middleware/validation';

const router = express.Router();

// Rate limiting for currency operations
const currencyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many currency requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all currency routes
router.use(currencyRateLimit);

/**
 * @route GET /api/currencies
 * @description Get all available currencies
 * @access Public
 */
router.get('/', (req: Request, res: Response) => CurrencyController.getCurrencies(req, res));

/**
 * @route GET /api/currencies/popular
 * @description Get popular currencies by region
 * @access Public
 */
router.get(
  '/popular',
  [
    query('region')
      .optional()
      .isString()
      .isIn(['north-america', 'europe', 'asia', 'africa', 'south-america', 'oceania', 'global'])
      .withMessage('Invalid region specified'),
  ],
  validateInput,
  ((req: any, res: any) => CurrencyController.getPopularCurrencies(req, res)) as any,
);

/**
 * @route GET /api/currencies/user
 * @description Get user's currency preferences
 * @access Private
 */
router.get('/user', authenticateToken, (req: Request, res: Response) => CurrencyController.getUserCurrencies(req as any, res));

/**
 * @route PUT /api/currencies/user/primary
 * @description Set user's primary currency
 * @access Private
 */
router.put(
  '/user/primary',
  [
    body('currencyCode')
      .notEmpty()
      .withMessage('Currency code is required')
      .isString()
      .withMessage('Currency code must be a string')
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency code must be exactly 3 characters')
      .matches(/^[A-Z]{3}$/)
      .withMessage('Currency code must be 3 uppercase letters'),
  ],
  authenticateToken,
  validateInput,
  ((req: any, res: any) => CurrencyController.setPrimaryCurrency(req, res)) as any,
);

/**
 * @route POST /api/currencies/user/payment
 * @description Add currency to user's payment options
 * @access Private
 */
router.post(
  '/user/payment',
  [
    body('currencyCode')
      .notEmpty()
      .withMessage('Currency code is required')
      .isString()
      .withMessage('Currency code must be a string')
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency code must be exactly 3 characters')
      .matches(/^[A-Z]{3}$/)
      .withMessage('Currency code must be 3 uppercase letters'),
  ],
  authenticateToken,
  validateInput,
  ((req: any, res: any) => CurrencyController.addPaymentCurrency(req, res)) as any,
);

/**
 * @route DELETE /api/currencies/user/payment/:currencyCode
 * @description Remove currency from user's payment options
 * @access Private
 */
router.delete(
  '/user/payment/:currencyCode',
  [
    param('currencyCode')
      .notEmpty()
      .withMessage('Currency code is required')
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency code must be exactly 3 characters')
      .matches(/^[A-Z]{3}$/)
      .withMessage('Currency code must be 3 uppercase letters'),
  ],
  authenticateToken,
  validateInput,
  ((req: any, res: any) => CurrencyController.removePaymentCurrency(req, res)) as any,
);

/**
 * @route POST /api/currencies/convert
 * @description Convert amount between currencies
 * @access Public (with rate limiting)
 */
router.post(
  '/convert',
  [
    body('fromCurrency')
      .notEmpty()
      .withMessage('Source currency is required')
      .isString()
      .withMessage('Source currency must be a string')
      .isLength({ min: 3, max: 3 })
      .withMessage('Source currency must be exactly 3 characters')
      .matches(/^[A-Z]{3}$/)
      .withMessage('Source currency must be 3 uppercase letters'),
    body('toCurrency')
      .notEmpty()
      .withMessage('Target currency is required')
      .isString()
      .withMessage('Target currency must be a string')
      .isLength({ min: 3, max: 3 })
      .withMessage('Target currency must be exactly 3 characters')
      .matches(/^[A-Z]{3}$/)
      .withMessage('Target currency must be 3 uppercase letters'),
    body('amount')
      .notEmpty()
      .withMessage('Amount is required')
      .isNumeric()
      .withMessage('Amount must be a number')
      .custom((value) => {
        const num = parseFloat(value);
        if (num <= 0) {
          throw new Error('Amount must be positive');
        }
        if (num > 10000) {
          throw new Error('Amount exceeds maximum conversion limit');
        }
        return true;
      }),
  ],
  validateInput,
  ((req: any, res: any) => CurrencyController.convertCurrency(req, res)) as any,
);

/**
 * @route POST /api/currencies/exchange-rates/update
 * @description Update exchange rates from external API (Admin only)
 * @access Private (Admin)
 */
router.post(
  '/exchange-rates/update',
  authenticateToken,
  // Note: Admin role check is done in the controller
  (req: Request, res: Response) => CurrencyController.updateExchangeRates(req, res),
);

// More restrictive rate limiting for conversion endpoint
const conversionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 conversions per minute
  message: {
    success: false,
    error: 'Too many conversion requests. Please try again later.',
    code: 'CONVERSION_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply stricter rate limiting to conversion endpoint
router.use('/convert', conversionRateLimit);

export default router;
