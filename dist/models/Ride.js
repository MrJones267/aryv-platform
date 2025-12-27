"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const types_1 = require("../types");
const Ride = database_1.sequelize.define('rides', {
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    driverId: {
        type: sequelize_1.DataTypes.UUID,
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
        type: sequelize_1.DataTypes.UUID,
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
        type: sequelize_1.DataTypes.TEXT,
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
        type: sequelize_1.DataTypes.GEOMETRY('POINT'),
        allowNull: false,
        field: 'origin_coordinates',
        validate: {
            isValidCoordinates(value) {
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
        type: sequelize_1.DataTypes.TEXT,
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
        type: sequelize_1.DataTypes.GEOMETRY('POINT'),
        allowNull: false,
        field: 'destination_coordinates',
        validate: {
            isValidCoordinates(value) {
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
        type: sequelize_1.DataTypes.DATE,
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
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        field: 'estimated_duration',
        validate: {
            min: {
                args: [1],
                msg: 'Estimated duration must be at least 1 minute',
            },
            max: {
                args: [1440],
                msg: 'Estimated duration cannot exceed 24 hours',
            },
        },
    },
    distance: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
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
        type: sequelize_1.DataTypes.INTEGER,
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
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
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
        type: sequelize_1.DataTypes.ENUM(...Object.values(types_1.RideStatus)),
        allowNull: false,
        defaultValue: types_1.RideStatus.PENDING,
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        validate: {
            len: {
                args: [0, 1000],
                msg: 'Description cannot exceed 1000 characters',
            },
        },
    },
    route: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
        validate: {
            isValidRoute(value) {
                if (value && (!Array.isArray(value) || value.length < 2)) {
                    throw new Error('Route must be an array with at least 2 coordinates');
                }
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
    tableName: 'rides',
    timestamps: true,
    paranoid: false,
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
            return [types_1.RideStatus.PENDING, types_1.RideStatus.CONFIRMED].includes(this.status);
        },
    },
});
exports.default = Ride;
//# sourceMappingURL=Ride.js.map