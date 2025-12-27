"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationTemplate = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const Notification_1 = require("./Notification");
class NotificationTemplate extends sequelize_1.Model {
    populateTemplate(variables, locale = 'en') {
        const localizedContent = this.getLocalizedContent(locale);
        let title = localizedContent.title || this.title;
        let body = localizedContent.body || this.body;
        let deepLink = this.deepLinkTemplate;
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            title = title.replace(new RegExp(placeholder, 'g'), String(value));
            body = body.replace(new RegExp(placeholder, 'g'), String(value));
            if (deepLink) {
                deepLink = deepLink.replace(new RegExp(placeholder, 'g'), String(value));
            }
        }
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
    getLocalizedContent(locale) {
        if (!this.localization || !this.localization[locale]) {
            return {};
        }
        return this.localization[locale];
    }
    replaceVariables(text, variables) {
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
    validateVariables(variables) {
        const missing = [];
        for (const variable of this.variables) {
            if (!(variable in variables)) {
                missing.push(variable);
            }
        }
        return missing;
    }
    static getDefaultTemplates() {
        return [
            {
                name: 'ride_request_template',
                type: Notification_1.NotificationType.RIDE_REQUEST,
                title: 'New Ride Request',
                body: '{{passengerName}} wants to join your ride from {{origin}} to {{destination}} on {{date}}',
                priority: Notification_1.NotificationPriority.HIGH,
                channels: [Notification_1.NotificationChannel.PUSH, Notification_1.NotificationChannel.IN_APP],
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
                type: Notification_1.NotificationType.RIDE_ACCEPTED,
                title: 'Ride Request Accepted! 🎉',
                body: '{{driverName}} accepted your request! Your ride from {{origin}} to {{destination}} is confirmed.',
                priority: Notification_1.NotificationPriority.HIGH,
                channels: [Notification_1.NotificationChannel.PUSH, Notification_1.NotificationChannel.IN_APP],
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
                type: Notification_1.NotificationType.INCOMING_CALL,
                title: 'Incoming Call',
                body: '{{callerName}} is calling you',
                priority: Notification_1.NotificationPriority.URGENT,
                channels: [Notification_1.NotificationChannel.PUSH, Notification_1.NotificationChannel.IN_APP],
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
                type: Notification_1.NotificationType.DELIVERY_REQUEST,
                title: 'New Delivery Request',
                body: 'Deliver {{packageType}} from {{pickupLocation}} to {{dropoffLocation}} for {{reward}}',
                priority: Notification_1.NotificationPriority.NORMAL,
                channels: [Notification_1.NotificationChannel.PUSH, Notification_1.NotificationChannel.IN_APP],
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
                type: Notification_1.NotificationType.EMERGENCY_ALERT,
                title: '🚨 EMERGENCY ALERT',
                body: 'Emergency situation reported by {{reporterName}} at {{location}}. Immediate assistance required.',
                priority: Notification_1.NotificationPriority.CRITICAL,
                channels: [Notification_1.NotificationChannel.PUSH, Notification_1.NotificationChannel.IN_APP, Notification_1.NotificationChannel.SMS],
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
                type: Notification_1.NotificationType.AI_SUGGESTION,
                title: '💡 Smart Suggestion',
                body: '{{suggestionText}}',
                priority: Notification_1.NotificationPriority.LOW,
                channels: [Notification_1.NotificationChannel.IN_APP],
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
exports.NotificationTemplate = NotificationTemplate;
NotificationTemplate.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        unique: true,
    },
    type: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(Notification_1.NotificationType)),
        allowNull: false,
    },
    title: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: false,
    },
    body: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    priority: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(Notification_1.NotificationPriority)),
        allowNull: false,
        defaultValue: Notification_1.NotificationPriority.NORMAL,
    },
    channels: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: [Notification_1.NotificationChannel.PUSH, Notification_1.NotificationChannel.IN_APP],
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
    },
    variables: {
        type: sequelize_1.DataTypes.JSON,
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
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
        validate: {
            isUrl: true,
        },
    },
    deepLinkTemplate: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
    },
    metadata: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    version: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    localization: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    aiOptimized: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    engagementScore: {
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
});
exports.default = NotificationTemplate;
//# sourceMappingURL=NotificationTemplate.js.map