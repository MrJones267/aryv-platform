/**
 * @fileoverview Call model for Voice/Video calling system
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import User from './User';

export enum CallType {
  VOICE = 'voice',
  VIDEO = 'video',
  EMERGENCY = 'emergency'
}

export enum CallStatus {
  INITIATED = 'initiated',
  RINGING = 'ringing',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  ENDED = 'ended',
  FAILED = 'failed',
  MISSED = 'missed'
}

export enum CallPurpose {
  RIDE_COMMUNICATION = 'ride_communication',
  COURIER_DELIVERY = 'courier_delivery',
  EMERGENCY_CALL = 'emergency_call',
  CUSTOMER_SUPPORT = 'customer_support'
}

export interface CallAttributes {
  id: string;
  callerId: string;
  calleeId: string;
  callType: CallType;
  callPurpose: CallPurpose;
  status: CallStatus;
  rideId?: string;
  deliveryId?: string;
  isEmergency: boolean;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number; // Duration in seconds
  recordingUrl?: string;
  recordingEnabled: boolean;
  quality: number; // Call quality score 1-5
  metadata: {
    userAgent?: string;
    deviceInfo?: any;
    networkType?: string;
    resolution?: string;
    bandwidth?: number;
    rejectionReason?: string;
    endReason?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CallCreationAttributes extends Optional<CallAttributes, 'id' | 'startedAt' | 'endedAt' | 'duration' | 'recordingUrl' | 'quality' | 'createdAt' | 'updatedAt'> {}

export class Call extends Model<CallAttributes, CallCreationAttributes> implements CallAttributes {
  public id!: string;
  public callerId!: string;
  public calleeId!: string;
  public callType!: CallType;
  public callPurpose!: CallPurpose;
  public status!: CallStatus;
  public rideId?: string;
  public deliveryId?: string;
  public isEmergency!: boolean;
  public startedAt?: Date;
  public endedAt?: Date;
  public duration?: number;
  public recordingUrl?: string;
  public recordingEnabled!: boolean;
  public quality!: number;
  public metadata!: any;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association helpers
  public Caller?: typeof User;
  public Callee?: typeof User;

  // Helper methods
  public getDurationFormatted(): string {
    if (!this.duration) return '00:00';
    const minutes = Math.floor(this.duration / 60);
    const seconds = this.duration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  public isActiveCall(): boolean {
    return [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ACCEPTED].includes(this.status);
  }

  public canRecord(): boolean {
    return this.recordingEnabled && !this.isEmergency; // Emergency calls have special recording rules
  }
}

Call.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    callerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: 'User initiating the call',
    },
    calleeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: 'User receiving the call',
    },
    callType: {
      type: DataTypes.ENUM(...Object.values(CallType)),
      allowNull: false,
      defaultValue: CallType.VOICE,
      comment: 'Type of call: voice, video, or emergency',
    },
    callPurpose: {
      type: DataTypes.ENUM(...Object.values(CallPurpose)),
      allowNull: false,
      defaultValue: CallPurpose.RIDE_COMMUNICATION,
      comment: 'Purpose/context of the call',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(CallStatus)),
      allowNull: false,
      defaultValue: CallStatus.INITIATED,
      comment: 'Current status of the call',
    },
    rideId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'rides',
        key: 'id',
      },
      comment: 'Associated ride ID if call is ride-related',
    },
    deliveryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'delivery_agreements',
        key: 'id',
      },
      comment: 'Associated delivery ID if call is delivery-related',
    },
    isEmergency: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this is an emergency call',
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the call was actually connected',
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the call was terminated',
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Call duration in seconds',
    },
    recordingUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'URL to call recording if available',
    },
    recordingEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether call recording is enabled',
    },
    quality: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      validate: {
        min: 1,
        max: 5,
      },
      comment: 'Call quality rating from 1-5',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Additional call metadata and technical information',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Call',
    tableName: 'calls',
    indexes: [
      {
        fields: ['caller_id'],
      },
      {
        fields: ['callee_id'],
      },
      {
        fields: ['ride_id'],
      },
      {
        fields: ['delivery_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['call_type'],
      },
      {
        fields: ['is_emergency'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['caller_id', 'callee_id', 'created_at'],
      },
    ],
  },
);

// Define associations
Call.belongsTo(User, {
  foreignKey: 'callerId',
  as: 'caller',
});

Call.belongsTo(User, {
  foreignKey: 'calleeId',
  as: 'callee',
});

User.hasMany(Call, {
  foreignKey: 'callerId',
  as: 'outgoingCalls',
});

User.hasMany(Call, {
  foreignKey: 'calleeId',
  as: 'incomingCalls',
});

export default Call;
