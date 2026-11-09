/**
 * @fileoverview The pickup PIN for one booking
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 *
 * Kept apart from bookings because booking rows reach the driver, who must
 * only ever be able to check it. See PickupPinService.
 */

import {
  Model,
  DataTypes,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import { sequelize } from '../config/database';

export interface BookingPinModel extends Model<InferAttributes<BookingPinModel>, InferCreationAttributes<BookingPinModel>> {
  bookingId: string;
  pin: string;
  failedAttempts: CreationOptional<number>;
  verifiedAt: CreationOptional<Date | null>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const BookingPin = sequelize.define<BookingPinModel>(
  'booking_pins',
  {
    bookingId: { type: DataTypes.UUID, primaryKey: true, field: 'booking_id', references: { model: 'bookings', key: 'id' }, onDelete: 'CASCADE' },
    pin: { type: DataTypes.STRING(4), allowNull: false },
    failedAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'failed_attempts' },
    verifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'verified_at' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  {
    tableName: 'booking_pins',
    timestamps: true,
    underscored: true,
  },
);

export { BookingPin };
export default BookingPin;
