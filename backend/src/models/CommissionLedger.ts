/**
 * @fileoverview Commission ledger model — append-only record of driver
 *               commission accruals (charged on cash rides) and settlements
 *               (driver paying the platform what is owed).
 * @author Oabona-Majoko
 * @created 2026-06-17
 * @lastModified 2026-06-17
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

export enum CommissionEntryType {
  ACCRUAL = 'accrual', // Commission charged to driver for a cash ride
  SETTLEMENT = 'settlement', // Driver paid the platform the owed commission
  WAIVER = 'waiver', // Admin waived a portion of owed commission
  ADJUSTMENT = 'adjustment', // Manual correction
}

export enum SettlementMethod {
  WALLET_DEDUCTION = 'wallet_deduction', // Deducted from driver's digital balance
  CASH_AGENT = 'cash_agent', // Paid in cash at an authorised agent
  MOBILE_MONEY = 'mobile_money',
  BANK_TRANSFER = 'bank_transfer',
  MANUAL = 'manual',
}

export interface CommissionLedgerModel extends Model<
  InferAttributes<CommissionLedgerModel>,
  InferCreationAttributes<CommissionLedgerModel>
> {
  id: CreationOptional<string>;
  driverId: ForeignKey<string>;

  entryType: CommissionEntryType;
  amount: number;
  balanceAfter: number;

  settlementMethod: CreationOptional<SettlementMethod | null>;
  cashTransactionId: CreationOptional<string | null>;
  recordedBy: CreationOptional<string | null>;

  description: CreationOptional<string | null>;
  metadata: CreationOptional<object | null>;

  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const CommissionLedger = sequelize.define<CommissionLedgerModel>(
  'commission_ledger',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
    entryType: {
      type: DataTypes.ENUM(...Object.values(CommissionEntryType)),
      allowNull: false,
      field: 'entry_type',
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'balance_after',
    },
    settlementMethod: {
      type: DataTypes.ENUM(...Object.values(SettlementMethod)),
      allowNull: true,
      field: 'settlement_method',
    },
    cashTransactionId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'cash_transaction_id',
      references: {
        model: 'cash_transactions',
        key: 'id',
      },
    },
    recordedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'recorded_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
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
    tableName: 'commission_ledger',
    timestamps: true,
    indexes: [
      { fields: ['driver_id'] },
      { fields: ['entry_type'] },
      { fields: ['cash_transaction_id'] },
      { fields: ['created_at'] },
    ],
  },
);

export { CommissionLedger };
export default CommissionLedger;
