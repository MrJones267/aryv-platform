/**
 * @fileoverview Chat API service for group chat and message history
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import BaseApiService from './baseApi';
import type { ApiResponse } from './baseApi';

export interface ChatMessageRecord {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'system' | 'location' | 'image';
  timestamp: string;
  isRead: boolean;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

export interface GroupChatSummary {
  id: string;
  name: string;
  type: 'ride' | 'booking' | 'courier' | 'support';
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  participantName?: string;
  rideId?: string;
  bookingId?: string;
  isOnline?: boolean;
  routeOrigin?: string;
  routeDestination?: string;
}

export interface GetMessagesParams {
  limit?: number;
  offset?: number;
  beforeDate?: string;
}

class ChatApiService extends BaseApiService {
  /**
   * Get messages for a group chat
   */
  async getGroupMessages(
    groupChatId: string,
    params: GetMessagesParams = {}
  ): Promise<ApiResponse<{ messages: ChatMessageRecord[]; total: number }>> {
    return this.get(`/group-chats/${groupChatId}/messages`, { params });
  }

  /**
   * Get the user's group chats (conversation list)
   */
  async getUserGroupChats(params: {
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
  } = {}): Promise<ApiResponse<{ groupChats: GroupChatSummary[]; total: number }>> {
    return this.get('/group-chats/my-chats', { params });
  }

  /**
   * Mark messages in a group chat as read
   */
  async markAsRead(groupChatId: string): Promise<ApiResponse<{ updatedCount: number }>> {
    return this.post(`/group-chats/${groupChatId}/read`, {});
  }
}

export const chatApi = new ChatApiService();
export default chatApi;
