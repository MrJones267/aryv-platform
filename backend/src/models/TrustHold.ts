/**
 * @fileoverview A rider's cash amount held against an open cash payment
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * CashPaymentService wrote and released holds through
 * sequelize.models['TrustHold'], a model that was never defined. Starting a
 * cash payment therefore threw before it committed, so no cash ride could be
 * paid through the app and no commission accrued on one. The unit test mocked
 * the hold away, which is why nothing caught it.
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

export interface TrustHoldModel extends Model<
  InferAttributes<TrustHoldModel>,
  InferCreationAttributes<TrustHoldModel>
> {
  id: CreationOptional<string>;
  userId: ForeignKey<string>;
  transactionId: ForeignKey<string> | null;
  amount: number;
  reason: string;
  expiresAt: Date;
  createdAt: CreationOptional<Date>;
}

const TrustHold = sequelize.define<TrustHoldModel>(
  'trust_holds',
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
      onDelete: 'CASCADE',
    },
    transactionId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'transaction_id',
      references: { model: 'cash_transactions', key: 'id' },
      onDelete: 'CASCADE',
    },
    amount: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  },
  {
    tableName: 'trust_holds',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [{ fields: ['user_id'] }, { fields: ['transaction_id'] }, { fields: ['expires_at'] }],
  },
);

export { TrustHold };
export default TrustHold;
