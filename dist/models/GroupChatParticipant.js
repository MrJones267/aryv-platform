"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupChatParticipant = exports.ParticipantStatus = exports.ParticipantRole = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
var ParticipantRole;
(function (ParticipantRole) {
    ParticipantRole["ADMIN"] = "admin";
    ParticipantRole["MODERATOR"] = "moderator";
    ParticipantRole["MEMBER"] = "member";
})(ParticipantRole || (exports.ParticipantRole = ParticipantRole = {}));
var ParticipantStatus;
(function (ParticipantStatus) {
    ParticipantStatus["ACTIVE"] = "active";
    ParticipantStatus["MUTED"] = "muted";
    ParticipantStatus["BLOCKED"] = "blocked";
    ParticipantStatus["LEFT"] = "left";
    ParticipantStatus["REMOVED"] = "removed";
})(ParticipantStatus || (exports.ParticipantStatus = ParticipantStatus = {}));
class GroupChatParticipant extends sequelize_1.Model {
    isActive() {
        return this.status === ParticipantStatus.ACTIVE;
    }
    isMuted() {
        if (this.status === ParticipantStatus.MUTED) {
            return true;
        }
        if (this.mutedUntil) {
            return new Date() < this.mutedUntil;
        }
        return false;
    }
    isAdmin() {
        return this.role === ParticipantRole.ADMIN;
    }
    isModerator() {
        return this.role === ParticipantRole.MODERATOR || this.isAdmin();
    }
    canModerate() {
        return this.isModerator() && this.isActive();
    }
    canInvite() {
        return this.permissions.canInvite !== false && this.isActive();
    }
    canRemoveMessages() {
        return this.permissions.canRemoveMessages !== false && this.isModerator();
    }
    canMuteParticipants() {
        return this.permissions.canMute !== false && this.isModerator();
    }
    getDefaultPermissions(role) {
        const basePermissions = {
            canSendMessages: true,
            canSendMedia: true,
            canSendVoiceMessages: true,
            canMakeVoiceCalls: true,
            canMakeVideoCalls: true,
            canShareLocation: true,
            canInvite: false,
            canRemoveMessages: false,
            canMute: false,
            canRemoveParticipants: false,
            canEditGroupInfo: false,
        };
        switch (role) {
            case ParticipantRole.ADMIN:
                return {
                    ...basePermissions,
                    canInvite: true,
                    canRemoveMessages: true,
                    canMute: true,
                    canRemoveParticipants: true,
                    canEditGroupInfo: true,
                };
            case ParticipantRole.MODERATOR:
                return {
                    ...basePermissions,
                    canInvite: true,
                    canRemoveMessages: true,
                    canMute: true,
                };
            case ParticipantRole.MEMBER:
            default:
                return basePermissions;
        }
    }
    updateLastSeen() {
        return this.constructor.update({ lastSeenAt: new Date() }, { where: { id: this.id } });
    }
    markMessageAsRead(messageId) {
        return this.constructor.update({
            lastReadMessageId: messageId,
            lastSeenAt: new Date(),
        }, { where: { id: this.id } });
    }
    mute(duration) {
        const updates = { status: ParticipantStatus.MUTED };
        if (duration) {
            updates.mutedUntil = new Date(Date.now() + duration);
        }
        return this.constructor.update(updates, { where: { id: this.id } });
    }
    unmute() {
        return this.constructor.update({
            status: ParticipantStatus.ACTIVE,
            mutedUntil: null,
        }, { where: { id: this.id } });
    }
    leave() {
        return this.constructor.update({
            status: ParticipantStatus.LEFT,
            leftAt: new Date(),
        }, { where: { id: this.id } });
    }
    formatForApi() {
        return {
            id: this.id,
            userId: this.userId,
            role: this.role,
            status: this.status,
            nickname: this.nickname,
            joinedAt: this.joinedAt,
            leftAt: this.leftAt,
            lastSeenAt: this.lastSeenAt,
            isMuted: this.isMuted(),
            isActive: this.isActive(),
            isAdmin: this.isAdmin(),
            isModerator: this.isModerator(),
            permissions: this.permissions,
            invitedBy: this.invitedBy,
            metadata: this.metadata,
        };
    }
    static getRoleHierarchy() {
        return {
            [ParticipantRole.MEMBER]: 1,
            [ParticipantRole.MODERATOR]: 2,
            [ParticipantRole.ADMIN]: 3,
        };
    }
    canPromote(targetRole) {
        const hierarchy = GroupChatParticipant.getRoleHierarchy();
        return hierarchy[this.role] > hierarchy[targetRole];
    }
    canDemote(targetRole) {
        const hierarchy = GroupChatParticipant.getRoleHierarchy();
        return hierarchy[this.role] > hierarchy[targetRole];
    }
}
exports.GroupChatParticipant = GroupChatParticipant;
GroupChatParticipant.init({
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
    userId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    },
    role: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(ParticipantRole)),
        allowNull: false,
        defaultValue: ParticipantRole.MEMBER,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(ParticipantStatus)),
        allowNull: false,
        defaultValue: ParticipantStatus.ACTIVE,
    },
    nickname: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        validate: {
            len: [1, 50],
        },
    },
    joinedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    leftAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    lastSeenAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    lastReadMessageId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
    },
    mutedUntil: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    permissions: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    metadata: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    invitedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
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
    modelName: 'GroupChatParticipant',
    tableName: 'group_chat_participants',
    timestamps: true,
    indexes: [
        {
            fields: ['groupChatId', 'userId'],
            name: 'idx_group_chat_participants_group_user',
            unique: true,
        },
        {
            fields: ['userId', 'status'],
            name: 'idx_group_chat_participants_user_status',
        },
        {
            fields: ['groupChatId', 'role'],
            name: 'idx_group_chat_participants_group_role',
        },
        {
            fields: ['groupChatId', 'status'],
            name: 'idx_group_chat_participants_group_status',
        },
        {
            fields: ['lastSeenAt'],
            name: 'idx_group_chat_participants_last_seen',
        },
        {
            fields: ['joinedAt'],
            name: 'idx_group_chat_participants_joined_at',
        },
    ],
    hooks: {
        beforeCreate: (participant) => {
            if (!participant.permissions || Object.keys(participant.permissions).length === 0) {
                participant.permissions = participant.getDefaultPermissions(participant.role);
            }
        },
        beforeUpdate: (participant) => {
            if (participant.changed('role')) {
                participant.permissions = participant.getDefaultPermissions(participant.role);
            }
            if (participant.changed('status') &&
                [ParticipantStatus.LEFT, ParticipantStatus.REMOVED].includes(participant.status) &&
                !participant.leftAt) {
                participant.leftAt = new Date();
            }
        },
    },
    validate: {
        statusTransitions() {
            if (this['status'] === ParticipantStatus.LEFT && !this['leftAt']) {
                this['leftAt'] = new Date();
            }
            if (this['status'] === ParticipantStatus.REMOVED && !this['leftAt']) {
                this['leftAt'] = new Date();
            }
        },
    },
});
exports.default = GroupChatParticipant;
//# sourceMappingURL=GroupChatParticipant.js.map