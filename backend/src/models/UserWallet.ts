/**
 * @fileoverview User Wallet model for cash payment trust system
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

export enum VerificationLevel {
  BASIC = 'basic',
  VERIFIED = 'verified',
  PREMIUM = 'premium'
}

export interface UserWalletModel extends Model<
  InferAttributes<UserWalletModel>,
  InferCreationAttributes<UserWalletModel>
> {
  id: CreationOptional<string>;
  userId: ForeignKey<string>;

  // Wallet balances (for future digital wallet features)
  availableBalance: CreationOptional<number>;
  pendingBalance: CreationOptional<number>;
  escrowBalance: CreationOptional<number>;

  // Cash transaction limits
  dailyCashLimit: CreationOptional<number>;
  weeklyCashLimit: CreationOptional<number>;
  monthlyCashLimit: CreationOptional<number>;

  // Current usage tracking
  dailyCashUsed: CreationOptional<number>;
  weeklyCashUsed: CreationOptional<number>;
  monthlyCashUsed: CreationOptional<number>;
  lastResetDate: CreationOptional<Date>;

  // Verification levels
  verificationLevel: CreationOptional<VerificationLevel>;
  phoneVerified: CreationOptional<boolean>;
  idVerified: CreationOptional<boolean>;
  addressVerified: CreationOptional<boolean>;

  // Trust score (0-100)
  trustScore: CreationOptional<number>;
  completedCashTransactions: CreationOptional<number>;
  disputedTransactions: CreationOptional<number>;
  successfulTransactions: CreationOptional<number>;

  // Risk tracking
  totalTransactionValue: CreationOptional<number>;
  averageTransactionValue: CreationOptional<number>;
  lastTrustScoreUpdate: CreationOptional<Date>;

  // Security flags
  isSuspended: CreationOptional<boolean>;
  suspensionReason: CreationOptional<string | null>;
  suspendedUntil: CreationOptional<Date | null>;

  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const UserWallet = sequelize.define<UserWalletModel>(
  'user_wallets',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    availableBalance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'available_balance',
    },
    pendingBalance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'pending_balance',
    },
    escrowBalance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'escrow_balance',
    },
    dailyCashLimit: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 100.00,
      field: 'daily_cash_limit',
    },
    weeklyCashLimit: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 500.00,
      field: 'weekly_cash_limit',
    },
    monthlyCashLimit: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 2000.00,
      field: 'monthly_cash_limit',
    },
    dailyCashUsed: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'daily_cash_used',
    },
    weeklyCashUsed: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'weekly_cash_used',
    },
    monthlyCashUsed: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'monthly_cash_used',
    },
    lastResetDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_reset_date',
    },
    verificationLevel: {
      type: DataTypes.ENUM(...Object.values(VerificationLevel)),
      allowNull: false,
      defaultValue: VerificationLevel.BASIC,
      field: 'verification_level',
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'phone_verified',
    },
    idVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'id_verified',
    },
    addressVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'address_verified',
    },
    trustScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50, // Starting trust score
      field: 'trust_score',
      validate: {
        min: 0,
        max: 100,
      },
    },
    completedCashTransactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'completed_cash_transactions',
    },
    disputedTransactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'disputed_transactions',
    },
    successfulTransactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'successful_transactions',
    },
    totalTransactionValue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'total_transaction_value',
    },
    averageTransactionValue: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'average_transaction_value',
    },
    lastTrustScoreUpdate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_trust_score_update',
    },
    isSuspended: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_suspended',
    },
    suspensionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'suspension_reason',
    },
    suspendedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'suspended_until',
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
    tableName: 'user_wallets',
    timestamps: true,
    indexes: [
      {
        fields: ['user_id'],
        unique: true,
      },
      {
        fields: ['trust_score'],
      },
      {
        fields: ['verification_level'],
      },
      {
        fields: ['is_suspended'],
      },
    ],
  },
);

export { UserWallet };
export default UserWallet;
