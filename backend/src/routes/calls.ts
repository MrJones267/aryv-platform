/**
 * @fileoverview Call endpoints — ICE configuration, history and active call.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Calls were reachable only over the socket. That covers placing and answering
 * one, but not the things a client needs outside a live call: the ICE servers
 * it must have before it can build a peer connection at all, the history
 * screen, and recovering an in-progress call after the app restarts.
 *
 * The ICE endpoint is the important one. It hands out short-lived TURN
 * credentials, which is what lets a call connect on a mobile network behind
 * carrier-grade NAT — where STUN alone frequently cannot.
 */

import { Router, Response } from 'express';
import { query, param, body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { rateLimitKey } from '../config/rateLimitKey';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { iceServerService } from '../services/IceServerService';
import CallService from '../services/CallService';
import { AuthenticatedRequest } from '../types';
import logger, { getErrorMessage } from '../utils/logger';

const router = Router();
const callService = new CallService();

const callRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many call requests, please try again later',
  store: makeStore('calls'),
  keyGenerator: rateLimitKey,
});

/**
 * @route   GET /api/calls/ice-servers
 * @desc    ICE servers, with time-limited TURN credentials
 * @access  Private
 *
 * Authenticated because the credentials meter relay bandwidth: an open
 * endpoint hands anyone a free TURN server.
 */
router.get(
  '/ice-servers',
  callRateLimit,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false, error: 'User not authenticated', code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const config = iceServerService.getConfiguration(userId);

    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString(),
    });
  },
);

/**
 * @route   GET /api/calls/active
 * @desc    The caller's in-progress call, if any
 * @access  Private
 */
router.get(
  '/active',
  callRateLimit,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false, error: 'User not authenticated', code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const call = await callService.getActiveCallForUser(userId);

      res.json({
        success: true,
        data: call,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching active call', { error: getErrorMessage(error), userId });

      res.status(500).json({
        success: false, error: 'Could not load the active call', code: 'CALL_FETCH_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  },
);

/**
 * @route   GET /api/calls/history
 * @desc    The caller's call history
 * @access  Private
 */
router.get(
  '/history',
  callRateLimit,
  authenticateToken,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1 to 100').toInt(),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset cannot be negative').toInt(),
  ],
  validateInput,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false, error: 'User not authenticated', code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const limit = Number(req.query['limit'] ?? 50);
      const offset = Number(req.query['offset'] ?? 0);

      const calls = await callService.getCallHistory(userId, limit, offset);

      res.json({
        success: true,
        data: calls,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching call history', { error: getErrorMessage(error), userId });

      res.status(500).json({
        success: false, error: 'Could not load call history', code: 'CALL_HISTORY_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  },
);

/**
 * @route   PUT /api/calls/:id/quality
 * @desc    Rate a finished call
 * @access  Private
 *
 * PUT rather than POST because the shipped mobile client already calls it that
 * way; a rating is idempotent, so the verb is honest either way.
 */
router.put(
  '/:id/quality',
  callRateLimit,
  authenticateToken,
  [
    param('id').isUUID().withMessage('Call ID must be a valid UUID'),
    body('quality').isInt({ min: 1, max: 5 }).withMessage('Quality must be between 1 and 5').toInt(),
  ],
  validateInput,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false, error: 'User not authenticated', code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      // Returns false when the call is not the caller's, so one user cannot
      // rate another's calls.
      const updated = await callService.updateCallQuality(
        req.params['id']!,
        userId,
        Number(req.body.quality),
      );

      if (!updated) {
        res.status(404).json({
          success: false, error: 'Call not found', code: 'CALL_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: { id: req.params['id'] },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error rating call', { error: getErrorMessage(error), userId });

      res.status(500).json({
        success: false, error: 'Could not save the rating', code: 'CALL_QUALITY_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  },
);

export default router;
