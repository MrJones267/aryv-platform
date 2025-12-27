"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourierChatMessage = exports.MessageType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "text";
    MessageType["IMAGE"] = "image";
    MessageType["LOCATION"] = "location";
    MessageType["SYSTEM"] = "system";
})(MessageType || (exports.MessageType = MessageType = {}));
class CourierChatMessage extends sequelize_1.Model {
    async markAsRead() {
        if (!this.isRead) {
            this.isRead = true;
            this.readAt = new Date();
            await this.save();
        }
    }
    isRecent() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return this.createdAt > oneHourAgo;
    }
    hasAttachment() {
        return !!(this.attachmentUrl && this.attachmentUrl.trim().length > 0);
    }
    getMessageAge() {
        return Date.now() - this.createdAt.getTime();
    }
    toJSON() {
        const values = { ...this.get() };
        return {
            ...values,
            isRecent: this.isRecent(),
            hasAttachment: this.hasAttachment(),
            ageInMinutes: Math.floor(this.getMessageAge() / (1000 * 60)),
        };
    }
}
exports.CourierChatMessage = CourierChatMessage;
CourierChatMessage.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    deliveryAgreementId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'delivery_agreements',
            key: 'id',
        },
        field: 'delivery_agreement_id',
    },
    senderId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        field: 'sender_id',
    },
    recipientId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        field: 'recipient_id',
    },
    messageType: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(MessageType)),
        allowNull: false,
        defaultValue: MessageType.TEXT,
        field: 'message_type',
    },
    content: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true,
        },
    },
    attachmentUrl: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
        field: 'attachment_url',
    },
    isRead: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_read',
    },
    readAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'read_at',
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'created_at',
    },
}, {
    sequelize: database_1.sequelize,
    modelName: 'CourierChatMessage',
    tableName: 'courier_chat_messages',
    timestamps: false,
    indexes: [
        { fields: ['delivery_agreement_id'] },
        { fields: ['sender_id'] },
        { fields: ['recipient_id', 'is_read'] },
        { fields: ['created_at'] },
    ],
});
exports.default = CourierChatMessage;
//# sourceMappingURL=CourierChatMessage.js.map