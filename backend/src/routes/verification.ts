/**
 * @fileoverview Driver document verification routes.
 * @author Oabona-Majoko
 * @created 2026-08-22
 * @lastModified 2026-08-22
 */

import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { rateLimitKey } from '../config/rateLimitKey';
import VerificationController from '../controllers/VerificationController';
import { DocumentType } from '../models/DriverDocument';
import { authenticateToken } from '../middleware/auth';
import { validateInput } from '../middleware/validation';
import { uploadDocument, handleMulterError } from '../middleware/upload';

const router = Router();

// Uploads are expensive (disk, review queue) and are the natural target for
// abuse, so they are limited far more tightly than reads.
const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many document uploads, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('verification-upload'),
  keyGenerator: rateLimitKey,
});

const readRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('verification-read'),
  keyGenerator: rateLimitKey,
});

router.use(authenticateToken);

/**
 * @route   POST /api/verification/documents/upload
 * @desc    Submit a document for review (multipart/form-data, field "document")
 * @access  Private
 */
router.post(
  '/documents/upload',
  uploadRateLimit,
  // uploadDocument is already bound to .single('document') in the middleware.
  uploadDocument,
  handleMulterError,
  [
    body('documentType')
      .isIn(Object.values(DocumentType))
      .withMessage('A valid documentType is required'),
    body('documentExpiresAt')
      .optional()
      .isISO8601()
      .withMessage('documentExpiresAt must be an ISO 8601 date'),
    validateInput,
  ],
  (req: Request, res: Response) => VerificationController.uploadDocument(req as any, res),
);

/**
 * @route   GET /api/verification/status/:userId
 * @desc    Verification state for a user (self, or any user for admins)
 * @access  Private
 */
router.get(
  '/status/:userId',
  readRateLimit,
  [param('userId').isUUID().withMessage('Valid user ID is required'), validateInput],
  (req: Request, res: Response) => VerificationController.getStatus(req as any, res),
);

/**
 * @route   GET /api/verification/progress/:userId
 * @desc    Progress view of the same state
 * @access  Private
 */
router.get(
  '/progress/:userId',
  readRateLimit,
  [param('userId').isUUID().withMessage('Valid user ID is required'), validateInput],
  (req: Request, res: Response) => VerificationController.getProgress(req as any, res),
);

/**
 * @route   GET /api/verification/documents/:documentId/file
 * @desc    Stream a stored document to its owner or an admin
 * @access  Private
 */
router.get(
  '/documents/:documentId/file',
  readRateLimit,
  [param('documentId').isUUID().withMessage('Valid document ID is required'), validateInput],
  (req: Request, res: Response) => VerificationController.getDocumentFile(req as any, res),
);

/**
 * @route   GET /api/verification/admin/queue
 * @desc    Documents awaiting human review
 * @access  Private (Admin)
 */
router.get(
  '/admin/queue',
  readRateLimit,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    validateInput,
  ],
  (req: Request, res: Response) => VerificationController.getReviewQueue(req as any, res),
);

/**
 * @route   POST /api/verification/admin/:documentId/review
 * @desc    Approve or reject a submitted document
 * @access  Private (Admin)
 */
router.post(
  '/admin/:documentId/review',
  [
    param('documentId').isUUID().withMessage('Valid document ID is required'),
    body('approve').isBoolean().withMessage('approve must be a boolean'),
    body('rejectionReason')
      .optional()
      .isLength({ min: 3, max: 1000 })
      .withMessage('rejectionReason must be between 3 and 1000 characters'),
    body('adminNotes').optional().isLength({ max: 2000 }),
    body('allowResubmission').optional().isBoolean(),
    validateInput,
  ],
  (req: Request, res: Response) => VerificationController.reviewDocument(req as any, res),
);

export default router;
