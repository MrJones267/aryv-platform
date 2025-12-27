"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryTier = exports.DeliveryTierType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var DeliveryTierType;
(function (DeliveryTierType) {
    DeliveryTierType["LIGHTNING"] = "lightning";
    DeliveryTierType["EXPRESS"] = "express";
    DeliveryTierType["STANDARD"] = "standard";
    DeliveryTierType["ECONOMY"] = "economy";
})(DeliveryTierType || (exports.DeliveryTierType = DeliveryTierType = {}));
class DeliveryTier extends sequelize_1.Model {
    getDeliveryWindow() {
        if (this.minDeliveryHours === this.maxDeliveryHours) {
            return `${this.maxDeliveryHours} hour${this.maxDeliveryHours > 1 ? 's' : ''}`;
        }
        return `${this.minDeliveryHours}-${this.maxDeliveryHours} hours`;
    }
    isWithinSLA(deliveryTime, createdTime) {
        const hoursDiff = (deliveryTime.getTime() - createdTime.getTime()) / (1000 * 60 * 60);
        return hoursDiff <= this.maxDeliveryHours;
    }
    calculatePlatformFee(agreedPrice) {
        return agreedPrice * (this.platformFeePercentage / 100);
    }
    toJSON() {
        const values = { ...this.get() };
        return values;
    }
}
exports.DeliveryTier = DeliveryTier;
DeliveryTier.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    tierType: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(DeliveryTierType)),
        allowNull: false,
        unique: true,
        field: 'tier_type',
    },
    tierName: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        field: 'tier_name',
        validate: {
            notEmpty: true,
            len: [1, 100],
        },
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true,
        },
    },
    maxDeliveryHours: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        field: 'max_delivery_hours',
        validate: {
            min: 1,
            max: 48,
        },
    },
    minDeliveryHours: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        field: 'min_delivery_hours',
        validate: {
            min: 1,
            max: 48,
        },
    },
    basePriceMultiplier: {
        type: sequelize_1.DataTypes.DECIMAL(4, 2),
        allowNull: false,
        field: 'base_price_multiplier',
        validate: {
            min: 0.1,
            max: 10.0,
        },
    },
    platformFeePercentage: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: false,
        field: 'platform_fee_percentage',
        validate: {
            min: 5.0,
            max: 50.0,
        },
    },
    slaGuarantee: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: false,
        field: 'sla_guarantee',
        validate: {
            min: 50.0,
            max: 100.0,
        },
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
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
    modelName: 'DeliveryTier',
    tableName: 'delivery_tiers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['tier_type'], unique: true },
        { fields: ['is_active'] },
        { fields: ['base_price_multiplier'] },
    ],
});
exports.default = DeliveryTier;
//# sourceMappingURL=DeliveryTier.js.map