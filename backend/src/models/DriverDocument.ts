/**
 * @fileoverview Driver document model — identity and vehicle papers submitted
 *               for human review before a user is allowed to drive.
 * @author Oabona-Majoko
 * @created 2026-08-22
 * @lastModified 2026-08-22
 */

import {
  Model,
  DataTypes,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  ForeignKey,
} from 'sequelize';
import { sequelize } from '../config/database';

export enum DocumentType {
  DRIVERS_LICENSE = 'drivers_license',
  PASSPORT = 'passport',
  NATIONAL_ID = 'national_id',
  VEHICLE_REGISTRATION = 'vehicle_registration',
  INSURANCE_CARD = 'insurance_card',
  BACKGROUND_CHECK = 'background_check',
  BANK_STATEMENT = 'bank_statement',
  UTILITY_BILL = 'utility_bill',
}

export enum DocumentStatus {
  UPLOADED = 'uploaded',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REQUIRES_RESUBMISSION = 'requires_resubmission',
  EXPIRED = 'expired',
}

export enum DriverVerificationStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

/**
 * Documents a driver must have approved before they can be verified.
 * Identity is satisfied by any one of licence / passport / national ID; the
 * licence is additionally required because it is what authorises driving.
 */
export const REQUIRED_DOCUMENT_TYPES: DocumentType[] = [
  DocumentType.DRIVERS_LICENSE,
  DocumentType.VEHICLE_REGISTRATION,
  DocumentType.INSURANCE_CARD,
];

/** Types that must carry an expiry date, since a lapsed one is worthless. */
export const EXPIRY_REQUIRED_TYPES: DocumentType[] = [
  DocumentType.DRIVERS_LICENSE,
  DocumentType.INSURANCE_CARD,
  DocumentType.PASSPORT,
];

/** A rejected applicant may resubmit a given document type this many times. */
export const MAX_SUBMISSION_ATTEMPTS = 5;

/** Statuses that occupy the single "live document" slot for a type. */
export const LIVE_STATUSES: DocumentStatus[] = [
  DocumentStatus.UPLOADED,
  DocumentStatus.UNDER_REVIEW,
  DocumentStatus.APPROVED,
];

export interface DriverDocumentModel extends Model<
  InferAttributes<DriverDocumentModel>,
  InferCreationAttributes<DriverDocumentModel>
> {
  id: CreationOptional<string>;
  userId: ForeignKey<string>;

  documentType: DocumentType;
  status: CreationOptional<DocumentStatus>;

  storageKey: string;
  originalFilename: CreationOptional<string | null>;
  mimeType: CreationOptional<string | null>;
  fileSizeBytes: CreationOptional<number | null>;

  documentExpiresAt: CreationOptional<Date | null>;

  reviewedBy: CreationOptional<string | null>;
  reviewedAt: CreationOptional<Date | null>;
  rejectionReason: CreationOptional<string | null>;
  adminNotes: CreationOptional<string | null>;

  attemptNumber: CreationOptional<number>;

  submittedAt: CreationOptional<Date>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const DriverDocument = sequelize.define<DriverDocumentModel>(
  'driver_documents',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: { model: 'users', key: 'id' },
    },
    documentType: {
      type: DataTypes.STRING(40),
      allowNull: false,
      field: 'document_type',
      validate: { isIn: [Object.values(DocumentType)] },
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: DocumentStatus.UPLOADED,
      validate: { isIn: [Object.values(DocumentStatus)] },
    },
    storageKey: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'storage_key',
    },
    originalFilename: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'original_filename',
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'mime_type',
    },
    fileSizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'file_size_bytes',
    },
    documentExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'document_expires_at',
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reviewed_by',
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at',
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason',
    },
    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'admin_notes',
    },
    attemptNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'attempt_number',
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'submitted_at',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    tableName: 'driver_documents',
    timestamps: true,
    underscored: true,
  },
);

export default DriverDocument;
