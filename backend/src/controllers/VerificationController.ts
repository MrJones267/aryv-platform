/**
 * @fileoverview Driver document verification endpoints.
 * @author Oabona-Majoko
 * @created 2026-08-22
 * @lastModified 2026-08-22
 */

import { Response } from 'express';
import { validationResult } from 'express-validator';
import verificationService from '../services/VerificationService';
import DriverDocument, { DocumentStatus, DocumentType } from '../models/DriverDocument';
import { AuthenticatedRequest, UserRole } from '../types';
import { logError, logWarning } from '../utils/logger';
import { UPLOADS_DIR } from '../middleware/upload';

const ADMIN_ROLES = [UserRole.ADMIN];

const isAdmin = (req: AuthenticatedRequest): boolean =>
  Boolean(req.user && ADMIN_ROLES.includes(req.user.role));

const fail = (
  res: Response,
  statusCode: number,
  error: string,
  code: string,
): void => {
  res.status(statusCode).json({
    success: false,
    error,
    code,
    timestamp: new Date().toISOString(),
  });
};

export class VerificationController {
  /**
   * POST /api/verification/documents/upload
   *
   * multipart/form-data with a single `document` file plus `documentType` and,
   * where the type requires one, `documentExpiresAt`. The document always
   * belongs to the authenticated caller — there is no userId field, so a user
   * cannot file papers against somebody else's application.
   */
  static async uploadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_FAILED',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!req.user) {
        fail(res, 401, 'Authentication required', 'AUTHENTICATION_REQUIRED');
        return;
      }

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        fail(
          res,
          400,
          'No document file provided. Send it as multipart/form-data under the field name "document".',
          'NO_FILE',
        );
        return;
      }

      const { documentType, documentExpiresAt } = req.body as {
        documentType: DocumentType;
        documentExpiresAt?: string;
      };

      const result = await verificationService.submitDocument({
        userId: req.user.id,
        documentType,
        storageKey: file.filename,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        documentExpiresAt: documentExpiresAt ? new Date(documentExpiresAt) : undefined,
      });

      if (!result.success) {
        fail(res, 400, result.error ?? 'Could not submit document', result.code ?? 'SUBMIT_FAILED');
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          documentId: result.documentId,
          status: result.status,
        },
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logError('Error in uploadDocument', error as Error, { userId: req.user?.id });
      fail(res, 500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
    }
  }

  /**
   * GET /api/verification/status/:userId
   *
   * A user may read their own status; admins may read anyone's. The param is
   * retained because the mobile client sends it, but it is authorised rather
   * than trusted.
   */
  static async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        fail(res, 401, 'Authentication required', 'AUTHENTICATION_REQUIRED');
        return;
      }

      const { userId } = req.params as { userId: string };

      if (userId !== req.user.id && !isAdmin(req)) {
        logWarning('Verification status cross-user access attempt', {
          callerId: req.user.id,
          requestedUserId: userId,
        });
        fail(res, 403, 'Access denied', 'ACCESS_DENIED');
        return;
      }

      const status = await verificationService.getStatus(userId);

      res.status(200).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logError('Error in getStatus', error as Error, { userId: req.user?.id });
      fail(res, 500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
    }
  }

  /**
   * GET /api/verification/progress/:userId
   *
   * The same underlying state, shaped for the client's progress view.
   */
  static async getProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        fail(res, 401, 'Authentication required', 'AUTHENTICATION_REQUIRED');
        return;
      }

      const { userId } = req.params as { userId: string };

      if (userId !== req.user.id && !isAdmin(req)) {
        fail(res, 403, 'Access denied', 'ACCESS_DENIED');
        return;
      }

      const status = await verificationService.getStatus(userId);

      res.status(200).json({
        success: true,
        data: {
          userId,
          documents: status.submittedDocuments,
          overallProgress: status.completionPercentage,
          blockers: status.nextSteps,
          canStartDriving: status.canStartDriving,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logError('Error in getProgress', error as Error, { userId: req.user?.id });
      fail(res, 500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
    }
  }

  /** GET /api/verification/admin/queue — documents awaiting review. */
  static async getReviewQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!isAdmin(req)) {
        fail(res, 403, 'Admin access required', 'ADMIN_REQUIRED');
        return;
      }

      const limit = Math.min(parseInt(String(req.query['limit'] ?? '50'), 10) || 50, 100);
      const offset = parseInt(String(req.query['offset'] ?? '0'), 10) || 0;

      const { rows, count } = await verificationService.getReviewQueue(limit, offset);

      res.status(200).json({
        success: true,
        data: rows,
        pagination: { limit, offset, total: count },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logError('Error in getReviewQueue', error as Error);
      fail(res, 500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
    }
  }

  /** POST /api/verification/admin/:documentId/review — approve or reject. */
  static async reviewDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_FAILED',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!isAdmin(req) || !req.user) {
        fail(res, 403, 'Admin access required', 'ADMIN_REQUIRED');
        return;
      }

      const { documentId } = req.params as { documentId: string };
      const { approve, rejectionReason, adminNotes, allowResubmission } = req.body as {
        approve: boolean;
        rejectionReason?: string;
        adminNotes?: string;
        allowResubmission?: boolean;
      };

      const result = await verificationService.reviewDocument({
        documentId,
        adminId: req.user.id,
        approve,
        rejectionReason,
        adminNotes,
        allowResubmission,
      });

      if (!result.success) {
        const notFound = result.code === 'DOCUMENT_NOT_FOUND';
        fail(res, notFound ? 404 : 400, result.error ?? 'Review failed', result.code ?? 'REVIEW_FAILED');
        return;
      }

      res.status(200).json({
        success: true,
        data: { status: result.status, driverStatus: result.driverStatus },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logError('Error in reviewDocument', error as Error, { userId: req.user?.id });
      fail(res, 500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
    }
  }

  /**
   * GET /api/verification/documents/:documentId/file
   *
   * Streams the stored document to its owner or an admin. Identity papers are
   * never served from a public path.
   */
  static async getDocumentFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        fail(res, 401, 'Authentication required', 'AUTHENTICATION_REQUIRED');
        return;
      }

      const { documentId } = req.params as { documentId: string };
      const document = await DriverDocument.findByPk(documentId);

      if (!document) {
        fail(res, 404, 'Document not found', 'DOCUMENT_NOT_FOUND');
        return;
      }

      if (document.userId !== req.user.id && !isAdmin(req)) {
        logWarning('Document file cross-user access attempt', {
          callerId: req.user.id,
          documentId,
        });
        // Same response as a missing document, so the endpoint cannot be used
        // to confirm that a given document id exists.
        fail(res, 404, 'Document not found', 'DOCUMENT_NOT_FOUND');
        return;
      }

      // storageKey is a bare filename produced by the upload middleware, but
      // it is still passed through basename so a crafted value can never walk
      // out of the documents directory.
      const path = await import('path');
      const safeName = path.basename(document.storageKey);
      const filePath = path.resolve(UPLOADS_DIR, 'documents', safeName);

      res.sendFile(filePath, (err) => {
        if (err) {
          fail(res, 404, 'File not found', 'FILE_NOT_FOUND');
        }
      });
    } catch (error) {
      logError('Error in getDocumentFile', error as Error, { userId: req.user?.id });
      fail(res, 500, 'Internal server error', 'INTERNAL_SERVER_ERROR');
    }
  }
}

export { DocumentStatus, DocumentType };
export default VerificationController;
