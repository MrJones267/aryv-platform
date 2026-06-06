/**
 * @fileoverview Promo code routes — validate, apply, and manage discount codes
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-05-18
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { validateInput } from '../middleware/validation';
import { authenticateToken, authenticateAdminToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { Response, Request } from 'express';
import { redisClient } from '../config/redis';
import PromoCode from '../models/PromoCode';
import logger from '../utils/logger';

const router = Router();

const promoRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many promo requests', code: 'RATE_LIMIT_EXCEEDED' },
  store: makeStore('promos'),
});

// ─── Seed built-in promos on startup ─────────────────────────────────────────

export async function seedBuiltInPromos(): Promise<void> {
  const builtIn = [
    { code: 'WELCOME50', type: 'percentage' as const, value: 50, maxDiscount: 100, description: '50% off your first ride' },
    { code: 'ARYV2026', type: 'fixed' as const, value: 20, maxDiscount: null, description: 'BWP 20 off any ride' },
    { code: 'FREERIDE', type: 'percentage' as const, value: 100, maxDiscount: 50, description: 'Free ride (up to BWP 50)' },
  ];

  for (const promo of builtIn) {
    await PromoCode.findOrCreate({
      where: { code: promo.code },
      defaults: { ...promo, minOrderAmount: 0, isActive: true },
    });
  }
}

// ─── User routes ──────────────────────────────────────────────────────────────

/**
 * POST /api/promos/validate
 */
router.post(
  '/validate',
  promoRateLimit,
  authenticateToken,
  [
    body('code').notEmpty().isLength({ min: 2, max: 20 }).withMessage('Invalid code format'),
    body('orderAmount').optional().isFloat({ min: 0 }).withMessage('Order amount must be a positive number'),
  ],
  validateInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { code, orderAmount = 0 } = req.body as { code: string; orderAmount?: number };
      const normalised = code.toUpperCase().trim();
      const userId = req.user?.id;

      const promo = await PromoCode.findOne({ where: { code: normalised } });
      if (!promo) {
        res.status(404).json({ success: false, error: 'Invalid or expired promo code', code: 'PROMO_INVALID', timestamp: new Date().toISOString() });
        return;
      }

      const validity = promo.isValid(orderAmount);
      if (!validity.valid) {
        res.status(400).json({ success: false, error: validity.reason, code: 'PROMO_INVALID', timestamp: new Date().toISOString() });
        return;
      }

      // Check per-user usage (Redis-backed for speed, falls back gracefully)
      const usageKey = `promo_use:${normalised}:${userId}`;
      const alreadyUsed = await redisClient.get(usageKey);
      if (alreadyUsed) {
        res.status(400).json({ success: false, error: 'Promo code already used', code: 'PROMO_ALREADY_USED', timestamp: new Date().toISOString() });
        return;
      }

      const discount = promo.calculateDiscount(orderAmount);
      logger.info('Promo code validated', { code: normalised, userId, discount });

      res.json({
        success: true,
        data: {
          code: promo.code,
          type: promo.type,
          value: promo.value,
          maxDiscount: promo.maxDiscount,
          description: promo.description,
          discount,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in promo validate', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  },
);

/**
 * POST /api/promos/apply
 */
router.post(
  '/apply',
  promoRateLimit,
  authenticateToken,
  [
    body('code').notEmpty().isLength({ min: 2, max: 20 }),
    body('rideId').notEmpty().isUUID(),
    body('orderAmount').isFloat({ min: 0 }),
  ],
  validateInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { code, rideId, orderAmount } = req.body as { code: string; rideId: string; orderAmount: number };
      const normalised = code.toUpperCase().trim();
      const userId = req.user?.id;

      const promo = await PromoCode.findOne({ where: { code: normalised } });
      if (!promo) {
        res.status(404).json({ success: false, error: 'Invalid promo code', code: 'PROMO_INVALID', timestamp: new Date().toISOString() });
        return;
      }

      const validity = promo.isValid(orderAmount);
      if (!validity.valid) {
        res.status(400).json({ success: false, error: validity.reason, code: 'PROMO_INVALID', timestamp: new Date().toISOString() });
        return;
      }

      // Mark as used per-user
      const usageKey = `promo_use:${normalised}:${userId}`;
      await redisClient.set(usageKey, JSON.stringify({ rideId, appliedAt: new Date().toISOString() }), 365 * 24 * 3600);

      // Increment global usage count
      await promo.increment('usedCount');

      const discount = promo.calculateDiscount(orderAmount);
      logger.info('Promo code applied', { code: normalised, userId, rideId, discount });

      res.json({
        success: true,
        message: 'Promo code applied',
        data: { discount },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in promo apply', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  },
);

// ─── Admin routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/promos/admin/list
 */
router.get(
  '/admin/list',
  authenticateAdminToken,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const promos = await PromoCode.findAll({ order: [['created_at', 'DESC']] });
      res.json({ success: true, data: promos, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to list promos', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  },
);

/**
 * POST /api/promos/admin/create
 */
router.post(
  '/admin/create',
  authenticateAdminToken,
  [
    body('code').notEmpty().isLength({ min: 2, max: 20 }).matches(/^[A-Z0-9_]+$/).withMessage('Code must be uppercase alphanumeric'),
    body('type').isIn(['percentage', 'fixed']),
    body('value').isFloat({ min: 0.01 }),
    body('maxDiscount').optional().isFloat({ min: 0 }),
    body('minOrderAmount').optional().isFloat({ min: 0 }),
    body('usageLimit').optional().isInt({ min: 1 }),
    body('expiresAt').optional().isISO8601(),
    body('description').optional().isLength({ max: 500 }),
  ],
  validateInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { code, type, value, maxDiscount, minOrderAmount = 0, usageLimit, expiresAt, description } = req.body;
      const normalised = (code as string).toUpperCase().trim();

      const existing = await PromoCode.findOne({ where: { code: normalised } });
      if (existing) {
        res.status(409).json({ success: false, error: 'Promo code already exists', code: 'PROMO_EXISTS', timestamp: new Date().toISOString() });
        return;
      }

      const promo = await PromoCode.create({
        code: normalised, type, value, maxDiscount: maxDiscount ?? null,
        minOrderAmount, usageLimit: usageLimit ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        description: description ?? null,
        createdBy: req.user?.id ?? null,
        isActive: true,
      });

      logger.info('Promo code created', { code: normalised, createdBy: req.user?.id });
      res.status(201).json({ success: true, data: promo, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error creating promo', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Failed to create promo', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  },
);

/**
 * PATCH /api/promos/admin/:id/toggle
 */
router.patch(
  '/admin/:id/toggle',
  authenticateAdminToken,
  [param('id').isUUID()],
  validateInput,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const promo = await PromoCode.findByPk(req.params['id']);
      if (!promo) {
        res.status(404).json({ success: false, error: 'Promo not found', code: 'PROMO_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }
      await promo.update({ isActive: !promo.isActive });
      res.json({ success: true, data: { id: promo.id, isActive: promo.isActive }, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to toggle promo', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  },
);

/**
 * DELETE /api/promos/admin/:id
 */
router.delete(
  '/admin/:id',
  authenticateAdminToken,
  [param('id').isUUID()],
  validateInput,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const promo = await PromoCode.findByPk(req.params['id']);
      if (!promo) {
        res.status(404).json({ success: false, error: 'Promo not found', code: 'PROMO_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }
      await promo.destroy();
      res.json({ success: true, message: 'Promo code deleted', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to delete promo', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  },
);

export default router;
