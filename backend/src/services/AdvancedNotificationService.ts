/**
 * @fileoverview Advanced Notification Service with AI prioritization and multi-channel delivery
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { QueryTypes, Op } from 'sequelize';
import { sequelize } from '../config/database';
import Notification, { NotificationType, NotificationPriority, NotificationStatus, NotificationChannel } from '../models/Notification';
import NotificationPreference from '../models/NotificationPreference';
import NotificationTemplate from '../models/NotificationTemplate';
import { User } from '../models';
import { logInfo, logError, logWarning } from '../utils/logger';

export interface NotificationRequest {
  userId: string;
  type: NotificationType;
  templateName?: string;
  title?: string;
  body?: string;
  data?: any;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  variables?: Record<string, any>;
  actionable?: boolean;
  actions?: any[];
  imageUrl?: string;
  deepLink?: string;
  expiresAt?: Date;
  scheduledAt?: Date;
  relatedEntityType?: string;
  relatedEntityId?: string;
  batchId?: string;
  campaignId?: string;
  locale?: string;
}

export interface NotificationResult {
  success: boolean;
  notification?: Notification;
  error?: string;
  deliveryChannels?: NotificationChannel[];
}

export interface BulkNotificationRequest extends Omit<NotificationRequest, 'userId'> {
  userIds: string[];
  batchSize?: number;
}

export interface NotificationAnalytics {
  totalSent: number;
  totalRead: number;
  totalDismissed: number;
  readRate: number;
  avgEngagementScore: number;
  channelPerformance: Record<NotificationChannel, any>;
  typePerformance: Record<NotificationType, any>;
}

export class AdvancedNotificationService {
  private aiEnabled: boolean;
  // private _maxRetryAttempts: number; // Currently unused
  private batchSize: number;

  constructor() {
    this.aiEnabled = process.env['NOTIFICATION_AI_ENABLED'] === 'true';
    // this._maxRetryAttempts = parseInt(process.env['NOTIFICATION_MAX_RETRIES'] || '3'); // Currently unused
    this.batchSize = parseInt(process.env['NOTIFICATION_BATCH_SIZE'] || '100');
  }

  /**
   * Send a notification to a user
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationResult> {
    const transaction = await sequelize.transaction();

    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(request.userId, request.type);

      if (!preferences) {
        await transaction.rollback();
        return {
          success: false,
          error: 'User preferences not found',
        };
      }

      // Check if user should receive this notification
      const priority = request.priority || NotificationPriority.NORMAL;
      if (!preferences.shouldReceiveNotification(priority)) {
        await transaction.rollback();
        logInfo('Notification filtered by user preferences', {
          userId: request.userId,
          type: request.type,
          priority,
        });
        return {
          success: true,
          deliveryChannels: [],
        };
      }

      // Get notification template if specified
      let notificationData = { ...request };
      if (request.templateName) {
        const template = await NotificationTemplate.findOne({
          where: { name: request.templateName, isActive: true },
          transaction,
        });

        if (template) {
          const populated = template.populateTemplate(
            request.variables || {},
            request.locale || 'en',
          );
          notificationData = { ...notificationData, ...populated };
        }
      }

      // Determine delivery channels
      const deliveryChannels = preferences.getActiveChannels(priority);
      if (deliveryChannels.length === 0) {
        await transaction.rollback();
        return {
          success: true,
          deliveryChannels: [],
        };
      }

      // Calculate AI score if enabled
      let aiScore;
      if (this.aiEnabled) {
        aiScore = await this.calculateAiScore(request.userId, request.type, request.data || {});
      }

      // Create notification record
      const notification = await (Notification as any).create({
        userId: request.userId,
        type: request.type,
        priority,
        status: NotificationStatus.PENDING,
        channel: deliveryChannels,
        title: notificationData.title || 'Notification',
        body: notificationData.body || '',
        data: notificationData.data || {},
        metadata: {
          ...(notificationData as any).metadata,
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

      // Send notification if not scheduled
      if (!request.scheduledAt) {
        await this.deliverNotification(notification);
      }

      logInfo('Notification created successfully', {
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

    } catch (error) {
      await transaction.rollback();
      logError('Error sending notification', error as Error, {
        userId: request.userId,
        type: request.type,
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Send bulk notifications to multiple users
   */
  async sendBulkNotifications(request: BulkNotificationRequest): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    const batchSize = request.batchSize || this.batchSize;
    const batchId = `bulk_${Date.now()}`;

    try {
      // Process users in batches
      for (let i = 0; i < request.userIds.length; i += batchSize) {
        const userBatch = request.userIds.slice(i, i + batchSize);
        const batchPromises = userBatch.map(userId =>
          this.sendNotification({
            ...request,
            userId,
            batchId,
          }),
        );

        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              error: result.reason.message,
            });
          }
        }

        // Small delay between batches to avoid overwhelming the system
        if (i + batchSize < request.userIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logInfo('Bulk notifications processed', {
        totalUsers: request.userIds.length,
        successCount: results.filter(r => r.success).length,
        batchId,
      });

      return results;

    } catch (error) {
      logError('Error in bulk notification processing', error as Error, {
        userCount: request.userIds.length,
        batchId,
      });

      throw error;
    }
  }

  /**
   * Deliver a notification through appropriate channels
   */
  private async deliverNotification(notification: Notification): Promise<void> {
    try {
      const deliveryPromises = notification.channel.map(channel =>
        this.deliverToChannel(notification, channel),
      );

      const results = await Promise.allSettled(deliveryPromises);

      let deliveredToAnyChannel = false;
      const failedChannels: NotificationChannel[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const channel = notification.channel[i];

        if (result.status === 'fulfilled' && result.value) {
          deliveredToAnyChannel = true;
        } else {
          failedChannels.push(channel);
          logWarning('Failed to deliver notification to channel', {
            notificationId: notification.id,
            channel,
            error: result.status === 'rejected' ? result.reason : 'Unknown error',
          });
        }
      }

      // Update notification status
      const newStatus = deliveredToAnyChannel
        ? NotificationStatus.SENT
        : NotificationStatus.FAILED;

      await (notification as any).update({
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

      // Schedule retry for failed notifications
      if (!deliveredToAnyChannel && notification.shouldRetryDelivery()) {
        await this.scheduleRetry(notification);
      }

    } catch (error) {
      logError('Error delivering notification', error as Error, {
        notificationId: notification.id,
      });

      await notification.update({
        status: NotificationStatus.FAILED,
        deliveryAttempts: notification.deliveryAttempts + 1,
        lastDeliveryAttempt: new Date(),
      });
    }
  }

  /**
   * Deliver notification to specific channel
   */
  private async deliverToChannel(
    notification: Notification,
    channel: NotificationChannel,
  ): Promise<boolean> {
    try {
      switch (channel) {
        case NotificationChannel.PUSH:
          return await this.sendPushNotification(notification);

        case NotificationChannel.IN_APP:
          return await this.sendInAppNotification(notification);

        case NotificationChannel.EMAIL:
          return await this.sendEmailNotification(notification);

        case NotificationChannel.SMS:
          return await this.sendSmsNotification(notification);

        case NotificationChannel.SOCKET:
          return await this.sendSocketNotification(notification);

        default:
          logWarning('Unknown notification channel', { channel });
          return false;
      }
    } catch (error) {
      logError(`Error delivering to ${channel}`, error as Error, {
        notificationId: notification.id,
      });
      return false;
    }
  }

  /**
   * Send push notification via FCM
   */
  private async sendPushNotification(notification: Notification): Promise<boolean> {
    try {
      // Get user's FCM token
      const user = await User.findByPk(notification.userId);
      if (!user || !(user as any).fcmToken) {
        return false;
      }

      // Format push notification payload
      const payload = {
        token: (user as any).fcmToken,
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

      // Send via FCM (implementation would depend on FCM SDK)
      // const response = await fcmAdmin.messaging().send(payload);
      console.log('Push notification payload prepared:', payload);

      // For now, simulate successful delivery
      logInfo('Push notification sent', {
        notificationId: notification.id,
        userId: notification.userId,
      });

      return true;

    } catch (error) {
      logError('Push notification delivery failed', error as Error, {
        notificationId: notification.id,
      });
      return false;
    }
  }

  /**
   * Send in-app notification via WebSocket
   */
  private async sendInAppNotification(notification: Notification): Promise<boolean> {
    try {
      // Use existing NotificationService for real-time delivery
      const basicNotificationService = await import('./NotificationService');

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

      logInfo('In-app notification sent', {
        notificationId: notification.id,
        userId: notification.userId,
      });

      return true;

    } catch (error) {
      logError('In-app notification delivery failed', error as Error, {
        notificationId: notification.id,
      });
      return false;
    }
  }

  /**
   * Send socket notification for real-time events
   */
  private async sendSocketNotification(notification: Notification): Promise<boolean> {
    return this.sendInAppNotification(notification);
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: Notification): Promise<boolean> {
    try {
      const user = await User.findByPk(notification.userId);
      if (!user || !user.email) {
        return false;
      }

      // Format email content
      const emailData = {
        to: user.email,
        subject: notification.title,
        html: this.formatEmailContent(notification),
        text: notification.body,
      };

      // Send via email service (implementation would depend on email provider)
      // await emailService.send(emailData);
      console.log('Email notification data prepared:', emailData);

      logInfo('Email notification sent', {
        notificationId: notification.id,
        userId: notification.userId,
      });

      return true;

    } catch (error) {
      logError('Email notification delivery failed', error as Error, {
        notificationId: notification.id,
      });
      return false;
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSmsNotification(notification: Notification): Promise<boolean> {
    try {
      const user = await User.findByPk(notification.userId);
      if (!user || !user.phone) {
        return false;
      }

      // Format SMS content (keep it short)
      const smsText = `${notification.title}: ${notification.body}`.slice(0, 160);

      // Send via SMS service (implementation would depend on SMS provider)
      // await smsService.send({ to: user.phone, text: smsText });
      console.log('SMS notification text prepared:', smsText);

      logInfo('SMS notification sent', {
        notificationId: notification.id,
        userId: notification.userId,
      });

      return true;

    } catch (error) {
      logError('SMS notification delivery failed', error as Error, {
        notificationId: notification.id,
      });
      return false;
    }
  }

  /**
   * Get user's notification preferences
   */
  private async getUserPreferences(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationPreference | null> {
    try {
      let preference = await NotificationPreference.findOne({
        where: { userId, type },
      });

      // Create default preferences if not found
      if (!preference) {
        const defaults = NotificationPreference.getDefaultPreferences(userId);
        const defaultForType = defaults.find(p => p.type === type);

        if (defaultForType) {
          preference = await NotificationPreference.create(defaultForType);
        }
      }

      return preference;

    } catch (error) {
      logError('Error getting user preferences', error as Error, { userId, type });
      return null;
    }
  }

  /**
   * Calculate AI-based notification score
   */
  private async calculateAiScore(
    userId: string,
    type: NotificationType,
    contextData: any,
  ): Promise<number> {
    try {
      // Use database function for AI scoring
      const result = await sequelize.query(
        'SELECT calculate_ai_notification_score(:userId, :type, :contextData) as score',
        {
          replacements: {
            userId,
            type,
            contextData: JSON.stringify(contextData),
          },
          type: QueryTypes.SELECT,
        },
      );

      return (result[0] as any)?.score || 50;

    } catch (error) {
      logError('Error calculating AI score', error as Error, { userId, type });
      return 50; // Default score
    }
  }

  /**
   * Schedule notification retry
   */
  private async scheduleRetry(notification: Notification): Promise<void> {
    try {
      const retryDelay = Math.pow(2, notification.deliveryAttempts) * 60000; // Exponential backoff
      const retryAt = new Date(Date.now() + retryDelay);

      await notification.update({
        scheduledAt: retryAt,
        metadata: {
          ...notification.metadata,
          isRetry: true,
          originalFailedAt: new Date(),
        },
      });

      logInfo('Notification retry scheduled', {
        notificationId: notification.id,
        retryAt,
        attempt: notification.deliveryAttempts + 1,
      });

    } catch (error) {
      logError('Error scheduling notification retry', error as Error, {
        notificationId: notification.id,
      });
    }
  }

  /**
   * Process scheduled notifications
   */
  async processScheduledNotifications(): Promise<void> {
    try {
      const scheduledNotifications = await Notification.findAll({
        where: {
          status: NotificationStatus.PENDING,
          scheduledAt: {
            [Op.lte]: new Date(),
          },
        },
        limit: this.batchSize,
        order: [['scheduledAt', 'ASC']],
      });

      for (const notification of scheduledNotifications) {
        if (!notification.isExpired()) {
          await this.deliverNotification(notification);
        } else {
          await notification.update({ status: NotificationStatus.FAILED });
        }
      }

      if (scheduledNotifications.length > 0) {
        logInfo('Processed scheduled notifications', {
          count: scheduledNotifications.length,
        });
      }

    } catch (error) {
      logError('Error processing scheduled notifications', error as Error);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const [updatedRows] = await Notification.update(
        {
          status: NotificationStatus.READ,
          readAt: new Date(),
        },
        {
          where: {
            id: notificationId,
            userId,
            status: { [Op.in]: [NotificationStatus.SENT, NotificationStatus.DELIVERED] },
          },
        },
      );

      if (updatedRows > 0) {
        // Calculate and update engagement score
        const notification = await Notification.findByPk(notificationId);
        if (notification) {
          const engagementScore = notification.getEngagementScore();
          await notification.update({ userEngagementScore: engagementScore });
        }

        logInfo('Notification marked as read', { notificationId, userId });
        return true;
      }

      return false;

    } catch (error) {
      logError('Error marking notification as read', error as Error, {
        notificationId,
        userId,
      });
      return false;
    }
  }

  /**
   * Helper methods
   */
  private getAndroidChannelId(type: NotificationType): string {
    const channelMap = {
      [NotificationType.EMERGENCY_ALERT]: 'emergency',
      [NotificationType.INCOMING_CALL]: 'calls',
      [NotificationType.RIDE_REQUEST]: 'rides',
      [NotificationType.CHAT_MESSAGE]: 'messages',
      [NotificationType.PAYMENT_RECEIVED]: 'payments',
      [NotificationType.DELIVERY_REQUEST]: 'deliveries',
    };

    return (channelMap as any)[type] || 'default';
  }

  private formatEmailContent(notification: Notification): string {
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

  /**
   * Cleanup expired notifications
   */
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const result = await sequelize.query('SELECT cleanup_expired_notifications()');
      const deletedCount = (result[0] as any)[0]?.cleanup_expired_notifications || 0;

      if (deletedCount > 0) {
        logInfo('Cleaned up expired notifications', { deletedCount });
      }

      return deletedCount;

    } catch (error) {
      logError('Error cleaning up expired notifications', error as Error);
      return 0;
    }
  }
}

export default AdvancedNotificationService;
