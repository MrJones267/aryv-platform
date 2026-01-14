/**
 * @fileoverview Country routes for country and dialing code support
 * @author Oabona-Majoko
 * @created 2026-01-05
 * @lastModified 2026-01-05
 */

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { param, query } from 'express-validator';
import { CountryController } from '../controllers/CountryController';
import { validateInput } from '../middleware/validation';

const router = express.Router();

// Rate limiting for country operations
const countryRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window (higher than currency since it's mostly static data)
  message: {
    success: false,
    error: 'Too many country requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all country routes
router.use(countryRateLimit);

/**
 * @route GET /api/countries
 * @description Get all available countries with dialing codes
 * @access Public
 */
router.get('/', (req: Request, res: Response) => CountryController.getCountries(req, res));

/**
 * @route GET /api/countries/popular
 * @description Get popular countries
 * @access Public
 */
router.get('/popular', (req: Request, res: Response) => CountryController.getPopularCountries(req, res));

/**
 * @route GET /api/countries/search
 * @description Search countries by name, code, or dialing code
 * @access Public
 */
router.get(
  '/search',
  [
    query('q')
      .notEmpty()
      .withMessage('Search query is required')
      .isString()
      .withMessage('Search query must be a string')
      .isLength({ min: 1, max: 50 })
      .withMessage('Search query must be between 1 and 50 characters'),
  ],
  validateInput,
  (req: any, res: any) => CountryController.searchCountries(req, res),
);

/**
 * @route GET /api/countries/region/:region
 * @description Get countries by region
 * @access Public
 */
router.get(
  '/region/:region',
  [
    param('region')
      .notEmpty()
      .withMessage('Region is required')
      .isString()
      .withMessage('Region must be a string')
      .isIn(['North America', 'Europe', 'Asia', 'Africa', 'South America', 'Oceania'])
      .withMessage('Invalid region specified'),
  ],
  validateInput,
  (req: any, res: any) => CountryController.getCountriesByRegion(req, res),
);

/**
 * @route GET /api/countries/:countryCode
 * @description Get specific country by code
 * @access Public
 */
router.get(
  '/:countryCode',
  [
    param('countryCode')
      .notEmpty()
      .withMessage('Country code is required')
      .isLength({ min: 2, max: 3 })
      .withMessage('Country code must be 2-3 characters')
      .matches(/^[A-Z]{2,3}$/i)
      .withMessage('Country code must contain only letters'),
  ],
  validateInput,
  (req: any, res: any) => CountryController.getCountryByCode(req, res),
);

export default router;