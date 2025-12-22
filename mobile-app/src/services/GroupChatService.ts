/**
 * @fileoverview Group Chat Service for mobile app
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

// import { API_BASE_URL } from '../config/api';
// import { getAuthToken } from '../utils/storage';
const API_BASE_URL = process.env.REACT_NATIVE_API_URL || 'https://api.aryv-app.com';
const getAuthToken = () => Promise.resolve('mock-token');

export interface GroupChatResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface CreateGroupChatRequest {
  name: string;
  description?: string;
  type: 'ride_group' | 'delivery_group' | 'emergency_group' | 'custom_group';
  avatarUrl?: string;
  maxParticipants?: number;
  isPublic?: boolean;
  rideId?: string;
  deliveryId?: string;
  initialParticipants?: string[];
}

export interface SendMessageRequest {
  content: string;
  type?: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'poll' | 'announcement';
  replyToMessageId?: string;
  attachments?: any[];
  metadata?: any;
  mentions?: string[];
  expiresAt?: string;
}

export interface JoinGroupRequest {
  groupChatId?: string;
  joinCode?: string;
}

export interface MessageSearchOptions {
  search?: string;
  type?: string;
  senderId?: string;
  limit?: number;
  offset?: number;
  beforeDate?: string;
  afterDate?: string;
  onlyPinned?: boolean;
}

export interface GroupSearchOptions {
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}

class GroupChatServiceClass {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/group-chats`;
  }

  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<GroupChatResponse> {
    try {
      const token = await getAuthToken();
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('GroupChatService error:', error);
      throw error;
    }
  }

  /**
   * Create a new group chat
   */
  async createGroupChat(request: CreateGroupChatRequest): Promise<GroupChatResponse> {
    return this.makeRequest('/', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get user's group chats
   */
  async getUserGroupChats(options: GroupSearchOptions = {}): Promise<GroupChatResponse> {
    const params = new URLSearchParams();
    
    if (options.type) params.append('type', options.type);
    if (options.search) params.append('search', options.search);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.includeArchived) params.append('includeArchived', 'true');

    const queryString = params.toString();
    const endpoint = queryString ? `/my-chats?${queryString}` : '/my-chats';

    return this.makeRequest(endpoint);
  }

  /**
   * Join a group chat
   */
  async joinGroup(request: JoinGroupRequest): Promise<GroupChatResponse> {
    return this.makeRequest('/join', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Leave a group chat
   */
  async leaveGroup(groupChatId: string): Promise<GroupChatResponse> {
    return this.makeRequest(`/${groupChatId}/leave`, {
      method: 'POST',
    });
  }

  /**
   * Send message to group chat
   */
  async sendMessage(groupChatId: string, request: SendMessageRequest): Promise<GroupChatResponse> {
    return this.makeRequest(`/${groupChatId}/messages`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get group chat messages
   */
  async getGroupMessages(groupChatId: string, options: MessageSearchOptions = {}): Promise<GroupChatResponse> {
    const params = new URLSearchParams();
    
    if (options.search) params.append('search', options.search);
    if (options.type) params.append('type', options.type);
    if (options.senderId) params.append('senderId', options.senderId);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.beforeDate) params.append('beforeDate', options.beforeDate);
    if (options.afterDate) params.append('afterDate', options.afterDate);
    if (options.onlyPinned) params.append('onlyPinned', 'true');

    const queryString = params.toString();
    const endpoint = queryString 
      ? `/${groupChatId}/messages?${queryString}` 
      : `/${groupChatId}/messages`;

    return this.makeRequest(endpoint);
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(groupChatId: string, messageId?: string): Promise<GroupChatResponse> {
    const body = messageId ? JSON.stringify({ messageId }) : JSON.stringify({});
    
    return this.makeRequest(`/${groupChatId}/read`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Add reaction to message
   */
  async addReaction(messageId: string, emoji: string): Promise<GroupChatResponse> {
    return this.makeRequest(`/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  /**
   * Remove reaction from message
   */
  async removeReaction(messageId: string, emoji: string): Promise<GroupChatResponse> {
    return this.makeRequest(`/messages/${messageId}/reactions`, {
      method: 'DELETE',
      body: JSON.stringify({ emoji }),
    });
  }

  /**
   * Toggle message pin status
   */
  async toggleMessagePin(messageId: string): Promise<GroupChatResponse> {
    return this.makeRequest(`/messages/${messageId}/pin`, {
      method: 'POST',
    });
  }

  /**
   * Update participant role or status
   */
  async updateParticipant(
    groupChatId: string, 
    participantId: string, 
    updates: {
      role?: 'admin' | 'moderator' | 'member';
      status?: 'active' | 'muted' | 'blocked' | 'left' | 'removed';
      nickname?: string;
      permissions?: any;
    }
  ): Promise<GroupChatResponse> {
    return this.makeRequest(`/${groupChatId}/participants/${participantId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Get group chat details
   */
  async getGroupChatDetails(groupChatId: string): Promise<GroupChatResponse> {
    return this.makeRequest(`/${groupChatId}`);
  }

  /**
   * Get group chat participants
   */
  async getGroupParticipants(groupChatId: string): Promise<GroupChatResponse> {
    return this.makeRequest(`/${groupChatId}/participants`);
  }

  /**
   * Search public groups
   */
  async searchPublicGroups(query: string, type?: string): Promise<GroupChatResponse> {
    const params = new URLSearchParams();
    params.append('search', query);
    if (type) params.append('type', type);

    return this.makeRequest(`/public?${params.toString()}`);
  }

  /**
   * Generate invite link for group
   */
  async generateInviteLink(groupChatId: string): Promise<GroupChatResponse> {
    return this.makeRequest(`/${groupChatId}/invite`, {
      method: 'POST',
    });
  }

  /**
   * Update group chat settings
   */
  async updateGroupSettings(
    groupChatId: string, 
    settings: {
      name?: string;
      description?: string;
      avatarUrl?: string;
      maxParticipants?: number;
      isPublic?: boolean;
      settings?: any;
    }
  ): Promise<GroupChatResponse> {
    return this.makeRequest(`/${groupChatId}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  /**
   * Archive group chat
   */
  async archiveGroup(groupChatId: string): Promise<GroupChatResponse> {
    return this.makeRequest(`/${groupChatId}/archive`, {
      method: 'POST',
    });
  }

  /**
   * Delete group chat (admin only)
   */
  async deleteGroup(groupChatId: string): Promise<GroupChatResponse> {
    return this.makeRequest(`/${groupChatId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Report message or group
   */
  async reportContent(
    groupChatId: string,
    messageId: string | null,
    reason: string,
    description?: string
  ): Promise<GroupChatResponse> {
    return this.makeRequest(`/${groupChatId}/report`, {
      method: 'POST',
      body: JSON.stringify({
        messageId,
        reason,
        description,
      }),
    });
  }

  /**
   * Get message thread (replies)
   */
  async getMessageThread(messageId: string): Promise<GroupChatResponse> {
    return this.makeRequest(`/messages/${messageId}/thread`);
  }

  /**
   * Forward message to another group
   */
  async forwardMessage(
    messageId: string,
    targetGroupIds: string[]
  ): Promise<GroupChatResponse> {
    return this.makeRequest(`/messages/${messageId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ targetGroupIds }),
    });
  }

  /**
   * Edit message (if allowed)
   */
  async editMessage(messageId: string, newContent: string): Promise<GroupChatResponse> {
    return this.makeRequest(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content: newContent }),
    });
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId: string): Promise<GroupChatResponse> {
    return this.makeRequest(`/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Vote to keep group active after ride completion
   */
  async voteToKeepGroup(groupChatId: string, keepActive: boolean): Promise<GroupChatResponse> {
    return this.makeRequest(`/${groupChatId}/vote-keep-active`, {
      method: 'POST',
      body: JSON.stringify({ keepActive }),
    });
  }
}

export const GroupChatService = new GroupChatServiceClass();
export default GroupChatService;