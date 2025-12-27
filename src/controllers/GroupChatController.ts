/**
 * @fileoverview Group Chat Controller for handling group messaging API endpoints
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import GroupChatService, {
  CreateGroupChatRequest,
  SendGroupMessageRequest,
  JoinGroupRequest,
  UpdateParticipantRequest,
  GroupChatSearchOptions,
  GroupMessageSearchOptions,
} from '../services/GroupChatService';
import { GroupChatType } from '../models/GroupChat';
import { ParticipantRole, ParticipantStatus } from '../models/GroupChatParticipant';
import { MessageType } from '../models/GroupChatMessage';
import logger from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export class GroupChatController {
  private groupChatService: GroupChatService;

  constructor() {
    this.groupChatService = new GroupChatService();
  }

  /**
   * Create a new group chat
   */
  async createGroupChat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const userId = req.user.id;
      const {
        name,
        description,
        type,
        avatarUrl,
        maxParticipants,
        isPublic,
        rideId,
        deliveryId,
        settings,
        initialParticipants,
      } = req.body;

      const createRequest: CreateGroupChatRequest = {
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
    } catch (error) {
      logger.error('Error creating group chat:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create group chat',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Send message to group chat
   */
  async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
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
      const {
        content,
        type,
        replyToMessageId,
        attachments,
        metadata,
        mentions,
        expiresAt,
      } = req.body;

      const messageRequest: SendGroupMessageRequest = {
        groupChatId,
        senderId: userId,
        content,
        type: type || MessageType.TEXT,
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
    } catch (error) {
      logger.error('Error sending group message:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Join a group chat
   */
  async joinGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
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

      const joinRequest: JoinGroupRequest = {
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
    } catch (error) {
      logger.error('Error joining group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to join group',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Leave a group chat
   */
  async leaveGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
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
    } catch (error) {
      logger.error('Error leaving group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to leave group',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update participant role or status
   */
  async updateParticipant(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
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

      const updateRequest: UpdateParticipantRequest = {
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
    } catch (error) {
      logger.error('Error updating participant:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update participant',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get user's group chats
   */
  async getUserGroupChats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user.id;
      const {
        type,
        search,
        limit = 20,
        offset = 0,
        includeArchived = false,
      } = req.query;

      const options: GroupChatSearchOptions = {
        userId,
        type: type as GroupChatType,
        search: search as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
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
    } catch (error) {
      logger.error('Error getting user group chats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get group chats',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get group chat messages
   */
  async getGroupMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
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
      const {
        search,
        type,
        senderId,
        limit = 50,
        offset = 0,
        beforeDate,
        afterDate,
        onlyPinned = false,
      } = req.query;

      const options: GroupMessageSearchOptions = {
        groupChatId,
        userId,
        search: search as string,
        type: type as MessageType,
        senderId: senderId as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        ...(beforeDate && { beforeDate: new Date(beforeDate as string) }),
        ...(afterDate && { afterDate: new Date(afterDate as string) }),
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
    } catch (error) {
      logger.error('Error getting group messages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get messages',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Add reaction to message
   */
  async addReaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
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
    } catch (error) {
      logger.error('Error adding reaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add reaction',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Toggle message pin status
   */
  async togglePin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
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
    } catch (error) {
      logger.error('Error toggling message pin:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle message pin',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Mark messages as read
   */
  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
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
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark messages as read',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Vote to keep group active after ride completion
   */
  async voteToKeepGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
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
    } catch (error) {
      logger.error('Error recording group vote:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record vote',
        error: (error as Error).message,
      });
    }
  }
}

/**
 * Validation rules for group chat endpoints
 */
export const groupChatValidationRules = {
  createGroupChat: [
    body('name')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Group name must be 1-100 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Description must be max 500 characters'),
    body('type')
      .isIn(Object.values(GroupChatType))
      .withMessage('Invalid group chat type'),
    body('maxParticipants')
      .optional()
      .isInt({ min: 2, max: 500 })
      .withMessage('Max participants must be between 2 and 500'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be a boolean'),
    body('rideId')
      .optional()
      .isUUID()
      .withMessage('Invalid ride ID'),
    body('deliveryId')
      .optional()
      .isUUID()
      .withMessage('Invalid delivery ID'),
    body('initialParticipants')
      .optional()
      .isArray()
      .withMessage('Initial participants must be an array'),
  ],

  sendMessage: [
    param('groupChatId')
      .isUUID()
      .withMessage('Invalid group chat ID'),
    body('content')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Message content is required'),
    body('type')
      .optional()
      .isIn(Object.values(MessageType))
      .withMessage('Invalid message type'),
    body('replyToMessageId')
      .optional()
      .isUUID()
      .withMessage('Invalid reply message ID'),
  ],

  joinGroup: [
    body('groupChatId')
      .optional()
      .isUUID()
      .withMessage('Invalid group chat ID'),
    body('joinCode')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('Join code is required'),
  ],

  leaveGroup: [
    param('groupChatId')
      .isUUID()
      .withMessage('Invalid group chat ID'),
  ],

  updateParticipant: [
    param('groupChatId')
      .isUUID()
      .withMessage('Invalid group chat ID'),
    param('participantId')
      .isUUID()
      .withMessage('Invalid participant ID'),
    body('role')
      .optional()
      .isIn(Object.values(ParticipantRole))
      .withMessage('Invalid participant role'),
    body('status')
      .optional()
      .isIn(Object.values(ParticipantStatus))
      .withMessage('Invalid participant status'),
  ],

  getMessages: [
    param('groupChatId')
      .isUUID()
      .withMessage('Invalid group chat ID'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be non-negative'),
  ],

  addReaction: [
    param('messageId')
      .isUUID()
      .withMessage('Invalid message ID'),
    body('emoji')
      .isString()
      .isLength({ min: 1, max: 10 })
      .withMessage('Emoji must be 1-10 characters'),
  ],

  markAsRead: [
    param('groupChatId')
      .isUUID()
      .withMessage('Invalid group chat ID'),
    body('messageId')
      .optional()
      .isUUID()
      .withMessage('Invalid message ID'),
  ],

  voteToKeepGroup: [
    param('groupChatId')
      .isUUID()
      .withMessage('Invalid group chat ID'),
    body('keepActive')
      .isBoolean()
      .withMessage('keepActive must be a boolean'),
  ],
};

export default GroupChatController;
