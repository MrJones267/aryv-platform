/**
 * @fileoverview Ride model with Sequelize and PostGIS support
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
import { RideStatus, Coordinates, GeoPoint } from '../types';
import type { UserModel } from './User';
import type { VehicleModel } from './Vehicle';

// Ride model interface
export interface RideModel extends Model<
  InferAttributes<RideModel>,
  InferCreationAttributes<RideModel>
> {
  id: CreationOptional<string>;
  driverId: ForeignKey<string>;
  vehicleId: ForeignKey<string>;
  originAddress: string;
  originCoordinates: GeoPoint;
  destinationAddress: string;
  destinationCoordinates: GeoPoint;
  departureTime: Date;
  estimatedDuration: CreationOptional<number | null>; // in minutes
  distance: CreationOptional<number | null>; // in kilometers
  availableSeats: number;
  pricePerSeat: number;
  status: CreationOptional<RideStatus>;
  description: CreationOptional<string | null>;
  route: CreationOptional<Coordinates[] | null>; // Polyline coordinates
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;

  // Associations
  driver?: NonAttribute<UserModel>;
  vehicle?: NonAttribute<VehicleModel>;

  // Virtual attributes
  isActive: NonAttribute<boolean>;
  bookedSeats: NonAttribute<number>;
}

// Define Ride model
const Ride = sequelize.define<RideModel>(
  'rides',
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
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    vehicleId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'vehicle_id',
      references: {
        model: 'vehicles',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    originAddress: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'origin_address',
      validate: {
        len: {
          args: [10, 500],
          msg: 'Origin address must be between 10 and 500 characters',
        },
      },
    },
    originCoordinates: {
      type: DataTypes.GEOMETRY('POINT'),
      allowNull: false,
      field: 'origin_coordinates',
      validate: {
        isValidCoordinates(value: any) {
          if (!value || !value.coordinates || value.coordinates.length !== 2) {
            throw new Error('Invalid origin coordinates');
          }
          const [longitude, latitude] = value.coordinates;
          if (latitude < -90 || latitude > 90) {
            throw new Error('Latitude must be between -90 and 90');
          }
          if (longitude < -180 || longitude > 180) {
            throw new Error('Longitude must be between -180 and 180');
          }
        },
      },
    },
    destinationAddress: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'destination_address',
      validate: {
        len: {
          args: [10, 500],
          msg: 'Destination address must be between 10 and 500 characters',
        },
      },
    },
    destinationCoordinates: {
      type: DataTypes.GEOMETRY('POINT'),
      allowNull: false,
      field: 'destination_coordinates',
      validate: {
        isValidCoordinates(value: any) {
          if (!value || !value.coordinates || value.coordinates.length !== 2) {
            throw new Error('Invalid destination coordinates');
          }
          const [longitude, latitude] = value.coordinates;
          if (latitude < -90 || latitude > 90) {
            throw new Error('Latitude must be between -90 and 90');
          }
          if (longitude < -180 || longitude > 180) {
            throw new Error('Longitude must be between -180 and 180');
          }
        },
      },
    },
    departureTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'departure_time',
      validate: {
        isAfter: {
          args: new Date().toISOString(),
          msg: 'Departure time must be in the future',
        },
      },
    },
    estimatedDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'estimated_duration',
      validate: {
        min: {
          args: [1],
          msg: 'Estimated duration must be at least 1 minute',
        },
        max: {
          args: [1440], // 24 hours
          msg: 'Estimated duration cannot exceed 24 hours',
        },
      },
    },
    distance: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      validate: {
        min: {
          args: [0.1],
          msg: 'Distance must be at least 0.1 km',
        },
        max: {
          args: [2000],
          msg: 'Distance cannot exceed 2000 km',
        },
      },
    },
    availableSeats: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'available_seats',
      validate: {
        min: {
          args: [1],
          msg: 'Available seats must be at least 1',
        },
        max: {
          args: [7],
          msg: 'Available seats cannot exceed 7',
        },
      },
    },
    pricePerSeat: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'price_per_seat',
      validate: {
        min: {
          args: [0.01],
          msg: 'Price per seat must be at least 0.01',
        },
        max: {
          args: [10000],
          msg: 'Price per seat cannot exceed 10,000',
        },
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(RideStatus)),
      allowNull: false,
      defaultValue: RideStatus.PENDING,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: 'Description cannot exceed 1000 characters',
        },
      },
    },
    route: {
      type: DataTypes.JSON,
      allowNull: true,
      validate: {
        isValidRoute(value: any) {
          if (value && (!Array.isArray(value) || value.length < 2)) {
            throw new Error('Route must be an array with at least 2 coordinates');
          }
        },
      },
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
    tableName: 'rides',
    timestamps: true,
    paranoid: false, // No soft delete for this table
    indexes: [
      {
        fields: ['driverId'],
      },
      {
        fields: ['vehicleId'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['departureTime'],
      },
      {
        fields: ['pricePerSeat'],
      },
      {
        name: 'origin_gist_idx',
        fields: ['originCoordinates'],
        using: 'GIST',
      },
      {
        name: 'destination_gist_idx',
        fields: ['destinationCoordinates'],
        using: 'GIST',
      },
    ],
    getterMethods: {
      isActive() {
        return [RideStatus.PENDING, RideStatus.CONFIRMED].includes(this.status);
      },
    },
  },
);

export default Ride;
