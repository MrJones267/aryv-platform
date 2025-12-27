import GroupChat, { GroupChatType, GroupChatStatus } from '../models/GroupChat';
import GroupChatParticipant, { ParticipantRole, ParticipantStatus } from '../models/GroupChatParticipant';
import GroupChatMessage, { MessageType } from '../models/GroupChatMessage';
import { SocketService } from './SocketService';
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
export declare class GroupChatService {
    private socketService?;
    private notificationService;
    constructor(socketService?: SocketService);
    private getSocketService;
    createGroupChat(request: CreateGroupChatRequest): Promise<GroupChat>;
    sendMessage(request: SendGroupMessageRequest): Promise<GroupChatMessage>;
    joinGroup(request: JoinGroupRequest): Promise<GroupChatParticipant>;
    leaveGroup(groupChatId: string, userId: string): Promise<void>;
    updateParticipant(request: UpdateParticipantRequest): Promise<GroupChatParticipant>;
    getUserGroupChats(options: GroupChatSearchOptions): Promise<{
        groupChats: any[];
        total: number;
    }>;
    getGroupMessages(options: GroupMessageSearchOptions): Promise<{
        messages: any[];
        total: number;
    }>;
    addReaction(messageId: string, userId: string, emoji: string): Promise<GroupChatMessage>;
    toggleMessagePin(messageId: string, userId: string): Promise<GroupChatMessage>;
    markMessagesAsRead(groupChatId: string, userId: string, messageId?: string): Promise<void>;
    private calculateUnreadCount;
    handleRideCompletion(rideId: string): Promise<void>;
    private processRideGroupCompletion;
    private sendRideCompletionMessage;
    private scheduleGroupDisbanding;
    private executeDisbandingIfScheduled;
    private disbandRideGroup;
    private convertRideGroupToCustom;
    voteToKeepGroup(groupChatId: string, userId: string, keepActive: boolean): Promise<void>;
    cleanupExpiredMessages(): Promise<number>;
    cleanupInactiveGroups(): Promise<number>;
}
export default GroupChatService;
//# sourceMappingURL=GroupChatService.d.ts.map