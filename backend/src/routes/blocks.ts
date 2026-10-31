/**
 * @fileoverview Blocking and unblocking people
 * @author Oabona-Majoko
 * @created 2026-10-31
 * @lastModified 2026-10-31
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { rateLimitKey } from '../config/rateLimitKey';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import blockService, { BlockError } from '../services/BlockService';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';

const router = Router();
const blockLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many requests, please try again later', code: 'RATE_LIMIT_EXCEEDED' },
  store: makeStore('blocks'),
  keyGenerator: rateLimitKey,
});

router.use(authenticateToken);

const now = () => new Date().toISOString();
const fail = (res: any, error: unknown) => {
  if (error instanceof BlockError) {
    res.status(error.status).json({ success: false, error: error.message, code: error.code, timestamp: now() });
    return;
  }
  logger.error('Block request failed', { error: (error as Error).message });
  res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: now() });
};

/** @route GET /api/blocks — people I have blocked */
router.get('/', blockLimit, async (req: AuthenticatedRequest, res: any) => {
  try {
    res.json({ success: true, data: { blocks: await blockService.list(req.user!.id) }, timestamp: now() });
  } catch (error) { fail(res, error); }
});

/** @route POST /api/blocks — block someone */
router.post('/', blockLimit, [body('userId').isUUID().withMessage('userId must be a valid UUID')], validateInput,
  async (req: AuthenticatedRequest, res: any) => {
    try {
      await blockService.block(req.user!.id, req.body.userId);
      res.status(201).json({ success: true, data: { userId: req.body.userId, blocked: true }, timestamp: now() });
    } catch (error) { fail(res, error); }
  });

/** @route DELETE /api/blocks/:userId — unblock someone */
router.delete('/:userId', blockLimit, [param('userId').isUUID().withMessage('userId must be a valid UUID')], validateInput,
  async (req: AuthenticatedRequest, res: any) => {
    try {
      await blockService.unblock(req.user!.id, String(req.params['userId']));
      res.json({ success: true, data: { userId: req.params['userId'], blocked: false }, timestamp: now() });
    } catch (error) { fail(res, error); }
  });

export default router;
