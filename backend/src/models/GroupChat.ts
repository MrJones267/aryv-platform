/**
 * @fileoverview Group Chat model for enhanced messaging capabilities
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';

export enum GroupChatType {
  RIDE_GROUP = 'ride_group',
  DELIVERY_GROUP = 'delivery_group',
  EMERGENCY_GROUP = 'emergency_group',
  CUSTOM_GROUP = 'custom_group',
}

export enum GroupChatStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

export interface GroupChatAttributes {
  id: string;
  name: string;
  description?: string;
  type: GroupChatType;
  status: GroupChatStatus;
  createdBy: string;
  avatarUrl?: string;
  settings: any;
  metadata: any;
  rideId?: string;
  deliveryId?: string;
  maxParticipants: number;
  isPublic: boolean;
  joinCode?: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
  lastMessageId?: string;
}

export interface GroupChatCreationAttributes
  extends Optional<GroupChatAttributes, 'id' | 'createdAt' | 'updatedAt' | 'lastMessageAt' | 'lastMessageId'> {}

export class GroupChat extends Model<GroupChatAttributes, GroupChatCreationAttributes>
  implements GroupChatAttributes {

  public id!: string;
  public name!: string;
  public description?: string;
  public type!: GroupChatType;
  public status!: GroupChatStatus;
  public createdBy!: string;
  public avatarUrl?: string;
  public settings!: any;
  public metadata!: any;
  public rideId?: string;
  public deliveryId?: string;
  public maxParticipants!: number;
  public isPublic!: boolean;
  public joinCode?: string;
  public createdAt!: Date;
  public updatedAt!: Date;
  public lastMessageAt?: Date;
  public lastMessageId?: string;

  // Helper methods
  public isActive(): boolean {
    return this.status === GroupChatStatus.ACTIVE;
  }

  public canAddParticipants(currentCount: number): boolean {
    return currentCount < this.maxParticipants && this.isActive();
  }

  public generateJoinCode(): string {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    return code;
  }

  public getDefaultSettings(): any {
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

  public static getTypeDisplayName(type: GroupChatType): string {
    const typeMap = {
      [GroupChatType.RIDE_GROUP]: 'Ride Group',
      [GroupChatType.DELIVERY_GROUP]: 'Delivery Group',
      [GroupChatType.EMERGENCY_GROUP]: 'Emergency Group',
      [GroupChatType.CUSTOM_GROUP]: 'Custom Group',
    };
    return typeMap[type] || 'Unknown';
  }

  public getParticipantSummary(): any {
    // This would be populated via associations
    return {
      total: 0,
      active: 0,
      admins: 0,
    };
  }

  public formatForApi(): any {
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

GroupChat.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500],
      },
    },
    type: {
      type: DataTypes.ENUM(...Object.values(GroupChatType)),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(GroupChatStatus)),
      allowNull: false,
      defaultValue: GroupChatStatus.ACTIVE,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    avatarUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    settings: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    rideId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'rides',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    deliveryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'delivery_agreements',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    maxParticipants: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50,
      validate: {
        min: 2,
        max: 500,
      },
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    joinCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
      unique: true,
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
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
            [Op.ne]: null,
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
      beforeCreate: (groupChat: GroupChat) => {
        // Set default settings
        if (!groupChat.settings || Object.keys(groupChat.settings).length === 0) {
          groupChat.settings = groupChat.getDefaultSettings();
        }

        // Generate join code for public groups
        if (groupChat.isPublic && !groupChat.joinCode) {
          groupChat.joinCode = groupChat.generateJoinCode();
        }

        // Set default names based on type
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
      beforeUpdate: (groupChat: GroupChat) => {
        // Update join code if making group public
        if (groupChat.changed('isPublic') && groupChat.isPublic && !groupChat.joinCode) {
          groupChat.joinCode = groupChat.generateJoinCode();
        }

        // Remove join code if making group private
        if (groupChat.changed('isPublic') && !groupChat.isPublic) {
          groupChat.joinCode = null as any;
        }
      },
    },
    validate: {
      checkRelatedEntity() {
        // Ensure ride groups have rideId and delivery groups have deliveryId
        if ((this as any)['type'] === GroupChatType.RIDE_GROUP && !(this as any)['rideId']) {
          throw new Error('Ride groups must have a rideId');
        }
        if ((this as any)['type'] === GroupChatType.DELIVERY_GROUP && !(this as any)['deliveryId']) {
          throw new Error('Delivery groups must have a deliveryId');
        }
        if ((this as any)['rideId'] && (this as any)['deliveryId']) {
          throw new Error('Group cannot be associated with both ride and delivery');
        }
      },
    },
  },
);

export default GroupChat;
