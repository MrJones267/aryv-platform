/**
 * @fileoverview Group Chat Service for managing group messaging operations
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Op, Transaction, WhereOptions } from 'sequelize';
import { sequelize } from '../config/database';
import GroupChat, { GroupChatType, GroupChatStatus } from '../models/GroupChat';
import GroupChatParticipant, { ParticipantRole, ParticipantStatus } from '../models/GroupChatParticipant';
import GroupChatMessage, { MessageType, MessageStatus } from '../models/GroupChatMessage';
import User from '../models/User';
import { SocketService } from './SocketService';
import { AdvancedNotificationService } from './AdvancedNotificationService';
import logger from '../utils/logger';

export interface CreateGroupChatRequest {
  name: string;
  description?: string;
  type: GroupChatType;
  createdBy: string;
  avatarUrl?: string;
  maxParticipants?: number;
  isPublic?: boolean;
  rideId?: string;
  deliveryId?: string;
  settings?: any;
  initialParticipants?: string[];
}

export interface SendGroupMessageRequest {
  groupChatId: string;
  senderId: string;
  content: string;
  type?: MessageType;
  replyToMessageId?: string;
  attachments?: any[];
  metadata?: any;
  mentions?: string[];
  expiresAt?: Date;
}

export interface JoinGroupRequest {
  groupChatId?: string;
  joinCode?: string;
  userId: string;
  invitedBy?: string;
}

export interface UpdateParticipantRequest {
  groupChatId: string;
  participantId: string;
  requesterId: string;
  role?: ParticipantRole;
  status?: ParticipantStatus;
  nickname?: string;
  permissions?: any;
}

export interface GroupChatSearchOptions {
  userId: string;
  type?: GroupChatType;
  status?: GroupChatStatus;
  search?: string;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}

export interface GroupMessageSearchOptions {
  groupChatId: string;
  userId: string;
  search?: string;
  type?: MessageType;
  senderId?: string;
  limit?: number;
  offset?: number;
  beforeDate?: Date;
  afterDate?: Date;
  onlyPinned?: boolean;
}

export class GroupChatService {
  private socketService?: SocketService | undefined;
  private notificationService: AdvancedNotificationService;

  constructor(socketService?: SocketService) {
    this.socketService = socketService || undefined;
    this.notificationService = new AdvancedNotificationService();
  }

  private getSocketService(): SocketService | undefined {
    if (!this.socketService) {
      // Get singleton instance if not injected
      try {
        this.socketService = (SocketService as any).getInstance();
      } catch (error) {
        // Socket service might not be initialized yet
        return undefined;
      }
    }
    return this.socketService;
  }

  /**
   * Create a new group chat
   */
  async createGroupChat(request: CreateGroupChatRequest): Promise<GroupChat> {
    const transaction = await sequelize.transaction();

    try {
      // Validate creator exists and has permissions
      const creator = await User.findByPk(request.createdBy);
      if (!creator) {
        throw new Error('Creator not found');
      }

      // Create the group chat
      const groupChat = await (GroupChat as any).create({
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
        status: GroupChatStatus.ACTIVE,
      }, { transaction });

      // Add creator as admin
      await GroupChatParticipant.create({
        groupChatId: groupChat.id,
        userId: request.createdBy,
        role: ParticipantRole.ADMIN,
        status: ParticipantStatus.ACTIVE,
        joinedAt: new Date(),
      }, { transaction });

      // Add initial participants if provided
      if (request.initialParticipants && request.initialParticipants.length > 0) {
        const participantsToAdd = request.initialParticipants.filter(id => id !== request.createdBy);

        for (const participantId of participantsToAdd) {
          await GroupChatParticipant.create({
            groupChatId: groupChat.id,
            userId: participantId,
            role: ParticipantRole.MEMBER,
            status: ParticipantStatus.ACTIVE,
            invitedBy: request.createdBy,
            joinedAt: new Date(),
          }, { transaction });
        }

        // Send notifications to new participants
        for (const participantId of participantsToAdd) {
          await this.notificationService.sendNotification({
            userId: participantId,
            type: 'ride_request' as any,
            title: 'Group Chat Invitation',
            body: `You've been added to the group "${groupChat.name}"`,
            data: {
              groupChatId: groupChat.id,
              groupName: groupChat.name,
              invitedBy: request.createdBy,
            },
            channels: ['PUSH' as any, 'IN_APP' as any],
          });
        }
      }

      // Create welcome system message
      await GroupChatMessage.create({
        groupChatId: groupChat.id,
        senderId: 'system',
        type: MessageType.SYSTEM,
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

      // Emit real-time event
      const socketService = this.getSocketService();
      if (socketService) {
        socketService.emitToRoom(`group_${groupChat.id}`, 'group_created', {
          groupChat: (groupChat as any).formatForApi(),
          creator: (creator as any).formatForApi(),
        });
      }

      return groupChat;
    } catch (error) {
      await transaction.rollback();
      logger.error('Error creating group chat:', error);
      throw error;
    }
  }

  /**
   * Send a message to a group chat
   */
  async sendMessage(request: SendGroupMessageRequest): Promise<GroupChatMessage> {
    const transaction = await sequelize.transaction();

    try {
      // Validate group and participant
      const groupChat = await GroupChat.findByPk(request.groupChatId);
      if (!groupChat || !groupChat.isActive()) {
        throw new Error('Group chat not found or inactive');
      }

      const participant = await GroupChatParticipant.findOne({
        where: {
          groupChatId: request.groupChatId,
          userId: request.senderId,
          status: ParticipantStatus.ACTIVE,
        },
      });

      if (!participant) {
        throw new Error('User is not an active participant of this group');
      }

      if (participant.isMuted()) {
        throw new Error('User is muted in this group');
      }

      // Create the message
      const message = await (GroupChatMessage as any).create({
        groupChatId: request.groupChatId,
        senderId: request.senderId,
        content: request.content,
        type: request.type || MessageType.TEXT,
        replyToMessageId: request.replyToMessageId || undefined,
        attachments: request.attachments || [],
        metadata: request.metadata || {},
        mentions: request.mentions || [],
        reactions: {},
        expiresAt: request.expiresAt || undefined,
      }, { transaction });

      // Update participant's last seen
      await participant.updateLastSeen();

      // Mark message as delivered to sender
      message.markAsDelivered(request.senderId);
      await message.save({ transaction });

      // Get all active participants for notifications
      const participants = await GroupChatParticipant.findAll({
        where: {
          groupChatId: request.groupChatId,
          status: ParticipantStatus.ACTIVE,
          userId: { [Op.ne]: request.senderId },
        },
        include: [{ model: User, as: 'user' }],
      });

      await transaction.commit();

      // Emit real-time message
      const socketService = this.getSocketService();
      if (socketService) {
        socketService.emitToRoom(`group_${request.groupChatId}`, 'group_message', {
          message: (message as any).formatForApi(request.senderId),
          groupChatId: request.groupChatId,
        });
      }

      // Send notifications to mentioned users and group members
      const mentionedUsers = request.mentions || [];
      const sender = await User.findByPk(request.senderId);

      for (const participant of participants) {
        const isMentioned = mentionedUsers.includes(participant.userId);
        const shouldNotify = isMentioned || !participant.isMuted();

        if (shouldNotify && participant.userId !== request.senderId) {
          await this.notificationService.sendNotification({
            userId: participant.userId,
            type: isMentioned ? ('ride_request' as any) : ('ride_request' as any),
            title: isMentioned ? `Mentioned in ${groupChat.name}` : groupChat.name,
            body: `${sender?.firstName}: ${(message as any).getPreviewText(50)}`,
            data: {
              groupChatId: request.groupChatId,
              messageId: message.id,
              senderId: request.senderId,
              groupName: groupChat.name,
            },
            channels: isMentioned ? ['PUSH' as any, 'IN_APP' as any] : ['IN_APP' as any],
          });
        }

        // Mark as delivered
        message.markAsDelivered(participant.userId);
      }

      await message.save();

      return message;
    } catch (error) {
      await transaction.rollback();
      logger.error('Error sending group message:', error);
      throw error;
    }
  }

  /**
   * Join a group chat
   */
  async joinGroup(request: JoinGroupRequest): Promise<GroupChatParticipant> {
    const transaction = await sequelize.transaction();

    try {
      let groupChat: GroupChat | null = null;

      // Find group by ID or join code
      if (request.groupChatId) {
        groupChat = await GroupChat.findByPk(request.groupChatId);
      } else if (request.joinCode) {
        groupChat = await GroupChat.findOne({
          where: { joinCode: request.joinCode, isPublic: true },
        });
      }

      if (!groupChat || !groupChat.isActive()) {
        throw new Error('Group chat not found or inactive');
      }

      // Check if user is already a participant
      const existingParticipant = await GroupChatParticipant.findOne({
        where: {
          groupChatId: groupChat.id,
          userId: request.userId,
        },
      });

      if (existingParticipant) {
        if (existingParticipant.status === ParticipantStatus.ACTIVE) {
          throw new Error('User is already a member of this group');
        }

        // Reactivate if previously left
        await existingParticipant.update({
          status: ParticipantStatus.ACTIVE,
          leftAt: null as any,
          joinedAt: new Date(),
        }, { transaction });

        await transaction.commit();
        return existingParticipant;
      }

      // Check group capacity
      const currentCount = await GroupChatParticipant.count({
        where: {
          groupChatId: groupChat.id,
          status: ParticipantStatus.ACTIVE,
        },
      });

      if (!groupChat.canAddParticipants(currentCount)) {
        throw new Error('Group has reached maximum capacity');
      }

      // Create new participant
      const participant = await (GroupChatParticipant as any).create({
        groupChatId: groupChat.id,
        userId: request.userId,
        role: ParticipantRole.MEMBER,
        status: ParticipantStatus.ACTIVE,
        invitedBy: request.invitedBy || undefined,
        joinedAt: new Date(),
      }, { transaction });

      // Create system message
      const user = await User.findByPk(request.userId);
      await GroupChatMessage.create({
        groupChatId: groupChat.id,
        senderId: 'system',
        type: MessageType.SYSTEM,
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

      // Emit real-time event
      const socketService = this.getSocketService();
      if (socketService) {
        socketService.emitToRoom(`group_${groupChat.id}`, 'participant_joined', {
          participant: (participant as any).formatForApi(),
          user: user,
          groupChatId: groupChat.id,
        });
      }

      return participant;
    } catch (error) {
      await transaction.rollback();
      logger.error('Error joining group:', error);
      throw error;
    }
  }

  /**
   * Leave a group chat
   */
  async leaveGroup(groupChatId: string, userId: string): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const participant = await GroupChatParticipant.findOne({
        where: {
          groupChatId,
          userId,
          status: ParticipantStatus.ACTIVE,
        },
      });

      if (!participant) {
        throw new Error('User is not an active participant of this group');
      }

      // Check if user is the only admin
      if (participant.isAdmin()) {
        const adminCount = await GroupChatParticipant.count({
          where: {
            groupChatId,
            role: ParticipantRole.ADMIN,
            status: ParticipantStatus.ACTIVE,
          },
        });

        if (adminCount === 1) {
          // Transfer admin to another participant or delete group
          const nextParticipant = await GroupChatParticipant.findOne({
            where: {
              groupChatId,
              userId: { [Op.ne]: userId },
              status: ParticipantStatus.ACTIVE,
            },
            order: [['joinedAt', 'ASC']],
          });

          if (nextParticipant) {
            await nextParticipant.update({ role: ParticipantRole.ADMIN }, { transaction });
          } else {
            // No other participants, archive the group
            await GroupChat.update(
              { status: GroupChatStatus.ARCHIVED },
              { where: { id: groupChatId }, transaction },
            );
          }
        }
      }

      // Update participant status
      await participant.update({
        status: ParticipantStatus.LEFT,
        leftAt: new Date(),
      }, { transaction });

      // Create system message
      const user = await User.findByPk(userId);
      await GroupChatMessage.create({
        groupChatId,
        senderId: 'system',
        type: MessageType.SYSTEM,
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

      // Emit real-time event
      const socketService = this.getSocketService();
      if (socketService) {
        socketService.emitToRoom(`group_${groupChatId}`, 'participant_left', {
          userId,
          groupChatId,
        });
      }
    } catch (error) {
      await transaction.rollback();
      logger.error('Error leaving group:', error);
      throw error;
    }
  }

  /**
   * Update participant role or status
   */
  async updateParticipant(request: UpdateParticipantRequest): Promise<GroupChatParticipant> {
    const transaction = await sequelize.transaction();

    try {
      // Validate requester permissions
      const requester = await GroupChatParticipant.findOne({
        where: {
          groupChatId: request.groupChatId,
          userId: request.requesterId,
          status: ParticipantStatus.ACTIVE,
        },
      });

      if (!requester || !requester.canModerate()) {
        throw new Error('Insufficient permissions to update participant');
      }

      // Find target participant
      const participant = await GroupChatParticipant.findByPk(request.participantId);
      if (!participant || participant.groupChatId !== request.groupChatId) {
        throw new Error('Participant not found');
      }

      // Validate role changes
      if (request.role && request.role !== participant.role) {
        if (!requester.canPromote(request.role) && !requester.canDemote(participant.role)) {
          throw new Error('Cannot change participant role');
        }
      }

      // Update participant
      const updates: any = {};
      if (request.role) updates.role = request.role;
      if (request.status) updates.status = request.status;
      if (request.nickname) updates.nickname = request.nickname;
      if (request.permissions) updates.permissions = request.permissions;

      await participant.update(updates, { transaction });

      // Create system message for role changes
      if (request.role && request.role !== participant.role) {
        const user = await User.findByPk(participant.userId);
        const requesterUser = await User.findByPk(request.requesterId);

        await GroupChatMessage.create({
          groupChatId: request.groupChatId,
          senderId: 'system',
          type: MessageType.SYSTEM,
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

      // Emit real-time event
      const socketService = this.getSocketService();
      if (socketService) {
        socketService.emitToRoom(`group_${request.groupChatId}`, 'participant_updated', {
          participant: (participant as any).formatForApi(),
          groupChatId: request.groupChatId,
          updates,
        });
      }

      return participant;
    } catch (error) {
      await transaction.rollback();
      logger.error('Error updating participant:', error);
      throw error;
    }
  }

  /**
   * Get user's group chats
   */
  async getUserGroupChats(options: GroupChatSearchOptions): Promise<{
    groupChats: any[];
    total: number;
  }> {
    try {
      const whereClause: WhereOptions = {
        userId: options.userId,
        status: ParticipantStatus.ACTIVE,
      };

      const groupWhereClause: WhereOptions = {
        status: options.includeArchived ?
          [GroupChatStatus.ACTIVE, GroupChatStatus.ARCHIVED] :
          GroupChatStatus.ACTIVE,
      };

      if (options.type) {
        groupWhereClause['type'] = options.type;
      }

      if (options.search) {
        groupWhereClause['name'] = { [Op.iLike]: `%${options.search}%` };
      }

      const { count, rows } = await GroupChatParticipant.findAndCountAll({
        where: whereClause,
        include: [{
          model: GroupChat,
          as: 'groupChat',
          where: groupWhereClause,
          include: [{
            model: GroupChatMessage,
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
        // @ts-ignore - Association exists
        ...participant.groupChat,
        participantInfo: (participant as any).formatForApi(),
        unreadCount: this.calculateUnreadCount(participant),
      }));

      return { groupChats, total: count };
    } catch (error) {
      logger.error('Error getting user group chats:', error);
      throw error;
    }
  }

  /**
   * Get group chat messages
   */
  async getGroupMessages(options: GroupMessageSearchOptions): Promise<{
    messages: any[];
    total: number;
  }> {
    try {
      // Verify user is participant
      const participant = await GroupChatParticipant.findOne({
        where: {
          groupChatId: options.groupChatId,
          userId: options.userId,
          status: ParticipantStatus.ACTIVE,
        },
      });

      if (!participant) {
        throw new Error('User is not an active participant of this group');
      }

      const whereClause: WhereOptions = {
        groupChatId: options.groupChatId,
        deletedAt: null,
      };

      if (options.search) {
        whereClause['content'] = { [Op.iLike]: `%${options.search}%` };
      }

      if (options.type) {
        whereClause['type'] = options.type;
      }

      if (options.senderId) {
        whereClause['senderId'] = options.senderId;
      }

      if (options.beforeDate) {
        whereClause['createdAt'] = { [Op.lt]: options.beforeDate };
      }

      if (options.afterDate) {
        whereClause['createdAt'] = { [Op.gt]: options.afterDate };
      }

      if (options.onlyPinned) {
        whereClause['isPinned'] = true;
      }

      const { count, rows } = await GroupChatMessage.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName', 'profilePicture'],
          },
          {
            model: GroupChatMessage,
            as: 'replyToMessage',
            required: false,
            include: [{
              model: User,
              as: 'sender',
              attributes: ['id', 'firstName', 'lastName'],
            }],
          },
        ],
        limit: options.limit || 50,
        offset: options.offset || 0,
        order: [['createdAt', 'DESC']],
      });

      const messages = rows.map(message => (message as any).formatForApi(options.userId));

      return { messages: messages.reverse(), total: count };
    } catch (error) {
      logger.error('Error getting group messages:', error);
      throw error;
    }
  }

  /**
   * React to a message
   */
  async addReaction(messageId: string, userId: string, emoji: string): Promise<GroupChatMessage> {
    try {
      const message = await GroupChatMessage.findByPk(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      // Verify user is participant
      const participant = await GroupChatParticipant.findOne({
        where: {
          groupChatId: message.groupChatId,
          userId,
          status: ParticipantStatus.ACTIVE,
        },
      });

      if (!participant) {
        throw new Error('User is not an active participant of this group');
      }

      message.addReaction(userId, emoji);
      await message.save();

      // Emit real-time event
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
    } catch (error) {
      logger.error('Error adding reaction:', error);
      throw error;
    }
  }

  /**
   * Pin/unpin a message
   */
  async toggleMessagePin(messageId: string, userId: string): Promise<GroupChatMessage> {
    try {
      const message = await GroupChatMessage.findByPk(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      // Verify user has moderation permissions
      const participant = await GroupChatParticipant.findOne({
        where: {
          groupChatId: message.groupChatId,
          userId,
          status: ParticipantStatus.ACTIVE,
        },
      });

      if (!participant || !participant.canModerate()) {
        throw new Error('Insufficient permissions to pin messages');
      }

      await message.update({
        isPinned: !message.isPinned,
        pinnedBy: !message.isPinned ? null as any : userId,
        pinnedAt: !message.isPinned ? null as any : new Date(),
      });

      // Emit real-time event
      const socketService = this.getSocketService();
      if (socketService) {
        socketService.emitToRoom(`group_${message.groupChatId}`, 'message_pinned', {
          messageId,
          isPinned: message.isPinned,
          pinnedBy: userId,
        });
      }

      return message;
    } catch (error) {
      logger.error('Error toggling message pin:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(groupChatId: string, userId: string, messageId?: string): Promise<void> {
    try {
      const participant = await GroupChatParticipant.findOne({
        where: {
          groupChatId,
          userId,
          status: ParticipantStatus.ACTIVE,
        },
      });

      if (!participant) {
        throw new Error('User is not an active participant of this group');
      }

      if (messageId) {
        // Mark specific message as read
        await participant.markMessageAsRead(messageId);

        const message = await GroupChatMessage.findByPk(messageId);
        if (message) {
          message.markAsRead(userId);
          await message.save();
        }
      } else {
        // Mark all messages as read
        const lastMessage = await GroupChatMessage.findOne({
          where: { groupChatId },
          order: [['createdAt', 'DESC']],
        });

        if (lastMessage) {
          await participant.markMessageAsRead(lastMessage.id);
        }
      }

      // Emit real-time event
      const socketService = this.getSocketService();
      if (socketService) {
        socketService.emitToRoom(`group_${groupChatId}`, 'messages_read', {
          userId,
          messageId,
          groupChatId,
        });
      }
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      throw error;
    }
  }

  /**
   * Calculate unread message count for a participant
   */
  private calculateUnreadCount(_participant: GroupChatParticipant): number {
    // This would be implemented based on lastReadMessageId
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Handle ride completion and group lifecycle management
   */
  async handleRideCompletion(rideId: string): Promise<void> {
    try {
      // Find all ride groups associated with this ride
      const rideGroups = await GroupChat.findAll({
        where: {
          rideId,
          type: GroupChatType.RIDE_GROUP,
          status: GroupChatStatus.ACTIVE,
        },
        include: [{
          model: GroupChatParticipant,
          as: 'participants',
          where: { status: ParticipantStatus.ACTIVE },
          required: false,
        }],
      });

      for (const group of rideGroups) {
        await this.processRideGroupCompletion(group);
      }

      logger.info(`Processed ride completion for ${rideGroups.length} groups`, { rideId });
    } catch (error) {
      logger.error('Error handling ride completion:', error);
      throw error;
    }
  }

  /**
   * Process individual ride group completion
   */
  private async processRideGroupCompletion(group: GroupChat): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      // Get group settings for auto-disbanding preferences
      const settings = group.settings || {};
      const autoDisbandOnRideCompletion = settings.autoDisbandOnRideCompletion !== false; // Default: true
      const disbandDelay = settings.disbandDelay || 2; // Default: 2 hours
      const allowMembersToKeepGroup = settings.allowMembersToKeepGroup || false;

      // Send completion notification to group
      await this.sendRideCompletionMessage(group.id, transaction);

      if (autoDisbandOnRideCompletion) {
        if (disbandDelay > 0) {
          // Schedule delayed disbanding
          await this.scheduleGroupDisbanding(group.id, disbandDelay, allowMembersToKeepGroup, transaction);
        } else {
          // Immediate disbanding
          await this.disbandRideGroup(group.id, transaction);
        }
      } else {
        // Convert ride group to custom group to persist
        await this.convertRideGroupToCustom(group.id, transaction);
      }

      await transaction.commit();
      logger.info('Processed ride group completion', { groupId: group.id, rideId: group.rideId });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error processing ride group completion:', error);
      throw error;
    }
  }

  /**
   * Send ride completion system message to group
   */
  private async sendRideCompletionMessage(groupChatId: string, transaction: Transaction): Promise<void> {
    await GroupChatMessage.create({
      groupChatId,
      senderId: 'system',
      type: MessageType.SYSTEM,
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

    // Emit real-time notification
    const socketService = this.getSocketService();
    if (socketService) {
      socketService.emitToRoom(`group_${groupChatId}`, 'ride_completed', {
        groupChatId,
        message: 'Trip completed successfully',
        autoArchiveIn: 2, // hours
      });
    }
  }

  /**
   * Schedule group disbanding with delay
   */
  private async scheduleGroupDisbanding(
    groupChatId: string,
    delayHours: number,
    allowKeepOption: boolean,
    transaction: Transaction,
  ): Promise<void> {
    // Update group metadata to mark for scheduled disbanding
    await GroupChat.update({
      metadata: {
        scheduledDisbandAt: new Date(Date.now() + delayHours * 60 * 60 * 1000),
        allowKeepOption,
        disbandReason: 'ride_completed',
      },
    }, {
      where: { id: groupChatId },
      transaction,
    });

    // In a production system, you would use a job scheduler like Bull Queue
    // For now, we'll use setTimeout (note: this won't persist across server restarts)
    setTimeout(async () => {
      try {
        await this.executeDisbandingIfScheduled(groupChatId);
      } catch (error) {
        logger.error('Error executing scheduled disbanding:', error);
      }
    }, delayHours * 60 * 60 * 1000);
  }

  /**
   * Execute disbanding if still scheduled
   */
  private async executeDisbandingIfScheduled(groupChatId: string): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const group = await GroupChat.findByPk(groupChatId);
      if (!group || group.status !== GroupChatStatus.ACTIVE) {
        await transaction.rollback();
        return;
      }

      const metadata = group.metadata || {};
      if (!metadata.scheduledDisbandAt) {
        await transaction.rollback();
        return;
      }

      // Check if group members voted to keep it active
      if (metadata.keepGroupActive) {
        await this.convertRideGroupToCustom(groupChatId, transaction);
        await transaction.commit();
        return;
      }

      // Proceed with disbanding
      await this.disbandRideGroup(groupChatId, transaction);
      await transaction.commit();

      logger.info('Auto-disbanded ride group after delay', { groupChatId });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error executing scheduled disbanding:', error);
      throw error;
    }
  }

  /**
   * Disband a ride group by archiving it
   */
  private async disbandRideGroup(groupChatId: string, transaction: Transaction): Promise<void> {
    // Archive the group
    await GroupChat.update({
      status: GroupChatStatus.ARCHIVED,
      metadata: {
        ...((await GroupChat.findByPk(groupChatId))?.metadata || {}),
        archivedAt: new Date(),
        archivedReason: 'ride_completed',
      },
    }, {
      where: { id: groupChatId },
      transaction,
    });

    // Update all active participants to left status
    await GroupChatParticipant.update({
      status: ParticipantStatus.LEFT,
      leftAt: new Date(),
    }, {
      where: {
        groupChatId,
        status: ParticipantStatus.ACTIVE,
      },
      transaction,
    });

    // Send final system message
    await GroupChatMessage.create({
      groupChatId,
      senderId: 'system',
      type: MessageType.SYSTEM,
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

    // Emit real-time notification
    const socketService = this.getSocketService();
    if (socketService) {
      socketService.emitToRoom(`group_${groupChatId}`, 'group_archived', {
        groupChatId,
        reason: 'ride_completed',
        message: 'Group archived after trip completion',
      });
    }
  }

  /**
   * Convert ride group to custom group to persist after ride
   */
  private async convertRideGroupToCustom(groupChatId: string, transaction: Transaction): Promise<void> {
    await GroupChat.update({
      type: GroupChatType.CUSTOM_GROUP,
      rideId: null as any,
      metadata: {
        ...((await GroupChat.findByPk(groupChatId))?.metadata || {}),
        convertedFrom: 'ride_group',
        convertedAt: new Date(),
      },
    }, {
      where: { id: groupChatId },
      transaction,
    });

    // Send conversion notification
    await GroupChatMessage.create({
      groupChatId,
      senderId: 'system',
      type: MessageType.SYSTEM,
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

    // Emit real-time notification
    const socketService = this.getSocketService();
    if (socketService) {
      socketService.emitToRoom(`group_${groupChatId}`, 'group_converted', {
        groupChatId,
        newType: 'custom_group',
        message: 'Group converted to custom group',
      });
    }
  }

  /**
   * Allow users to vote to keep group active
   */
  async voteToKeepGroup(groupChatId: string, userId: string, keepActive: boolean): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const group = await GroupChat.findByPk(groupChatId);
      if (!group || group.status !== GroupChatStatus.ACTIVE) {
        throw new Error('Group not found or not active');
      }

      const metadata = group.metadata || {};
      if (!metadata.scheduledDisbandAt) {
        throw new Error('Group is not scheduled for disbanding');
      }

      // Initialize votes object if it doesn't exist
      if (!metadata.keepGroupVotes) {
        metadata.keepGroupVotes = {};
      }

      metadata.keepGroupVotes[userId] = keepActive;

      // Count votes
      const activeParticipants = await GroupChatParticipant.count({
        where: {
          groupChatId,
          status: ParticipantStatus.ACTIVE,
        },
      });

      const votes = Object.values(metadata.keepGroupVotes);
      const keepVotes = votes.filter(vote => vote === true).length;
      const totalVotes = votes.length;

      // Require majority vote to keep group active
      if (keepVotes > activeParticipants / 2) {
        metadata.keepGroupActive = true;
      }

      await group.update({ metadata }, { transaction });

      // Send voting update message
      await GroupChatMessage.create({
        groupChatId,
        senderId: 'system',
        type: MessageType.SYSTEM,
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

      // Emit real-time notification
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
    } catch (error) {
      await transaction.rollback();
      logger.error('Error processing group vote:', error);
      throw error;
    }
  }

  /**
   * Clean up expired messages
   */
  async cleanupExpiredMessages(): Promise<number> {
    try {
      const result = await GroupChatMessage.update(
        {
          status: MessageStatus.DELETED,
          deletedAt: new Date(),
          content: 'This message has expired',
        },
        {
          where: {
            expiresAt: { [Op.lt]: new Date() },
            status: { [Op.ne]: MessageStatus.DELETED },
          },
        },
      );

      return Array.isArray(result) ? result[0] : 0;
    } catch (error) {
      logger.error('Error cleaning up expired messages:', error);
      throw error;
    }
  }

  /**
   * Clean up inactive groups (scheduled task)
   */
  async cleanupInactiveGroups(): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      // Find groups scheduled for disbanding that passed their deadline
      const expiredGroups = await GroupChat.findAll({
        where: {
          status: GroupChatStatus.ACTIVE,
          metadata: {
            scheduledDisbandAt: { [Op.lt]: new Date() },
          },
        },
      });

      let cleanedCount = 0;
      for (const group of expiredGroups) {
        const transaction = await sequelize.transaction();
        try {
          await this.disbandRideGroup(group.id, transaction);
          await transaction.commit();
          cleanedCount++;
        } catch (error) {
          await transaction.rollback();
          logger.error('Error cleaning up expired group:', { groupId: group.id, error });
        }
      }

      // Also clean up truly inactive groups (no messages for 30+ days)
      const inactiveGroups = await GroupChat.findAll({
        where: {
          status: GroupChatStatus.ACTIVE,
          [Op.or]: [
            { lastMessageAt: { [Op.lt]: cutoffDate } },
            {
              lastMessageAt: null as any,
              createdAt: { [Op.lt]: cutoffDate },
            },
          ],
        } as any,
      });

      for (const group of inactiveGroups) {
        const transaction = await sequelize.transaction();
        try {
          await GroupChat.update({
            status: GroupChatStatus.ARCHIVED,
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
        } catch (error) {
          await transaction.rollback();
          logger.error('Error archiving inactive group:', { groupId: group.id, error });
        }
      }

      logger.info(`Cleaned up ${cleanedCount} inactive groups`);
      return cleanedCount;
    } catch (error) {
      logger.error('Error cleaning up inactive groups:', error);
      throw error;
    }
  }
}

export default GroupChatService;
