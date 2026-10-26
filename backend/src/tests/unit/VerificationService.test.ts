/**
 * @fileoverview Unit tests for VerificationService — submission rules, human
 *               review, and the derived driver verification state.
 * @author Oabona-Majoko
 * @created 2026-08-22
 * @lastModified 2026-08-22
 */

import { sequelize } from '../../config/database';
import { VerificationService } from '../../services/VerificationService';
import DriverDocument, {
  DocumentStatus,
  DocumentType,
  DriverVerificationStatus,
  MAX_SUBMISSION_ATTEMPTS,
} from '../../models/DriverDocument';
import User from '../../models/User';

jest.mock('../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

const USER = 'user-uuid-1';
const ADMIN = 'admin-uuid-1';

const inOneYear = () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc-1',
  userId: USER,
  documentType: DocumentType.DRIVERS_LICENSE,
  status: DocumentStatus.UPLOADED,
  documentExpiresAt: inOneYear(),
  rejectionReason: null,
  attemptNumber: 1,
  submittedAt: new Date(),
  reviewedAt: null,
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('VerificationService', () => {
  let service: VerificationService;
  let mockTx: { commit: jest.Mock; rollback: jest.Mock };
  let findOne: jest.Mock;
  let findAll: jest.Mock;
  let count: jest.Mock;
  let create: jest.Mock;
  let findByPk: jest.Mock;
  let userUpdate: jest.Mock;

  beforeEach(() => {
    service = new VerificationService();
    mockTx = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(sequelize, 'transaction').mockResolvedValue(mockTx as any);

    findOne = jest.fn().mockResolvedValue(null);
    findAll = jest.fn().mockResolvedValue([]);
    count = jest.fn().mockResolvedValue(0);
    create = jest.fn().mockResolvedValue({ id: 'doc-new' });
    findByPk = jest.fn().mockResolvedValue(null);
    userUpdate = jest.fn().mockResolvedValue(undefined);

    jest.spyOn(DriverDocument, 'findOne').mockImplementation(findOne as any);
    jest.spyOn(DriverDocument, 'findAll').mockImplementation(findAll as any);
    jest.spyOn(DriverDocument, 'count').mockImplementation(count as any);
    jest.spyOn(DriverDocument, 'create').mockImplementation(create as any);
    jest.spyOn(DriverDocument, 'findByPk').mockImplementation(findByPk as any);
    jest.spyOn(User, 'findByPk').mockResolvedValue({
      id: USER,
      driverVerificationStatus: DriverVerificationStatus.UNVERIFIED,
      update: userUpdate,
    } as any);
  });

  describe('submitDocument', () => {
    const base = {
      userId: USER,
      documentType: DocumentType.DRIVERS_LICENSE,
      storageKey: 'user-doc-1.jpg',
      documentExpiresAt: inOneYear(),
    };

    it('records a submission as awaiting review, never as approved', async () => {
      const result = await service.submitDocument(base);

      expect(result.success).toBe(true);
      expect(result.status).toBe(DocumentStatus.UPLOADED);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ status: DocumentStatus.UPLOADED, attemptNumber: 1 }),
        expect.anything(),
      );
    });

    it('requires an expiry date for documents that expire', async () => {
      const result = await service.submitDocument({
        userId: USER,
        documentType: DocumentType.DRIVERS_LICENSE,
        storageKey: 'k.jpg',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('EXPIRY_REQUIRED');
      expect(create).not.toHaveBeenCalled();
    });

    it('refuses an already-expired document', async () => {
      const result = await service.submitDocument({
        ...base,
        documentExpiresAt: new Date(Date.now() - 1000),
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('DOCUMENT_EXPIRED');
    });

    it('refuses a duplicate while one is already under review', async () => {
      findOne.mockResolvedValue(makeDoc({ status: DocumentStatus.UNDER_REVIEW }));

      const result = await service.submitDocument(base);

      expect(result.success).toBe(false);
      expect(result.code).toBe('DOCUMENT_ALREADY_SUBMITTED');
      expect(create).not.toHaveBeenCalled();
    });

    it('caps resubmission attempts', async () => {
      count.mockResolvedValue(MAX_SUBMISSION_ATTEMPTS);

      const result = await service.submitDocument(base);

      expect(result.success).toBe(false);
      expect(result.code).toBe('MAX_ATTEMPTS_REACHED');
      expect(mockTx.rollback).toHaveBeenCalled();
    });
  });

  describe('reviewDocument', () => {
    it('requires a reason when rejecting', async () => {
      const result = await service.reviewDocument({
        documentId: 'doc-1',
        adminId: ADMIN,
        approve: false,
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('REJECTION_REASON_REQUIRED');
    });

    it('attributes an approval to the reviewing admin', async () => {
      const doc = makeDoc();
      findByPk.mockResolvedValue(doc);

      const result = await service.reviewDocument({
        documentId: 'doc-1',
        adminId: ADMIN,
        approve: true,
      });

      expect(result.success).toBe(true);
      const written = doc.update.mock.calls[0][0];
      expect(written.status).toBe(DocumentStatus.APPROVED);
      expect(written.reviewedBy).toBe(ADMIN);
      expect(written.reviewedAt).toBeInstanceOf(Date);
    });

    it('will not re-review a decided document', async () => {
      findByPk.mockResolvedValue(makeDoc({ status: DocumentStatus.APPROVED }));

      const result = await service.reviewDocument({
        documentId: 'doc-1',
        adminId: ADMIN,
        approve: false,
        rejectionReason: 'changed my mind',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('ALREADY_REVIEWED');
    });

    it('marks a rejection as resubmittable when the reviewer allows it', async () => {
      const doc = makeDoc();
      findByPk.mockResolvedValue(doc);

      await service.reviewDocument({
        documentId: 'doc-1',
        adminId: ADMIN,
        approve: false,
        rejectionReason: 'blurry photo',
        allowResubmission: true,
      });

      expect(doc.update.mock.calls[0][0].status).toBe(DocumentStatus.REQUIRES_RESUBMISSION);
    });
  });

  describe('recomputeDriverStatus', () => {
    const approvedAll = () => [
      makeDoc({ documentType: DocumentType.DRIVERS_LICENSE, status: DocumentStatus.APPROVED }),
      makeDoc({ documentType: DocumentType.VEHICLE_REGISTRATION, status: DocumentStatus.APPROVED, documentExpiresAt: null }),
      makeDoc({ documentType: DocumentType.INSURANCE_CARD, status: DocumentStatus.APPROVED }),
    ];

    it('verifies only when every required document is approved', async () => {
      findAll.mockResolvedValue(approvedAll());

      const status = await service.recomputeDriverStatus(USER);

      expect(status).toBe(DriverVerificationStatus.VERIFIED);
    });

    it('does not verify when a required document is missing', async () => {
      findAll.mockResolvedValue([approvedAll()[0]]);

      const status = await service.recomputeDriverStatus(USER);

      expect(status).toBe(DriverVerificationStatus.PENDING);
    });

    it('does not verify on an expired approval', async () => {
      const docs = approvedAll();
      docs[0]!.documentExpiresAt = new Date(Date.now() - 1000);
      findAll.mockResolvedValue(docs);

      const status = await service.recomputeDriverStatus(USER);

      expect(status).not.toBe(DriverVerificationStatus.VERIFIED);
    });

    it('reports rejected when a required document was rejected outright', async () => {
      findAll.mockResolvedValue([
        makeDoc({ documentType: DocumentType.DRIVERS_LICENSE, status: DocumentStatus.REJECTED }),
      ]);

      const status = await service.recomputeDriverStatus(USER);

      expect(status).toBe(DriverVerificationStatus.REJECTED);
    });

    it('never clears an admin suspension through document arithmetic', async () => {
      findAll.mockResolvedValue(approvedAll());
      jest.spyOn(User, 'findByPk').mockResolvedValue({
        id: USER,
        driverVerificationStatus: DriverVerificationStatus.SUSPENDED,
        update: userUpdate,
      } as any);

      await service.recomputeDriverStatus(USER);

      expect(userUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('reports canStartDriving false while documents are pending', async () => {
      findAll.mockResolvedValue([makeDoc({ status: DocumentStatus.UPLOADED })]);
      jest.spyOn(User, 'findByPk').mockResolvedValue({
        id: USER,
        driverVerificationStatus: DriverVerificationStatus.PENDING,
        update: userUpdate,
      } as any);

      const view = await service.getStatus(USER);

      expect(view.canStartDriving).toBe(false);
      expect(view.completionPercentage).toBeLessThan(100);
      expect(view.nextSteps.length).toBeGreaterThan(0);
    });
  });
});
