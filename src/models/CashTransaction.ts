/**
 * @fileoverview Cash Transaction model for in-app cash payments
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
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

export enum CashPaymentStatus {
  PENDING_VERIFICATION = 'pending_verification',
  DRIVER_CONFIRMED = 'driver_confirmed',
  RIDER_CONFIRMED = 'rider_confirmed',
  BOTH_CONFIRMED = 'both_confirmed',
  DISPUTED = 'disputed',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

export interface CashTransactionModel extends Model<
  InferAttributes<CashTransactionModel>,
  InferCreationAttributes<CashTransactionModel>
> {
  id: CreationOptional<string>;
  bookingId: ForeignKey<string>;
  riderId: ForeignKey<string>;
  driverId: ForeignKey<string>;

  // Amount details
  amount: number;
  platformFee: number;
  expectedAmount: number;
  actualAmountClaimed: CreationOptional<number | null>;

  // Status and verification
  status: CreationOptional<CashPaymentStatus>;
  riderConfirmedAt: CreationOptional<Date | null>;
  driverConfirmedAt: CreationOptional<Date | null>;

  // Verification codes
  riderConfirmationCode: string;
  driverConfirmationCode: string;

  // Security features
  verificationPhoto: CreationOptional<string | null>;
  gpsLocationConfirmed: CreationOptional<boolean>;
  transactionLocation: CreationOptional<object | null>;

  // Dispute handling
  disputeReason: CreationOptional<string | null>;
  disputeResolvedAt: CreationOptional<Date | null>;
  disputeResolution: CreationOptional<'rider_favor' | 'driver_favor' | 'split' | null>;

  // Risk assessment
  riskScore: CreationOptional<number>;
  fraudFlags: CreationOptional<string[] | null>;

  // Metadata
  metadata: CreationOptional<object | null>;
  expiresAt: Date;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const CashTransaction = sequelize.define<CashTransactionModel>(
  'cash_transactions',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    bookingId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'booking_id',
      references: {
        model: 'bookings',
        key: 'id',
      },
    },
    riderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'rider_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    driverId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'driver_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    amount: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      validate: {
        min: 0.01,
        max: 10000.00,
      },
    },
    platformFee: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'platform_fee',
    },
    expectedAmount: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      field: 'expected_amount',
    },
    actualAmountClaimed: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      field: 'actual_amount_claimed',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(CashPaymentStatus)),
      allowNull: false,
      defaultValue: CashPaymentStatus.PENDING_VERIFICATION,
    },
    riderConfirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'rider_confirmed_at',
    },
    driverConfirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'driver_confirmed_at',
    },
    riderConfirmationCode: {
      type: DataTypes.STRING(6),
      allowNull: false,
      field: 'rider_confirmation_code',
    },
    driverConfirmationCode: {
      type: DataTypes.STRING(6),
      allowNull: false,
      field: 'driver_confirmation_code',
    },
    verificationPhoto: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'verification_photo',
    },
    gpsLocationConfirmed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'gps_location_confirmed',
    },
    transactionLocation: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'transaction_location',
    },
    disputeReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'dispute_reason',
    },
    disputeResolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'dispute_resolved_at',
    },
    disputeResolution: {
      type: DataTypes.ENUM('rider_favor', 'driver_favor', 'split'),
      allowNull: true,
      field: 'dispute_resolution',
    },
    riskScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'risk_score',
      validate: {
        min: 0,
        max: 100,
      },
    },
    fraudFlags: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'fraud_flags',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  },
  {
    tableName: 'cash_transactions',
    timestamps: true,
    indexes: [
      {
        fields: ['booking_id'],
      },
      {
        fields: ['rider_id'],
      },
      {
        fields: ['driver_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['expires_at'],
      },
      {
        fields: ['risk_score'],
      },
    ],
  },
);

export { CashTransaction };
export default CashTransaction;
