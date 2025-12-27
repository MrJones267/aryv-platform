"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupChatValidationRules = exports.GroupChatController = void 0;
const express_validator_1 = require("express-validator");
const GroupChatService_1 = __importDefault(require("../services/GroupChatService"));
const GroupChat_1 = require("../models/GroupChat");
const GroupChatParticipant_1 = require("../models/GroupChatParticipant");
const GroupChatMessage_1 = require("../models/GroupChatMessage");
const logger_1 = __importDefault(require("../utils/logger"));
class GroupChatController {
    constructor() {
        this.groupChatService = new GroupChatService_1.default();
    }
    async createGroupChat(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const userId = req.user.id;
            const { name, description, type, avatarUrl, maxParticipants, isPublic, rideId, deliveryId, settings, initialParticipants, } = req.body;
            const createRequest = {
                name,
                description,
                type,
                createdBy: userId,
                avatarUrl,
                maxParticipants,
                isPublic,
                rideId,
                deliveryId,
                settings,
                initialParticipants,
            };
            const groupChat = await this.groupChatService.createGroupChat(createRequest);
            res.status(201).json({
                success: true,
                message: 'Group chat created successfully',
                data: groupChat.formatForApi(),
            });
        }
        catch (error) {
            logger_1.default.error('Error creating group chat:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create group chat',
                error: error.message,
            });
        }
    }
    async sendMessage(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const userId = req.user.id;
            const { groupChatId } = req.params;
            const { content, type, replyToMessageId, attachments, metadata, mentions, expiresAt, } = req.body;
            const messageRequest = {
                groupChatId,
                senderId: userId,
                content,
                type: type || GroupChatMessage_1.MessageType.TEXT,
                replyToMessageId,
                attachments,
                metadata,
                mentions,
                ...(expiresAt && { expiresAt: new Date(expiresAt) }),
            };
            const message = await this.groupChatService.sendMessage(messageRequest);
            res.status(201).json({
                success: true,
                message: 'Message sent successfully',
                data: message.formatForApi(userId),
            });
        }
        catch (error) {
            logger_1.default.error('Error sending group message:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send message',
                error: error.message,
            });
        }
    }
    async joinGroup(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const userId = req.user.id;
            const { groupChatId, joinCode } = req.body;
            const joinRequest = {
                userId,
                groupChatId,
                joinCode,
            };
            const participant = await this.groupChatService.joinGroup(joinRequest);
            res.status(200).json({
                success: true,
                message: 'Successfully joined group chat',
                data: participant.formatForApi(),
            });
        }
        catch (error) {
            logger_1.default.error('Error joining group:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to join group',
                error: error.message,
            });
        }
    }
    async leaveGroup(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const userId = req.user.id;
            const { groupChatId } = req.params;
            await this.groupChatService.leaveGroup(groupChatId, userId);
            res.status(200).json({
                success: true,
                message: 'Successfully left group chat',
            });
        }
        catch (error) {
            logger_1.default.error('Error leaving group:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to leave group',
                error: error.message,
            });
        }
    }
    async updateParticipant(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const requesterId = req.user.id;
            const { groupChatId, participantId } = req.params;
            const { role, status, nickname, permissions } = req.body;
            const updateRequest = {
                groupChatId,
                participantId,
                requesterId,
                role,
                status,
                nickname,
                permissions,
            };
            const participant = await this.groupChatService.updateParticipant(updateRequest);
            res.status(200).json({
                success: true,
                message: 'Participant updated successfully',
                data: participant.formatForApi(),
            });
        }
        catch (error) {
            logger_1.default.error('Error updating participant:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update participant',
                error: error.message,
            });
        }
    }
    async getUserGroupChats(req, res) {
        try {
            const userId = req.user.id;
            const { type, search, limit = 20, offset = 0, includeArchived = false, } = req.query;
            const options = {
                userId,
                type: type,
                search: search,
                limit: parseInt(limit),
                offset: parseInt(offset),
                includeArchived: includeArchived === 'true',
            };
            const result = await this.groupChatService.getUserGroupChats(options);
            res.status(200).json({
                success: true,
                message: 'Group chats retrieved successfully',
                data: {
                    groupChats: result.groupChats,
                    total: result.total,
                    limit: options.limit,
                    offset: options.offset,
                },
            });
        }
        catch (error) {
            logger_1.default.error('Error getting user group chats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get group chats',
                error: error.message,
            });
        }
    }
    async getGroupMessages(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const userId = req.user.id;
            const { groupChatId } = req.params;
            const { search, type, senderId, limit = 50, offset = 0, beforeDate, afterDate, onlyPinned = false, } = req.query;
            const options = {
                groupChatId,
                userId,
                search: search,
                type: type,
                senderId: senderId,
                limit: parseInt(limit),
                offset: parseInt(offset),
                ...(beforeDate && { beforeDate: new Date(beforeDate) }),
                ...(afterDate && { afterDate: new Date(afterDate) }),
                onlyPinned: onlyPinned === 'true',
            };
            const result = await this.groupChatService.getGroupMessages(options);
            res.status(200).json({
                success: true,
                message: 'Messages retrieved successfully',
                data: {
                    messages: result.messages,
                    total: result.total,
                    limit: options.limit,
                    offset: options.offset,
                },
            });
        }
        catch (error) {
            logger_1.default.error('Error getting group messages:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get messages',
                error: error.message,
            });
        }
    }
    async addReaction(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const userId = req.user.id;
            const { messageId } = req.params;
            const { emoji } = req.body;
            const message = await this.groupChatService.addReaction(messageId, userId, emoji);
            res.status(200).json({
                success: true,
                message: 'Reaction added successfully',
                data: {
                    messageId,
                    reactions: message.reactions,
                },
            });
        }
        catch (error) {
            logger_1.default.error('Error adding reaction:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add reaction',
                error: error.message,
            });
        }
    }
    async togglePin(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const userId = req.user.id;
            const { messageId } = req.params;
            const message = await this.groupChatService.toggleMessagePin(messageId, userId);
            res.status(200).json({
                success: true,
                message: message.isPinned ? 'Message pinned successfully' : 'Message unpinned successfully',
                data: {
                    messageId,
                    isPinned: message.isPinned,
                    pinnedBy: message.pinnedBy,
                    pinnedAt: message.pinnedAt,
                },
            });
        }
        catch (error) {
            logger_1.default.error('Error toggling message pin:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to toggle message pin',
                error: error.message,
            });
        }
    }
    async markAsRead(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const userId = req.user.id;
            const { groupChatId } = req.params;
            const { messageId } = req.body;
            await this.groupChatService.markMessagesAsRead(groupChatId, userId, messageId);
            res.status(200).json({
                success: true,
                message: 'Messages marked as read successfully',
            });
        }
        catch (error) {
            logger_1.default.error('Error marking messages as read:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to mark messages as read',
                error: error.message,
            });
        }
    }
    async voteToKeepGroup(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const userId = req.user.id;
            const { groupChatId } = req.params;
            const { keepActive } = req.body;
            await this.groupChatService.voteToKeepGroup(groupChatId, userId, keepActive);
            res.status(200).json({
                success: true,
                message: 'Vote recorded successfully',
            });
        }
        catch (error) {
            logger_1.default.error('Error recording group vote:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to record vote',
                error: error.message,
            });
        }
    }
}
exports.GroupChatController = GroupChatController;
exports.groupChatValidationRules = {
    createGroupChat: [
        (0, express_validator_1.body)('name')
            .isString()
            .isLength({ min: 1, max: 100 })
            .withMessage('Group name must be 1-100 characters'),
        (0, express_validator_1.body)('description')
            .optional()
            .isString()
            .isLength({ max: 500 })
            .withMessage('Description must be max 500 characters'),
        (0, express_validator_1.body)('type')
            .isIn(Object.values(GroupChat_1.GroupChatType))
            .withMessage('Invalid group chat type'),
        (0, express_validator_1.body)('maxParticipants')
            .optional()
            .isInt({ min: 2, max: 500 })
            .withMessage('Max participants must be between 2 and 500'),
        (0, express_validator_1.body)('isPublic')
            .optional()
            .isBoolean()
            .withMessage('isPublic must be a boolean'),
        (0, express_validator_1.body)('rideId')
            .optional()
            .isUUID()
            .withMessage('Invalid ride ID'),
        (0, express_validator_1.body)('deliveryId')
            .optional()
            .isUUID()
            .withMessage('Invalid delivery ID'),
        (0, express_validator_1.body)('initialParticipants')
            .optional()
            .isArray()
            .withMessage('Initial participants must be an array'),
    ],
    sendMessage: [
        (0, express_validator_1.param)('groupChatId')
            .isUUID()
            .withMessage('Invalid group chat ID'),
        (0, express_validator_1.body)('content')
            .isString()
            .isLength({ min: 1 })
            .withMessage('Message content is required'),
        (0, express_validator_1.body)('type')
            .optional()
            .isIn(Object.values(GroupChatMessage_1.MessageType))
            .withMessage('Invalid message type'),
        (0, express_validator_1.body)('replyToMessageId')
            .optional()
            .isUUID()
            .withMessage('Invalid reply message ID'),
    ],
    joinGroup: [
        (0, express_validator_1.body)('groupChatId')
            .optional()
            .isUUID()
            .withMessage('Invalid group chat ID'),
        (0, express_validator_1.body)('joinCode')
            .optional()
            .isString()
            .isLength({ min: 1 })
            .withMessage('Join code is required'),
    ],
    leaveGroup: [
        (0, express_validator_1.param)('groupChatId')
            .isUUID()
            .withMessage('Invalid group chat ID'),
    ],
    updateParticipant: [
        (0, express_validator_1.param)('groupChatId')
            .isUUID()
            .withMessage('Invalid group chat ID'),
        (0, express_validator_1.param)('participantId')
            .isUUID()
            .withMessage('Invalid participant ID'),
        (0, express_validator_1.body)('role')
            .optional()
            .isIn(Object.values(GroupChatParticipant_1.ParticipantRole))
            .withMessage('Invalid participant role'),
        (0, express_validator_1.body)('status')
            .optional()
            .isIn(Object.values(GroupChatParticipant_1.ParticipantStatus))
            .withMessage('Invalid participant status'),
    ],
    getMessages: [
        (0, express_validator_1.param)('groupChatId')
            .isUUID()
            .withMessage('Invalid group chat ID'),
        (0, express_validator_1.query)('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        (0, express_validator_1.query)('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Offset must be non-negative'),
    ],
    addReaction: [
        (0, express_validator_1.param)('messageId')
            .isUUID()
            .withMessage('Invalid message ID'),
        (0, express_validator_1.body)('emoji')
            .isString()
            .isLength({ min: 1, max: 10 })
            .withMessage('Emoji must be 1-10 characters'),
    ],
    markAsRead: [
        (0, express_validator_1.param)('groupChatId')
            .isUUID()
            .withMessage('Invalid group chat ID'),
        (0, express_validator_1.body)('messageId')
            .optional()
            .isUUID()
            .withMessage('Invalid message ID'),
    ],
    voteToKeepGroup: [
        (0, express_validator_1.param)('groupChatId')
            .isUUID()
            .withMessage('Invalid group chat ID'),
        (0, express_validator_1.body)('keepActive')
            .isBoolean()
            .withMessage('keepActive must be a boolean'),
    ],
};
exports.default = GroupChatController;
//# sourceMappingURL=GroupChatController.js.map