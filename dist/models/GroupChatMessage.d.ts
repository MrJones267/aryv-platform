import { Model, Optional } from 'sequelize';
export declare enum MessageType {
    TEXT = "text",
    IMAGE = "image",
    VIDEO = "video",
    AUDIO = "audio",
    FILE = "file",
    LOCATION = "location",
    SYSTEM = "system",
    POLL = "poll",
    ANNOUNCEMENT = "announcement"
}
export declare enum MessageStatus {
    SENT = "sent",
    DELIVERED = "delivered",
    READ = "read",
    DELETED = "deleted",
    EDITED = "edited"
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
export interface GroupChatMessageCreationAttributes extends Optional<GroupChatMessageAttributes, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'isEdited' | 'isPinned' | 'readBy' | 'deliveredTo'> {
}
export declare class GroupChatMessage extends Model<GroupChatMessageAttributes, GroupChatMessageCreationAttributes> implements GroupChatMessageAttributes {
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
    isDeleted(): boolean;
    isExpired(): boolean;
    hasAttachments(): boolean;
    hasMentions(): boolean;
    hasReactions(): boolean;
    isReply(): boolean;
    isForwarded(): boolean;
    getReactionCount(): number;
    getUserReaction(userId: string): string | null;
    addReaction(userId: string, emoji: string): void;
    removeReaction(userId: string, emoji?: string): void;
    markAsRead(userId: string): void;
    markAsDelivered(userId: string): void;
    getReadCount(): number;
    getDeliveredCount(): number;
    isReadBy(userId: string): boolean;
    isDeliveredTo(userId: string): boolean;
    extractMentions(content: string): string[];
    getPreviewText(maxLength?: number): string;
    formatForApi(currentUserId?: string): any;
    static createSystemMessage(groupChatId: string, content: string, metadata?: any): GroupChatMessageCreationAttributes;
    static createAnnouncementMessage(groupChatId: string, senderId: string, content: string, metadata?: any): GroupChatMessageCreationAttributes;
}
export default GroupChatMessage;
//# sourceMappingURL=GroupChatMessage.d.ts.map