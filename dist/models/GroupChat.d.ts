import { Model, Optional } from 'sequelize';
export declare enum GroupChatType {
    RIDE_GROUP = "ride_group",
    DELIVERY_GROUP = "delivery_group",
    EMERGENCY_GROUP = "emergency_group",
    CUSTOM_GROUP = "custom_group"
}
export declare enum GroupChatStatus {
    ACTIVE = "active",
    ARCHIVED = "archived",
    DELETED = "deleted"
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
export interface GroupChatCreationAttributes extends Optional<GroupChatAttributes, 'id' | 'createdAt' | 'updatedAt' | 'lastMessageAt' | 'lastMessageId'> {
}
export declare class GroupChat extends Model<GroupChatAttributes, GroupChatCreationAttributes> implements GroupChatAttributes {
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
    isActive(): boolean;
    canAddParticipants(currentCount: number): boolean;
    generateJoinCode(): string;
    getDefaultSettings(): any;
    static getTypeDisplayName(type: GroupChatType): string;
    getParticipantSummary(): any;
    formatForApi(): any;
}
export default GroupChat;
//# sourceMappingURL=GroupChat.d.ts.map