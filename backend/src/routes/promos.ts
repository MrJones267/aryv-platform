/**
 * @fileoverview Promo code routes — validate, apply, and manage discount codes
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { Response } from 'express';
import { redisClient } from '../config/redis';
import logger from '../utils/logger';

const router = Router();

const promoRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many promo requests', code: 'RATE_LIMIT_EXCEEDED' },
});

// Built-in promo codes — in production these would be in the DB
const BUILT_IN_PROMOS: Record<string, object> = {
  WELCOME50: { code: 'WELCOME50', type: 'percentage', value: 50, description: '50% off your first ride', maxDiscount: 100, isActive: true },
  ARYV2026: { code: 'ARYV2026', type: 'fixed', value: 20, currency: 'BWP', description: 'BWP 20 off any ride', isActive: true },
  FREERIDE: { code: 'FREERIDE', type: 'percentage', value: 100, description: 'Free ride (up to BWP 50)', maxDiscount: 50, isActive: true },
};

/**
 * POST /api/promos/validate
 * Validate a promo code and return discount details
 */
router.post(
  '/validate',
  promoRateLimit,
  authenticateToken,
  [body('code').notEmpty().isLength({ min: 2, max: 30 })],
  validateInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { code } = req.body as { code: string };
      const normalised = code.toUpperCase().trim();
      const userId = req.user?.id;

      // Check usage count in Redis — limit 1 use per user per code
      const usageKey = `promo_use:${normalised}:${userId}`;
      const alreadyUsed = await redisClient.get(usageKey);
      if (alreadyUsed) {
        res.status(400).json({ success: false, error: 'Promo code already used', code: 'PROMO_ALREADY_USED', timestamp: new Date().toISOString() });
        return;
      }

      const promo = BUILT_IN_PROMOS[normalised];
      if (!promo) {
        res.status(404).json({ success: false, error: 'Invalid or expired promo code', code: 'PROMO_INVALID', timestamp: new Date().toISOString() });
        return;
      }

      logger.info('Promo code validated', { code: normalised, userId });
      res.json({ success: true, data: { promo }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in promo validate', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  },
);

/**
 * POST /api/promos/apply
 * Mark a promo code as used after a successful booking
 */
router.post(
  '/apply',
  promoRateLimit,
  authenticateToken,
  [body('code').notEmpty(), body('rideId').notEmpty()],
  validateInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { code, rideId } = req.body as { code: string; rideId: string };
      const normalised = code.toUpperCase().trim();
      const userId = req.user?.id;

      const promo = BUILT_IN_PROMOS[normalised];
      if (!promo) {
        res.status(404).json({ success: false, error: 'Invalid promo code', code: 'PROMO_INVALID', timestamp: new Date().toISOString() });
        return;
      }

      // Mark as used for 1 year
      const usageKey = `promo_use:${normalised}:${userId}`;
      await redisClient.set(usageKey, JSON.stringify({ rideId, appliedAt: new Date().toISOString() }), 365 * 24 * 3600);

      logger.info('Promo code applied', { code: normalised, userId, rideId });
      res.json({ success: true, message: 'Promo code applied', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in promo apply', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  },
);

export default router;
