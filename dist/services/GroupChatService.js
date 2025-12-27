"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupChatService = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const GroupChat_1 = __importStar(require("../models/GroupChat"));
const GroupChatParticipant_1 = __importStar(require("../models/GroupChatParticipant"));
const GroupChatMessage_1 = __importStar(require("../models/GroupChatMessage"));
const User_1 = __importDefault(require("../models/User"));
const SocketService_1 = require("./SocketService");
const AdvancedNotificationService_1 = require("./AdvancedNotificationService");
const logger_1 = __importDefault(require("../utils/logger"));
class GroupChatService {
    constructor(socketService) {
        this.socketService = socketService || undefined;
        this.notificationService = new AdvancedNotificationService_1.AdvancedNotificationService();
    }
    getSocketService() {
        if (!this.socketService) {
            try {
                this.socketService = SocketService_1.SocketService.getInstance();
            }
            catch (error) {
                return undefined;
            }
        }
        return this.socketService;
    }
    async createGroupChat(request) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const creator = await User_1.default.findByPk(request.createdBy);
            if (!creator) {
                throw new Error('Creator not found');
            }
            const groupChat = await GroupChat_1.default.create({
                name: request.name,
                description: request.description || undefined,
                type: request.type,
                createdBy: request.createdBy,
                avatarUrl: request.avatarUrl,
                maxParticipants: request.maxParticipants || 50,
                isPublic: request.isPublic || false,
                rideId: request.rideId,
                deliveryId: request.deliveryId,
                settings: request.settings || {},
                metadata: {},
                status: GroupChat_1.GroupChatStatus.ACTIVE,
            }, { transaction });
            await GroupChatParticipant_1.default.create({
                groupChatId: groupChat.id,
                userId: request.createdBy,
                role: GroupChatParticipant_1.ParticipantRole.ADMIN,
                status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                joinedAt: new Date(),
            }, { transaction });
            if (request.initialParticipants && request.initialParticipants.length > 0) {
                const participantsToAdd = request.initialParticipants.filter(id => id !== request.createdBy);
                for (const participantId of participantsToAdd) {
                    await GroupChatParticipant_1.default.create({
                        groupChatId: groupChat.id,
                        userId: participantId,
                        role: GroupChatParticipant_1.ParticipantRole.MEMBER,
                        status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                        invitedBy: request.createdBy,
                        joinedAt: new Date(),
                    }, { transaction });
                }
                for (const participantId of participantsToAdd) {
                    await this.notificationService.sendNotification({
                        userId: participantId,
                        type: 'ride_request',
                        title: 'Group Chat Invitation',
                        body: `You've been added to the group "${groupChat.name}"`,
                        data: {
                            groupChatId: groupChat.id,
                            groupName: groupChat.name,
                            invitedBy: request.createdBy,
                        },
                        channels: ['PUSH', 'IN_APP'],
                    });
                }
            }
            await GroupChatMessage_1.default.create({
                groupChatId: groupChat.id,
                senderId: 'system',
                type: GroupChatMessage_1.MessageType.SYSTEM,
                content: `${creator.firstName} created the group`,
                metadata: {
                    systemMessageType: 'group_created',
                    creatorId: request.createdBy,
                },
                attachments: [],
                mentions: [],
                reactions: {},
            }, { transaction });
            await transaction.commit();
            const socketService = this.getSocketService();
            if (socketService) {
                socketService.emitToRoom(`group_${groupChat.id}`, 'group_created', {
                    groupChat: groupChat.formatForApi(),
                    creator: creator.formatForApi(),
                });
            }
            return groupChat;
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error creating group chat:', error);
            throw error;
        }
    }
    async sendMessage(request) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const groupChat = await GroupChat_1.default.findByPk(request.groupChatId);
            if (!groupChat || !groupChat.isActive()) {
                throw new Error('Group chat not found or inactive');
            }
            const participant = await GroupChatParticipant_1.default.findOne({
                where: {
                    groupChatId: request.groupChatId,
                    userId: request.senderId,
                    status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                },
            });
            if (!participant) {
                throw new Error('User is not an active participant of this group');
            }
            if (participant.isMuted()) {
                throw new Error('User is muted in this group');
            }
            const message = await GroupChatMessage_1.default.create({
                groupChatId: request.groupChatId,
                senderId: request.senderId,
                content: request.content,
                type: request.type || GroupChatMessage_1.MessageType.TEXT,
                replyToMessageId: request.replyToMessageId || undefined,
                attachments: request.attachments || [],
                metadata: request.metadata || {},
                mentions: request.mentions || [],
                reactions: {},
                expiresAt: request.expiresAt || undefined,
            }, { transaction });
            await participant.updateLastSeen();
            message.markAsDelivered(request.senderId);
            await message.save({ transaction });
            const participants = await GroupChatParticipant_1.default.findAll({
                where: {
                    groupChatId: request.groupChatId,
                    status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                    userId: { [sequelize_1.Op.ne]: request.senderId },
                },
                include: [{ model: User_1.default, as: 'user' }],
            });
            await transaction.commit();
            const socketService = this.getSocketService();
            if (socketService) {
                socketService.emitToRoom(`group_${request.groupChatId}`, 'group_message', {
                    message: message.formatForApi(request.senderId),
                    groupChatId: request.groupChatId,
                });
            }
            const mentionedUsers = request.mentions || [];
            const sender = await User_1.default.findByPk(request.senderId);
            for (const participant of participants) {
                const isMentioned = mentionedUsers.includes(participant.userId);
                const shouldNotify = isMentioned || !participant.isMuted();
                if (shouldNotify && participant.userId !== request.senderId) {
                    await this.notificationService.sendNotification({
                        userId: participant.userId,
                        type: isMentioned ? 'ride_request' : 'ride_request',
                        title: isMentioned ? `Mentioned in ${groupChat.name}` : groupChat.name,
                        body: `${sender?.firstName}: ${message.getPreviewText(50)}`,
                        data: {
                            groupChatId: request.groupChatId,
                            messageId: message.id,
                            senderId: request.senderId,
                            groupName: groupChat.name,
                        },
                        channels: isMentioned ? ['PUSH', 'IN_APP'] : ['IN_APP'],
                    });
                }
                message.markAsDelivered(participant.userId);
            }
            await message.save();
            return message;
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error sending group message:', error);
            throw error;
        }
    }
    async joinGroup(request) {
        const transaction = await database_1.sequelize.transaction();
        try {
            let groupChat = null;
            if (request.groupChatId) {
                groupChat = await GroupChat_1.default.findByPk(request.groupChatId);
            }
            else if (request.joinCode) {
                groupChat = await GroupChat_1.default.findOne({
                    where: { joinCode: request.joinCode, isPublic: true },
                });
            }
            if (!groupChat || !groupChat.isActive()) {
                throw new Error('Group chat not found or inactive');
            }
            const existingParticipant = await GroupChatParticipant_1.default.findOne({
                where: {
                    groupChatId: groupChat.id,
                    userId: request.userId,
                },
            });
            if (existingParticipant) {
                if (existingParticipant.status === GroupChatParticipant_1.ParticipantStatus.ACTIVE) {
                    throw new Error('User is already a member of this group');
                }
                await existingParticipant.update({
                    status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                    leftAt: null,
                    joinedAt: new Date(),
                }, { transaction });
                await transaction.commit();
                return existingParticipant;
            }
            const currentCount = await GroupChatParticipant_1.default.count({
                where: {
                    groupChatId: groupChat.id,
                    status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                },
            });
            if (!groupChat.canAddParticipants(currentCount)) {
                throw new Error('Group has reached maximum capacity');
            }
            const participant = await GroupChatParticipant_1.default.create({
                groupChatId: groupChat.id,
                userId: request.userId,
                role: GroupChatParticipant_1.ParticipantRole.MEMBER,
                status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                invitedBy: request.invitedBy || undefined,
                joinedAt: new Date(),
            }, { transaction });
            const user = await User_1.default.findByPk(request.userId);
            await GroupChatMessage_1.default.create({
                groupChatId: groupChat.id,
                senderId: 'system',
                type: GroupChatMessage_1.MessageType.SYSTEM,
                content: `${user?.firstName} joined the group`,
                metadata: {
                    systemMessageType: 'user_joined',
                    userId: request.userId,
                },
                attachments: [],
                mentions: [],
                reactions: {},
            }, { transaction });
            await transaction.commit();
            const socketService = this.getSocketService();
            if (socketService) {
                socketService.emitToRoom(`group_${groupChat.id}`, 'participant_joined', {
                    participant: participant.formatForApi(),
                    user: user,
                    groupChatId: groupChat.id,
                });
            }
            return participant;
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error joining group:', error);
            throw error;
        }
    }
    async leaveGroup(groupChatId, userId) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const participant = await GroupChatParticipant_1.default.findOne({
                where: {
                    groupChatId,
                    userId,
                    status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                },
            });
            if (!participant) {
                throw new Error('User is not an active participant of this group');
            }
            if (participant.isAdmin()) {
                const adminCount = await GroupChatParticipant_1.default.count({
                    where: {
                        groupChatId,
                        role: GroupChatParticipant_1.ParticipantRole.ADMIN,
                        status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                    },
                });
                if (adminCount === 1) {
                    const nextParticipant = await GroupChatParticipant_1.default.findOne({
                        where: {
                            groupChatId,
                            userId: { [sequelize_1.Op.ne]: userId },
                            status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                        },
                        order: [['joinedAt', 'ASC']],
                    });
                    if (nextParticipant) {
                        await nextParticipant.update({ role: GroupChatParticipant_1.ParticipantRole.ADMIN }, { transaction });
                    }
                    else {
                        await GroupChat_1.default.update({ status: GroupChat_1.GroupChatStatus.ARCHIVED }, { where: { id: groupChatId }, transaction });
                    }
                }
            }
            await participant.update({
                status: GroupChatParticipant_1.ParticipantStatus.LEFT,
                leftAt: new Date(),
            }, { transaction });
            const user = await User_1.default.findByPk(userId);
            await GroupChatMessage_1.default.create({
                groupChatId,
                senderId: 'system',
                type: GroupChatMessage_1.MessageType.SYSTEM,
                content: `${user?.firstName} left the group`,
                metadata: {
                    systemMessageType: 'user_left',
                    userId,
                },
                attachments: [],
                mentions: [],
                reactions: {},
            }, { transaction });
            await transaction.commit();
            const socketService = this.getSocketService();
            if (socketService) {
                socketService.emitToRoom(`group_${groupChatId}`, 'participant_left', {
                    userId,
                    groupChatId,
                });
            }
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error leaving group:', error);
            throw error;
        }
    }
    async updateParticipant(request) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const requester = await GroupChatParticipant_1.default.findOne({
                where: {
                    groupChatId: request.groupChatId,
                    userId: request.requesterId,
                    status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                },
            });
            if (!requester || !requester.canModerate()) {
                throw new Error('Insufficient permissions to update participant');
            }
            const participant = await GroupChatParticipant_1.default.findByPk(request.participantId);
            if (!participant || participant.groupChatId !== request.groupChatId) {
                throw new Error('Participant not found');
            }
            if (request.role && request.role !== participant.role) {
                if (!requester.canPromote(request.role) && !requester.canDemote(participant.role)) {
                    throw new Error('Cannot change participant role');
                }
            }
            const updates = {};
            if (request.role)
                updates.role = request.role;
            if (request.status)
                updates.status = request.status;
            if (request.nickname)
                updates.nickname = request.nickname;
            if (request.permissions)
                updates.permissions = request.permissions;
            await participant.update(updates, { transaction });
            if (request.role && request.role !== participant.role) {
                const user = await User_1.default.findByPk(participant.userId);
                const requesterUser = await User_1.default.findByPk(request.requesterId);
                await GroupChatMessage_1.default.create({
                    groupChatId: request.groupChatId,
                    senderId: 'system',
                    type: GroupChatMessage_1.MessageType.SYSTEM,
                    content: `${requesterUser?.firstName} changed ${user?.firstName}'s role to ${request.role}`,
                    metadata: {
                        systemMessageType: 'role_changed',
                        targetUserId: participant.userId,
                        requesterId: request.requesterId,
                        oldRole: participant.role,
                        newRole: request.role,
                    },
                    attachments: [],
                    mentions: [],
                    reactions: {},
                }, { transaction });
            }
            await transaction.commit();
            const socketService = this.getSocketService();
            if (socketService) {
                socketService.emitToRoom(`group_${request.groupChatId}`, 'participant_updated', {
                    participant: participant.formatForApi(),
                    groupChatId: request.groupChatId,
                    updates,
                });
            }
            return participant;
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error updating participant:', error);
            throw error;
        }
    }
    async getUserGroupChats(options) {
        try {
            const whereClause = {
                userId: options.userId,
                status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
            };
            const groupWhereClause = {
                status: options.includeArchived ?
                    [GroupChat_1.GroupChatStatus.ACTIVE, GroupChat_1.GroupChatStatus.ARCHIVED] :
                    GroupChat_1.GroupChatStatus.ACTIVE,
            };
            if (options.type) {
                groupWhereClause['type'] = options.type;
            }
            if (options.search) {
                groupWhereClause['name'] = { [sequelize_1.Op.iLike]: `%${options.search}%` };
            }
            const { count, rows } = await GroupChatParticipant_1.default.findAndCountAll({
                where: whereClause,
                include: [{
                        model: GroupChat_1.default,
                        as: 'groupChat',
                        where: groupWhereClause,
                        include: [{
                                model: GroupChatMessage_1.default,
                                as: 'lastMessage',
                                required: false,
                                limit: 1,
                                order: [['createdAt', 'DESC']],
                            }],
                    }],
                limit: options.limit || 20,
                offset: options.offset || 0,
                order: [['lastSeenAt', 'DESC']],
            });
            const groupChats = rows.map(participant => ({
                ...participant.groupChat,
                participantInfo: participant.formatForApi(),
                unreadCount: this.calculateUnreadCount(participant),
            }));
            return { groupChats, total: count };
        }
        catch (error) {
            logger_1.default.error('Error getting user group chats:', error);
            throw error;
        }
    }
    async getGroupMessages(options) {
        try {
            const participant = await GroupChatParticipant_1.default.findOne({
                where: {
                    groupChatId: options.groupChatId,
                    userId: options.userId,
                    status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                },
            });
            if (!participant) {
                throw new Error('User is not an active participant of this group');
            }
            const whereClause = {
                groupChatId: options.groupChatId,
                deletedAt: null,
            };
            if (options.search) {
                whereClause['content'] = { [sequelize_1.Op.iLike]: `%${options.search}%` };
            }
            if (options.type) {
                whereClause['type'] = options.type;
            }
            if (options.senderId) {
                whereClause['senderId'] = options.senderId;
            }
            if (options.beforeDate) {
                whereClause['createdAt'] = { [sequelize_1.Op.lt]: options.beforeDate };
            }
            if (options.afterDate) {
                whereClause['createdAt'] = { [sequelize_1.Op.gt]: options.afterDate };
            }
            if (options.onlyPinned) {
                whereClause['isPinned'] = true;
            }
            const { count, rows } = await GroupChatMessage_1.default.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: User_1.default,
                        as: 'sender',
                        attributes: ['id', 'firstName', 'lastName', 'profilePicture'],
                    },
                    {
                        model: GroupChatMessage_1.default,
                        as: 'replyToMessage',
                        required: false,
                        include: [{
                                model: User_1.default,
                                as: 'sender',
                                attributes: ['id', 'firstName', 'lastName'],
                            }],
                    },
                ],
                limit: options.limit || 50,
                offset: options.offset || 0,
                order: [['createdAt', 'DESC']],
            });
            const messages = rows.map(message => message.formatForApi(options.userId));
            return { messages: messages.reverse(), total: count };
        }
        catch (error) {
            logger_1.default.error('Error getting group messages:', error);
            throw error;
        }
    }
    async addReaction(messageId, userId, emoji) {
        try {
            const message = await GroupChatMessage_1.default.findByPk(messageId);
            if (!message) {
                throw new Error('Message not found');
            }
            const participant = await GroupChatParticipant_1.default.findOne({
                where: {
                    groupChatId: message.groupChatId,
                    userId,
                    status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                },
            });
            if (!participant) {
                throw new Error('User is not an active participant of this group');
            }
            message.addReaction(userId, emoji);
            await message.save();
            const socketService = this.getSocketService();
            if (socketService) {
                socketService.emitToRoom(`group_${message.groupChatId}`, 'message_reaction', {
                    messageId,
                    userId,
                    emoji,
                    reactions: message.reactions,
                });
            }
            return message;
        }
        catch (error) {
            logger_1.default.error('Error adding reaction:', error);
            throw error;
        }
    }
    async toggleMessagePin(messageId, userId) {
        try {
            const message = await GroupChatMessage_1.default.findByPk(messageId);
            if (!message) {
                throw new Error('Message not found');
            }
            const participant = await GroupChatParticipant_1.default.findOne({
                where: {
                    groupChatId: message.groupChatId,
                    userId,
                    status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                },
            });
            if (!participant || !participant.canModerate()) {
                throw new Error('Insufficient permissions to pin messages');
            }
            await message.update({
                isPinned: !message.isPinned,
                pinnedBy: !message.isPinned ? null : userId,
                pinnedAt: !message.isPinned ? null : new Date(),
            });
            const socketService = this.getSocketService();
            if (socketService) {
                socketService.emitToRoom(`group_${message.groupChatId}`, 'message_pinned', {
                    messageId,
                    isPinned: message.isPinned,
                    pinnedBy: userId,
                });
            }
            return message;
        }
        catch (error) {
            logger_1.default.error('Error toggling message pin:', error);
            throw error;
        }
    }
    async markMessagesAsRead(groupChatId, userId, messageId) {
        try {
            const participant = await GroupChatParticipant_1.default.findOne({
                where: {
                    groupChatId,
                    userId,
                    status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                },
            });
            if (!participant) {
                throw new Error('User is not an active participant of this group');
            }
            if (messageId) {
                await participant.markMessageAsRead(messageId);
                const message = await GroupChatMessage_1.default.findByPk(messageId);
                if (message) {
                    message.markAsRead(userId);
                    await message.save();
                }
            }
            else {
                const lastMessage = await GroupChatMessage_1.default.findOne({
                    where: { groupChatId },
                    order: [['createdAt', 'DESC']],
                });
                if (lastMessage) {
                    await participant.markMessageAsRead(lastMessage.id);
                }
            }
            const socketService = this.getSocketService();
            if (socketService) {
                socketService.emitToRoom(`group_${groupChatId}`, 'messages_read', {
                    userId,
                    messageId,
                    groupChatId,
                });
            }
        }
        catch (error) {
            logger_1.default.error('Error marking messages as read:', error);
            throw error;
        }
    }
    calculateUnreadCount(_participant) {
        return 0;
    }
    async handleRideCompletion(rideId) {
        try {
            const rideGroups = await GroupChat_1.default.findAll({
                where: {
                    rideId,
                    type: GroupChat_1.GroupChatType.RIDE_GROUP,
                    status: GroupChat_1.GroupChatStatus.ACTIVE,
                },
                include: [{
                        model: GroupChatParticipant_1.default,
                        as: 'participants',
                        where: { status: GroupChatParticipant_1.ParticipantStatus.ACTIVE },
                        required: false,
                    }],
            });
            for (const group of rideGroups) {
                await this.processRideGroupCompletion(group);
            }
            logger_1.default.info(`Processed ride completion for ${rideGroups.length} groups`, { rideId });
        }
        catch (error) {
            logger_1.default.error('Error handling ride completion:', error);
            throw error;
        }
    }
    async processRideGroupCompletion(group) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const settings = group.settings || {};
            const autoDisbandOnRideCompletion = settings.autoDisbandOnRideCompletion !== false;
            const disbandDelay = settings.disbandDelay || 2;
            const allowMembersToKeepGroup = settings.allowMembersToKeepGroup || false;
            await this.sendRideCompletionMessage(group.id, transaction);
            if (autoDisbandOnRideCompletion) {
                if (disbandDelay > 0) {
                    await this.scheduleGroupDisbanding(group.id, disbandDelay, allowMembersToKeepGroup, transaction);
                }
                else {
                    await this.disbandRideGroup(group.id, transaction);
                }
            }
            else {
                await this.convertRideGroupToCustom(group.id, transaction);
            }
            await transaction.commit();
            logger_1.default.info('Processed ride group completion', { groupId: group.id, rideId: group.rideId });
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error processing ride group completion:', error);
            throw error;
        }
    }
    async sendRideCompletionMessage(groupChatId, transaction) {
        await GroupChatMessage_1.default.create({
            groupChatId,
            senderId: 'system',
            type: GroupChatMessage_1.MessageType.SYSTEM,
            content: '🎉 Trip completed! Thank you for riding together. This group will be archived in 2 hours unless you choose to keep it active.',
            metadata: {
                systemMessageType: 'ride_completed',
                timestamp: new Date().toISOString(),
                canKeepGroup: true,
            },
            attachments: [],
            mentions: [],
            reactions: {},
        }, { transaction });
        const socketService = this.getSocketService();
        if (socketService) {
            socketService.emitToRoom(`group_${groupChatId}`, 'ride_completed', {
                groupChatId,
                message: 'Trip completed successfully',
                autoArchiveIn: 2,
            });
        }
    }
    async scheduleGroupDisbanding(groupChatId, delayHours, allowKeepOption, transaction) {
        await GroupChat_1.default.update({
            metadata: {
                scheduledDisbandAt: new Date(Date.now() + delayHours * 60 * 60 * 1000),
                allowKeepOption,
                disbandReason: 'ride_completed',
            },
        }, {
            where: { id: groupChatId },
            transaction,
        });
        setTimeout(async () => {
            try {
                await this.executeDisbandingIfScheduled(groupChatId);
            }
            catch (error) {
                logger_1.default.error('Error executing scheduled disbanding:', error);
            }
        }, delayHours * 60 * 60 * 1000);
    }
    async executeDisbandingIfScheduled(groupChatId) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const group = await GroupChat_1.default.findByPk(groupChatId);
            if (!group || group.status !== GroupChat_1.GroupChatStatus.ACTIVE) {
                await transaction.rollback();
                return;
            }
            const metadata = group.metadata || {};
            if (!metadata.scheduledDisbandAt) {
                await transaction.rollback();
                return;
            }
            if (metadata.keepGroupActive) {
                await this.convertRideGroupToCustom(groupChatId, transaction);
                await transaction.commit();
                return;
            }
            await this.disbandRideGroup(groupChatId, transaction);
            await transaction.commit();
            logger_1.default.info('Auto-disbanded ride group after delay', { groupChatId });
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error executing scheduled disbanding:', error);
            throw error;
        }
    }
    async disbandRideGroup(groupChatId, transaction) {
        await GroupChat_1.default.update({
            status: GroupChat_1.GroupChatStatus.ARCHIVED,
            metadata: {
                ...((await GroupChat_1.default.findByPk(groupChatId))?.metadata || {}),
                archivedAt: new Date(),
                archivedReason: 'ride_completed',
            },
        }, {
            where: { id: groupChatId },
            transaction,
        });
        await GroupChatParticipant_1.default.update({
            status: GroupChatParticipant_1.ParticipantStatus.LEFT,
            leftAt: new Date(),
        }, {
            where: {
                groupChatId,
                status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
            },
            transaction,
        });
        await GroupChatMessage_1.default.create({
            groupChatId,
            senderId: 'system',
            type: GroupChatMessage_1.MessageType.SYSTEM,
            content: '📁 Group has been archived after trip completion. Chat history is preserved.',
            metadata: {
                systemMessageType: 'group_archived',
                timestamp: new Date().toISOString(),
                reason: 'ride_completed',
            },
            attachments: [],
            mentions: [],
            reactions: {},
        }, { transaction });
        const socketService = this.getSocketService();
        if (socketService) {
            socketService.emitToRoom(`group_${groupChatId}`, 'group_archived', {
                groupChatId,
                reason: 'ride_completed',
                message: 'Group archived after trip completion',
            });
        }
    }
    async convertRideGroupToCustom(groupChatId, transaction) {
        await GroupChat_1.default.update({
            type: GroupChat_1.GroupChatType.CUSTOM_GROUP,
            rideId: null,
            metadata: {
                ...((await GroupChat_1.default.findByPk(groupChatId))?.metadata || {}),
                convertedFrom: 'ride_group',
                convertedAt: new Date(),
            },
        }, {
            where: { id: groupChatId },
            transaction,
        });
        await GroupChatMessage_1.default.create({
            groupChatId,
            senderId: 'system',
            type: GroupChatMessage_1.MessageType.SYSTEM,
            content: '🔄 Group converted to custom group and will remain active.',
            metadata: {
                systemMessageType: 'group_converted',
                timestamp: new Date().toISOString(),
                fromType: 'ride_group',
                toType: 'custom_group',
            },
            attachments: [],
            mentions: [],
            reactions: {},
        }, { transaction });
        const socketService = this.getSocketService();
        if (socketService) {
            socketService.emitToRoom(`group_${groupChatId}`, 'group_converted', {
                groupChatId,
                newType: 'custom_group',
                message: 'Group converted to custom group',
            });
        }
    }
    async voteToKeepGroup(groupChatId, userId, keepActive) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const group = await GroupChat_1.default.findByPk(groupChatId);
            if (!group || group.status !== GroupChat_1.GroupChatStatus.ACTIVE) {
                throw new Error('Group not found or not active');
            }
            const metadata = group.metadata || {};
            if (!metadata.scheduledDisbandAt) {
                throw new Error('Group is not scheduled for disbanding');
            }
            if (!metadata.keepGroupVotes) {
                metadata.keepGroupVotes = {};
            }
            metadata.keepGroupVotes[userId] = keepActive;
            const activeParticipants = await GroupChatParticipant_1.default.count({
                where: {
                    groupChatId,
                    status: GroupChatParticipant_1.ParticipantStatus.ACTIVE,
                },
            });
            const votes = Object.values(metadata.keepGroupVotes);
            const keepVotes = votes.filter(vote => vote === true).length;
            const totalVotes = votes.length;
            if (keepVotes > activeParticipants / 2) {
                metadata.keepGroupActive = true;
            }
            await group.update({ metadata }, { transaction });
            await GroupChatMessage_1.default.create({
                groupChatId,
                senderId: 'system',
                type: GroupChatMessage_1.MessageType.SYSTEM,
                content: `📊 Vote to keep group: ${keepVotes}/${totalVotes} votes to keep active (need ${Math.floor(activeParticipants / 2) + 1})`,
                metadata: {
                    systemMessageType: 'group_vote_update',
                    timestamp: new Date().toISOString(),
                    keepVotes,
                    totalVotes,
                    requiredVotes: Math.floor(activeParticipants / 2) + 1,
                },
                attachments: [],
                mentions: [],
                reactions: {},
            }, { transaction });
            await transaction.commit();
            const socketService = this.getSocketService();
            if (socketService) {
                socketService.emitToRoom(`group_${groupChatId}`, 'group_vote_update', {
                    groupChatId,
                    keepVotes,
                    totalVotes,
                    requiredVotes: Math.floor(activeParticipants / 2) + 1,
                    userVote: { userId, keepActive },
                });
            }
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error processing group vote:', error);
            throw error;
        }
    }
    async cleanupExpiredMessages() {
        try {
            const result = await GroupChatMessage_1.default.update({
                status: GroupChatMessage_1.MessageStatus.DELETED,
                deletedAt: new Date(),
                content: 'This message has expired',
            }, {
                where: {
                    expiresAt: { [sequelize_1.Op.lt]: new Date() },
                    status: { [sequelize_1.Op.ne]: GroupChatMessage_1.MessageStatus.DELETED },
                },
            });
            return Array.isArray(result) ? result[0] : 0;
        }
        catch (error) {
            logger_1.default.error('Error cleaning up expired messages:', error);
            throw error;
        }
    }
    async cleanupInactiveGroups() {
        try {
            const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const expiredGroups = await GroupChat_1.default.findAll({
                where: {
                    status: GroupChat_1.GroupChatStatus.ACTIVE,
                    metadata: {
                        scheduledDisbandAt: { [sequelize_1.Op.lt]: new Date() },
                    },
                },
            });
            let cleanedCount = 0;
            for (const group of expiredGroups) {
                const transaction = await database_1.sequelize.transaction();
                try {
                    await this.disbandRideGroup(group.id, transaction);
                    await transaction.commit();
                    cleanedCount++;
                }
                catch (error) {
                    await transaction.rollback();
                    logger_1.default.error('Error cleaning up expired group:', { groupId: group.id, error });
                }
            }
            const inactiveGroups = await GroupChat_1.default.findAll({
                where: {
                    status: GroupChat_1.GroupChatStatus.ACTIVE,
                    [sequelize_1.Op.or]: [
                        { lastMessageAt: { [sequelize_1.Op.lt]: cutoffDate } },
                        {
                            lastMessageAt: null,
                            createdAt: { [sequelize_1.Op.lt]: cutoffDate },
                        },
                    ],
                },
            });
            for (const group of inactiveGroups) {
                const transaction = await database_1.sequelize.transaction();
                try {
                    await GroupChat_1.default.update({
                        status: GroupChat_1.GroupChatStatus.ARCHIVED,
                        metadata: {
                            ...group.metadata,
                            archivedAt: new Date(),
                            archivedReason: 'inactivity',
                        },
                    }, {
                        where: { id: group.id },
                        transaction,
                    });
                    await transaction.commit();
                    cleanedCount++;
                }
                catch (error) {
                    await transaction.rollback();
                    logger_1.default.error('Error archiving inactive group:', { groupId: group.id, error });
                }
            }
            logger_1.default.info(`Cleaned up ${cleanedCount} inactive groups`);
            return cleanedCount;
        }
        catch (error) {
            logger_1.default.error('Error cleaning up inactive groups:', error);
            throw error;
        }
    }
}
exports.GroupChatService = GroupChatService;
exports.default = GroupChatService;
//# sourceMappingURL=GroupChatService.js.map