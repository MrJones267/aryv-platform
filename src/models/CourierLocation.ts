/**
 * @fileoverview CourierLocation model for real-time tracking during deliveries
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// CourierLocation interface
export interface CourierLocationAttributes {
  id: string;
  deliveryAgreementId: string;
  courierId: string;
  location: [number, number]; // [longitude, latitude]
  accuracy?: number; // GPS accuracy in meters
  speed?: number; // Speed in km/h
  heading?: number; // Direction in degrees (0-360)
  timestamp: Date;
}

export interface CourierLocationCreationAttributes extends Optional<CourierLocationAttributes,
  'id' | 'accuracy' | 'speed' | 'heading'
> {}

export class CourierLocation extends Model<CourierLocationAttributes, CourierLocationCreationAttributes>
  implements CourierLocationAttributes {

  public id!: string;
  public deliveryAgreementId!: string;
  public courierId!: string;
  public location!: [number, number];
  public accuracy?: number;
  public speed?: number;
  public heading?: number;
  public timestamp!: Date;

  // Associations
  public readonly deliveryAgreement?: DeliveryAgreement;
  public readonly courier?: import('./User').UserModel;

  // Methods
  public isRecentLocation(): boolean {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.timestamp > fiveMinutesAgo;
  }

  public isAccurate(): boolean {
    return this.accuracy ? this.accuracy <= 50 : true; // Consider accurate if within 50 meters
  }

  public getLocationAge(): number {
    return Date.now() - this.timestamp.getTime();
  }

  public override toJSON(): object {
    const values = { ...this.get() };
    return {
      ...values,
      isRecent: this.isRecentLocation(),
      isAccurate: this.isAccurate(),
      ageInMinutes: Math.floor(this.getLocationAge() / (1000 * 60)),
    };
  }
}

CourierLocation.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  deliveryAgreementId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'delivery_agreements',
      key: 'id',
    },
    field: 'delivery_agreement_id',
  },
  courierId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    field: 'courier_id',
  },
  location: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: false,
  },
  accuracy: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    validate: {
      min: 0,
    },
  },
  speed: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    validate: {
      min: 0,
    },
  },
  heading: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    validate: {
      min: 0,
      max: 360,
    },
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'CourierLocation',
  tableName: 'courier_locations',
  timestamps: false,
  indexes: [
    { fields: ['delivery_agreement_id'] },
    { fields: ['courier_id'] },
    {
      fields: ['location'],
      using: 'gist',
    },
    { fields: ['timestamp'] },
  ],
});

// Import these to avoid circular dependencies - will be set up in index.ts
import { DeliveryAgreement } from './DeliveryAgreement';

export default CourierLocation;
