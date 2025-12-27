import { Model, Optional } from 'sequelize';
export declare enum ParticipantRole {
    ADMIN = "admin",
    MODERATOR = "moderator",
    MEMBER = "member"
}
export declare enum ParticipantStatus {
    ACTIVE = "active",
    MUTED = "muted",
    BLOCKED = "blocked",
    LEFT = "left",
    REMOVED = "removed"
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
export interface GroupChatParticipantCreationAttributes extends Optional<GroupChatParticipantAttributes, 'id' | 'createdAt' | 'updatedAt' | 'joinedAt'> {
}
export declare class GroupChatParticipant extends Model<GroupChatParticipantAttributes, GroupChatParticipantCreationAttributes> implements GroupChatParticipantAttributes {
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
    isActive(): boolean;
    isMuted(): boolean;
    isAdmin(): boolean;
    isModerator(): boolean;
    canModerate(): boolean;
    canInvite(): boolean;
    canRemoveMessages(): boolean;
    canMuteParticipants(): boolean;
    getDefaultPermissions(role: ParticipantRole): any;
    updateLastSeen(): Promise<[affectedCount: number]>;
    markMessageAsRead(messageId: string): Promise<[affectedCount: number]>;
    mute(duration?: number): Promise<[affectedCount: number]>;
    unmute(): Promise<[affectedCount: number]>;
    leave(): Promise<[affectedCount: number]>;
    formatForApi(): any;
    static getRoleHierarchy(): Record<ParticipantRole, number>;
    canPromote(targetRole: ParticipantRole): boolean;
    canDemote(targetRole: ParticipantRole): boolean;
}
export default GroupChatParticipant;
//# sourceMappingURL=GroupChatParticipant.d.ts.map