/**
 * @fileoverview Notification Preference model for user notification settings
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { NotificationType, NotificationChannel, NotificationPriority } from './Notification';

export interface NotificationPreferenceAttributes {
  id: string;
  userId: string;
  type: NotificationType;
  enabled: boolean;
  channels: NotificationChannel[];
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
  timezone: string;
  minPriority: NotificationPriority;
  frequency: 'immediate' | 'digest_hourly' | 'digest_daily' | 'digest_weekly';
  customSettings: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferenceCreationAttributes
  extends Optional<NotificationPreferenceAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class NotificationPreference extends Model<NotificationPreferenceAttributes, NotificationPreferenceCreationAttributes>
  implements NotificationPreferenceAttributes {

  public id!: string;
  public userId!: string;
  public type!: NotificationType;
  public enabled!: boolean;
  public channels!: NotificationChannel[];
  public quietHoursEnabled!: boolean;
  public quietHoursStart?: string;
  public quietHoursEnd?: string;
  public timezone!: string;
  public minPriority!: NotificationPriority;
  public frequency!: 'immediate' | 'digest_hourly' | 'digest_daily' | 'digest_weekly';
  public customSettings!: any;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Helper methods
  public isInQuietHours(currentTime?: Date): boolean {
    if (!this.quietHoursEnabled || !this.quietHoursStart || !this.quietHoursEnd) {
      return false;
    }

    const now = currentTime || new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = this.quietHoursStart.split(':').map(Number);
    const [endHour, endMinute] = this.quietHoursEnd.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    if (startTimeMinutes <= endTimeMinutes) {
      // Same day range (e.g., 08:00 to 18:00)
      return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
    } else {
      // Overnight range (e.g., 22:00 to 06:00)
      return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
    }
  }

  public shouldReceiveNotification(priority: NotificationPriority, currentTime?: Date): boolean {
    if (!this.enabled) {
      return false;
    }

    // Always allow critical notifications
    if (priority === NotificationPriority.CRITICAL) {
      return true;
    }

    // Check quiet hours (except for urgent notifications)
    if (this.isInQuietHours(currentTime) && priority !== NotificationPriority.URGENT) {
      return false;
    }

    // Check minimum priority
    const priorityLevels = {
      [NotificationPriority.LOW]: 1,
      [NotificationPriority.NORMAL]: 2,
      [NotificationPriority.HIGH]: 3,
      [NotificationPriority.URGENT]: 4,
      [NotificationPriority.CRITICAL]: 5,
    };

    return priorityLevels[priority] >= priorityLevels[this.minPriority];
  }

  public getActiveChannels(priority: NotificationPriority): NotificationChannel[] {
    if (!this.shouldReceiveNotification(priority)) {
      return [];
    }

    // For critical/urgent notifications, use all available channels
    if ([NotificationPriority.CRITICAL, NotificationPriority.URGENT].includes(priority)) {
      return this.channels;
    }

    // Filter channels based on frequency setting
    const filteredChannels = [...this.channels];

    if (this.frequency !== 'immediate') {
      // Remove push notifications for digest frequencies
      const index = filteredChannels.indexOf(NotificationChannel.PUSH);
      if (index > -1) {
        filteredChannels.splice(index, 1);
      }
    }

    return filteredChannels;
  }

  public static getDefaultPreferences(userId: string): NotificationPreferenceCreationAttributes[] {
    const defaults: NotificationPreferenceCreationAttributes[] = [];

    // Create default preferences for each notification type
    Object.values(NotificationType).forEach(type => {
      const preference: NotificationPreferenceCreationAttributes = {
        userId,
        type,
        enabled: true,
        channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
        quietHoursEnabled: false,
        timezone: 'UTC',
        minPriority: NotificationPriority.NORMAL,
        frequency: 'immediate',
        customSettings: {},
      };

      // Customize defaults based on notification type
      switch (type) {
        case NotificationType.EMERGENCY_ALERT:
          preference.channels = [
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP,
            NotificationChannel.SMS,
          ];
          preference.minPriority = NotificationPriority.CRITICAL;
          break;

        case NotificationType.INCOMING_CALL:
        case NotificationType.RIDE_REQUEST:
        case NotificationType.RIDE_ACCEPTED:
          preference.minPriority = NotificationPriority.HIGH;
          break;

        case NotificationType.CHAT_MESSAGE:
          preference.frequency = 'digest_hourly';
          preference.quietHoursEnabled = true;
          preference.quietHoursStart = '22:00';
          preference.quietHoursEnd = '08:00';
          break;

        case NotificationType.PROMOTION:
        case NotificationType.AI_SUGGESTION:
          preference.minPriority = NotificationPriority.LOW;
          preference.frequency = 'digest_daily';
          preference.channels = [NotificationChannel.IN_APP];
          break;

        case NotificationType.SYSTEM_UPDATE:
          preference.frequency = 'digest_weekly';
          preference.channels = [NotificationChannel.IN_APP, NotificationChannel.EMAIL];
          break;
      }

      defaults.push(preference);
    });

    return defaults;
  }
}

NotificationPreference.init(
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
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    channels: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
      validate: {
        isValidChannels(value: NotificationChannel[]) {
          if (!Array.isArray(value)) {
            throw new Error('Channels must be an array');
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
    quietHoursEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    quietHoursStart: {
      type: DataTypes.STRING(5),
      allowNull: true,
      validate: {
        is: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
    },
    quietHoursEnd: {
      type: DataTypes.STRING(5),
      allowNull: true,
      validate: {
        is: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'UTC',
    },
    minPriority: {
      type: DataTypes.ENUM(...Object.values(NotificationPriority)),
      allowNull: false,
      defaultValue: NotificationPriority.NORMAL,
    },
    frequency: {
      type: DataTypes.ENUM('immediate', 'digest_hourly', 'digest_daily', 'digest_weekly'),
      allowNull: false,
      defaultValue: 'immediate',
    },
    customSettings: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
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
    modelName: 'NotificationPreference',
    tableName: 'notification_preferences',
    timestamps: true,
    indexes: [
      {
        fields: ['userId', 'type'],
        name: 'idx_notification_preferences_user_type',
        unique: true,
      },
      {
        fields: ['userId', 'enabled'],
        name: 'idx_notification_preferences_user_enabled',
      },
    ],
    validate: {
      quietHoursValidation() {
        if ((this as any)['quietHoursEnabled']) {
          if (!(this as any)['quietHoursStart'] || !(this as any)['quietHoursEnd']) {
            throw new Error('Quiet hours start and end times are required when quiet hours are enabled');
          }
        }
      },
    },
  },
);

export default NotificationPreference;
