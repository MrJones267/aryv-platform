/**
 * @fileoverview CourierProfile model for courier-specific user data
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { PackageSize } from './Package';

// CourierProfile interface
export interface CourierProfileAttributes {
  id: string;
  userId: string;
  isCourierActive: boolean;
  courierRating: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  totalCourierEarnings: number;
  preferredPackageSizes: PackageSize[];
  maxPackageWeight?: number;
  deliveryRadius?: number;
  isAvailableForDeliveries: boolean;
  verificationDocuments?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourierProfileCreationAttributes extends Optional<CourierProfileAttributes,
  'id' | 'maxPackageWeight' | 'deliveryRadius' | 'verificationDocuments' | 'createdAt' | 'updatedAt'
> {}

export class CourierProfile extends Model<CourierProfileAttributes, CourierProfileCreationAttributes>
  implements CourierProfileAttributes {

  public id!: string;
  public userId!: string;
  public isCourierActive!: boolean;
  public courierRating!: number;
  public totalDeliveries!: number;
  public successfulDeliveries!: number;
  public totalCourierEarnings!: number;
  public preferredPackageSizes!: PackageSize[];
  public maxPackageWeight?: number;
  public deliveryRadius?: number;
  public isAvailableForDeliveries!: boolean;
  public verificationDocuments?: Record<string, any>;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Associations
  public readonly user?: import('./User').UserModel;
  public readonly deliveryAgreements?: DeliveryAgreement[];

  // Methods
  public getSuccessRate(): number {
    if (this.totalDeliveries === 0) return 100;
    return (this.successfulDeliveries / this.totalDeliveries) * 100;
  }

  public canHandlePackage(packageSize: PackageSize, weight?: number): boolean {
    // Check if courier accepts this package size
    if (!this.preferredPackageSizes.includes(packageSize)) {
      return false;
    }

    // Check weight limit if specified
    if (weight && this.maxPackageWeight && weight > this.maxPackageWeight) {
      return false;
    }

    return true;
  }

  public async updateRating(newRating: number): Promise<void> {
    // Calculate new average rating
    const totalRatingPoints = this.courierRating * this.totalDeliveries;
    const newTotalRatingPoints = totalRatingPoints + newRating;
    const newTotalDeliveries = this.totalDeliveries + 1;

    this.courierRating = newTotalRatingPoints / newTotalDeliveries;
    this.totalDeliveries = newTotalDeliveries;

    await this.save();
  }

  public async recordSuccessfulDelivery(earnings: number): Promise<void> {
    this.successfulDeliveries += 1;
    this.totalCourierEarnings += earnings;
    await this.save();
  }

  public override toJSON(): object {
    const values = { ...this.get() };
    return {
      ...values,
      successRate: this.getSuccessRate(),
    };
  }
}

CourierProfile.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id',
    },
    field: 'user_id',
  },
  isCourierActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_courier_active',
  },
  courierRating: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: false,
    defaultValue: 5.0,
    field: 'courier_rating',
    validate: {
      min: 0,
      max: 5,
    },
  },
  totalDeliveries: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'total_deliveries',
    validate: {
      min: 0,
    },
  },
  successfulDeliveries: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'successful_deliveries',
    validate: {
      min: 0,
    },
  },
  totalCourierEarnings: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'total_courier_earnings',
    validate: {
      min: 0,
    },
  },
  preferredPackageSizes: {
    type: DataTypes.ARRAY(DataTypes.ENUM(...Object.values(PackageSize))),
    allowNull: false,
    defaultValue: [PackageSize.SMALL, PackageSize.MEDIUM],
    field: 'preferred_package_sizes',
  },
  maxPackageWeight: {
    type: DataTypes.DECIMAL(8, 3),
    allowNull: true,
    field: 'max_package_weight',
    validate: {
      min: 0,
    },
  },
  deliveryRadius: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    field: 'delivery_radius',
    validate: {
      min: 0,
    },
  },
  isAvailableForDeliveries: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_available_for_deliveries',
  },
  verificationDocuments: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'verification_documents',
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
  modelName: 'CourierProfile',
  tableName: 'courier_profiles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['is_courier_active'] },
    { fields: ['is_available_for_deliveries'] },
  ],
});

// Import these to avoid circular dependencies - will be set up in index.ts
import { DeliveryAgreement } from './DeliveryAgreement';

export default CourierProfile;
