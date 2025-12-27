"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemandMetrics = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class DemandMetrics extends sequelize_1.Model {
    getDemandLevel() {
        if (this.demandMultiplier >= 2.5)
            return 'SURGE';
        if (this.demandMultiplier >= 1.5)
            return 'HIGH';
        if (this.demandMultiplier >= 1.0)
            return 'NORMAL';
        return 'LOW';
    }
    getSupplyDemandRatio() {
        if (this.activeDemand === 0)
            return this.availableCouriers;
        return this.availableCouriers / this.activeDemand;
    }
    isDataFresh(maxAgeMinutes = 15) {
        const ageMs = Date.now() - this.calculatedAt.getTime();
        return ageMs <= maxAgeMinutes * 60 * 1000;
    }
    toJSON() {
        const values = { ...this.get() };
        return {
            ...values,
            demandLevel: this.getDemandLevel(),
            supplyDemandRatio: this.getSupplyDemandRatio(),
            isDataFresh: this.isDataFresh(),
        };
    }
}
exports.DemandMetrics = DemandMetrics;
DemandMetrics.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    locationHash: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        field: 'location_hash',
        validate: {
            notEmpty: true,
        },
    },
    timeSlot: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        field: 'time_slot',
    },
    availableCouriers: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'available_couriers',
        validate: {
            min: 0,
        },
    },
    activeDemand: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'active_demand',
        validate: {
            min: 0,
        },
    },
    completedDeliveries: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'completed_deliveries',
        validate: {
            min: 0,
        },
    },
    averageDeliveryTime: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'average_delivery_time',
        validate: {
            min: 0,
        },
    },
    demandMultiplier: {
        type: sequelize_1.DataTypes.DECIMAL(4, 2),
        allowNull: false,
        defaultValue: 1.00,
        field: 'demand_multiplier',
        validate: {
            min: 0.5,
            max: 5.0,
        },
    },
    weatherConditions: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        field: 'weather_conditions',
    },
    eventModifier: {
        type: sequelize_1.DataTypes.DECIMAL(4, 2),
        allowNull: false,
        defaultValue: 1.00,
        field: 'event_modifier',
        validate: {
            min: 0.5,
            max: 3.0,
        },
    },
    calculatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        field: 'calculated_at',
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
    modelName: 'DemandMetrics',
    tableName: 'demand_metrics',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['location_hash', 'time_slot'], unique: true },
        { fields: ['calculated_at'] },
        { fields: ['demand_multiplier'] },
        { fields: ['time_slot'] },
    ],
});
exports.default = DemandMetrics;
//# sourceMappingURL=DemandMetrics.js.map