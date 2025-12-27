import { Model, Optional } from 'sequelize';
import { NotificationType, NotificationChannel, NotificationPriority } from './Notification';
export interface NotificationPreferenceAttributes {
    id: string;
    userId: string;
    type: NotificationType;
    enabled: boolean;
    channels: NotificationChannel[];
    quietHoursEnabled: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone: string;
    minPriority: NotificationPriority;
    frequency: 'immediate' | 'digest_hourly' | 'digest_daily' | 'digest_weekly';
    customSettings: any;
    createdAt: Date;
    updatedAt: Date;
}
export interface NotificationPreferenceCreationAttributes extends Optional<NotificationPreferenceAttributes, 'id' | 'createdAt' | 'updatedAt'> {
}
export declare class NotificationPreference extends Model<NotificationPreferenceAttributes, NotificationPreferenceCreationAttributes> implements NotificationPreferenceAttributes {
    id: string;
    userId: string;
    type: NotificationType;
    enabled: boolean;
    channels: NotificationChannel[];
    quietHoursEnabled: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone: string;
    minPriority: NotificationPriority;
    frequency: 'immediate' | 'digest_hourly' | 'digest_daily' | 'digest_weekly';
    customSettings: any;
    createdAt: Date;
    updatedAt: Date;
    isInQuietHours(currentTime?: Date): boolean;
    shouldReceiveNotification(priority: NotificationPriority, currentTime?: Date): boolean;
    getActiveChannels(priority: NotificationPriority): NotificationChannel[];
    static getDefaultPreferences(userId: string): NotificationPreferenceCreationAttributes[];
}
export default NotificationPreference;
//# sourceMappingURL=NotificationPreference.d.ts.map