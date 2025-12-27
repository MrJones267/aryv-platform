import Notification, { NotificationType, NotificationPriority, NotificationChannel } from '../models/Notification';
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
export declare class AdvancedNotificationService {
    private aiEnabled;
    private batchSize;
    constructor();
    sendNotification(request: NotificationRequest): Promise<NotificationResult>;
    sendBulkNotifications(request: BulkNotificationRequest): Promise<NotificationResult[]>;
    private deliverNotification;
    private deliverToChannel;
    private sendPushNotification;
    private sendInAppNotification;
    private sendSocketNotification;
    private sendEmailNotification;
    private sendSmsNotification;
    private getUserPreferences;
    private calculateAiScore;
    private scheduleRetry;
    processScheduledNotifications(): Promise<void>;
    markAsRead(notificationId: string, userId: string): Promise<boolean>;
    private getAndroidChannelId;
    private formatEmailContent;
    cleanupExpiredNotifications(): Promise<number>;
}
export default AdvancedNotificationService;
//# sourceMappingURL=AdvancedNotificationService.d.ts.map