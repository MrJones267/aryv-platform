/**
 * @fileoverview A face photo taken for one side of one booking
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 *
 * The passenger takes one when booking and the driver when accepting, so
 * each can check who is actually getting into the car. Kept only until a
 * day after the trip; see TripPhotoService.
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

export type TripPhotoRole = 'passenger' | 'driver';

export interface TripPhotoModel extends Model<InferAttributes<TripPhotoModel>, InferCreationAttributes<TripPhotoModel>> {
  id: CreationOptional<string>;
  bookingId: ForeignKey<string>;
  userId: ForeignKey<string>;
  role: TripPhotoRole;
  /** FileStorageService key, `trip-photos/<file>`. */
  storageKey: string;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const TripPhoto = sequelize.define<TripPhotoModel>(
  'trip_photos',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    bookingId: { type: DataTypes.UUID, allowNull: false, field: 'booking_id', references: { model: 'bookings', key: 'id' }, onDelete: 'CASCADE' },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id', references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    role: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [['passenger', 'driver']] } },
    storageKey: { type: DataTypes.TEXT, allowNull: false, field: 'storage_key' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  {
    tableName: 'trip_photos',
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['booking_id', 'role'] }],
  },
);

export { TripPhoto };
export default TripPhoto;
