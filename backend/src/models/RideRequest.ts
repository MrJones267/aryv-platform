/**
 * @fileoverview A passenger's request for a ride that does not exist yet
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Posted when a search finds nothing. Drivers see open requests near them,
 * and the passenger is told when a ride that fits is published. Requests
 * used to live in Redis for a day where no driver could see them.
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
import type { GeoPoint } from '../types';

export const RIDE_REQUEST_STATUSES = ['active', 'cancelled'] as const;
export type RideRequestStatus = typeof RIDE_REQUEST_STATUSES[number];

export interface RideRequestModel extends Model<
  InferAttributes<RideRequestModel>,
  InferCreationAttributes<RideRequestModel>
> {
  id: CreationOptional<string>;
  passengerId: ForeignKey<string>;
  originAddress: string;
  originCoordinates: GeoPoint;
  destinationAddress: string;
  destinationCoordinates: GeoPoint;
  departureTime: Date;
  seats: number;
  maxPrice: CreationOptional<number | null>;
  currency: CreationOptional<string>;
  note: CreationOptional<string | null>;
  /** 'active' until cancelled; past expiresAt it is reported as expired. */
  status: CreationOptional<RideRequestStatus>;
  expiresAt: Date;
  /** Rides the passenger has already been told about. */
  notifiedRideIds: CreationOptional<string[]>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const RideRequest = sequelize.define<RideRequestModel>(
  'ride_requests',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    passengerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'passenger_id',
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    originAddress: { type: DataTypes.STRING(500), allowNull: false, field: 'origin_address' },
    originCoordinates: { type: DataTypes.GEOMETRY('POINT', 4326), allowNull: false, field: 'origin_coordinates' },
    destinationAddress: { type: DataTypes.STRING(500), allowNull: false, field: 'destination_address' },
    destinationCoordinates: { type: DataTypes.GEOMETRY('POINT', 4326), allowNull: false, field: 'destination_coordinates' },
    departureTime: { type: DataTypes.DATE, allowNull: false, field: 'departure_time' },
    seats: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 8 } },
    maxPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'max_price' },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'BWP' },
    note: { type: DataTypes.STRING(500), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active', validate: { isIn: [RIDE_REQUEST_STATUSES as unknown as string[]] } },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
    notifiedRideIds: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'notified_ride_ids' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  {
    tableName: 'ride_requests',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['passenger_id'] }, { fields: ['status', 'departure_time'] }],
  },
);

export { RideRequest };
export default RideRequest;
