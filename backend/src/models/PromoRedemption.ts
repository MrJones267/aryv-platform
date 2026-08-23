/**
 * @fileoverview A promo code actually spent, by a person, on a booking.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Redemption used to be a Redis key with a year's TTL. Redis is a cache: a
 * flush or an eviction handed everyone their one-per-user promo back, and
 * nothing tied a redemption to the booking it paid for. This row is written
 * inside the booking transaction, so the two cannot disagree.
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

export interface PromoRedemptionModel extends Model<
  InferAttributes<PromoRedemptionModel>,
  InferCreationAttributes<PromoRedemptionModel>
> {
  id: CreationOptional<string>;
  promoCodeId: ForeignKey<string>;
  userId: ForeignKey<string>;
  bookingId: CreationOptional<string | null>;

  /** What came off, which may be less than face value once capped. */
  discountAmount: number;
  /** What the order was worth before the discount. */
  orderAmount: number;

  redeemedAt: CreationOptional<Date>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const PromoRedemption = sequelize.define<PromoRedemptionModel>(
  'promo_redemptions',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    promoCodeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'promo_code_id',
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    bookingId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'booking_id',
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'discount_amount',
    },
    orderAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'order_amount',
    },
    redeemedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'redeemed_at',
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
    tableName: 'promo_redemptions',
    timestamps: true,
    underscored: true,
  },
);

export default PromoRedemption;
