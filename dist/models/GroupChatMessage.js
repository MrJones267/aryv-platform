"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupChatMessage = exports.MessageStatus = exports.MessageType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "text";
    MessageType["IMAGE"] = "image";
    MessageType["VIDEO"] = "video";
    MessageType["AUDIO"] = "audio";
    MessageType["FILE"] = "file";
    MessageType["LOCATION"] = "location";
    MessageType["SYSTEM"] = "system";
    MessageType["POLL"] = "poll";
    MessageType["ANNOUNCEMENT"] = "announcement";
})(MessageType || (exports.MessageType = MessageType = {}));
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["SENT"] = "sent";
    MessageStatus["DELIVERED"] = "delivered";
    MessageStatus["READ"] = "read";
    MessageStatus["DELETED"] = "deleted";
    MessageStatus["EDITED"] = "edited";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
class GroupChatMessage extends sequelize_1.Model {
    isDeleted() {
        return this.status === MessageStatus.DELETED || !!this.deletedAt;
    }
    isExpired() {
        return this.expiresAt ? new Date() > this.expiresAt : false;
    }
    hasAttachments() {
        return this.attachments && this.attachments.length > 0;
    }
    hasMentions() {
        return this.mentions && this.mentions.length > 0;
    }
    hasReactions() {
        return this.reactions && Object.keys(this.reactions).length > 0;
    }
    isReply() {
        return !!this.replyToMessageId;
    }
    isForwarded() {
        return !!this.forwardedFrom;
    }
    getReactionCount() {
        if (!this.reactions)
            return 0;
        return Object.values(this.reactions).reduce((total, users) => total + users.length, 0);
    }
    getUserReaction(userId) {
        if (!this.reactions)
            return null;
        for (const [emoji, users] of Object.entries(this.reactions)) {
            if (users.includes(userId)) {
                return emoji;
            }
        }
        return null;
    }
    addReaction(userId, emoji) {
        if (!this.reactions) {
            this.reactions = {};
        }
        this.removeReaction(userId);
        if (!this.reactions[emoji]) {
            this.reactions[emoji] = [];
        }
        this.reactions[emoji].push(userId);
    }
    removeReaction(userId, emoji) {
        if (!this.reactions)
            return;
        if (emoji) {
            if (this.reactions[emoji]) {
                this.reactions[emoji] = this.reactions[emoji].filter((id) => id !== userId);
                if (this.reactions[emoji].length === 0) {
                    delete this.reactions[emoji];
                }
            }
        }
        else {
            for (const emojiKey of Object.keys(this.reactions)) {
                this.reactions[emojiKey] = this.reactions[emojiKey].filter((id) => id !== userId);
                if (this.reactions[emojiKey].length === 0) {
                    delete this.reactions[emojiKey];
                }
            }
        }
    }
    markAsRead(userId) {
        if (!this.readBy) {
            this.readBy = {};
        }
        this.readBy[userId] = new Date().toISOString();
    }
    markAsDelivered(userId) {
        if (!this.deliveredTo) {
            this.deliveredTo = {};
        }
        this.deliveredTo[userId] = new Date().toISOString();
    }
    getReadCount() {
        return this.readBy ? Object.keys(this.readBy).length : 0;
    }
    getDeliveredCount() {
        return this.deliveredTo ? Object.keys(this.deliveredTo).length : 0;
    }
    isReadBy(userId) {
        return this.readBy && this.readBy[userId] !== undefined;
    }
    isDeliveredTo(userId) {
        return this.deliveredTo && this.deliveredTo[userId] !== undefined;
    }
    extractMentions(content) {
        const mentionRegex = /@(\w+)/g;
        const mentions = [];
        let match;
        while ((match = mentionRegex.exec(content)) !== null) {
            mentions.push(match[1]);
        }
        return mentions;
    }
    getPreviewText(maxLength = 100) {
        if (this.isDeleted()) {
            return 'This message was deleted';
        }
        switch (this.type) {
            case MessageType.TEXT:
                return this.content.length > maxLength
                    ? `${this.content.substring(0, maxLength)}...`
                    : this.content;
            case MessageType.IMAGE:
                return '📷 Image';
            case MessageType.VIDEO:
                return '🎥 Video';
            case MessageType.AUDIO:
                return '🎵 Audio message';
            case MessageType.FILE:
                return '📎 File';
            case MessageType.LOCATION:
                return '📍 Location';
            case MessageType.POLL:
                return '📊 Poll';
            case MessageType.ANNOUNCEMENT:
                return `📢 ${this.content.length > maxLength
                    ? `${this.content.substring(0, maxLength)}...`
                    : this.content}`;
            case MessageType.SYSTEM:
                return this.content;
            default:
                return 'Message';
        }
    }
    formatForApi(currentUserId) {
        return {
            id: this.id,
            groupChatId: this.groupChatId,
            senderId: this.senderId,
            replyToMessageId: this.replyToMessageId,
            type: this.type,
            status: this.status,
            content: this.isDeleted() ? null : this.content,
            metadata: this.metadata,
            attachments: this.isDeleted() ? [] : this.attachments,
            mentions: this.mentions,
            reactions: this.reactions,
            reactionCount: this.getReactionCount(),
            userReaction: currentUserId ? this.getUserReaction(currentUserId) : null,
            isEdited: this.isEdited,
            editedAt: this.editedAt,
            isDeleted: this.isDeleted(),
            deletedAt: this.deletedAt,
            isPinned: this.isPinned,
            pinnedAt: this.pinnedAt,
            isForwarded: this.isForwarded(),
            forwardedFrom: this.forwardedFrom,
            readCount: this.getReadCount(),
            deliveredCount: this.getDeliveredCount(),
            isRead: currentUserId ? this.isReadBy(currentUserId) : false,
            isDelivered: currentUserId ? this.isDeliveredTo(currentUserId) : false,
            previewText: this.getPreviewText(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    static createSystemMessage(groupChatId, content, metadata = {}) {
        return {
            groupChatId,
            senderId: 'system',
            type: MessageType.SYSTEM,
            content,
            metadata,
            attachments: [],
            mentions: [],
            reactions: {},
        };
    }
    static createAnnouncementMessage(groupChatId, senderId, content, metadata = {}) {
        return {
            groupChatId,
            senderId,
            type: MessageType.ANNOUNCEMENT,
            content,
            metadata,
            attachments: [],
            mentions: [],
            reactions: {},
            isPinned: true,
            pinnedBy: senderId,
            pinnedAt: new Date(),
        };
    }
}
exports.GroupChatMessage = GroupChatMessage;
GroupChatMessage.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    groupChatId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'group_chats',
            key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    },
    senderId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    },
    replyToMessageId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'group_chat_messages',
            key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
    },
    type: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(MessageType)),
        allowNull: false,
        defaultValue: MessageType.TEXT,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(MessageStatus)),
        allowNull: false,
        defaultValue: MessageStatus.SENT,
    },
    content: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    metadata: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    attachments: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
    },
    mentions: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
    },
    reactions: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    isEdited: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    editedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    deletedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    deletedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
    },
    expiresAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    isPinned: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    pinnedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
    },
    pinnedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    forwardedFrom: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
    },
    forwardedFromMessageId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
    },
    readBy: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    deliveredTo: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
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
    modelName: 'GroupChatMessage',
    tableName: 'group_chat_messages',
    timestamps: true,
    indexes: [
        {
            fields: ['groupChatId', 'createdAt'],
            name: 'idx_group_chat_messages_group_created',
        },
        {
            fields: ['senderId'],
            name: 'idx_group_chat_messages_sender',
        },
        {
            fields: ['replyToMessageId'],
            name: 'idx_group_chat_messages_reply_to',
        },
        {
            fields: ['type', 'status'],
            name: 'idx_group_chat_messages_type_status',
        },
        {
            fields: ['isPinned', 'groupChatId'],
            name: 'idx_group_chat_messages_pinned_group',
        },
        {
            fields: ['expiresAt'],
            name: 'idx_group_chat_messages_expires',
            where: {
                expiresAt: {
                    [sequelize_1.Op.ne]: null,
                },
            },
        },
        {
            fields: ['deletedAt'],
            name: 'idx_group_chat_messages_deleted',
        },
    ],
    hooks: {
        beforeCreate: (message) => {
            if (message.type === MessageType.TEXT || message.type === MessageType.ANNOUNCEMENT) {
                message.mentions = message.extractMentions(message.content);
            }
            if (!message.metadata) {
                message.metadata = {};
            }
            if (message.type === MessageType.ANNOUNCEMENT && message.isPinned && !message.pinnedAt) {
                message.pinnedAt = new Date();
            }
        },
        beforeUpdate: (message) => {
            if (message.changed('content') && !message.isDeleted()) {
                message.isEdited = true;
                message.editedAt = new Date();
                if (message.type === MessageType.TEXT || message.type === MessageType.ANNOUNCEMENT) {
                    message.mentions = message.extractMentions(message.content);
                }
            }
            if (message.changed('isPinned') && message.isPinned && !message.pinnedAt) {
                message.pinnedAt = new Date();
            }
            if (message.changed('isPinned') && !message.isPinned) {
                message.pinnedAt = null;
                message.pinnedBy = null;
            }
        },
    },
    validate: {
        contentRequired() {
            if (!this['content'] && this['type'] !== MessageType.FILE) {
                throw new Error('Content is required for most message types');
            }
        },
        pinnedByRequired() {
            if (this['isPinned'] && !this['pinnedBy']) {
                throw new Error('pinnedBy is required when message is pinned');
            }
        },
    },
});
exports.default = GroupChatMessage;
//# sourceMappingURL=GroupChatMessage.js.map