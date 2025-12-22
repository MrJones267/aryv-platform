/**
 * @fileoverview Group Chat Message model for enhanced messaging
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  LOCATION = 'location',
  SYSTEM = 'system',
  POLL = 'poll',
  ANNOUNCEMENT = 'announcement',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  DELETED = 'deleted',
  EDITED = 'edited',
}

export interface GroupChatMessageAttributes {
  id: string;
  groupChatId: string;
  senderId: string;
  replyToMessageId?: string;
  type: MessageType;
  status: MessageStatus;
  content: string;
  metadata: any;
  attachments: any[];
  mentions: string[];
  reactions: any;
  isEdited: boolean;
  editedAt?: Date;
  deletedAt?: Date;
  deletedBy?: string;
  expiresAt?: Date;
  isPinned: boolean;
  pinnedBy?: string;
  pinnedAt?: Date;
  forwardedFrom?: string;
  forwardedFromMessageId?: string;
  readBy: any;
  deliveredTo: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupChatMessageCreationAttributes
  extends Optional<GroupChatMessageAttributes, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'isEdited' | 'isPinned' | 'readBy' | 'deliveredTo'> {}

export class GroupChatMessage extends Model<GroupChatMessageAttributes, GroupChatMessageCreationAttributes>
  implements GroupChatMessageAttributes {

  public id!: string;
  public groupChatId!: string;
  public senderId!: string;
  public replyToMessageId?: string;
  public type!: MessageType;
  public status!: MessageStatus;
  public content!: string;
  public metadata!: any;
  public attachments!: any[];
  public mentions!: string[];
  public reactions!: any;
  public isEdited!: boolean;
  public editedAt?: Date;
  public deletedAt?: Date;
  public deletedBy?: string;
  public expiresAt?: Date;
  public isPinned!: boolean;
  public pinnedBy?: string;
  public pinnedAt?: Date;
  public forwardedFrom?: string;
  public forwardedFromMessageId?: string;
  public readBy!: any;
  public deliveredTo!: any;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Helper methods
  public isDeleted(): boolean {
    return this.status === MessageStatus.DELETED || !!this.deletedAt;
  }

  public isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  public hasAttachments(): boolean {
    return this.attachments && this.attachments.length > 0;
  }

  public hasMentions(): boolean {
    return this.mentions && this.mentions.length > 0;
  }

  public hasReactions(): boolean {
    return this.reactions && Object.keys(this.reactions).length > 0;
  }

  public isReply(): boolean {
    return !!this.replyToMessageId;
  }

  public isForwarded(): boolean {
    return !!this.forwardedFrom;
  }

  public getReactionCount(): number {
    if (!this.reactions) return 0;
    return Object.values(this.reactions).reduce((total: number, users: any) => total + users.length, 0);
  }

  public getUserReaction(userId: string): string | null {
    if (!this.reactions) return null;

    for (const [emoji, users] of Object.entries(this.reactions)) {
      if ((users as string[]).includes(userId)) {
        return emoji;
      }
    }
    return null;
  }

  public addReaction(userId: string, emoji: string): void {
    if (!this.reactions) {
      this.reactions = {};
    }

    // Remove existing reaction from user
    this.removeReaction(userId);

    // Add new reaction
    if (!this.reactions[emoji]) {
      this.reactions[emoji] = [];
    }
    this.reactions[emoji].push(userId);
  }

  public removeReaction(userId: string, emoji?: string): void {
    if (!this.reactions) return;

    if (emoji) {
      // Remove specific emoji reaction
      if (this.reactions[emoji]) {
        this.reactions[emoji] = this.reactions[emoji].filter((id: string) => id !== userId);
        if (this.reactions[emoji].length === 0) {
          delete this.reactions[emoji];
        }
      }
    } else {
      // Remove all reactions from user
      for (const emojiKey of Object.keys(this.reactions)) {
        this.reactions[emojiKey] = this.reactions[emojiKey].filter((id: string) => id !== userId);
        if (this.reactions[emojiKey].length === 0) {
          delete this.reactions[emojiKey];
        }
      }
    }
  }

  public markAsRead(userId: string): void {
    if (!this.readBy) {
      this.readBy = {};
    }
    this.readBy[userId] = new Date().toISOString();
  }

  public markAsDelivered(userId: string): void {
    if (!this.deliveredTo) {
      this.deliveredTo = {};
    }
    this.deliveredTo[userId] = new Date().toISOString();
  }

  public getReadCount(): number {
    return this.readBy ? Object.keys(this.readBy).length : 0;
  }

  public getDeliveredCount(): number {
    return this.deliveredTo ? Object.keys(this.deliveredTo).length : 0;
  }

  public isReadBy(userId: string): boolean {
    return this.readBy && this.readBy[userId] !== undefined;
  }

  public isDeliveredTo(userId: string): boolean {
    return this.deliveredTo && this.deliveredTo[userId] !== undefined;
  }

  public extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  }

  public getPreviewText(maxLength: number = 100): string {
    if (this.isDeleted()) {
      return 'This message was deleted';
    }

    switch (this.type) {
      case MessageType.TEXT:
        return this.content.length > maxLength
          ? `${this.content.substring(0, maxLength)  }...`
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
        return `📢 ${  this.content.length > maxLength
          ? `${this.content.substring(0, maxLength)  }...`
          : this.content}`;

      case MessageType.SYSTEM:
        return this.content;

      default:
        return 'Message';
    }
  }

  public formatForApi(currentUserId?: string): any {
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

  public static createSystemMessage(
    groupChatId: string,
    content: string,
    metadata: any = {},
  ): GroupChatMessageCreationAttributes {
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

  public static createAnnouncementMessage(
    groupChatId: string,
    senderId: string,
    content: string,
    metadata: any = {},
  ): GroupChatMessageCreationAttributes {
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

GroupChatMessage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    groupChatId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'group_chats',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    replyToMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'group_chat_messages',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    type: {
      type: DataTypes.ENUM(...Object.values(MessageType)),
      allowNull: false,
      defaultValue: MessageType.TEXT,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(MessageStatus)),
      allowNull: false,
      defaultValue: MessageStatus.SENT,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    attachments: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    mentions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    reactions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    isEdited: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deletedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isPinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    pinnedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    pinnedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    forwardedFrom: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    forwardedFromMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    readBy: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    deliveredTo: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
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
            [Op.ne]: null,
          },
        },
      },
      {
        fields: ['deletedAt'],
        name: 'idx_group_chat_messages_deleted',
      },
    ],
    hooks: {
      beforeCreate: (message: GroupChatMessage) => {
        // Extract mentions from content
        if (message.type === MessageType.TEXT || message.type === MessageType.ANNOUNCEMENT) {
          message.mentions = message.extractMentions(message.content);
        }

        // Set default metadata
        if (!message.metadata) {
          message.metadata = {};
        }

        // Set pinned timestamp for announcements
        if (message.type === MessageType.ANNOUNCEMENT && message.isPinned && !message.pinnedAt) {
          message.pinnedAt = new Date();
        }
      },
      beforeUpdate: (message: GroupChatMessage) => {
        // Update edited timestamp
        if (message.changed('content') && !message.isDeleted()) {
          message.isEdited = true;
          message.editedAt = new Date();

          // Re-extract mentions if content changed
          if (message.type === MessageType.TEXT || message.type === MessageType.ANNOUNCEMENT) {
            message.mentions = message.extractMentions(message.content);
          }
        }

        // Set pinned timestamp
        if (message.changed('isPinned') && message.isPinned && !message.pinnedAt) {
          message.pinnedAt = new Date();
        }

        // Clear pinned timestamp when unpinning
        if (message.changed('isPinned') && !message.isPinned) {
          message.pinnedAt = null as any;
          message.pinnedBy = null as any;
        }
      },
    },
    validate: {
      contentRequired() {
        if (!(this as any)['content'] && (this as any)['type'] !== MessageType.FILE) {
          throw new Error('Content is required for most message types');
        }
      },
      pinnedByRequired() {
        if ((this as any)['isPinned'] && !(this as any)['pinnedBy']) {
          throw new Error('pinnedBy is required when message is pinned');
        }
      },
    },
  },
);

export default GroupChatMessage;
