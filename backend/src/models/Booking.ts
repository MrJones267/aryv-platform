/**
 * @fileoverview Booking model for ride reservations
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import {
  Model,
  DataTypes,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  ForeignKey,
  NonAttribute,
  Op,
} from 'sequelize';
import { sequelize } from '../config/database';
import { BookingStatus } from '../types';
import type { UserModel } from './User';
import type { RideModel } from './Ride';

// Booking model interface
export interface BookingModel extends Model<
  InferAttributes<BookingModel>,
  InferCreationAttributes<BookingModel>
> {
  id: CreationOptional<string>;
  rideId: ForeignKey<string>;
  passengerId: ForeignKey<string>;
  seatsBooked: number;
  totalAmount: number;
  platformFee: number;
  status: CreationOptional<BookingStatus>;
  pickupAddress: CreationOptional<string | null>;
  dropoffAddress: CreationOptional<string | null>;
  specialRequests: CreationOptional<string | null>;
  paymentIntentId: CreationOptional<string | null>;
  cancelReason: CreationOptional<string | null>;
  ratingGiven: CreationOptional<number | null>;
  reviewText: CreationOptional<string | null>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;

  // Associations
  ride?: NonAttribute<RideModel>;
  passenger?: NonAttribute<UserModel>;

  // Virtual attributes
  canCancel: NonAttribute<boolean>;
  canRate: NonAttribute<boolean>;
}

// Define Booking model
const Booking = sequelize.define<BookingModel>(
  'bookings',
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
      references: {
        model: 'rides',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    passengerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'passenger_id',
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    seatsBooked: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'seats_booked',
      validate: {
        min: {
          args: [1],
          msg: 'Must book at least 1 seat',
        },
        max: {
          args: [7],
          msg: 'Cannot book more than 7 seats',
        },
      },
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'total_amount',
      validate: {
        min: {
          args: [0.01],
          msg: 'Total amount must be greater than 0',
        },
      },
    },
    platformFee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'platform_fee',
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Platform fee cannot be negative',
        },
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(BookingStatus)),
      allowNull: false,
      defaultValue: BookingStatus.PENDING,
    },
    pickupAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'pickup_address',
      validate: {
        len: {
          args: [0, 500],
          msg: 'Pickup address cannot exceed 500 characters',
        },
      },
    },
    dropoffAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'dropoff_address',
      validate: {
        len: {
          args: [0, 500],
          msg: 'Dropoff address cannot exceed 500 characters',
        },
      },
    },
    specialRequests: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'special_requests',
      validate: {
        len: {
          args: [0, 1000],
          msg: 'Special requests cannot exceed 1000 characters',
        },
      },
    },
    paymentIntentId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'payment_intent_id',
      unique: true,
    },
    cancelReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'cancel_reason',
      validate: {
        len: {
          args: [0, 500],
          msg: 'Cancel reason cannot exceed 500 characters',
        },
      },
    },
    ratingGiven: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'rating_given',
      validate: {
        min: {
          args: [1],
          msg: 'Rating must be at least 1',
        },
        max: {
          args: [5],
          msg: 'Rating cannot exceed 5',
        },
      },
    },
    reviewText: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'review_text',
      validate: {
        len: {
          args: [0, 1000],
          msg: 'Review text cannot exceed 1000 characters',
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
    tableName: 'bookings',
    timestamps: true,
    paranoid: false, // No soft delete for this table
    indexes: [
      {
        fields: ['rideId'],
      },
      {
        fields: ['passengerId'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['createdAt'],
      },
      {
        fields: ['paymentIntentId'],
        unique: true,
        where: {
          paymentIntentId: {
            [Op.ne]: null,
          },
        },
      },
      {
        // Unique constraint: one booking per passenger per ride
        fields: ['rideId', 'passengerId'],
        unique: true,
        name: 'unique_passenger_per_ride',
      },
    ],
    getterMethods: {
      canCancel() {
        return [BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(this.status);
      },
      canRate() {
        return this.status === BookingStatus.COMPLETED && !this['ratingGiven'];
      },
    },
    validate: {
      ratingRequiresReview() {
        if (this['ratingGiven'] && !this['reviewText']) {
          throw new Error('Review text is required when giving a rating');
        }
      },
      cancelReasonRequired() {
        if (this['status'] === BookingStatus.CANCELLED && !this['cancelReason']) {
          throw new Error('Cancel reason is required when cancelling a booking');
        }
      },
    },
  },
);

export default Booking;
