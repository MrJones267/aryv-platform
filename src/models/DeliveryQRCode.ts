/**
 * @fileoverview DeliveryQRCode model for delivery verification
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// QR Code status enum
export enum QRCodeStatus {
  ACTIVE = 'active',
  USED = 'used',
  EXPIRED = 'expired'
}

// DeliveryQRCode interface
export interface DeliveryQRCodeAttributes {
  id: string;
  deliveryAgreementId: string;
  qrToken: string;
  status: QRCodeStatus;
  generatedAt: Date;
  expiresAt: Date;
  scannedAt?: Date;
  scannedByUserId?: string;
  scanLocation?: [number, number];
  verificationData?: Record<string, any>;
}

export interface DeliveryQRCodeCreationAttributes extends Optional<DeliveryQRCodeAttributes,
  'id' | 'scannedAt' | 'scannedByUserId' | 'scanLocation' | 'verificationData'
> {}

export class DeliveryQRCode extends Model<DeliveryQRCodeAttributes, DeliveryQRCodeCreationAttributes>
  implements DeliveryQRCodeAttributes {

  public id!: string;
  public deliveryAgreementId!: string;
  public qrToken!: string;
  public status!: QRCodeStatus;
  public generatedAt!: Date;
  public expiresAt!: Date;
  public scannedAt?: Date;
  public scannedByUserId?: string;
  public scanLocation?: [number, number];
  public verificationData?: Record<string, any>;

  // Associations
  public readonly deliveryAgreement?: DeliveryAgreement;
  public readonly scannedByUser?: import('./User').UserModel;

  // Methods
  public isValid(): boolean {
    return this.status === QRCodeStatus.ACTIVE && new Date() < this.expiresAt;
  }

  public isExpired(): boolean {
    return new Date() >= this.expiresAt;
  }

  public async scan(userId: string, location?: [number, number], additionalData?: Record<string, any>): Promise<boolean> {
    if (!this.isValid()) {
      return false;
    }

    this.status = QRCodeStatus.USED;
    this.scannedAt = new Date();
    this.scannedByUserId = userId;
    if (location) {
      this.scanLocation = location;
    }

    if (additionalData) {
      this.verificationData = {
        ...this.verificationData,
        ...additionalData,
      };
    }

    await this.save();
    return true;
  }

  public async expire(): Promise<void> {
    this.status = QRCodeStatus.EXPIRED;
    await this.save();
  }

  public getTimeUntilExpiry(): number {
    return this.expiresAt.getTime() - new Date().getTime();
  }

  public override toJSON(): object {
    const values = { ...this.get() };
    return {
      ...values,
      isValid: this.isValid(),
      timeUntilExpiry: this.getTimeUntilExpiry(),
    };
  }
}

DeliveryQRCode.init({
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
  qrToken: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    field: 'qr_token',
  },
  status: {
    type: DataTypes.ENUM(...Object.values(QRCodeStatus)),
    allowNull: false,
    defaultValue: QRCodeStatus.ACTIVE,
  },
  generatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'generated_at',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
  },
  scannedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'scanned_at',
  },
  scannedByUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
    field: 'scanned_by_user_id',
  },
  scanLocation: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: true,
    field: 'scan_location',
  },
  verificationData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'verification_data',
  },
}, {
  sequelize,
  modelName: 'DeliveryQRCode',
  tableName: 'delivery_qr_codes',
  timestamps: false,
  indexes: [
    { fields: ['delivery_agreement_id'] },
    { fields: ['qr_token'] },
    { fields: ['status'] },
    { fields: ['expires_at'] },
  ],
});

// Import these to avoid circular dependencies - will be set up in index.ts
import { DeliveryAgreement } from './DeliveryAgreement';

export default DeliveryQRCode;
