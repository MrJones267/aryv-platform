"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const types_1 = require("../types");
const Vehicle = database_1.sequelize.define('vehicles', {
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    driverId: {
        type: sequelize_1.DataTypes.UUID,
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
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        validate: {
            len: {
                args: [1, 50],
                msg: 'Vehicle make must be between 1 and 50 characters',
            },
        },
    },
    model: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        validate: {
            len: {
                args: [1, 50],
                msg: 'Vehicle model must be between 1 and 50 characters',
            },
        },
    },
    year: {
        type: sequelize_1.DataTypes.INTEGER,
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
        type: sequelize_1.DataTypes.STRING(30),
        allowNull: false,
        validate: {
            len: {
                args: [1, 30],
                msg: 'Vehicle color must be between 1 and 30 characters',
            },
        },
    },
    licensePlate: {
        type: sequelize_1.DataTypes.STRING(20),
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
        type: sequelize_1.DataTypes.ENUM(...Object.values(types_1.VehicleType)),
        allowNull: false,
        field: 'vehicle_type',
    },
    capacity: {
        type: sequelize_1.DataTypes.INTEGER,
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
        type: sequelize_1.DataTypes.ENUM(...Object.values(types_1.VehicleStatus)),
        allowNull: false,
        defaultValue: types_1.VehicleStatus.INACTIVE,
    },
    isVerified: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        field: 'is_verified',
        defaultValue: false,
    },
    registrationDocument: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        validate: {
            isUrl: {
                msg: 'Registration document must be a valid URL',
            },
        },
    },
    insuranceDocument: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        validate: {
            isUrl: {
                msg: 'Insurance document must be a valid URL',
            },
        },
    },
    inspectionExpiry: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true,
        validate: {
            isAfter: {
                args: new Date().toISOString(),
                msg: 'Inspection expiry date must be in the future',
            },
        },
    },
    verificationSubmittedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'verification_submitted_at',
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
    tableName: 'vehicles',
    timestamps: true,
    paranoid: false,
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
});
exports.default = Vehicle;
//# sourceMappingURL=Vehicle.js.map