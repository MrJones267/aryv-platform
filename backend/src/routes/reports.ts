/**
 * @fileoverview Reporting a chat message or a person
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 */

import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { rateLimitKey } from '../config/rateLimitKey';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import contentReportService, { ReportError } from '../services/ContentReportService';
import { REPORT_REASONS } from '../models/ContentReport';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';

const router = Router();

const reportLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many reports, please try again later', code: 'RATE_LIMIT_EXCEEDED' },
  store: makeStore('reports'),
  keyGenerator: rateLimitKey,
});

/**
 * @route   POST /api/reports
 * @desc    Report a chat message (messageId) or a person (reportedUserId)
 * @access  Private
 */
router.post(
  '/',
  reportLimit,
  authenticateToken,
  [
    body('messageId').optional().isUUID().withMessage('messageId must be a valid UUID'),
    body('reportedUserId').optional().isUUID().withMessage('reportedUserId must be a valid UUID'),
    body('reason').isIn([...REPORT_REASONS]).withMessage(`reason must be one of ${REPORT_REASONS.join(', ')}`),
    body('details').optional().isString().isLength({ max: 1000 }),
  ],
  validateInput,
  async (req: AuthenticatedRequest, res: any) => {
    try {
      const { report, duplicate } = await contentReportService.create(req.user!.id, req.body);
      res.status(duplicate ? 200 : 201).json({
        success: true,
        data: { reportId: report.id, status: report.status, duplicate },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ReportError) {
        res.status(error.status).json({ success: false, error: error.message, code: error.code, timestamp: new Date().toISOString() });
        return;
      }
      logger.error('Report failed', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  },
);

export default router;
