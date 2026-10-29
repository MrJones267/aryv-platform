/**
 * @fileoverview A rider's or driver's dispute about a cash ride payment
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * The app's "Report a problem" on a cash payment wrote through
 * sequelize.models['CashDispute'], which was never defined, so every report
 * failed with a 500 and nothing reached an admin. Resolution columns record
 * which admin decided, what they decided, and why.
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

/**
 * What the admin decided happened to the cash, which is what commission
 * follows: paid in full, not paid (nothing owed to the platform), or part paid.
 * Who was at fault is a separate decision (block the account if need be).
 */
export const CASH_DISPUTE_OUTCOMES = ['paid_in_full', 'not_paid', 'part_paid'] as const;
export type CashDisputeOutcome = typeof CASH_DISPUTE_OUTCOMES[number];

export interface CashDisputeModel extends Model<
  InferAttributes<CashDisputeModel>,
  InferCreationAttributes<CashDisputeModel>
> {
  id: CreationOptional<string>;
  transactionId: ForeignKey<string>;
  reporterId: ForeignKey<string>;
  reason: string;
  description: CreationOptional<string | null>;
  evidence: CreationOptional<unknown>;
  /** 0 to 100; higher is looked at first. */
  priority: CreationOptional<number>;
  status: CreationOptional<'open' | 'resolved'>;
  /** The payment's status when the dispute was raised. */
  transactionStatusBefore: CreationOptional<string | null>;
  outcome: CreationOptional<CashDisputeOutcome | null>;
  /** For a split: the cash the admin decided actually changed hands. */
  amountPaid: CreationOptional<number | null>;
  resolutionNotes: CreationOptional<string | null>;
  /** An admin_users id. Not a foreign key, as with commission_ledger.recorded_by. */
  resolvedBy: CreationOptional<string | null>;
  resolvedAt: CreationOptional<Date | null>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const CashDispute = sequelize.define<CashDisputeModel>(
  'cash_disputes',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    transactionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'transaction_id',
      references: { model: 'cash_transactions', key: 'id' },
      onDelete: 'CASCADE',
    },
    reporterId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'reporter_id',
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    reason: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    evidence: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'open',
    },
    transactionStatusBefore: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'transaction_status_before',
    },
    outcome: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    amountPaid: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'amount_paid',
    },
    resolutionNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'resolution_notes',
    },
    resolvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'resolved_by',
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
  },
  {
    tableName: 'cash_disputes',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['transaction_id'] }, { fields: ['status'] }, { fields: ['priority'] }],
  },
);

export { CashDispute };
export default CashDispute;
