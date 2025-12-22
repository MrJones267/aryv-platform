/**
 * @fileoverview Group Chat Participant model for managing group membership
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export enum ParticipantRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
}

export enum ParticipantStatus {
  ACTIVE = 'active',
  MUTED = 'muted',
  BLOCKED = 'blocked',
  LEFT = 'left',
  REMOVED = 'removed',
}

export interface GroupChatParticipantAttributes {
  id: string;
  groupChatId: string;
  userId: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  nickname?: string;
  joinedAt: Date;
  leftAt?: Date;
  lastSeenAt?: Date;
  lastReadMessageId?: string;
  mutedUntil?: Date;
  permissions: any;
  metadata: any;
  invitedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupChatParticipantCreationAttributes
  extends Optional<GroupChatParticipantAttributes, 'id' | 'createdAt' | 'updatedAt' | 'joinedAt'> {}

export class GroupChatParticipant extends Model<GroupChatParticipantAttributes, GroupChatParticipantCreationAttributes>
  implements GroupChatParticipantAttributes {

  public id!: string;
  public groupChatId!: string;
  public userId!: string;
  public role!: ParticipantRole;
  public status!: ParticipantStatus;
  public nickname?: string;
  public joinedAt!: Date;
  public leftAt?: Date;
  public lastSeenAt?: Date;
  public lastReadMessageId?: string;
  public mutedUntil?: Date;
  public permissions!: any;
  public metadata!: any;
  public invitedBy?: string;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Helper methods
  public isActive(): boolean {
    return this.status === ParticipantStatus.ACTIVE;
  }

  public isMuted(): boolean {
    if (this.status === ParticipantStatus.MUTED) {
      return true;
    }
    if (this.mutedUntil) {
      return new Date() < this.mutedUntil;
    }
    return false;
  }

  public isAdmin(): boolean {
    return this.role === ParticipantRole.ADMIN;
  }

  public isModerator(): boolean {
    return this.role === ParticipantRole.MODERATOR || this.isAdmin();
  }

  public canModerate(): boolean {
    return this.isModerator() && this.isActive();
  }

  public canInvite(): boolean {
    return this.permissions.canInvite !== false && this.isActive();
  }

  public canRemoveMessages(): boolean {
    return this.permissions.canRemoveMessages !== false && this.isModerator();
  }

  public canMuteParticipants(): boolean {
    return this.permissions.canMute !== false && this.isModerator();
  }

  public getDefaultPermissions(role: ParticipantRole): any {
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

  public updateLastSeen(): Promise<[affectedCount: number]> {
    return (this.constructor as any).update(
      { lastSeenAt: new Date() },
      { where: { id: this.id } },
    ) as Promise<[affectedCount: number]>;
  }

  public markMessageAsRead(messageId: string): Promise<[affectedCount: number]> {
    return (this.constructor as any).update(
      {
        lastReadMessageId: messageId,
        lastSeenAt: new Date(),
      },
      { where: { id: this.id } },
    ) as Promise<[affectedCount: number]>;
  }

  public mute(duration?: number): Promise<[affectedCount: number]> {
    const updates: any = { status: ParticipantStatus.MUTED };

    if (duration) {
      updates.mutedUntil = new Date(Date.now() + duration);
    }

    return (this.constructor as any).update(updates, { where: { id: this.id } }) as Promise<[affectedCount: number]>;
  }

  public unmute(): Promise<[affectedCount: number]> {
    return (this.constructor as any).update(
      {
        status: ParticipantStatus.ACTIVE,
        mutedUntil: null,
      },
      { where: { id: this.id } },
    ) as Promise<[affectedCount: number]>;
  }

  public leave(): Promise<[affectedCount: number]> {
    return (this.constructor as any).update(
      {
        status: ParticipantStatus.LEFT,
        leftAt: new Date(),
      },
      { where: { id: this.id } },
    ) as Promise<[affectedCount: number]>;
  }

  public formatForApi(): any {
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

  public static getRoleHierarchy(): Record<ParticipantRole, number> {
    return {
      [ParticipantRole.MEMBER]: 1,
      [ParticipantRole.MODERATOR]: 2,
      [ParticipantRole.ADMIN]: 3,
    };
  }

  public canPromote(targetRole: ParticipantRole): boolean {
    const hierarchy = GroupChatParticipant.getRoleHierarchy();
    return hierarchy[this.role] > hierarchy[targetRole];
  }

  public canDemote(targetRole: ParticipantRole): boolean {
    const hierarchy = GroupChatParticipant.getRoleHierarchy();
    return hierarchy[this.role] > hierarchy[targetRole];
  }
}

GroupChatParticipant.init(
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    role: {
      type: DataTypes.ENUM(...Object.values(ParticipantRole)),
      allowNull: false,
      defaultValue: ParticipantRole.MEMBER,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ParticipantStatus)),
      allowNull: false,
      defaultValue: ParticipantStatus.ACTIVE,
    },
    nickname: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [1, 50],
      },
    },
    joinedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    leftAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastReadMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    mutedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    permissions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    invitedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
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
      beforeCreate: (participant: GroupChatParticipant) => {
        // Set default permissions based on role
        if (!participant.permissions || Object.keys(participant.permissions).length === 0) {
          participant.permissions = participant.getDefaultPermissions(participant.role);
        }
      },
      beforeUpdate: (participant: GroupChatParticipant) => {
        // Update permissions if role changed
        if (participant.changed('role')) {
          participant.permissions = participant.getDefaultPermissions(participant.role);
        }

        // Set leftAt timestamp when status changes to left/removed
        if (participant.changed('status') &&
            [ParticipantStatus.LEFT, ParticipantStatus.REMOVED].includes(participant.status) &&
            !participant.leftAt) {
          participant.leftAt = new Date();
        }
      },
    },
    validate: {
      statusTransitions() {
        // Validate status transitions
        if ((this as any)['status'] === ParticipantStatus.LEFT && !(this as any)['leftAt']) {
          (this as any)['leftAt'] = new Date();
        }
        if ((this as any)['status'] === ParticipantStatus.REMOVED && !(this as any)['leftAt']) {
          (this as any)['leftAt'] = new Date();
        }
      },
    },
  },
);

export default GroupChatParticipant;
