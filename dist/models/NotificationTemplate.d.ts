import { Model, Optional } from 'sequelize';
import { NotificationType, NotificationPriority, NotificationChannel } from './Notification';
export interface NotificationTemplateAttributes {
    id: string;
    name: string;
    type: NotificationType;
    title: string;
    body: string;
    priority: NotificationPriority;
    channels: NotificationChannel[];
    actionable: boolean;
    actions: any[];
    variables: string[];
    imageUrl?: string;
    deepLinkTemplate?: string;
    metadata: any;
    isActive: boolean;
    version: number;
    localization: any;
    aiOptimized: boolean;
    engagementScore?: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface NotificationTemplateCreationAttributes extends Optional<NotificationTemplateAttributes, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'aiOptimized'> {
}
export declare class NotificationTemplate extends Model<NotificationTemplateAttributes, NotificationTemplateCreationAttributes> implements NotificationTemplateAttributes {
    id: string;
    name: string;
    type: NotificationType;
    title: string;
    body: string;
    priority: NotificationPriority;
    channels: NotificationChannel[];
    actionable: boolean;
    actions: any[];
    variables: string[];
    imageUrl?: string;
    deepLinkTemplate?: string;
    metadata: any;
    isActive: boolean;
    version: number;
    localization: any;
    aiOptimized: boolean;
    engagementScore?: number;
    createdAt: Date;
    updatedAt: Date;
    populateTemplate(variables: Record<string, any>, locale?: string): any;
    private getLocalizedContent;
    private replaceVariables;
    validateVariables(variables: Record<string, any>): string[];
    static getDefaultTemplates(): NotificationTemplateCreationAttributes[];
}
export default NotificationTemplate;
//# sourceMappingURL=NotificationTemplate.d.ts.map