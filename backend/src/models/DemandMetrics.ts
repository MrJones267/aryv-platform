/**
 * @fileoverview Demand Metrics model for real-time pricing engine
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Demand metrics attributes interface
export interface DemandMetricsAttributes {
  id: string;
  locationHash: string; // Geographic area identifier
  timeSlot: Date; // Hour-based time slot
  availableCouriers: number;
  activeDemand: number; // Active package requests
  completedDeliveries: number;
  averageDeliveryTime: number; // In minutes
  demandMultiplier: number; // Current demand-based pricing multiplier
  weatherConditions: string | null;
  eventModifier: number; // Special event impact modifier
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Optional attributes for creation
interface DemandMetricsCreationAttributes extends Optional<DemandMetricsAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class DemandMetrics extends Model<DemandMetricsAttributes, DemandMetricsCreationAttributes> implements DemandMetricsAttributes {
  public id!: string;
  public locationHash!: string;
  public timeSlot!: Date;
  public availableCouriers!: number;
  public activeDemand!: number;
  public completedDeliveries!: number;
  public averageDeliveryTime!: number;
  public demandMultiplier!: number;
  public weatherConditions!: string | null;
  public eventModifier!: number;
  public calculatedAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Helper methods
  public getDemandLevel(): 'LOW' | 'NORMAL' | 'HIGH' | 'SURGE' {
    if (this.demandMultiplier >= 2.5) return 'SURGE';
    if (this.demandMultiplier >= 1.5) return 'HIGH';
    if (this.demandMultiplier >= 1.0) return 'NORMAL';
    return 'LOW';
  }

  public getSupplyDemandRatio(): number {
    if (this.activeDemand === 0) return this.availableCouriers;
    return this.availableCouriers / this.activeDemand;
  }

  public isDataFresh(maxAgeMinutes: number = 15): boolean {
    const ageMs = Date.now() - this.calculatedAt.getTime();
    return ageMs <= maxAgeMinutes * 60 * 1000;
  }

  public override toJSON() {
    const values = { ...this.get() };
    return {
      ...values,
      demandLevel: this.getDemandLevel(),
      supplyDemandRatio: this.getSupplyDemandRatio(),
      isDataFresh: this.isDataFresh(),
    };
  }
}

DemandMetrics.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  locationHash: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'location_hash',
    validate: {
      notEmpty: true,
    },
  },
  timeSlot: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'time_slot',
  },
  availableCouriers: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'available_couriers',
    validate: {
      min: 0,
    },
  },
  activeDemand: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'active_demand',
    validate: {
      min: 0,
    },
  },
  completedDeliveries: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'completed_deliveries',
    validate: {
      min: 0,
    },
  },
  averageDeliveryTime: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'average_delivery_time',
    validate: {
      min: 0,
    },
  },
  demandMultiplier: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 1.00,
    field: 'demand_multiplier',
    validate: {
      min: 0.5,
      max: 5.0,
    },
  },
  weatherConditions: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'weather_conditions',
  },
  eventModifier: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 1.00,
    field: 'event_modifier',
    validate: {
      min: 0.5,
      max: 3.0,
    },
  },
  calculatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'calculated_at',
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
}, {
  sequelize,
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

export { DemandMetrics };
export default DemandMetrics;
