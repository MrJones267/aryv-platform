/**
 * @fileoverview Package model for courier service
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Package size enum
export enum PackageSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  CUSTOM = 'custom'
}

// Package interface
export interface PackageAttributes {
  id: string;
  senderId: string;
  title: string;
  description?: string;
  dimensionsLength?: number;
  dimensionsWidth?: number;
  dimensionsHeight?: number;
  weight?: number;
  packageSize: PackageSize;
  fragile: boolean;
  valuable: boolean;
  specialInstructions?: string;
  pickupAddress: string;
  pickupCoordinates: [number, number]; // [longitude, latitude]
  pickupContactName?: string;
  pickupContactPhone?: string;
  dropoffAddress: string;
  dropoffCoordinates: [number, number]; // [longitude, latitude]
  dropoffContactName?: string;
  dropoffContactPhone?: string;
  packageImages?: string[];
  distance?: number;
  senderPriceOffer: number;
  systemSuggestedPrice?: number;
  deliveryTierId?: string; // New: Selected delivery tier
  requestedDeliveryTime?: Date; // New: When sender wants delivery
  urgencyLevel?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; // New: Urgency indicator
  demandMultiplierApplied?: number; // New: Applied demand pricing multiplier
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PackageCreationAttributes extends Optional<PackageAttributes,
  'id' | 'description' | 'dimensionsLength' | 'dimensionsWidth' | 'dimensionsHeight' |
  'weight' | 'specialInstructions' | 'pickupContactName' | 'pickupContactPhone' |
  'dropoffContactName' | 'dropoffContactPhone' | 'packageImages' | 'distance' |
  'systemSuggestedPrice' | 'deliveryTierId' | 'requestedDeliveryTime' | 'urgencyLevel' |
  'demandMultiplierApplied' | 'expiresAt' | 'createdAt' | 'updatedAt'
> {}

export class Package extends Model<PackageAttributes, PackageCreationAttributes> implements PackageAttributes {
  public id!: string;
  public senderId!: string;
  public title!: string;
  public description?: string;
  public dimensionsLength?: number;
  public dimensionsWidth?: number;
  public dimensionsHeight?: number;
  public weight?: number;
  public packageSize!: PackageSize;
  public fragile!: boolean;
  public valuable!: boolean;
  public specialInstructions?: string;
  public pickupAddress!: string;
  public pickupCoordinates!: [number, number];
  public pickupContactName?: string;
  public pickupContactPhone?: string;
  public dropoffAddress!: string;
  public dropoffCoordinates!: [number, number];
  public dropoffContactName?: string;
  public dropoffContactPhone?: string;
  public packageImages?: string[];
  public distance?: number;
  public senderPriceOffer!: number;
  public systemSuggestedPrice?: number;
  public deliveryTierId?: string;
  public requestedDeliveryTime?: Date;
  public urgencyLevel?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  public demandMultiplierApplied?: number;
  public isActive!: boolean;
  public expiresAt?: Date;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Associations
  public readonly deliveryAgreements?: DeliveryAgreement[];
  public readonly images?: PackageImage[];

  // Methods
  public isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  public calculateVolume(): number | null {
    if (this.dimensionsLength && this.dimensionsWidth && this.dimensionsHeight) {
      return this.dimensionsLength * this.dimensionsWidth * this.dimensionsHeight;
    }
    return null;
  }

  public override toJSON(): object {
    const values = { ...this.get() };
    // Convert coordinates to a more readable format if needed
    return values;
  }
}

Package.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    field: 'sender_id',
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 200],
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  dimensionsLength: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    field: 'dimensions_length',
    validate: {
      min: 0,
    },
  },
  dimensionsWidth: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    field: 'dimensions_width',
    validate: {
      min: 0,
    },
  },
  dimensionsHeight: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    field: 'dimensions_height',
    validate: {
      min: 0,
    },
  },
  weight: {
    type: DataTypes.DECIMAL(8, 3),
    allowNull: true,
    validate: {
      min: 0,
    },
  },
  packageSize: {
    type: DataTypes.ENUM(...Object.values(PackageSize)),
    allowNull: false,
    defaultValue: PackageSize.MEDIUM,
    field: 'package_size',
  },
  fragile: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  valuable: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  specialInstructions: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'special_instructions',
  },
  pickupAddress: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'pickup_address',
    validate: {
      notEmpty: true,
    },
  },
  pickupCoordinates: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: false,
    field: 'pickup_coordinates',
  },
  pickupContactName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'pickup_contact_name',
  },
  pickupContactPhone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'pickup_contact_phone',
  },
  dropoffAddress: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'dropoff_address',
    validate: {
      notEmpty: true,
    },
  },
  dropoffCoordinates: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: false,
    field: 'dropoff_coordinates',
  },
  dropoffContactName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'dropoff_contact_name',
  },
  dropoffContactPhone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'dropoff_contact_phone',
  },
  packageImages: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'package_images',
  },
  distance: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    validate: {
      min: 0,
    },
  },
  senderPriceOffer: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false,
    field: 'sender_price_offer',
    validate: {
      min: 0.01,
    },
  },
  systemSuggestedPrice: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    field: 'system_suggested_price',
    validate: {
      min: 0,
    },
  },
  deliveryTierId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'delivery_tiers',
      key: 'id',
    },
    field: 'delivery_tier_id',
  },
  requestedDeliveryTime: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'requested_delivery_time',
  },
  urgencyLevel: {
    type: DataTypes.ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT'),
    allowNull: true,
    field: 'urgency_level',
  },
  demandMultiplierApplied: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true,
    field: 'demand_multiplier_applied',
    validate: {
      min: 0.5,
      max: 5.0,
    },
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at',
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
  modelName: 'Package',
  tableName: 'packages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['sender_id'] },
    { fields: ['is_active'] },
    { fields: ['package_size'] },
    { fields: ['created_at'] },
    { fields: ['delivery_tier_id'] },
    { fields: ['urgency_level'] },
    { fields: ['requested_delivery_time'] },
    {
      fields: ['pickup_coordinates'],
      using: 'gist',
    },
    {
      fields: ['dropoff_coordinates'],
      using: 'gist',
    },
  ],
});

// Import these to avoid circular dependencies - will be set up in index.ts
import { DeliveryAgreement } from './DeliveryAgreement';
import { PackageImage } from './PackageImage';

export default Package;
