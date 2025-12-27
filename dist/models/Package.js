"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Package = exports.PackageSize = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var PackageSize;
(function (PackageSize) {
    PackageSize["SMALL"] = "small";
    PackageSize["MEDIUM"] = "medium";
    PackageSize["LARGE"] = "large";
    PackageSize["CUSTOM"] = "custom";
})(PackageSize || (exports.PackageSize = PackageSize = {}));
class Package extends sequelize_1.Model {
    isExpired() {
        return this.expiresAt ? new Date() > this.expiresAt : false;
    }
    calculateVolume() {
        if (this.dimensionsLength && this.dimensionsWidth && this.dimensionsHeight) {
            return this.dimensionsLength * this.dimensionsWidth * this.dimensionsHeight;
        }
        return null;
    }
    toJSON() {
        const values = { ...this.get() };
        return values;
    }
}
exports.Package = Package;
Package.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    senderId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        field: 'sender_id',
    },
    title: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [1, 200],
        },
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    dimensionsLength: {
        type: sequelize_1.DataTypes.DECIMAL(6, 2),
        allowNull: true,
        field: 'dimensions_length',
        validate: {
            min: 0,
        },
    },
    dimensionsWidth: {
        type: sequelize_1.DataTypes.DECIMAL(6, 2),
        allowNull: true,
        field: 'dimensions_width',
        validate: {
            min: 0,
        },
    },
    dimensionsHeight: {
        type: sequelize_1.DataTypes.DECIMAL(6, 2),
        allowNull: true,
        field: 'dimensions_height',
        validate: {
            min: 0,
        },
    },
    weight: {
        type: sequelize_1.DataTypes.DECIMAL(8, 3),
        allowNull: true,
        validate: {
            min: 0,
        },
    },
    packageSize: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(PackageSize)),
        allowNull: false,
        defaultValue: PackageSize.MEDIUM,
        field: 'package_size',
    },
    fragile: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    valuable: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    specialInstructions: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        field: 'special_instructions',
    },
    pickupAddress: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: false,
        field: 'pickup_address',
        validate: {
            notEmpty: true,
        },
    },
    pickupCoordinates: {
        type: sequelize_1.DataTypes.GEOMETRY('POINT'),
        allowNull: false,
        field: 'pickup_coordinates',
    },
    pickupContactName: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        field: 'pickup_contact_name',
    },
    pickupContactPhone: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: true,
        field: 'pickup_contact_phone',
    },
    dropoffAddress: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: false,
        field: 'dropoff_address',
        validate: {
            notEmpty: true,
        },
    },
    dropoffCoordinates: {
        type: sequelize_1.DataTypes.GEOMETRY('POINT'),
        allowNull: false,
        field: 'dropoff_coordinates',
    },
    dropoffContactName: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        field: 'dropoff_contact_name',
    },
    dropoffContactPhone: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: true,
        field: 'dropoff_contact_phone',
    },
    packageImages: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        field: 'package_images',
    },
    distance: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: true,
        validate: {
            min: 0,
        },
    },
    senderPriceOffer: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        field: 'sender_price_offer',
        validate: {
            min: 0.01,
        },
    },
    systemSuggestedPrice: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: true,
        field: 'system_suggested_price',
        validate: {
            min: 0,
        },
    },
    deliveryTierId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'delivery_tiers',
            key: 'id',
        },
        field: 'delivery_tier_id',
    },
    requestedDeliveryTime: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'requested_delivery_time',
    },
    urgencyLevel: {
        type: sequelize_1.DataTypes.ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT'),
        allowNull: true,
        field: 'urgency_level',
    },
    demandMultiplierApplied: {
        type: sequelize_1.DataTypes.DECIMAL(4, 2),
        allowNull: true,
        field: 'demand_multiplier_applied',
        validate: {
            min: 0.5,
            max: 5.0,
        },
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
    },
    expiresAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'expires_at',
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'created_at',
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'updated_at',
    },
}, {
    sequelize: database_1.sequelize,
    modelName: 'Package',
    tableName: 'packages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['sender_id'] },
        { fields: ['is_active'] },
        { fields: ['package_size'] },
        { fields: ['created_at'] },
        { fields: ['delivery_tier_id'] },
        { fields: ['urgency_level'] },
        { fields: ['requested_delivery_time'] },
        {
            fields: ['pickup_coordinates'],
            using: 'gist',
        },
        {
            fields: ['dropoff_coordinates'],
            using: 'gist',
        },
    ],
});
exports.default = Package;
//# sourceMappingURL=Package.js.map