/**
 * @fileoverview Notifications API service for fetching and managing in-app notifications
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import BaseApiService from './baseApi';
import type { ApiResponse } from './baseApi';

export interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}

export interface GetNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

class NotificationsApiService extends BaseApiService {
  async getNotifications(
    params: GetNotificationsParams = {}
  ): Promise<ApiResponse<{ notifications: NotificationRecord[]; pagination: NotificationsPagination }>> {
    return this.get('/notifications', { params });
  }

  async markAsRead(notificationIds: string[]): Promise<ApiResponse<{ count: number }>> {
    return this.put('/notifications/read', { notificationIds });
  }

  async markAllAsRead(): Promise<ApiResponse<void>> {
    return this.put('/notifications/read', { markAll: true });
  }

  async deleteNotification(id: string): Promise<ApiResponse<void>> {
    return this.delete(`/notifications/${id}`);
  }

  async registerPushToken(token: string, platform: 'ios' | 'android'): Promise<ApiResponse<void>> {
    return this.post('/notifications/push-token', { token, platform });
  }
}

export const notificationsApi = new NotificationsApiService();
export default notificationsApi;
