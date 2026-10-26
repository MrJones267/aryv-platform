/**
 * @fileoverview Driver document verification — submission, human review, and
 *               the derived driver verification state that gates driving.
 * @author Oabona-Majoko
 * @created 2026-08-22
 * @lastModified 2026-08-22
 *
 * Design note: there is no OCR, no confidence scoring, and no automatic
 * approval anywhere in here. Every approve/reject decision carries the id of
 * the admin who made it. The mobile client previously simulated all of that
 * with Math.random(), which is worse than having nothing, because it looks
 * like vetting happened.
 */

import { Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import DriverDocument, {
  DriverDocumentModel,
  DocumentStatus,
  DocumentType,
  DriverVerificationStatus,
  EXPIRY_REQUIRED_TYPES,
  LIVE_STATUSES,
  MAX_SUBMISSION_ATTEMPTS,
  REQUIRED_DOCUMENT_TYPES,
} from '../models/DriverDocument';
import User from '../models/User';
import { logInfo, logError, logWarning } from '../utils/logger';

export interface SubmitDocumentInput {
  userId: string;
  documentType: DocumentType;
  storageKey: string;
  originalFilename?: string | undefined;
  mimeType?: string | undefined;
  fileSizeBytes?: number | undefined;
  documentExpiresAt?: Date | undefined;
}

export interface SubmitDocumentResult {
  success: boolean;
  documentId?: string;
  status?: DocumentStatus;
  message?: string;
  error?: string;
  code?: string;
}

export interface ReviewDecisionInput {
  documentId: string;
  adminId: string;
  approve: boolean;
  rejectionReason?: string | undefined;
  adminNotes?: string | undefined;
  allowResubmission?: boolean | undefined;
}

export interface VerificationStatusView {
  userId: string;
  overallStatus: DriverVerificationStatus;
  completionPercentage: number;
  canStartDriving: boolean;
  requiredDocuments: DocumentType[];
  submittedDocuments: Array<{
    id: string;
    documentType: DocumentType;
    status: DocumentStatus;
    submittedAt: Date;
    reviewedAt: Date | null;
    documentExpiresAt: Date | null;
    rejectionReason: string | null;
    attemptNumber: number;
  }>;
  nextSteps: string[];
  lastUpdated: string;
}

export class VerificationService {
  /**
   * Record a submitted document. The file has already been written to storage
   * by the upload middleware; this owns the database record and the resulting
   * change to the user's verification state.
   */
  async submitDocument(input: SubmitDocumentInput): Promise<SubmitDocumentResult> {
    const transaction = await sequelize.transaction();

    try {
      if (
        EXPIRY_REQUIRED_TYPES.includes(input.documentType) &&
        !input.documentExpiresAt
      ) {
        await transaction.rollback();
        return {
          success: false,
          error: `An expiry date is required for ${input.documentType.replace(/_/g, ' ')}`,
          code: 'EXPIRY_REQUIRED',
        };
      }

      if (input.documentExpiresAt && input.documentExpiresAt.getTime() <= Date.now()) {
        await transaction.rollback();
        return {
          success: false,
          error: 'That document has already expired',
          code: 'DOCUMENT_EXPIRED',
        };
      }

      // A live document already occupying this slot blocks resubmission. The
      // partial unique index enforces this at the database level too; this
      // check exists to return a usable message rather than a constraint error.
      const live = await DriverDocument.findOne({
        where: {
          userId: input.userId,
          documentType: input.documentType,
          status: { [Op.in]: LIVE_STATUSES },
        },
        transaction,
      });

      if (live) {
        await transaction.rollback();
        return {
          success: false,
          error:
            live.status === DocumentStatus.APPROVED
              ? 'That document is already approved'
              : 'That document is already awaiting review',
          code: 'DOCUMENT_ALREADY_SUBMITTED',
        };
      }

      const priorAttempts = await DriverDocument.count({
        where: { userId: input.userId, documentType: input.documentType },
        transaction,
      });

      if (priorAttempts >= MAX_SUBMISSION_ATTEMPTS) {
        await transaction.rollback();
        logWarning('Document submission attempt limit reached', {
          userId: input.userId,
          documentType: input.documentType,
        });
        return {
          success: false,
          error: 'You have reached the resubmission limit for this document. Contact support.',
          code: 'MAX_ATTEMPTS_REACHED',
        };
      }

      const document = await DriverDocument.create(
        {
          userId: input.userId,
          documentType: input.documentType,
          storageKey: input.storageKey,
          originalFilename: input.originalFilename ?? null,
          mimeType: input.mimeType ?? null,
          fileSizeBytes: input.fileSizeBytes ?? null,
          documentExpiresAt: input.documentExpiresAt ?? null,
          status: DocumentStatus.UPLOADED,
          attemptNumber: priorAttempts + 1,
          submittedAt: new Date(),
        },
        { transaction },
      );

      await this.recomputeDriverStatus(input.userId, transaction);
      await transaction.commit();

      logInfo('Driver document submitted', {
        userId: input.userId,
        documentType: input.documentType,
        documentId: document.id,
        attempt: priorAttempts + 1,
      });

      return {
        success: true,
        documentId: document.id,
        status: DocumentStatus.UPLOADED,
        message: 'Document submitted. A reviewer will check it shortly.',
      };
    } catch (error) {
      await transaction.rollback();
      logError('Error submitting driver document', error as Error, {
        userId: input.userId,
        documentType: input.documentType,
      });
      return { success: false, error: 'Could not submit document', code: 'SUBMIT_FAILED' };
    }
  }

  /**
   * Record an admin's decision on a document. Approval and rejection are the
   * only two outcomes; rejection optionally leaves the slot open for another
   * attempt.
   */
  async reviewDocument(input: ReviewDecisionInput): Promise<{
    success: boolean;
    status?: DocumentStatus;
    driverStatus?: DriverVerificationStatus;
    error?: string;
    code?: string;
  }> {
    const transaction = await sequelize.transaction();

    try {
      if (!input.approve && !input.rejectionReason) {
        await transaction.rollback();
        return {
          success: false,
          error: 'A rejection reason is required',
          code: 'REJECTION_REASON_REQUIRED',
        };
      }

      const document = await DriverDocument.findByPk(input.documentId, { transaction });
      if (!document) {
        await transaction.rollback();
        return { success: false, error: 'Document not found', code: 'DOCUMENT_NOT_FOUND' };
      }

      if (
        document.status === DocumentStatus.APPROVED ||
        document.status === DocumentStatus.REJECTED
      ) {
        await transaction.rollback();
        return {
          success: false,
          error: 'That document has already been reviewed',
          code: 'ALREADY_REVIEWED',
        };
      }

      const nextStatus = input.approve
        ? DocumentStatus.APPROVED
        : input.allowResubmission
          ? DocumentStatus.REQUIRES_RESUBMISSION
          : DocumentStatus.REJECTED;

      await document.update(
        {
          status: nextStatus,
          reviewedBy: input.adminId,
          reviewedAt: new Date(),
          rejectionReason: input.approve ? null : (input.rejectionReason ?? null),
          adminNotes: input.adminNotes ?? null,
        },
        { transaction },
      );

      const driverStatus = await this.recomputeDriverStatus(document.userId, transaction);
      await transaction.commit();

      logInfo('Driver document reviewed', {
        documentId: document.id,
        userId: document.userId,
        documentType: document.documentType,
        decision: nextStatus,
        adminId: input.adminId,
      });

      return { success: true, status: nextStatus, driverStatus };
    } catch (error) {
      await transaction.rollback();
      logError('Error reviewing driver document', error as Error, {
        documentId: input.documentId,
        adminId: input.adminId,
      });
      return { success: false, error: 'Could not record review', code: 'REVIEW_FAILED' };
    }
  }

  /**
   * Derive the user's driver verification state from their documents and
   * persist it. Verified requires every required type approved and unexpired.
   */
  async recomputeDriverStatus(
    userId: string,
    transaction?: Transaction,
  ): Promise<DriverVerificationStatus> {
    const documents = await DriverDocument.findAll({
      where: { userId },
      ...(transaction ? { transaction } : {}),
    });

    const now = Date.now();
    const approved = new Set(
      documents
        .filter(
          (d) =>
            d.status === DocumentStatus.APPROVED &&
            (!d.documentExpiresAt || d.documentExpiresAt.getTime() > now),
        )
        .map((d) => d.documentType),
    );

    const allRequiredApproved = REQUIRED_DOCUMENT_TYPES.every((t) => approved.has(t));

    // A hard rejection on any required type blocks the whole application;
    // requires_resubmission does not, since the applicant can still act.
    const hardRejected = documents.some(
      (d) =>
        d.status === DocumentStatus.REJECTED &&
        REQUIRED_DOCUMENT_TYPES.includes(d.documentType),
    );

    const anyPending = documents.some(
      (d) =>
        d.status === DocumentStatus.UPLOADED || d.status === DocumentStatus.UNDER_REVIEW,
    );

    let status: DriverVerificationStatus;
    if (allRequiredApproved) {
      status = DriverVerificationStatus.VERIFIED;
    } else if (hardRejected) {
      status = DriverVerificationStatus.REJECTED;
    } else if (anyPending || documents.length > 0) {
      status = DriverVerificationStatus.PENDING;
    } else {
      status = DriverVerificationStatus.UNVERIFIED;
    }

    const user = await User.findByPk(userId, { ...(transaction ? { transaction } : {}) });
    if (user) {
      const current = (user as any).driverVerificationStatus;
      // A suspension is an admin action and is never cleared by document
      // arithmetic — only an admin lifting it can change that.
      if (current !== DriverVerificationStatus.SUSPENDED && current !== status) {
        await user.update(
          {
            driverVerificationStatus: status,
            driverVerifiedAt:
              status === DriverVerificationStatus.VERIFIED ? new Date() : null,
          } as any,
          { ...(transaction ? { transaction } : {}) },
        );
      }
    }

    return status;
  }

  /** The user-facing view of where their application stands. */
  async getStatus(userId: string): Promise<VerificationStatusView> {
    const documents = await DriverDocument.findAll({
      where: { userId },
      order: [['submittedAt', 'DESC']],
    });

    const now = Date.now();
    const approved = new Set(
      documents
        .filter(
          (d) =>
            d.status === DocumentStatus.APPROVED &&
            (!d.documentExpiresAt || d.documentExpiresAt.getTime() > now),
        )
        .map((d) => d.documentType),
    );

    const user = await User.findByPk(userId);
    const overallStatus =
      ((user as any)?.driverVerificationStatus as DriverVerificationStatus) ??
      DriverVerificationStatus.UNVERIFIED;

    const missing = REQUIRED_DOCUMENT_TYPES.filter((t) => !approved.has(t));
    const nextSteps = missing.map((t) => {
      const existing = documents.find(
        (d) => d.documentType === t && LIVE_STATUSES.includes(d.status),
      );
      if (existing) {
        return `${t.replace(/_/g, ' ')} is awaiting review`;
      }
      const rejected = documents.find(
        (d) =>
          d.documentType === t &&
          (d.status === DocumentStatus.REJECTED ||
            d.status === DocumentStatus.REQUIRES_RESUBMISSION),
      );
      if (rejected) {
        return `Resubmit ${t.replace(/_/g, ' ')}: ${rejected.rejectionReason ?? 'rejected'}`;
      }
      return `Upload your ${t.replace(/_/g, ' ')}`;
    });

    return {
      userId,
      overallStatus,
      completionPercentage: Math.round(
        (approved.size / REQUIRED_DOCUMENT_TYPES.length) * 100,
      ),
      canStartDriving: overallStatus === DriverVerificationStatus.VERIFIED,
      requiredDocuments: REQUIRED_DOCUMENT_TYPES,
      submittedDocuments: documents.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        status: d.status,
        submittedAt: d.submittedAt,
        reviewedAt: d.reviewedAt ?? null,
        documentExpiresAt: d.documentExpiresAt ?? null,
        rejectionReason: d.rejectionReason ?? null,
        attemptNumber: d.attemptNumber,
      })),
      nextSteps,
      lastUpdated: new Date().toISOString(),
    };
  }

  /** Admin review queue, oldest submission first. */
  async getReviewQueue(limit = 50, offset = 0): Promise<{ rows: DriverDocumentModel[]; count: number }> {
    const result = await DriverDocument.findAndCountAll({
      where: {
        status: { [Op.in]: [DocumentStatus.UPLOADED, DocumentStatus.UNDER_REVIEW] },
      },
      order: [['submittedAt', 'ASC']],
      limit,
      offset,
    });
    return { rows: result.rows as unknown as DriverDocumentModel[], count: result.count };
  }

  /**
   * Expire approved documents whose own expiry has passed, and demote any
   * driver who thereby loses a required document. Intended for a daily job:
   * without it an approved-then-lapsed licence keeps a driver verified.
   */
  async expireLapsedDocuments(): Promise<{ expired: number; demoted: number }> {
    const lapsed = await DriverDocument.findAll({
      where: {
        status: DocumentStatus.APPROVED,
        documentExpiresAt: { [Op.lt]: new Date() },
      },
    });

    if (lapsed.length === 0) return { expired: 0, demoted: 0 };

    const affectedUsers = new Set<string>();
    for (const document of lapsed) {
      await document.update({ status: DocumentStatus.EXPIRED });
      affectedUsers.add(document.userId);
    }

    let demoted = 0;
    for (const userId of affectedUsers) {
      const status = await this.recomputeDriverStatus(userId);
      if (status !== DriverVerificationStatus.VERIFIED) demoted += 1;
    }

    logInfo('Expired lapsed driver documents', {
      expired: lapsed.length,
      usersAffected: affectedUsers.size,
      demoted,
    });

    return { expired: lapsed.length, demoted };
  }
}

export const verificationService = new VerificationService();
export default verificationService;
