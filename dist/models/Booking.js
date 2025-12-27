"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const types_1 = require("../types");
const Booking = database_1.sequelize.define('bookings', {
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    rideId: {
        type: sequelize_1.DataTypes.UUID,
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
        type: sequelize_1.DataTypes.UUID,
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
        type: sequelize_1.DataTypes.INTEGER,
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
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
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
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
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
        type: sequelize_1.DataTypes.ENUM(...Object.values(types_1.BookingStatus)),
        allowNull: false,
        defaultValue: types_1.BookingStatus.PENDING,
    },
    pickupAddress: {
        type: sequelize_1.DataTypes.TEXT,
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
        type: sequelize_1.DataTypes.TEXT,
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
        type: sequelize_1.DataTypes.TEXT,
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
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        field: 'payment_intent_id',
        unique: true,
    },
    cancelReason: {
        type: sequelize_1.DataTypes.TEXT,
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
        type: sequelize_1.DataTypes.INTEGER,
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
        type: sequelize_1.DataTypes.TEXT,
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
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
    },
}, {
    tableName: 'bookings',
    timestamps: true,
    paranoid: false,
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
                    [sequelize_1.Op.ne]: null,
                },
            },
        },
        {
            fields: ['rideId', 'passengerId'],
            unique: true,
            name: 'unique_passenger_per_ride',
        },
    ],
    getterMethods: {
        canCancel() {
            return [types_1.BookingStatus.PENDING, types_1.BookingStatus.CONFIRMED].includes(this.status);
        },
        canRate() {
            return this.status === types_1.BookingStatus.COMPLETED && !this['ratingGiven'];
        },
    },
    validate: {
        ratingRequiresReview() {
            if (this['ratingGiven'] && !this['reviewText']) {
                throw new Error('Review text is required when giving a rating');
            }
        },
        cancelReasonRequired() {
            if (this['status'] === types_1.BookingStatus.CANCELLED && !this['cancelReason']) {
                throw new Error('Cancel reason is required when cancelling a booking');
            }
        },
    },
});
exports.default = Booking;
//# sourceMappingURL=Booking.js.map