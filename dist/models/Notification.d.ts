import { Model, Optional } from 'sequelize';
export declare enum NotificationType {
    RIDE_REQUEST = "ride_request",
    RIDE_ACCEPTED = "ride_accepted",
    RIDE_CANCELLED = "ride_cancelled",
    RIDE_STARTED = "ride_started",
    RIDE_COMPLETED = "ride_completed",
    PAYMENT_RECEIVED = "payment_received",
    PAYMENT_FAILED = "payment_failed",
    CHAT_MESSAGE = "chat_message",
    INCOMING_CALL = "incoming_call",
    CALL_MISSED = "call_missed",
    DELIVERY_REQUEST = "delivery_request",
    DELIVERY_ACCEPTED = "delivery_accepted",
    DELIVERY_COMPLETED = "delivery_completed",
    PACKAGE_DELIVERED = "package_delivered",
    EMERGENCY_ALERT = "emergency_alert",
    SYSTEM_UPDATE = "system_update",
    PROMOTION = "promotion",
    REMINDER = "reminder",
    AI_SUGGESTION = "ai_suggestion"
}
export declare enum NotificationPriority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high",
    URGENT = "urgent",
    CRITICAL = "critical"
}
export declare enum NotificationStatus {
    PENDING = "pending",
    SENT = "sent",
    DELIVERED = "delivered",
    READ = "read",
    DISMISSED = "dismissed",
    FAILED = "failed"
}
export declare enum NotificationChannel {
    PUSH = "push",
    IN_APP = "in_app",
    EMAIL = "email",
    SMS = "sms",
    SOCKET = "socket"
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
export interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deliveryAttempts'> {
}
export declare class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
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
    isExpired(): boolean;
    isPending(): boolean;
    isDelivered(): boolean;
    isRead(): boolean;
    isCritical(): boolean;
    shouldRetryDelivery(): boolean;
    getTimeToRead(): number | null;
    getEngagementScore(): number;
    formatForMobile(): any;
}
export default Notification;
//# sourceMappingURL=Notification.d.ts.map