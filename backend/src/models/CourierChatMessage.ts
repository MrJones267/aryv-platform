/**
 * @fileoverview CourierChatMessage model for delivery-specific chat
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Message type enum
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  LOCATION = 'location',
  SYSTEM = 'system'
}

// CourierChatMessage interface
export interface CourierChatMessageAttributes {
  id: string;
  deliveryAgreementId: string;
  senderId: string;
  recipientId: string;
  messageType: MessageType;
  content: string;
  attachmentUrl?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface CourierChatMessageCreationAttributes extends Optional<CourierChatMessageAttributes,
  'id' | 'attachmentUrl' | 'readAt' | 'createdAt'
> {}

export class CourierChatMessage extends Model<CourierChatMessageAttributes, CourierChatMessageCreationAttributes>
  implements CourierChatMessageAttributes {

  public id!: string;
  public deliveryAgreementId!: string;
  public senderId!: string;
  public recipientId!: string;
  public messageType!: MessageType;
  public content!: string;
  public attachmentUrl?: string;
  public isRead!: boolean;
  public readAt?: Date;
  public createdAt!: Date;

  // Associations
  public readonly deliveryAgreement?: DeliveryAgreement;
  public readonly sender?: import('./User').UserModel;
  public readonly recipient?: import('./User').UserModel;

  // Methods
  public async markAsRead(): Promise<void> {
    if (!this.isRead) {
      this.isRead = true;
      this.readAt = new Date();
      await this.save();
    }
  }

  public isRecent(): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.createdAt > oneHourAgo;
  }

  public hasAttachment(): boolean {
    return !!(this.attachmentUrl && this.attachmentUrl.trim().length > 0);
  }

  public getMessageAge(): number {
    return Date.now() - this.createdAt.getTime();
  }

  public override toJSON(): object {
    const values = { ...this.get() };
    return {
      ...values,
      isRecent: this.isRecent(),
      hasAttachment: this.hasAttachment(),
      ageInMinutes: Math.floor(this.getMessageAge() / (1000 * 60)),
    };
  }
}

CourierChatMessage.init({
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
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    field: 'sender_id',
  },
  recipientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    field: 'recipient_id',
  },
  messageType: {
    type: DataTypes.ENUM(...Object.values(MessageType)),
    allowNull: false,
    defaultValue: MessageType.TEXT,
    field: 'message_type',
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  attachmentUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'attachment_url',
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_read',
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'read_at',
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
}, {
  sequelize,
  modelName: 'CourierChatMessage',
  tableName: 'courier_chat_messages',
  timestamps: false,
  indexes: [
    { fields: ['delivery_agreement_id'] },
    { fields: ['sender_id'] },
    { fields: ['recipient_id', 'is_read'] },
    { fields: ['created_at'] },
  ],
});

// Import these to avoid circular dependencies - will be set up in index.ts
import { DeliveryAgreement } from './DeliveryAgreement';

export default CourierChatMessage;
