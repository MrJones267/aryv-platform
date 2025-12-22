/**
 * @fileoverview Delivery Tier model for demand-based courier service
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Delivery tier types for same-day delivery system
export enum DeliveryTierType {
  LIGHTNING = 'lightning',  // 1-2 hour delivery
  EXPRESS = 'express',      // 2-4 hour delivery
  STANDARD = 'standard',    // 4-8 hour delivery
  ECONOMY = 'economy'       // 8-12 hour delivery
}

// Delivery tier attributes interface
export interface DeliveryTierAttributes {
  id: string;
  tierType: DeliveryTierType;
  tierName: string;
  description: string;
  maxDeliveryHours: number;
  minDeliveryHours: number;
  basePriceMultiplier: number;
  platformFeePercentage: number;
  slaGuarantee: number; // Percentage guarantee (e.g., 95%)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Optional attributes for creation
interface DeliveryTierCreationAttributes extends Optional<DeliveryTierAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class DeliveryTier extends Model<DeliveryTierAttributes, DeliveryTierCreationAttributes> implements DeliveryTierAttributes {
  public id!: string;
  public tierType!: DeliveryTierType;
  public tierName!: string;
  public description!: string;
  public maxDeliveryHours!: number;
  public minDeliveryHours!: number;
  public basePriceMultiplier!: number;
  public platformFeePercentage!: number;
  public slaGuarantee!: number;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Helper methods
  public getDeliveryWindow(): string {
    if (this.minDeliveryHours === this.maxDeliveryHours) {
      return `${this.maxDeliveryHours} hour${this.maxDeliveryHours > 1 ? 's' : ''}`;
    }
    return `${this.minDeliveryHours}-${this.maxDeliveryHours} hours`;
  }

  public isWithinSLA(deliveryTime: Date, createdTime: Date): boolean {
    const hoursDiff = (deliveryTime.getTime() - createdTime.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= this.maxDeliveryHours;
  }

  public calculatePlatformFee(agreedPrice: number): number {
    return agreedPrice * (this.platformFeePercentage / 100);
  }

  public override toJSON() {
    const values = { ...this.get() };
    return values;
  }
}

DeliveryTier.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tierType: {
    type: DataTypes.ENUM(...Object.values(DeliveryTierType)),
    allowNull: false,
    unique: true,
    field: 'tier_type',
  },
  tierName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'tier_name',
    validate: {
      notEmpty: true,
      len: [1, 100],
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  maxDeliveryHours: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'max_delivery_hours',
    validate: {
      min: 1,
      max: 48,
    },
  },
  minDeliveryHours: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'min_delivery_hours',
    validate: {
      min: 1,
      max: 48,
    },
  },
  basePriceMultiplier: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    field: 'base_price_multiplier',
    validate: {
      min: 0.1,
      max: 10.0,
    },
  },
  platformFeePercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    field: 'platform_fee_percentage',
    validate: {
      min: 5.0,
      max: 50.0,
    },
  },
  slaGuarantee: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    field: 'sla_guarantee',
    validate: {
      min: 50.0,
      max: 100.0,
    },
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
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
  modelName: 'DeliveryTier',
  tableName: 'delivery_tiers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['tier_type'], unique: true },
    { fields: ['is_active'] },
    { fields: ['base_price_multiplier'] },
  ],
});

export { DeliveryTier };
export default DeliveryTier;
