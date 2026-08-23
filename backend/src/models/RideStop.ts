/**
 * @fileoverview A stop along a ride's route.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Sequence 0 is the origin and the highest sequence is the final destination,
 * so a journey is always at least two stops. `fareFromOrigin` is cumulative,
 * which makes the fare for any segment a single subtraction rather than a sum
 * over legs — and availability checks run that arithmetic on every search.
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
import { GeoPoint } from '../types';

export interface RideStopModel extends Model<
  InferAttributes<RideStopModel>,
  InferCreationAttributes<RideStopModel>
> {
  id: CreationOptional<string>;
  rideId: ForeignKey<string>;

  sequence: number;
  address: string;
  coordinates: GeoPoint;

  fareFromOrigin: CreationOptional<number>;
  estimatedArrival: CreationOptional<Date | null>;

  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const RideStop = sequelize.define<RideStopModel>(
  'ride_stops',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    rideId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'ride_id',
      references: { model: 'rides', key: 'id' },
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0 },
    },
    address: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    coordinates: {
      type: DataTypes.GEOMETRY('POINT'),
      allowNull: false,
    },
    fareFromOrigin: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'fare_from_origin',
    },
    estimatedArrival: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'estimated_arrival',
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
    tableName: 'ride_stops',
    timestamps: true,
    underscored: true,
  },
);

export default RideStop;
