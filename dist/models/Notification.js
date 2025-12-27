"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = exports.NotificationChannel = exports.NotificationStatus = exports.NotificationPriority = exports.NotificationType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var NotificationType;
(function (NotificationType) {
    NotificationType["RIDE_REQUEST"] = "ride_request";
    NotificationType["RIDE_ACCEPTED"] = "ride_accepted";
    NotificationType["RIDE_CANCELLED"] = "ride_cancelled";
    NotificationType["RIDE_STARTED"] = "ride_started";
    NotificationType["RIDE_COMPLETED"] = "ride_completed";
    NotificationType["PAYMENT_RECEIVED"] = "payment_received";
    NotificationType["PAYMENT_FAILED"] = "payment_failed";
    NotificationType["CHAT_MESSAGE"] = "chat_message";
    NotificationType["INCOMING_CALL"] = "incoming_call";
    NotificationType["CALL_MISSED"] = "call_missed";
    NotificationType["DELIVERY_REQUEST"] = "delivery_request";
    NotificationType["DELIVERY_ACCEPTED"] = "delivery_accepted";
    NotificationType["DELIVERY_COMPLETED"] = "delivery_completed";
    NotificationType["PACKAGE_DELIVERED"] = "package_delivered";
    NotificationType["EMERGENCY_ALERT"] = "emergency_alert";
    NotificationType["SYSTEM_UPDATE"] = "system_update";
    NotificationType["PROMOTION"] = "promotion";
    NotificationType["REMINDER"] = "reminder";
    NotificationType["AI_SUGGESTION"] = "ai_suggestion";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["LOW"] = "low";
    NotificationPriority["NORMAL"] = "normal";
    NotificationPriority["HIGH"] = "high";
    NotificationPriority["URGENT"] = "urgent";
    NotificationPriority["CRITICAL"] = "critical";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["PENDING"] = "pending";
    NotificationStatus["SENT"] = "sent";
    NotificationStatus["DELIVERED"] = "delivered";
    NotificationStatus["READ"] = "read";
    NotificationStatus["DISMISSED"] = "dismissed";
    NotificationStatus["FAILED"] = "failed";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["PUSH"] = "push";
    NotificationChannel["IN_APP"] = "in_app";
    NotificationChannel["EMAIL"] = "email";
    NotificationChannel["SMS"] = "sms";
    NotificationChannel["SOCKET"] = "socket";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
class Notification extends sequelize_1.Model {
    isExpired() {
        return this.expiresAt ? new Date() > this.expiresAt : false;
    }
    isPending() {
        return this.status === NotificationStatus.PENDING;
    }
    isDelivered() {
        return [NotificationStatus.DELIVERED, NotificationStatus.READ].includes(this.status);
    }
    isRead() {
        return this.status === NotificationStatus.READ;
    }
    isCritical() {
        return [NotificationPriority.URGENT, NotificationPriority.CRITICAL].includes(this.priority);
    }
    shouldRetryDelivery() {
        return this.status === NotificationStatus.FAILED &&
            this.deliveryAttempts < 3 &&
            !this.isExpired();
    }
    getTimeToRead() {
        if (this.sentAt && this.readAt) {
            return this.readAt.getTime() - this.sentAt.getTime();
        }
        return null;
    }
    getEngagementScore() {
        let score = 0;
        if (this.isRead()) {
            score += 50;
            const timeToRead = this.getTimeToRead();
            if (timeToRead && timeToRead < 300000) {
                score += 30;
            }
        }
        if (this.actions && this.actions.length > 0) {
            score += 20;
        }
        return Math.min(score, 100);
    }
    formatForMobile() {
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
exports.Notification = Notification;
Notification.init({
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
        type: sequelize_1.DataTypes.ENUM(...Object.values(NotificationType)),
        allowNull: false,
    },
    priority: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(NotificationPriority)),
        allowNull: false,
        defaultValue: NotificationPriority.NORMAL,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(NotificationStatus)),
        allowNull: false,
        defaultValue: NotificationStatus.PENDING,
    },
    channel: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
        validate: {
            isValidChannels(value) {
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
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: false,
    },
    body: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    data: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    metadata: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    actionable: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    actions: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        validate: {
            isValidActions(value) {
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
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
        validate: {
            isUrl: true,
        },
    },
    deepLink: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
    },
    expiresAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    scheduledAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    sentAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    readAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    dismissedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    deliveryAttempts: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0,
            max: 10,
        },
    },
    lastDeliveryAttempt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    relatedEntityType: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
    },
    relatedEntityId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
    },
    batchId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
    },
    campaignId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
    },
    aiScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: 0,
            max: 100,
        },
    },
    userEngagementScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: 0,
            max: 100,
        },
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
        beforeCreate: (notification) => {
            if (!notification.expiresAt) {
                const now = new Date();
                switch (notification.type) {
                    case NotificationType.INCOMING_CALL:
                        notification.expiresAt = new Date(now.getTime() + 30000);
                        break;
                    case NotificationType.RIDE_REQUEST:
                        notification.expiresAt = new Date(now.getTime() + 600000);
                        break;
                    case NotificationType.CHAT_MESSAGE:
                        notification.expiresAt = new Date(now.getTime() + 86400000);
                        break;
                    case NotificationType.PROMOTION:
                        notification.expiresAt = new Date(now.getTime() + 604800000);
                        break;
                    default:
                        notification.expiresAt = new Date(now.getTime() + 259200000);
                }
            }
        },
        afterUpdate: (notification) => {
            if (notification.changed('status') && notification.isRead()) {
                notification.userEngagementScore = notification.getEngagementScore();
            }
        },
    },
});
exports.default = Notification;
//# sourceMappingURL=Notification.js.map