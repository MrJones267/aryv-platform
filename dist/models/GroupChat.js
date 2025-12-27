"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupChat = exports.GroupChatStatus = exports.GroupChatType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var GroupChatType;
(function (GroupChatType) {
    GroupChatType["RIDE_GROUP"] = "ride_group";
    GroupChatType["DELIVERY_GROUP"] = "delivery_group";
    GroupChatType["EMERGENCY_GROUP"] = "emergency_group";
    GroupChatType["CUSTOM_GROUP"] = "custom_group";
})(GroupChatType || (exports.GroupChatType = GroupChatType = {}));
var GroupChatStatus;
(function (GroupChatStatus) {
    GroupChatStatus["ACTIVE"] = "active";
    GroupChatStatus["ARCHIVED"] = "archived";
    GroupChatStatus["DELETED"] = "deleted";
})(GroupChatStatus || (exports.GroupChatStatus = GroupChatStatus = {}));
class GroupChat extends sequelize_1.Model {
    isActive() {
        return this.status === GroupChatStatus.ACTIVE;
    }
    canAddParticipants(currentCount) {
        return currentCount < this.maxParticipants && this.isActive();
    }
    generateJoinCode() {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        return code;
    }
    getDefaultSettings() {
        return {
            allowFileSharing: true,
            allowImageSharing: true,
            allowLocationSharing: true,
            allowVoiceMessages: true,
            allowCalls: true,
            messageRetentionDays: 30,
            moderationEnabled: false,
            profanityFilter: true,
            readReceipts: true,
            typingIndicators: true,
            notifications: {
                mentions: true,
                allMessages: false,
                quietHours: {
                    enabled: false,
                    start: '22:00',
                    end: '08:00',
                },
            },
        };
    }
    static getTypeDisplayName(type) {
        const typeMap = {
            [GroupChatType.RIDE_GROUP]: 'Ride Group',
            [GroupChatType.DELIVERY_GROUP]: 'Delivery Group',
            [GroupChatType.EMERGENCY_GROUP]: 'Emergency Group',
            [GroupChatType.CUSTOM_GROUP]: 'Custom Group',
        };
        return typeMap[type] || 'Unknown';
    }
    getParticipantSummary() {
        return {
            total: 0,
            active: 0,
            admins: 0,
        };
    }
    formatForApi() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            type: this.type,
            typeDisplayName: GroupChat.getTypeDisplayName(this.type),
            status: this.status,
            createdBy: this.createdBy,
            avatarUrl: this.avatarUrl,
            settings: this.settings,
            maxParticipants: this.maxParticipants,
            isPublic: this.isPublic,
            hasJoinCode: !!this.joinCode,
            lastMessageAt: this.lastMessageAt,
            lastMessageId: this.lastMessageId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            relatedEntity: this.rideId ? { type: 'ride', id: this.rideId } :
                this.deliveryId ? { type: 'delivery', id: this.deliveryId } : null,
        };
    }
}
exports.GroupChat = GroupChat;
GroupChat.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        validate: {
            len: [1, 100],
        },
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        validate: {
            len: [0, 500],
        },
    },
    type: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(GroupChatType)),
        allowNull: false,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(GroupChatStatus)),
        allowNull: false,
        defaultValue: GroupChatStatus.ACTIVE,
    },
    createdBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    },
    avatarUrl: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
        validate: {
            isUrl: true,
        },
    },
    settings: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    metadata: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    rideId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'rides',
            key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    },
    deliveryId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'delivery_agreements',
            key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    },
    maxParticipants: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50,
        validate: {
            min: 2,
            max: 500,
        },
    },
    isPublic: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    joinCode: {
        type: sequelize_1.DataTypes.STRING(10),
        allowNull: true,
        unique: true,
    },
    lastMessageAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    lastMessageId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
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
    modelName: 'GroupChat',
    tableName: 'group_chats',
    timestamps: true,
    indexes: [
        {
            fields: ['createdBy'],
            name: 'idx_group_chats_created_by',
        },
        {
            fields: ['type', 'status'],
            name: 'idx_group_chats_type_status',
        },
        {
            fields: ['rideId'],
            name: 'idx_group_chats_ride',
        },
        {
            fields: ['deliveryId'],
            name: 'idx_group_chats_delivery',
        },
        {
            fields: ['joinCode'],
            name: 'idx_group_chats_join_code',
            unique: true,
            where: {
                joinCode: {
                    [sequelize_1.Op.ne]: null,
                },
            },
        },
        {
            fields: ['isPublic', 'status'],
            name: 'idx_group_chats_public_status',
        },
        {
            fields: ['lastMessageAt'],
            name: 'idx_group_chats_last_message',
        },
    ],
    hooks: {
        beforeCreate: (groupChat) => {
            if (!groupChat.settings || Object.keys(groupChat.settings).length === 0) {
                groupChat.settings = groupChat.getDefaultSettings();
            }
            if (groupChat.isPublic && !groupChat.joinCode) {
                groupChat.joinCode = groupChat.generateJoinCode();
            }
            if (!groupChat.name) {
                switch (groupChat.type) {
                    case GroupChatType.RIDE_GROUP:
                        groupChat.name = 'Ride Group';
                        break;
                    case GroupChatType.DELIVERY_GROUP:
                        groupChat.name = 'Delivery Group';
                        break;
                    case GroupChatType.EMERGENCY_GROUP:
                        groupChat.name = 'Emergency Group';
                        break;
                    default:
                        groupChat.name = 'Group Chat';
                }
            }
        },
        beforeUpdate: (groupChat) => {
            if (groupChat.changed('isPublic') && groupChat.isPublic && !groupChat.joinCode) {
                groupChat.joinCode = groupChat.generateJoinCode();
            }
            if (groupChat.changed('isPublic') && !groupChat.isPublic) {
                groupChat.joinCode = null;
            }
        },
    },
    validate: {
        checkRelatedEntity() {
            if (this['type'] === GroupChatType.RIDE_GROUP && !this['rideId']) {
                throw new Error('Ride groups must have a rideId');
            }
            if (this['type'] === GroupChatType.DELIVERY_GROUP && !this['deliveryId']) {
                throw new Error('Delivery groups must have a deliveryId');
            }
            if (this['rideId'] && this['deliveryId']) {
                throw new Error('Group cannot be associated with both ride and delivery');
            }
        },
    },
});
exports.default = GroupChat;
//# sourceMappingURL=GroupChat.js.map