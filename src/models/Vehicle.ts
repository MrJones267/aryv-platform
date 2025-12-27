/**
 * @fileoverview Vehicle model with Sequelize and TypeScript
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-20
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
import { VehicleType, VehicleStatus } from '../types';
import type { UserModel } from './User';

// Vehicle model interface
export interface VehicleModel extends Model<
  InferAttributes<VehicleModel>,
  InferCreationAttributes<VehicleModel>
> {
  id: CreationOptional<string>;
  driverId: ForeignKey<string>;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  type: VehicleType;
  capacity: number;
  status: CreationOptional<VehicleStatus>;
  isVerified: CreationOptional<boolean>;
  registrationDocument: CreationOptional<string | null>;
  insuranceDocument: CreationOptional<string | null>;
  inspectionExpiry: CreationOptional<Date | null>;
  verificationSubmittedAt: CreationOptional<Date | null>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;

  // Associations
  driver?: NonAttribute<UserModel>;

  // Virtual attributes
  displayName: NonAttribute<string>;
}

// Define Vehicle model
const Vehicle = sequelize.define<VehicleModel>(
  'vehicles',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    driverId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    make: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: {
          args: [1, 50],
          msg: 'Vehicle make must be between 1 and 50 characters',
        },
      },
    },
    model: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: {
          args: [1, 50],
          msg: 'Vehicle model must be between 1 and 50 characters',
        },
      },
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: {
          args: [1980],
          msg: 'Vehicle year cannot be before 1980',
        },
        max: {
          args: [new Date().getFullYear() + 1],
          msg: 'Vehicle year cannot be in the future',
        },
      },
    },
    color: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: {
        len: {
          args: [1, 30],
          msg: 'Vehicle color must be between 1 and 30 characters',
        },
      },
    },
    licensePlate: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'license_plate',
      unique: true,
      validate: {
        len: {
          args: [1, 20],
          msg: 'License plate must be between 1 and 20 characters',
        },
      },
    },
    type: {
      type: DataTypes.ENUM(...Object.values(VehicleType)),
      allowNull: false,
      field: 'vehicle_type',
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'seats_available',
      validate: {
        min: {
          args: [1],
          msg: 'Vehicle capacity must be at least 1',
        },
        max: {
          args: [8],
          msg: 'Vehicle capacity cannot exceed 8 passengers',
        },
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(VehicleStatus)),
      allowNull: false,
      defaultValue: VehicleStatus.INACTIVE,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'is_verified',
      defaultValue: false,
    },
    registrationDocument: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: {
          msg: 'Registration document must be a valid URL',
        },
      },
    },
    insuranceDocument: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: {
          msg: 'Insurance document must be a valid URL',
        },
      },
    },
    inspectionExpiry: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isAfter: {
          args: new Date().toISOString(),
          msg: 'Inspection expiry date must be in the future',
        },
      },
    },
    verificationSubmittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verification_submitted_at',
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
    tableName: 'vehicles',
    timestamps: true,
    paranoid: false, // No soft delete for this table
    indexes: [
      {
        fields: ['driverId'],
      },
      {
        fields: ['licensePlate'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['isVerified'],
      },
    ],
    getterMethods: {
      displayName() {
        return `${this.year} ${this.make} ${this.model}`;
      },
    },
  },
);

export default Vehicle;
