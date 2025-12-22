/**
 * @fileoverview DeliveryDispute model for handling delivery conflicts
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Dispute status enum
export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

// Common dispute types
export enum DisputeType {
  PACKAGE_NOT_DELIVERED = 'package_not_delivered',
  PACKAGE_DAMAGED = 'package_damaged',
  INCORRECT_LOCATION = 'incorrect_location',
  WRONG_RECIPIENT = 'wrong_recipient',
  LATE_DELIVERY = 'late_delivery',
  COURIER_NO_SHOW = 'courier_no_show',
  OTHER = 'other'
}

// DeliveryDispute interface
export interface DeliveryDisputeAttributes {
  id: string;
  deliveryAgreementId: string;
  raisedByUserId: string;
  disputeType: string;
  description: string;
  evidenceImages?: string[];
  status: DisputeStatus;
  adminNotes?: string;
  resolutionAmount?: number;
  resolvedByAdminId?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryDisputeCreationAttributes extends Optional<DeliveryDisputeAttributes,
  'id' | 'evidenceImages' | 'adminNotes' | 'resolutionAmount' | 'resolvedByAdminId' |
  'resolvedAt' | 'createdAt' | 'updatedAt'
> {}

export class DeliveryDispute extends Model<DeliveryDisputeAttributes, DeliveryDisputeCreationAttributes>
  implements DeliveryDisputeAttributes {

  public id!: string;
  public deliveryAgreementId!: string;
  public raisedByUserId!: string;
  public disputeType!: string;
  public description!: string;
  public evidenceImages?: string[];
  public status!: DisputeStatus;
  public adminNotes?: string;
  public resolutionAmount?: number;
  public resolvedByAdminId?: string;
  public resolvedAt?: Date;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Associations
  public readonly deliveryAgreement?: DeliveryAgreement;
  public readonly raisedByUser?: import('./User').UserModel;
  public readonly resolvedByAdmin?: import('./User').UserModel;

  // Methods
  public isOpen(): boolean {
    return this.status === DisputeStatus.OPEN;
  }

  public isResolved(): boolean {
    return this.status === DisputeStatus.RESOLVED || this.status === DisputeStatus.CLOSED;
  }

  public canBeResolved(): boolean {
    return this.status === DisputeStatus.OPEN || this.status === DisputeStatus.UNDER_REVIEW;
  }

  public async moveToReview(_adminId: string, notes?: string): Promise<void> {
    if (this.status !== DisputeStatus.OPEN) {
      throw new Error('Dispute must be in OPEN status to move to review');
    }

    this.status = DisputeStatus.UNDER_REVIEW;
    if (notes) {
      this.adminNotes = notes;
    }

    await this.save();
  }

  public async resolve(adminId: string, resolutionAmount?: number, notes?: string): Promise<void> {
    if (!this.canBeResolved()) {
      throw new Error('Dispute cannot be resolved in current status');
    }

    this.status = DisputeStatus.RESOLVED;
    this.resolvedByAdminId = adminId;
    this.resolvedAt = new Date();

    if (resolutionAmount !== undefined) {
      this.resolutionAmount = resolutionAmount;
    }

    if (notes) {
      this.adminNotes = this.adminNotes
        ? `${this.adminNotes}\n\n[RESOLUTION] ${notes}`
        : `[RESOLUTION] ${notes}`;
    }

    await this.save();
  }

  public async close(adminId: string, notes?: string): Promise<void> {
    if (this.status === DisputeStatus.CLOSED) {
      throw new Error('Dispute is already closed');
    }

    this.status = DisputeStatus.CLOSED;
    this.resolvedByAdminId = adminId;
    this.resolvedAt = new Date();

    if (notes) {
      this.adminNotes = this.adminNotes
        ? `${this.adminNotes}\n\n[CLOSED] ${notes}`
        : `[CLOSED] ${notes}`;
    }

    await this.save();
  }

  public getDurationInHours(): number {
    const endDate = this.resolvedAt || new Date();
    return Math.floor((endDate.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60));
  }

  public addEvidenceImage(imageUrl: string): void {
    if (!this.evidenceImages) {
      this.evidenceImages = [];
    }
    this.evidenceImages.push(imageUrl);
  }

  public override toJSON(): object {
    const values = { ...this.get() };
    return {
      ...values,
      isOpen: this.isOpen(),
      isResolved: this.isResolved(),
      durationInHours: this.getDurationInHours(),
    };
  }
}

DeliveryDispute.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  deliveryAgreementId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'delivery_agreements',
      key: 'id',
    },
    field: 'delivery_agreement_id',
  },
  raisedByUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    field: 'raised_by_user_id',
  },
  disputeType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'dispute_type',
    validate: {
      isIn: [Object.values(DisputeType)],
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [10, 2000],
    },
  },
  evidenceImages: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'evidence_images',
  },
  status: {
    type: DataTypes.ENUM(...Object.values(DisputeStatus)),
    allowNull: false,
    defaultValue: DisputeStatus.OPEN,
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'admin_notes',
  },
  resolutionAmount: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    field: 'resolution_amount',
    validate: {
      min: 0,
    },
  },
  resolvedByAdminId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
    field: 'resolved_by_admin_id',
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'resolved_at',
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
}, {
  sequelize,
  modelName: 'DeliveryDispute',
  tableName: 'delivery_disputes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['delivery_agreement_id'] },
    { fields: ['raised_by_user_id'] },
    { fields: ['status'] },
    { fields: ['dispute_type'] },
    { fields: ['created_at'] },
  ],
});

// Import these to avoid circular dependencies - will be set up in index.ts
import { DeliveryAgreement } from './DeliveryAgreement';

export default DeliveryDispute;
