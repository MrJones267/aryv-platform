/**
 * @fileoverview Notification controller for managing user notifications and push tokens
 * @author Oabona-Majoko
 * @created 2026-03-27
 * @lastModified 2026-03-27
 */

import { Response } from 'express';
import { Op } from 'sequelize';
import Notification from '../models/Notification';
import User from '../models/User';
import { AuthenticatedRequest } from '../types';
import logger, { getErrorMessage, getErrorStack } from '../utils/logger';

export class NotificationController {
  async getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const page = parseInt(req.query['page'] as string) || 1;
      const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);
      const unreadOnly = req.query['unreadOnly'] === 'true';
      const offset = (page - 1) * limit;

      const where: any = { userId };
      if (unreadOnly) {
        where.readAt = { [Op.is]: null };
      }

      const [{ count, rows }, unreadCount] = await Promise.all([
        (Notification as any).findAndCountAll({
          where,
          order: [['createdAt', 'DESC']],
          limit,
          offset,
        }),
        unreadOnly
          ? Promise.resolve(null) // already filtered — count === unread total
          : (Notification as any).count({ where: { userId, readAt: { [Op.is]: null } } }),
      ]);

      res.json({
        success: true,
        data: {
          notifications: rows,
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
            unreadCount: unreadOnly ? count : unreadCount,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getNotifications', { error: getErrorMessage(error), stack: getErrorStack(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to get notifications', code: 'GET_NOTIFICATIONS_FAILED', timestamp: new Date().toISOString() });
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const { notificationIds, markAll } = req.body;

      if (markAll) {
        await (Notification as any).update(
          { readAt: new Date() },
          { where: { userId, readAt: { [Op.is]: null } } }
        );
        res.json({ success: true, message: 'All notifications marked as read', timestamp: new Date().toISOString() });
        return;
      }

      if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
        res.status(400).json({ success: false, error: 'notificationIds array required', code: 'INVALID_INPUT', timestamp: new Date().toISOString() });
        return;
      }

      await (Notification as any).update(
        { readAt: new Date() },
        { where: { id: { [Op.in]: notificationIds }, userId, readAt: { [Op.is]: null } } }
      );

      res.json({ success: true, message: 'Notifications marked as read', data: { count: notificationIds.length }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in markAsRead', { error: getErrorMessage(error), stack: getErrorStack(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to mark notifications as read', code: 'MARK_READ_FAILED', timestamp: new Date().toISOString() });
    }
  }

  async registerPushToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const { token, platform } = req.body;

      if (!token) {
        res.status(400).json({ success: false, error: 'Push token is required', code: 'MISSING_TOKEN', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      // Store FCM token in user preferences JSONB
      const currentPreferences = (user.preferences as Record<string, any>) || {};
      await user.update({
        preferences: {
          ...currentPreferences,
          pushToken: token,
          pushPlatform: platform || 'unknown',
          pushTokenUpdatedAt: new Date().toISOString(),
        },
      });

      logger.info('Push token registered', { userId, platform });

      res.json({
        success: true,
        message: 'Push token registered successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in registerPushToken', { error: getErrorMessage(error), stack: getErrorStack(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to register push token', code: 'REGISTER_TOKEN_FAILED', timestamp: new Date().toISOString() });
    }
  }

  async getNotificationSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const preferences = (user.preferences as Record<string, any>) || {};
      const notificationSettings = preferences['notifications'] || {
        push: true,
        email: true,
        sms: false,
        rideUpdates: true,
        bookingUpdates: true,
        promotions: false,
        systemAlerts: true,
      };

      res.json({
        success: true,
        data: { settings: notificationSettings },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getNotificationSettings', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to get notification settings', code: 'GET_SETTINGS_FAILED', timestamp: new Date().toISOString() });
    }
  }

  async updateNotificationSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const currentPreferences = (user.preferences as Record<string, any>) || {};
      const currentSettings = currentPreferences['notifications'] || {};

      await user.update({
        preferences: {
          ...currentPreferences,
          notifications: { ...currentSettings, ...req.body },
        },
      });

      res.json({
        success: true,
        message: 'Notification settings updated',
        data: { settings: { ...currentSettings, ...req.body } },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in updateNotificationSettings', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to update notification settings', code: 'UPDATE_SETTINGS_FAILED', timestamp: new Date().toISOString() });
    }
  }

  async deleteNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const deleted = await (Notification as any).destroy({ where: { id, userId } });
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Notification not found', code: 'NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      res.json({ success: true, message: 'Notification deleted', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in deleteNotification', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to delete notification', code: 'DELETE_FAILED', timestamp: new Date().toISOString() });
    }
  }
}

export default NotificationController;
