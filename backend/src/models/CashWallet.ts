/**
 * @fileoverview Cash wallet model for stored value system
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import {
  Model,
  DataTypes,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  ForeignKey,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { UserModel } from './User';

// Cash wallet model interface
export interface CashWalletModel extends Model<
  InferAttributes<CashWalletModel>,
  InferCreationAttributes<CashWalletModel>
> {
  id: CreationOptional<string>;
  userId: ForeignKey<string>;
  balance: number;
  currency: string;
  status: 'active' | 'suspended' | 'closed';
  dailyLoadLimit: number;
  monthlyLoadLimit: number;
  dailySpendLimit: number;
  monthlySpendLimit: number;
  kycLevel: 'basic' | 'enhanced' | 'full';
  isVerified: boolean;
  lastTransactionAt: CreationOptional<Date | null>;
  frozenBalance: CreationOptional<number>;
  escrowBalance: CreationOptional<number>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;

  // Associations
  user?: NonAttribute<UserModel>;
  transactions?: NonAttribute<CashWalletTransactionModel[]>;

  // Virtual attributes
  availableBalance: NonAttribute<number>;
  totalBalance: NonAttribute<number>;
}

// Cash wallet transaction model interface
export interface CashWalletTransactionModel extends Model<
  InferAttributes<CashWalletTransactionModel>,
  InferCreationAttributes<CashWalletTransactionModel>
> {
  id: CreationOptional<string>;
  walletId: ForeignKey<string>;
  type: 'load' | 'payment' | 'refund' | 'transfer' | 'escrow_hold' | 'escrow_release' | 'fee' | 'bonus';
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  source: 'agent' | 'kiosk' | 'partner_store' | 'mobile_money' | 'voucher' | 'bank_transfer' | 'ride_payment' | 'refund';
  sourceReference: CreationOptional<string | null>;
  description: string;
  metadata: CreationOptional<Record<string, any>>;
  processedAt: CreationOptional<Date | null>;
  expiresAt: CreationOptional<Date | null>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;

  // Associations
  wallet?: NonAttribute<CashWalletModel>;
}

// Define Cash Wallet model
const CashWallet = sequelize.define<CashWalletModel>(
  'cash_wallets',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true, // One wallet per user
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: {
          args: [0],
          msg: 'Balance cannot be negative',
        },
      },
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'closed'),
      allowNull: false,
      defaultValue: 'active',
    },
    dailyLoadLimit: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 500.00,
      field: 'daily_load_limit',
    },
    monthlyLoadLimit: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 10000.00,
      field: 'monthly_load_limit',
    },
    dailySpendLimit: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1000.00,
      field: 'daily_spend_limit',
    },
    monthlySpendLimit: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 15000.00,
      field: 'monthly_spend_limit',
    },
    kycLevel: {
      type: DataTypes.ENUM('basic', 'enhanced', 'full'),
      allowNull: false,
      defaultValue: 'basic',
      field: 'kyc_level',
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_verified',
    },
    lastTransactionAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_transaction_at',
    },
    frozenBalance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'frozen_balance',
    },
    escrowBalance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'escrow_balance',
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
    tableName: 'cash_wallets',
    timestamps: true,
    indexes: [
      {
        fields: ['userId'],
        unique: true,
      },
      {
        fields: ['status'],
      },
      {
        fields: ['kycLevel'],
      },
    ],
    getterMethods: {
      availableBalance() {
        return parseFloat((this.balance - this.frozenBalance - this.escrowBalance).toFixed(2));
      },
      totalBalance() {
        return parseFloat((this.balance + this.escrowBalance).toFixed(2));
      },
    },
    validate: {
      validBalances() {
        if ((this as any)['frozenBalance'] < 0 || (this as any)['escrowBalance'] < 0) {
          throw new Error('Frozen and escrow balances cannot be negative');
        }
        if ((this as any)['frozenBalance'] + (this as any)['escrowBalance'] > (this as any)['balance']) {
          throw new Error('Frozen and escrow balances cannot exceed total balance');
        }
      },
    },
  },
);

// Define Cash Wallet Transaction model
const CashWalletTransaction = sequelize.define<CashWalletTransactionModel>(
  'cash_wallet_transactions',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    walletId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'wallet_id',
      references: {
        model: 'cash_wallets',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    type: {
      type: DataTypes.ENUM('load', 'payment', 'refund', 'transfer', 'escrow_hold', 'escrow_release', 'fee', 'bonus'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0.01],
          msg: 'Amount must be greater than 0',
        },
      },
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
    },
    balanceBefore: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'balance_before',
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'balance_after',
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    source: {
      type: DataTypes.ENUM('agent', 'kiosk', 'partner_store', 'mobile_money', 'voucher', 'bank_transfer', 'ride_payment', 'refund'),
      allowNull: false,
    },
    sourceReference: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'source_reference',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processed_at',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: 'cash_wallet_transactions',
    timestamps: true,
    indexes: [
      {
        fields: ['walletId'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['source'],
      },
      {
        fields: ['sourceReference'],
      },
      {
        fields: ['createdAt'],
      },
      {
        fields: ['processedAt'],
      },
      {
        fields: ['expiresAt'],
      },
    ],
  },
);

// Define associations
CashWallet.hasMany(CashWalletTransaction, {
  foreignKey: 'walletId',
  as: 'transactions',
});

CashWalletTransaction.belongsTo(CashWallet, {
  foreignKey: 'walletId',
  as: 'wallet',
});

export { CashWallet, CashWalletTransaction };
export default CashWallet;
