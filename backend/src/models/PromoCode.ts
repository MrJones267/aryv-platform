/**
 * @fileoverview PromoCode model — database-backed promotional codes
 * @author Oabona-Majoko
 * @created 2026-05-18
 * @lastModified 2026-05-18
 */

import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type PromoType = 'percentage' | 'fixed';

export interface PromoCodeAttributes {
  id: string;
  code: string;
  type: PromoType;
  value: number;
  maxDiscount: number | null;
  minOrderAmount: number;
  usageLimit: number | null;
  usedCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  description: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromoCodeCreationAttributes extends Optional<PromoCodeAttributes,
  'id' | 'maxDiscount' | 'usageLimit' | 'usedCount' | 'expiresAt' | 'isActive' |
  'description' | 'createdBy' | 'createdAt' | 'updatedAt'
> {}

export class PromoCode extends Model<PromoCodeAttributes, PromoCodeCreationAttributes>
  implements PromoCodeAttributes {

  public id!: string;
  public code!: string;
  public type!: PromoType;
  public value!: number;
  public maxDiscount!: number | null;
  public minOrderAmount!: number;
  public usageLimit!: number | null;
  public usedCount!: number;
  public expiresAt!: Date | null;
  public isActive!: boolean;
  public description!: string | null;
  public createdBy!: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;

  isValid(orderAmount: number): { valid: boolean; reason?: string } {
    if (!this.isActive) return { valid: false, reason: 'Promo code is inactive' };
    if (this.expiresAt && new Date() > this.expiresAt) return { valid: false, reason: 'Promo code has expired' };
    if (this.usageLimit !== null && this.usedCount >= this.usageLimit) return { valid: false, reason: 'Promo code usage limit reached' };
    if (orderAmount < this.minOrderAmount) return { valid: false, reason: `Minimum order amount is ${this.minOrderAmount}` };
    return { valid: true };
  }

  calculateDiscount(orderAmount: number): number {
    let discount = this.type === 'percentage'
      ? (orderAmount * this.value) / 100
      : this.value;
    if (this.maxDiscount !== null) discount = Math.min(discount, this.maxDiscount);
    return Math.min(discount, orderAmount);
  }
}

PromoCode.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: { args: [2, 20], msg: 'Code must be 2-20 characters' },
    },
  },
  type: {
    type: DataTypes.ENUM('percentage', 'fixed'),
    allowNull: false,
  },
  value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { min: { args: [0.01], msg: 'Value must be positive' } },
  },
  maxDiscount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'max_discount',
  },
  minOrderAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'min_order_amount',
  },
  usageLimit: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'usage_limit',
  },
  usedCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'used_count',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'created_by',
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
}, {
  sequelize,
  modelName: 'PromoCode',
  tableName: 'promo_codes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['code'], unique: true },
    { fields: ['is_active'] },
    { fields: ['expires_at'] },
  ],
});

export default PromoCode;
