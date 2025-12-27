/**
 * @fileoverview Notification model for advanced notification system
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export enum NotificationType {
  RIDE_REQUEST = 'ride_request',
  RIDE_ACCEPTED = 'ride_accepted',
  RIDE_CANCELLED = 'ride_cancelled',
  RIDE_STARTED = 'ride_started',
  RIDE_COMPLETED = 'ride_completed',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  CHAT_MESSAGE = 'chat_message',
  INCOMING_CALL = 'incoming_call',
  CALL_MISSED = 'call_missed',
  DELIVERY_REQUEST = 'delivery_request',
  DELIVERY_ACCEPTED = 'delivery_accepted',
  DELIVERY_COMPLETED = 'delivery_completed',
  PACKAGE_DELIVERED = 'package_delivered',
  EMERGENCY_ALERT = 'emergency_alert',
  SYSTEM_UPDATE = 'system_update',
  PROMOTION = 'promotion',
  REMINDER = 'reminder',
  AI_SUGGESTION = 'ai_suggestion',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  DISMISSED = 'dismissed',
  FAILED = 'failed',
}

export enum NotificationChannel {
  PUSH = 'push',
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  SOCKET = 'socket',
}

export interface NotificationAttributes {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  channel: NotificationChannel[];
  title: string;
  body: string;
  data: any;
  metadata: any;
  actionable: boolean;
  actions: any[];
  imageUrl?: string;
  deepLink?: string;
  expiresAt?: Date;
  scheduledAt?: Date;
  sentAt?: Date;
  readAt?: Date;
  dismissedAt?: Date;
  deliveryAttempts: number;
  lastDeliveryAttempt?: Date;
  relatedEntityType?: string;
  relatedEntityId?: string;
  batchId?: string;
  campaignId?: string;
  aiScore?: number;
  userEngagementScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationCreationAttributes
  extends Optional<NotificationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deliveryAttempts'> {}

export class Notification extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes {

  public id!: string;
  public userId!: string;
  public type!: NotificationType;
  public priority!: NotificationPriority;
  public status!: NotificationStatus;
  public channel!: NotificationChannel[];
  public title!: string;
  public body!: string;
  public data!: any;
  public metadata!: any;
  public actionable!: boolean;
  public actions!: any[];
  public imageUrl?: string;
  public deepLink?: string;
  public expiresAt?: Date;
  public scheduledAt?: Date;
  public sentAt?: Date;
  public readAt?: Date;
  public dismissedAt?: Date;
  public deliveryAttempts!: number;
  public lastDeliveryAttempt?: Date;
  public relatedEntityType?: string;
  public relatedEntityId?: string;
  public batchId?: string;
  public campaignId?: string;
  public aiScore?: number;
  public userEngagementScore?: number;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Helper methods
  public isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  public isPending(): boolean {
    return this.status === NotificationStatus.PENDING;
  }

  public isDelivered(): boolean {
    return [NotificationStatus.DELIVERED, NotificationStatus.READ].includes(this.status);
  }

  public isRead(): boolean {
    return this.status === NotificationStatus.READ;
  }

  public isCritical(): boolean {
    return [NotificationPriority.URGENT, NotificationPriority.CRITICAL].includes(this.priority);
  }

  public shouldRetryDelivery(): boolean {
    return this.status === NotificationStatus.FAILED &&
           this.deliveryAttempts < 3 &&
           !this.isExpired();
  }

  public getTimeToRead(): number | null {
    if (this.sentAt && this.readAt) {
      return this.readAt.getTime() - this.sentAt.getTime();
    }
    return null;
  }

  public getEngagementScore(): number {
    // Calculate engagement based on read time, actions taken, etc.
    let score = 0;

    if (this.isRead()) {
      score += 50;

      const timeToRead = this.getTimeToRead();
      if (timeToRead && timeToRead < 300000) { // Read within 5 minutes
        score += 30;
      }
    }

    if (this.actions && this.actions.length > 0) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  public formatForMobile(): any {
    return {
      id: this.id,
      type: this.type,
      priority: this.priority,
      title: this.title,
      body: this.body,
      data: this.data,
      actionable: this.actionable,
      actions: this.actions,
      imageUrl: this.imageUrl,
      deepLink: this.deepLink,
      isRead: this.isRead(),
      createdAt: this.createdAt,
      relatedEntity: this.relatedEntityType ? {
        type: this.relatedEntityType,
        id: this.relatedEntityId,
      } : null,
    };
  }
}

Notification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    type: {
      type: DataTypes.ENUM(...Object.values(NotificationType)),
      allowNull: false,
    },
    priority: {
      type: DataTypes.ENUM(...Object.values(NotificationPriority)),
      allowNull: false,
      defaultValue: NotificationPriority.NORMAL,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(NotificationStatus)),
      allowNull: false,
      defaultValue: NotificationStatus.PENDING,
    },
    channel: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
      validate: {
        isValidChannels(value: NotificationChannel[]) {
          if (!Array.isArray(value) || value.length === 0) {
            throw new Error('At least one notification channel is required');
          }

          const validChannels = Object.values(NotificationChannel);
          for (const channel of value) {
            if (!validChannels.includes(channel)) {
              throw new Error(`Invalid notification channel: ${channel}`);
            }
          }
        },
      },
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    data: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    actionable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    actions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidActions(value: any[]) {
          if (!Array.isArray(value)) {
            throw new Error('Actions must be an array');
          }

          for (const action of value) {
            if (!action.id || !action.title || !action.type) {
              throw new Error('Each action must have id, title, and type');
            }
          }
        },
      },
    },
    imageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    deepLink: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    dismissedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deliveryAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 10,
      },
    },
    lastDeliveryAttempt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    relatedEntityType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    relatedEntityId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    batchId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    campaignId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    aiScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100,
      },
    },
    userEngagementScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100,
      },
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true,
    indexes: [
      {
        fields: ['userId', 'status'],
        name: 'idx_notifications_user_status',
      },
      {
        fields: ['type', 'priority'],
        name: 'idx_notifications_type_priority',
      },
      {
        fields: ['scheduledAt'],
        name: 'idx_notifications_scheduled',
      },
      {
        fields: ['relatedEntityType', 'relatedEntityId'],
        name: 'idx_notifications_related_entity',
      },
      {
        fields: ['batchId'],
        name: 'idx_notifications_batch',
      },
      {
        fields: ['campaignId'],
        name: 'idx_notifications_campaign',
      },
      {
        fields: ['createdAt'],
        name: 'idx_notifications_created_at',
      },
    ],
    hooks: {
      beforeCreate: (notification: Notification) => {
        // Auto-set expiration for certain notification types
        if (!notification.expiresAt) {
          const now = new Date();
          switch (notification.type) {
            case NotificationType.INCOMING_CALL:
              notification.expiresAt = new Date(now.getTime() + 30000); // 30 seconds
              break;
            case NotificationType.RIDE_REQUEST:
              notification.expiresAt = new Date(now.getTime() + 600000); // 10 minutes
              break;
            case NotificationType.CHAT_MESSAGE:
              notification.expiresAt = new Date(now.getTime() + 86400000); // 24 hours
              break;
            case NotificationType.PROMOTION:
              notification.expiresAt = new Date(now.getTime() + 604800000); // 7 days
              break;
            default:
              notification.expiresAt = new Date(now.getTime() + 259200000); // 3 days
          }
        }
      },
      afterUpdate: (notification: Notification) => {
        // Update engagement score after status changes
        if (notification.changed('status') && notification.isRead()) {
          notification.userEngagementScore = notification.getEngagementScore();
        }
      },
    },
  },
);

export default Notification;
