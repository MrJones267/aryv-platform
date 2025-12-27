"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationPreference = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const Notification_1 = require("./Notification");
class NotificationPreference extends sequelize_1.Model {
    isInQuietHours(currentTime) {
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
            return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
        }
        else {
            return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
        }
    }
    shouldReceiveNotification(priority, currentTime) {
        if (!this.enabled) {
            return false;
        }
        if (priority === Notification_1.NotificationPriority.CRITICAL) {
            return true;
        }
        if (this.isInQuietHours(currentTime) && priority !== Notification_1.NotificationPriority.URGENT) {
            return false;
        }
        const priorityLevels = {
            [Notification_1.NotificationPriority.LOW]: 1,
            [Notification_1.NotificationPriority.NORMAL]: 2,
            [Notification_1.NotificationPriority.HIGH]: 3,
            [Notification_1.NotificationPriority.URGENT]: 4,
            [Notification_1.NotificationPriority.CRITICAL]: 5,
        };
        return priorityLevels[priority] >= priorityLevels[this.minPriority];
    }
    getActiveChannels(priority) {
        if (!this.shouldReceiveNotification(priority)) {
            return [];
        }
        if ([Notification_1.NotificationPriority.CRITICAL, Notification_1.NotificationPriority.URGENT].includes(priority)) {
            return this.channels;
        }
        const filteredChannels = [...this.channels];
        if (this.frequency !== 'immediate') {
            const index = filteredChannels.indexOf(Notification_1.NotificationChannel.PUSH);
            if (index > -1) {
                filteredChannels.splice(index, 1);
            }
        }
        return filteredChannels;
    }
    static getDefaultPreferences(userId) {
        const defaults = [];
        Object.values(Notification_1.NotificationType).forEach(type => {
            const preference = {
                userId,
                type,
                enabled: true,
                channels: [Notification_1.NotificationChannel.PUSH, Notification_1.NotificationChannel.IN_APP],
                quietHoursEnabled: false,
                timezone: 'UTC',
                minPriority: Notification_1.NotificationPriority.NORMAL,
                frequency: 'immediate',
                customSettings: {},
            };
            switch (type) {
                case Notification_1.NotificationType.EMERGENCY_ALERT:
                    preference.channels = [
                        Notification_1.NotificationChannel.PUSH,
                        Notification_1.NotificationChannel.IN_APP,
                        Notification_1.NotificationChannel.SMS,
                    ];
                    preference.minPriority = Notification_1.NotificationPriority.CRITICAL;
                    break;
                case Notification_1.NotificationType.INCOMING_CALL:
                case Notification_1.NotificationType.RIDE_REQUEST:
                case Notification_1.NotificationType.RIDE_ACCEPTED:
                    preference.minPriority = Notification_1.NotificationPriority.HIGH;
                    break;
                case Notification_1.NotificationType.CHAT_MESSAGE:
                    preference.frequency = 'digest_hourly';
                    preference.quietHoursEnabled = true;
                    preference.quietHoursStart = '22:00';
                    preference.quietHoursEnd = '08:00';
                    break;
                case Notification_1.NotificationType.PROMOTION:
                case Notification_1.NotificationType.AI_SUGGESTION:
                    preference.minPriority = Notification_1.NotificationPriority.LOW;
                    preference.frequency = 'digest_daily';
                    preference.channels = [Notification_1.NotificationChannel.IN_APP];
                    break;
                case Notification_1.NotificationType.SYSTEM_UPDATE:
                    preference.frequency = 'digest_weekly';
                    preference.channels = [Notification_1.NotificationChannel.IN_APP, Notification_1.NotificationChannel.EMAIL];
                    break;
            }
            defaults.push(preference);
        });
        return defaults;
    }
}
exports.NotificationPreference = NotificationPreference;
NotificationPreference.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    userId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    },
    type: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(Notification_1.NotificationType)),
        allowNull: false,
    },
    enabled: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    channels: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: [Notification_1.NotificationChannel.PUSH, Notification_1.NotificationChannel.IN_APP],
        validate: {
            isValidChannels(value) {
                if (!Array.isArray(value)) {
                    throw new Error('Channels must be an array');
                }
                const validChannels = Object.values(Notification_1.NotificationChannel);
                for (const channel of value) {
                    if (!validChannels.includes(channel)) {
                        throw new Error(`Invalid notification channel: ${channel}`);
                    }
                }
            },
        },
    },
    quietHoursEnabled: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    quietHoursStart: {
        type: sequelize_1.DataTypes.STRING(5),
        allowNull: true,
        validate: {
            is: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
        },
    },
    quietHoursEnd: {
        type: sequelize_1.DataTypes.STRING(5),
        allowNull: true,
        validate: {
            is: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
        },
    },
    timezone: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'UTC',
    },
    minPriority: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(Notification_1.NotificationPriority)),
        allowNull: false,
        defaultValue: Notification_1.NotificationPriority.NORMAL,
    },
    frequency: {
        type: sequelize_1.DataTypes.ENUM('immediate', 'digest_hourly', 'digest_daily', 'digest_weekly'),
        allowNull: false,
        defaultValue: 'immediate',
    },
    customSettings: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
}, {
    sequelize: database_1.sequelize,
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
            if (this['quietHoursEnabled']) {
                if (!this['quietHoursStart'] || !this['quietHoursEnd']) {
                    throw new Error('Quiet hours start and end times are required when quiet hours are enabled');
                }
            }
        },
    },
});
exports.default = NotificationPreference;
//# sourceMappingURL=NotificationPreference.js.map