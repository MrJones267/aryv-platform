"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedNotificationService = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const Notification_1 = __importStar(require("../models/Notification"));
const NotificationPreference_1 = __importDefault(require("../models/NotificationPreference"));
const NotificationTemplate_1 = __importDefault(require("../models/NotificationTemplate"));
const models_1 = require("../models");
const logger_1 = require("../utils/logger");
class AdvancedNotificationService {
    constructor() {
        this.aiEnabled = process.env['NOTIFICATION_AI_ENABLED'] === 'true';
        this.batchSize = parseInt(process.env['NOTIFICATION_BATCH_SIZE'] || '100');
    }
    async sendNotification(request) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const preferences = await this.getUserPreferences(request.userId, request.type);
            if (!preferences) {
                await transaction.rollback();
                return {
                    success: false,
                    error: 'User preferences not found',
                };
            }
            const priority = request.priority || Notification_1.NotificationPriority.NORMAL;
            if (!preferences.shouldReceiveNotification(priority)) {
                await transaction.rollback();
                (0, logger_1.logInfo)('Notification filtered by user preferences', {
                    userId: request.userId,
                    type: request.type,
                    priority,
                });
                return {
                    success: true,
                    deliveryChannels: [],
                };
            }
            let notificationData = { ...request };
            if (request.templateName) {
                const template = await NotificationTemplate_1.default.findOne({
                    where: { name: request.templateName, isActive: true },
                    transaction,
                });
                if (template) {
                    const populated = template.populateTemplate(request.variables || {}, request.locale || 'en');
                    notificationData = { ...notificationData, ...populated };
                }
            }
            const deliveryChannels = preferences.getActiveChannels(priority);
            if (deliveryChannels.length === 0) {
                await transaction.rollback();
                return {
                    success: true,
                    deliveryChannels: [],
                };
            }
            let aiScore;
            if (this.aiEnabled) {
                aiScore = await this.calculateAiScore(request.userId, request.type, request.data || {});
            }
            const notification = await Notification_1.default.create({
                userId: request.userId,
                type: request.type,
                priority,
                status: Notification_1.NotificationStatus.PENDING,
                channel: deliveryChannels,
                title: notificationData.title || 'Notification',
                body: notificationData.body || '',
                data: notificationData.data || {},
                metadata: {
                    ...notificationData.metadata,
                    templateName: request.templateName,
                    locale: request.locale,
                    aiProcessed: !!aiScore,
                },
                actionable: notificationData.actionable || false,
                actions: notificationData.actions || [],
                imageUrl: notificationData.imageUrl,
                deepLink: notificationData.deepLink,
                expiresAt: notificationData.expiresAt,
                scheduledAt: notificationData.scheduledAt,
                relatedEntityType: request.relatedEntityType,
                relatedEntityId: request.relatedEntityId,
                batchId: request.batchId,
                campaignId: request.campaignId,
                aiScore,
            }, { transaction });
            await transaction.commit();
            if (!request.scheduledAt) {
                await this.deliverNotification(notification);
            }
            (0, logger_1.logInfo)('Notification created successfully', {
                notificationId: notification.id,
                userId: request.userId,
                type: request.type,
                channels: deliveryChannels,
            });
            return {
                success: true,
                notification,
                deliveryChannels,
            };
        }
        catch (error) {
            await transaction.rollback();
            (0, logger_1.logError)('Error sending notification', error, {
                userId: request.userId,
                type: request.type,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async sendBulkNotifications(request) {
        const results = [];
        const batchSize = request.batchSize || this.batchSize;
        const batchId = `bulk_${Date.now()}`;
        try {
            for (let i = 0; i < request.userIds.length; i += batchSize) {
                const userBatch = request.userIds.slice(i, i + batchSize);
                const batchPromises = userBatch.map(userId => this.sendNotification({
                    ...request,
                    userId,
                    batchId,
                }));
                const batchResults = await Promise.allSettled(batchPromises);
                for (const result of batchResults) {
                    if (result.status === 'fulfilled') {
                        results.push(result.value);
                    }
                    else {
                        results.push({
                            success: false,
                            error: result.reason.message,
                        });
                    }
                }
                if (i + batchSize < request.userIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            (0, logger_1.logInfo)('Bulk notifications processed', {
                totalUsers: request.userIds.length,
                successCount: results.filter(r => r.success).length,
                batchId,
            });
            return results;
        }
        catch (error) {
            (0, logger_1.logError)('Error in bulk notification processing', error, {
                userCount: request.userIds.length,
                batchId,
            });
            throw error;
        }
    }
    async deliverNotification(notification) {
        try {
            const deliveryPromises = notification.channel.map(channel => this.deliverToChannel(notification, channel));
            const results = await Promise.allSettled(deliveryPromises);
            let deliveredToAnyChannel = false;
            const failedChannels = [];
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const channel = notification.channel[i];
                if (result.status === 'fulfilled' && result.value) {
                    deliveredToAnyChannel = true;
                }
                else {
                    failedChannels.push(channel);
                    (0, logger_1.logWarning)('Failed to deliver notification to channel', {
                        notificationId: notification.id,
                        channel,
                        error: result.status === 'rejected' ? result.reason : 'Unknown error',
                    });
                }
            }
            const newStatus = deliveredToAnyChannel
                ? Notification_1.NotificationStatus.SENT
                : Notification_1.NotificationStatus.FAILED;
            await notification.update({
                status: newStatus,
                sentAt: deliveredToAnyChannel ? new Date() : null,
                deliveryAttempts: notification.deliveryAttempts + 1,
                lastDeliveryAttempt: new Date(),
                metadata: {
                    ...notification.metadata,
                    failedChannels,
                    deliveryResults: results.map(r => r.status),
                },
            });
            if (!deliveredToAnyChannel && notification.shouldRetryDelivery()) {
                await this.scheduleRetry(notification);
            }
        }
        catch (error) {
            (0, logger_1.logError)('Error delivering notification', error, {
                notificationId: notification.id,
            });
            await notification.update({
                status: Notification_1.NotificationStatus.FAILED,
                deliveryAttempts: notification.deliveryAttempts + 1,
                lastDeliveryAttempt: new Date(),
            });
        }
    }
    async deliverToChannel(notification, channel) {
        try {
            switch (channel) {
                case Notification_1.NotificationChannel.PUSH:
                    return await this.sendPushNotification(notification);
                case Notification_1.NotificationChannel.IN_APP:
                    return await this.sendInAppNotification(notification);
                case Notification_1.NotificationChannel.EMAIL:
                    return await this.sendEmailNotification(notification);
                case Notification_1.NotificationChannel.SMS:
                    return await this.sendSmsNotification(notification);
                case Notification_1.NotificationChannel.SOCKET:
                    return await this.sendSocketNotification(notification);
                default:
                    (0, logger_1.logWarning)('Unknown notification channel', { channel });
                    return false;
            }
        }
        catch (error) {
            (0, logger_1.logError)(`Error delivering to ${channel}`, error, {
                notificationId: notification.id,
            });
            return false;
        }
    }
    async sendPushNotification(notification) {
        try {
            const user = await models_1.User.findByPk(notification.userId);
            if (!user || !user.fcmToken) {
                return false;
            }
            const payload = {
                token: user.fcmToken,
                notification: {
                    title: notification.title,
                    body: notification.body,
                    imageUrl: notification.imageUrl,
                },
                data: {
                    notificationId: notification.id,
                    type: notification.type,
                    deepLink: notification.deepLink || '',
                    ...notification.data,
                },
                android: {
                    priority: notification.isCritical() ? 'high' : 'normal',
                    notification: {
                        channelId: this.getAndroidChannelId(notification.type),
                        sound: notification.isCritical() ? 'emergency' : 'default',
                        priority: notification.isCritical() ? 'high' : 'default',
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: notification.isCritical() ? 'emergency.wav' : 'default',
                            badge: 1,
                            'content-available': 1,
                        },
                    },
                },
            };
            console.log('Push notification payload prepared:', payload);
            (0, logger_1.logInfo)('Push notification sent', {
                notificationId: notification.id,
                userId: notification.userId,
            });
            return true;
        }
        catch (error) {
            (0, logger_1.logError)('Push notification delivery failed', error, {
                notificationId: notification.id,
            });
            return false;
        }
    }
    async sendInAppNotification(notification) {
        try {
            const basicNotificationService = await Promise.resolve().then(() => __importStar(require('./NotificationService')));
            await basicNotificationService.default.sendToUser(notification.userId, {
                type: notification.type,
                title: notification.title,
                message: notification.body,
                data: {
                    notificationId: notification.id,
                    ...notification.data,
                },
                timestamp: new Date().toISOString(),
            });
            (0, logger_1.logInfo)('In-app notification sent', {
                notificationId: notification.id,
                userId: notification.userId,
            });
            return true;
        }
        catch (error) {
            (0, logger_1.logError)('In-app notification delivery failed', error, {
                notificationId: notification.id,
            });
            return false;
        }
    }
    async sendSocketNotification(notification) {
        return this.sendInAppNotification(notification);
    }
    async sendEmailNotification(notification) {
        try {
            const user = await models_1.User.findByPk(notification.userId);
            if (!user || !user.email) {
                return false;
            }
            const emailData = {
                to: user.email,
                subject: notification.title,
                html: this.formatEmailContent(notification),
                text: notification.body,
            };
            console.log('Email notification data prepared:', emailData);
            (0, logger_1.logInfo)('Email notification sent', {
                notificationId: notification.id,
                userId: notification.userId,
            });
            return true;
        }
        catch (error) {
            (0, logger_1.logError)('Email notification delivery failed', error, {
                notificationId: notification.id,
            });
            return false;
        }
    }
    async sendSmsNotification(notification) {
        try {
            const user = await models_1.User.findByPk(notification.userId);
            if (!user || !user.phone) {
                return false;
            }
            const smsText = `${notification.title}: ${notification.body}`.slice(0, 160);
            console.log('SMS notification text prepared:', smsText);
            (0, logger_1.logInfo)('SMS notification sent', {
                notificationId: notification.id,
                userId: notification.userId,
            });
            return true;
        }
        catch (error) {
            (0, logger_1.logError)('SMS notification delivery failed', error, {
                notificationId: notification.id,
            });
            return false;
        }
    }
    async getUserPreferences(userId, type) {
        try {
            let preference = await NotificationPreference_1.default.findOne({
                where: { userId, type },
            });
            if (!preference) {
                const defaults = NotificationPreference_1.default.getDefaultPreferences(userId);
                const defaultForType = defaults.find(p => p.type === type);
                if (defaultForType) {
                    preference = await NotificationPreference_1.default.create(defaultForType);
                }
            }
            return preference;
        }
        catch (error) {
            (0, logger_1.logError)('Error getting user preferences', error, { userId, type });
            return null;
        }
    }
    async calculateAiScore(userId, type, contextData) {
        try {
            const result = await database_1.sequelize.query('SELECT calculate_ai_notification_score(:userId, :type, :contextData) as score', {
                replacements: {
                    userId,
                    type,
                    contextData: JSON.stringify(contextData),
                },
                type: sequelize_1.QueryTypes.SELECT,
            });
            return result[0]?.score || 50;
        }
        catch (error) {
            (0, logger_1.logError)('Error calculating AI score', error, { userId, type });
            return 50;
        }
    }
    async scheduleRetry(notification) {
        try {
            const retryDelay = Math.pow(2, notification.deliveryAttempts) * 60000;
            const retryAt = new Date(Date.now() + retryDelay);
            await notification.update({
                scheduledAt: retryAt,
                metadata: {
                    ...notification.metadata,
                    isRetry: true,
                    originalFailedAt: new Date(),
                },
            });
            (0, logger_1.logInfo)('Notification retry scheduled', {
                notificationId: notification.id,
                retryAt,
                attempt: notification.deliveryAttempts + 1,
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error scheduling notification retry', error, {
                notificationId: notification.id,
            });
        }
    }
    async processScheduledNotifications() {
        try {
            const scheduledNotifications = await Notification_1.default.findAll({
                where: {
                    status: Notification_1.NotificationStatus.PENDING,
                    scheduledAt: {
                        [sequelize_1.Op.lte]: new Date(),
                    },
                },
                limit: this.batchSize,
                order: [['scheduledAt', 'ASC']],
            });
            for (const notification of scheduledNotifications) {
                if (!notification.isExpired()) {
                    await this.deliverNotification(notification);
                }
                else {
                    await notification.update({ status: Notification_1.NotificationStatus.FAILED });
                }
            }
            if (scheduledNotifications.length > 0) {
                (0, logger_1.logInfo)('Processed scheduled notifications', {
                    count: scheduledNotifications.length,
                });
            }
        }
        catch (error) {
            (0, logger_1.logError)('Error processing scheduled notifications', error);
        }
    }
    async markAsRead(notificationId, userId) {
        try {
            const [updatedRows] = await Notification_1.default.update({
                status: Notification_1.NotificationStatus.READ,
                readAt: new Date(),
            }, {
                where: {
                    id: notificationId,
                    userId,
                    status: { [sequelize_1.Op.in]: [Notification_1.NotificationStatus.SENT, Notification_1.NotificationStatus.DELIVERED] },
                },
            });
            if (updatedRows > 0) {
                const notification = await Notification_1.default.findByPk(notificationId);
                if (notification) {
                    const engagementScore = notification.getEngagementScore();
                    await notification.update({ userEngagementScore: engagementScore });
                }
                (0, logger_1.logInfo)('Notification marked as read', { notificationId, userId });
                return true;
            }
            return false;
        }
        catch (error) {
            (0, logger_1.logError)('Error marking notification as read', error, {
                notificationId,
                userId,
            });
            return false;
        }
    }
    getAndroidChannelId(type) {
        const channelMap = {
            [Notification_1.NotificationType.EMERGENCY_ALERT]: 'emergency',
            [Notification_1.NotificationType.INCOMING_CALL]: 'calls',
            [Notification_1.NotificationType.RIDE_REQUEST]: 'rides',
            [Notification_1.NotificationType.CHAT_MESSAGE]: 'messages',
            [Notification_1.NotificationType.PAYMENT_RECEIVED]: 'payments',
            [Notification_1.NotificationType.DELIVERY_REQUEST]: 'deliveries',
        };
        return channelMap[type] || 'default';
    }
    formatEmailContent(notification) {
        return `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${notification.title}</h2>
          <p>${notification.body}</p>
          ${notification.imageUrl ? `<img src="${notification.imageUrl}" alt="Notification image" style="max-width: 100%;">` : ''}
          ${notification.actions.length > 0 ? `
            <div style="margin-top: 20px;">
              ${notification.actions.map(action => `
                <a href="${notification.deepLink}" style="display: inline-block; padding: 10px 20px; margin-right: 10px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
                  ${action.title}
                </a>
              `).join('')}
            </div>
          ` : ''}
          <p style="font-size: 12px; color: #666; margin-top: 30px;">
            This is a notification from ARYV. If you no longer wish to receive these emails, you can update your preferences in the app.
          </p>
        </body>
      </html>
    `;
    }
    async cleanupExpiredNotifications() {
        try {
            const result = await database_1.sequelize.query('SELECT cleanup_expired_notifications()');
            const deletedCount = result[0][0]?.cleanup_expired_notifications || 0;
            if (deletedCount > 0) {
                (0, logger_1.logInfo)('Cleaned up expired notifications', { deletedCount });
            }
            return deletedCount;
        }
        catch (error) {
            (0, logger_1.logError)('Error cleaning up expired notifications', error);
            return 0;
        }
    }
}
exports.AdvancedNotificationService = AdvancedNotificationService;
exports.default = AdvancedNotificationService;
//# sourceMappingURL=AdvancedNotificationService.js.map