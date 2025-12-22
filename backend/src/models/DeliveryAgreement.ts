/**
 * @fileoverview DeliveryAgreement model for courier service state machine
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Delivery status enum
export enum DeliveryStatus {
  PENDING_PICKUP = 'pending_pickup',
  IN_TRANSIT = 'in_transit',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled'
}

// Event log entry interface
export interface DeliveryEvent {
  timestamp: string;
  event_type: string;
  user_id?: string;
  data: Record<string, any>;
}

// DeliveryAgreement interface
export interface DeliveryAgreementAttributes {
  id: string;
  packageId: string;
  courierId: string;
  agreedPrice: number;
  platformFee: number;
  status: DeliveryStatus;
  escrowPaymentId?: string;
  escrowAmount: number;
  escrowHeldAt?: Date;
  pickupConfirmedAt?: Date;
  pickupLocation?: [number, number];
  deliveryConfirmedAt?: Date;
  deliveryLocation?: [number, number];
  paymentReleasedAt?: Date;
  qrCodeToken?: string;
  qrCodeExpiresAt?: Date;
  eventLog: DeliveryEvent[];
  chatChannelId?: string;
  courierLocations?: Array<{lat: number, lng: number, timestamp: string}>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryAgreementCreationAttributes extends Optional<DeliveryAgreementAttributes,
  'id' | 'escrowPaymentId' | 'escrowHeldAt' | 'pickupConfirmedAt' | 'pickupLocation' |
  'deliveryConfirmedAt' | 'deliveryLocation' | 'paymentReleasedAt' | 'qrCodeToken' |
  'qrCodeExpiresAt' | 'chatChannelId' | 'createdAt' | 'updatedAt'
> {}

export class DeliveryAgreement extends Model<DeliveryAgreementAttributes, DeliveryAgreementCreationAttributes>
  implements DeliveryAgreementAttributes {

  public id!: string;
  public packageId!: string;
  public courierId!: string;
  public agreedPrice!: number;
  public platformFee!: number;
  public status!: DeliveryStatus;
  public escrowPaymentId?: string;
  public escrowAmount!: number;
  public escrowHeldAt?: Date;
  public pickupConfirmedAt?: Date;
  public pickupLocation?: [number, number];
  public deliveryConfirmedAt?: Date;
  public deliveryLocation?: [number, number];
  public paymentReleasedAt?: Date;
  public qrCodeToken?: string;
  public qrCodeExpiresAt?: Date;
  public eventLog!: DeliveryEvent[];
  public chatChannelId?: string;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Associations
  public readonly package?: Package;
  public readonly courier?: import('./User').UserModel;
  public readonly qrCodes?: DeliveryQRCode[];
  public readonly disputes?: DeliveryDispute[];
  public readonly locationHistory?: CourierLocation[];
  public readonly chatMessages?: CourierChatMessage[];

  // State machine methods
  public canTransitionTo(newStatus: DeliveryStatus): boolean {
    const validTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
      [DeliveryStatus.PENDING_PICKUP]: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.CANCELLED, DeliveryStatus.DISPUTED],
      [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.COMPLETED, DeliveryStatus.DISPUTED, DeliveryStatus.CANCELLED],
      [DeliveryStatus.COMPLETED]: [DeliveryStatus.DISPUTED],
      [DeliveryStatus.DISPUTED]: [DeliveryStatus.COMPLETED, DeliveryStatus.CANCELLED],
      [DeliveryStatus.CANCELLED]: [],
    };

    return validTransitions[this.status]?.includes(newStatus) || false;
  }

  public async transitionTo(newStatus: DeliveryStatus, userId?: string, eventData: Record<string, any> = {}): Promise<void> {
    if (!this.canTransitionTo(newStatus)) {
      throw new Error(`Invalid transition from ${this.status} to ${newStatus}`);
    }

    const oldStatus = this.status;
    this.status = newStatus;

    // Log the state transition
    await this.logEvent('status_transition', {
      from: oldStatus,
      to: newStatus,
      ...eventData,
    }, userId);

    // Handle status-specific logic
    switch (newStatus) {
      case DeliveryStatus.IN_TRANSIT:
        this.pickupConfirmedAt = new Date();
        break;
      case DeliveryStatus.COMPLETED:
        this.deliveryConfirmedAt = new Date();
        break;
    }

    await this.save();
  }

  public async logEvent(eventType: string, eventData: Record<string, any> = {}, userId?: string): Promise<void> {
    const event: DeliveryEvent = {
      timestamp: new Date().toISOString(),
      event_type: eventType,
      user_id: userId || '',
      data: eventData,
    };

    this.eventLog = [...this.eventLog, event];
    await this.save();
  }

  public generateQRToken(): string {
    // Generate a unique token for QR code
    const token = Math.random().toString(36).substring(2, 15) +
                  Math.random().toString(36).substring(2, 15);
    return token.toUpperCase();
  }

  public async createQRCode(): Promise<void> {
    const token = this.generateQRToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    this.qrCodeToken = token;
    this.qrCodeExpiresAt = expiresAt;

    await this.logEvent('qr_code_generated', {
      token: token,
      expires_at: expiresAt.toISOString(),
    });

    await this.save();
  }

  public isQRCodeValid(): boolean {
    return !!(this.qrCodeToken &&
             this.qrCodeExpiresAt &&
             new Date() < this.qrCodeExpiresAt);
  }

  public getEventsByType(eventType: string): DeliveryEvent[] {
    return this.eventLog.filter(event => event.event_type === eventType);
  }

  public getLastEvent(): DeliveryEvent | null {
    return this.eventLog.length > 0 ? this.eventLog[this.eventLog.length - 1] : null;
  }

  public override toJSON(): object {
    const values = { ...this.get() };
    return values;
  }
}

DeliveryAgreement.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  packageId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'packages',
      key: 'id',
    },
    field: 'package_id',
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
  agreedPrice: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false,
    field: 'agreed_price',
    validate: {
      min: 0.01,
    },
  },
  platformFee: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'platform_fee',
    validate: {
      min: 0,
    },
  },
  status: {
    type: DataTypes.ENUM(...Object.values(DeliveryStatus)),
    allowNull: false,
    defaultValue: DeliveryStatus.PENDING_PICKUP,
  },
  escrowPaymentId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'escrow_payment_id',
  },
  escrowAmount: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false,
    field: 'escrow_amount',
    validate: {
      min: 0,
    },
  },
  escrowHeldAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'escrow_held_at',
  },
  pickupConfirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'pickup_confirmed_at',
  },
  pickupLocation: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: true,
    field: 'pickup_location',
  },
  deliveryConfirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'delivery_confirmed_at',
  },
  deliveryLocation: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: true,
    field: 'delivery_location',
  },
  paymentReleasedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'payment_released_at',
  },
  qrCodeToken: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    field: 'qr_code_token',
  },
  qrCodeExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'qr_code_expires_at',
  },
  eventLog: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    field: 'event_log',
  },
  chatChannelId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'chat_channel_id',
  },
  courierLocations: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'courier_locations',
    defaultValue: [],
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
  modelName: 'DeliveryAgreement',
  tableName: 'delivery_agreements',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['package_id'] },
    { fields: ['courier_id'] },
    { fields: ['status'] },
    { fields: ['qr_code_token'] },
    { fields: ['created_at'] },
  ],
});

// Import these to avoid circular dependencies - will be set up in index.ts
import { Package } from './Package';
import { DeliveryQRCode } from './DeliveryQRCode';
import { DeliveryDispute } from './DeliveryDispute';
import { CourierLocation } from './CourierLocation';
import { CourierChatMessage } from './CourierChatMessage';

export default DeliveryAgreement;
