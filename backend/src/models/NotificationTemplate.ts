/**
 * @fileoverview Notification Template model for reusable notification templates
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
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

export interface NotificationTemplateCreationAttributes
  extends Optional<NotificationTemplateAttributes, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'aiOptimized'> {}

export class NotificationTemplate extends Model<NotificationTemplateAttributes, NotificationTemplateCreationAttributes>
  implements NotificationTemplateAttributes {

  public id!: string;
  public name!: string;
  public type!: NotificationType;
  public title!: string;
  public body!: string;
  public priority!: NotificationPriority;
  public channels!: NotificationChannel[];
  public actionable!: boolean;
  public actions!: any[];
  public variables!: string[];
  public imageUrl?: string;
  public deepLinkTemplate?: string;
  public metadata!: any;
  public isActive!: boolean;
  public version!: number;
  public localization!: any;
  public aiOptimized!: boolean;
  public engagementScore?: number;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Helper methods
  public populateTemplate(variables: Record<string, any>, locale: string = 'en'): any {
    const localizedContent = this.getLocalizedContent(locale);

    let title = localizedContent.title || this.title;
    let body = localizedContent.body || this.body;
    let deepLink = this.deepLinkTemplate;

    // Replace variables in title, body, and deep link
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      title = title.replace(new RegExp(placeholder, 'g'), String(value));
      body = body.replace(new RegExp(placeholder, 'g'), String(value));
      if (deepLink) {
        deepLink = deepLink.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }

    // Populate actions
    const populatedActions = this.actions.map(action => ({
      ...action,
      title: this.replaceVariables(action.title, variables),
      data: this.replaceVariables(action.data, variables),
    }));

    return {
      title,
      body,
      priority: this.priority,
      channels: this.channels,
      actionable: this.actionable,
      actions: populatedActions,
      imageUrl: this.imageUrl,
      deepLink,
      metadata: {
        ...this.metadata,
        templateId: this.id,
        templateVersion: this.version,
      },
    };
  }

  private getLocalizedContent(locale: string): any {
    if (!this.localization || !this.localization[locale]) {
      return {};
    }
    return this.localization[locale];
  }

  private replaceVariables(text: any, variables: Record<string, any>): any {
    if (typeof text !== 'string') {
      return text;
    }

    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }
    return result;
  }

  public validateVariables(variables: Record<string, any>): string[] {
    const missing: string[] = [];

    for (const variable of this.variables) {
      if (!(variable in variables)) {
        missing.push(variable);
      }
    }

    return missing;
  }

  public static getDefaultTemplates(): NotificationTemplateCreationAttributes[] {
    return [
      {
        name: 'ride_request_template',
        type: NotificationType.RIDE_REQUEST,
        title: 'New Ride Request',
        body: '{{passengerName}} wants to join your ride from {{origin}} to {{destination}} on {{date}}',
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
        actionable: true,
        actions: [
          {
            id: 'accept',
            title: 'Accept',
            type: 'positive',
            data: { action: 'accept_ride_request' },
          },
          {
            id: 'decline',
            title: 'Decline',
            type: 'negative',
            data: { action: 'decline_ride_request' },
          },
        ],
        variables: ['passengerName', 'origin', 'destination', 'date'],
        deepLinkTemplate: 'hitch://ride/{{rideId}}/request/{{requestId}}',
        metadata: { category: 'ride_management' },
        isActive: true,
        localization: {
          es: {
            title: 'Nueva Solicitud de Viaje',
            body: '{{passengerName}} quiere unirse a tu viaje de {{origin}} a {{destination}} el {{date}}',
          },
          fr: {
            title: 'Nouvelle Demande de Trajet',
            body: '{{passengerName}} veut rejoindre votre trajet de {{origin}} à {{destination}} le {{date}}',
          },
        },
        aiOptimized: false,
      },
      {
        name: 'ride_accepted_template',
        type: NotificationType.RIDE_ACCEPTED,
        title: 'Ride Request Accepted! 🎉',
        body: '{{driverName}} accepted your request! Your ride from {{origin}} to {{destination}} is confirmed.',
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
        actionable: true,
        actions: [
          {
            id: 'view_details',
            title: 'View Details',
            type: 'primary',
            data: { action: 'view_ride_details' },
          },
          {
            id: 'contact_driver',
            title: 'Contact Driver',
            type: 'secondary',
            data: { action: 'open_chat' },
          },
        ],
        variables: ['driverName', 'origin', 'destination'],
        deepLinkTemplate: 'hitch://ride/{{rideId}}',
        metadata: { category: 'ride_management' },
        isActive: true,
        localization: {},
        aiOptimized: false,
      },
      {
        name: 'incoming_call_template',
        type: NotificationType.INCOMING_CALL,
        title: 'Incoming Call',
        body: '{{callerName}} is calling you',
        priority: NotificationPriority.URGENT,
        channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
        actionable: true,
        actions: [
          {
            id: 'answer',
            title: 'Answer',
            type: 'positive',
            data: { action: 'answer_call' },
          },
          {
            id: 'decline',
            title: 'Decline',
            type: 'negative',
            data: { action: 'decline_call' },
          },
        ],
        variables: ['callerName'],
        deepLinkTemplate: 'hitch://call/{{callId}}',
        metadata: { category: 'communication' },
        isActive: true,
        localization: {},
        aiOptimized: false,
      },
      {
        name: 'delivery_request_template',
        type: NotificationType.DELIVERY_REQUEST,
        title: 'New Delivery Request',
        body: 'Deliver {{packageType}} from {{pickupLocation}} to {{dropoffLocation}} for {{reward}}',
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
        actionable: true,
        actions: [
          {
            id: 'accept',
            title: 'Accept Delivery',
            type: 'positive',
            data: { action: 'accept_delivery' },
          },
          {
            id: 'view_details',
            title: 'View Details',
            type: 'secondary',
            data: { action: 'view_delivery_details' },
          },
        ],
        variables: ['packageType', 'pickupLocation', 'dropoffLocation', 'reward'],
        deepLinkTemplate: 'hitch://delivery/{{deliveryId}}',
        metadata: { category: 'courier_service' },
        isActive: true,
        localization: {},
        aiOptimized: false,
      },
      {
        name: 'emergency_alert_template',
        type: NotificationType.EMERGENCY_ALERT,
        title: '🚨 EMERGENCY ALERT',
        body: 'Emergency situation reported by {{reporterName}} at {{location}}. Immediate assistance required.',
        priority: NotificationPriority.CRITICAL,
        channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP, NotificationChannel.SMS],
        actionable: true,
        actions: [
          {
            id: 'respond',
            title: 'Respond',
            type: 'critical',
            data: { action: 'respond_to_emergency' },
          },
          {
            id: 'view_location',
            title: 'View Location',
            type: 'secondary',
            data: { action: 'view_emergency_location' },
          },
        ],
        variables: ['reporterName', 'location'],
        deepLinkTemplate: 'hitch://emergency/{{emergencyId}}',
        metadata: { category: 'safety' },
        isActive: true,
        localization: {},
        aiOptimized: false,
      },
      {
        name: 'ai_suggestion_template',
        type: NotificationType.AI_SUGGESTION,
        title: '💡 Smart Suggestion',
        body: '{{suggestionText}}',
        priority: NotificationPriority.LOW,
        channels: [NotificationChannel.IN_APP],
        actionable: true,
        actions: [
          {
            id: 'apply',
            title: 'Apply Suggestion',
            type: 'primary',
            data: { action: 'apply_ai_suggestion' },
          },
          {
            id: 'dismiss',
            title: 'Not Now',
            type: 'secondary',
            data: { action: 'dismiss_suggestion' },
          },
        ],
        variables: ['suggestionText'],
        deepLinkTemplate: 'hitch://ai-suggestion/{{suggestionId}}',
        metadata: { category: 'ai_features' },
        isActive: true,
        localization: {},
        aiOptimized: true,
      },
    ];
  }
}

NotificationTemplate.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    type: {
      type: DataTypes.ENUM(...Object.values(NotificationType)),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    priority: {
      type: DataTypes.ENUM(...Object.values(NotificationPriority)),
      allowNull: false,
      defaultValue: NotificationPriority.NORMAL,
    },
    channels: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
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
    },
    variables: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      validate: {
        isArray: {
          args: true,
          msg: 'Variables must be an array',
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
    deepLinkTemplate: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    localization: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    aiOptimized: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    engagementScore: {
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
    modelName: 'NotificationTemplate',
    tableName: 'notification_templates',
    timestamps: true,
    indexes: [
      {
        fields: ['name'],
        name: 'idx_notification_templates_name',
        unique: true,
      },
      {
        fields: ['type'],
        name: 'idx_notification_templates_type',
      },
      {
        fields: ['isActive'],
        name: 'idx_notification_templates_active',
      },
    ],
  },
);

export default NotificationTemplate;
