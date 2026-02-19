/**
 * @fileoverview React hook for managing push notifications
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import logger from '../services/LoggingService';

const log = logger.createLogger('useNotifications');
import { RootState } from '../store';
import NotificationService, { NotificationPayload } from '../services/NotificationService';

interface NotificationState {
  isInitialized: boolean;
  hasPermission: boolean;
  deviceToken: string | null;
  lastNotification: NotificationPayload | null;
  notificationCount: number;
}

export const useNotifications = () => {
  const [state, setState] = useState<NotificationState>({
    isInitialized: false,
    hasPermission: false,
    deviceToken: null,
    lastNotification: null,
    notificationCount: 0,
  });

  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  /**
   * Initialize notifications when user is authenticated
   */
  useEffect(() => {
    if (isAuthenticated && !state.isInitialized) {
      initializeNotifications();
    }
  }, [isAuthenticated, state.isInitialized]);

  /**
   * Setup notification listeners
   */
  useEffect(() => {
    const handleNotificationReceived = (notification: NotificationPayload) => {
      setState(prev => ({
        ...prev,
        lastNotification: notification,
        notificationCount: prev.notificationCount + 1,
      }));
    };

    const handleNotificationTapped = (notification: NotificationPayload) => {
      setState(prev => ({
        ...prev,
        lastNotification: notification,
      }));
    };

    NotificationService.addListener('notification_received', handleNotificationReceived);
    NotificationService.addListener('notification_tapped', handleNotificationTapped);

    return () => {
      NotificationService.removeListener('notification_received', handleNotificationReceived);
      NotificationService.removeListener('notification_tapped', handleNotificationTapped);
    };
  }, []);

  /**
   * Initialize notification service
   */
  const initializeNotifications = useCallback(async () => {
    try {
      const success = await NotificationService.initialize();
      
      setState(prev => ({
        ...prev,
        isInitialized: success,
        hasPermission: success,
        deviceToken: NotificationService.deviceToken,
      }));

      if (success) {
        log.info('Notifications initialized successfully');
      } else {
        log.warn('Failed to initialize notifications');
      }
    } catch (error) {
      log.error('Error initializing notifications:', error);
      setState(prev => ({
        ...prev,
        isInitialized: false,
        hasPermission: false,
      }));
    }
  }, []);

  /**
   * Send a test notification
   */
  const sendTestNotification = useCallback(async (type: NotificationPayload['type'] = 'system_alert') => {
    const testNotifications: Partial<Record<NotificationPayload['type'], NotificationPayload>> = {
      booking_update: {
        title: 'Ride Update',
        body: 'Your ride has been confirmed! Driver will arrive in 5 minutes.',
        type: 'booking_update',
        data: { bookingId: 'test_booking_123' },
        priority: 'high',
      },
      delivery_update: {
        title: 'Package Update',
        body: 'Your package is out for delivery and will arrive soon.',
        type: 'delivery_update',
        data: { deliveryId: 'test_delivery_456' },
        priority: 'high',
      },
      payment_received: {
        title: 'Payment Received',
        body: 'You earned $15.50 from your last delivery!',
        type: 'payment_received',
        data: { amount: 15.50, deliveryId: 'test_delivery_456' },
        priority: 'normal',
      },
      chat_message: {
        title: 'New Message',
        body: 'You have a new message from your driver.',
        type: 'chat_message',
        data: { chatId: 'test_chat_789', senderId: 'driver_123' },
        priority: 'normal',
      },
      system_alert: {
        title: 'Welcome to Hitch!',
        body: 'Notifications are now enabled. You\'ll receive updates about your rides and deliveries.',
        type: 'system_alert',
        priority: 'normal',
      },
    };

    const notification = testNotifications[type];
    if (notification) {
      await NotificationService.sendLocalNotification(notification);
    }
  }, []);

  /**
   * Update notification preferences
   */
  const updatePreferences = useCallback(async (preferences: {
    bookingUpdates: boolean;
    deliveryUpdates: boolean;
    paymentAlerts: boolean;
    chatMessages: boolean;
    marketingEmails: boolean;
  }) => {
    try {
      const success = await NotificationService.updateNotificationPreferences(preferences);
      return success;
    } catch (error) {
      log.error('Error updating notification preferences:', error);
      return false;
    }
  }, []);

  /**
   * Get current notification preferences
   */
  const getPreferences = useCallback(async () => {
    try {
      return await NotificationService.getNotificationPreferences();
    } catch (error) {
      log.error('Error getting notification preferences:', error);
      return {};
    }
  }, []);

  /**
   * Clear all notifications
   */
  const clearAllNotifications = useCallback(async () => {
    try {
      await NotificationService.clearAllNotifications();
      setState(prev => ({
        ...prev,
        notificationCount: 0,
        lastNotification: null,
      }));
    } catch (error) {
      log.error('Error clearing notifications:', error);
    }
  }, []);

  /**
   * Request notification permissions manually
   */
  const requestPermissions = useCallback(async () => {
    try {
      const success = await NotificationService.initialize();
      setState(prev => ({
        ...prev,
        hasPermission: success,
        isInitialized: success,
        deviceToken: NotificationService.deviceToken,
      }));
      return success;
    } catch (error) {
      log.error('Error requesting permissions:', error);
      return false;
    }
  }, []);

  /**
   * Get notification for specific type (for demo purposes)
   */
  const getNotificationForType = useCallback((type: NotificationPayload['type']) => {
    const notifications: Partial<Record<NotificationPayload['type'], NotificationPayload>> = {
      booking_update: {
        title: 'Ride Confirmed',
        body: 'Your driver John is on the way. ETA: 8 minutes.',
        type: 'booking_update',
        priority: 'high',
      },
      delivery_update: {
        title: 'Package Delivered',
        body: 'Your package has been delivered successfully!',
        type: 'delivery_update',
        priority: 'high',
      },
      payment_received: {
        title: 'Payment Processed',
        body: 'Your earnings have been transferred to your account.',
        type: 'payment_received',
        priority: 'normal',
      },
      chat_message: {
        title: 'New Message',
        body: 'You have an unread message.',
        type: 'chat_message',
        priority: 'normal',
      },
      system_alert: {
        title: 'System Update',
        body: 'New features are now available in the app!',
        type: 'system_alert',
        priority: 'low',
      },
    };

    return notifications[type];
  }, []);

  return {
    // State
    isInitialized: state.isInitialized,
    hasPermission: state.hasPermission,
    deviceToken: state.deviceToken,
    lastNotification: state.lastNotification,
    notificationCount: state.notificationCount,

    // Actions
    initializeNotifications,
    sendTestNotification,
    updatePreferences,
    getPreferences,
    clearAllNotifications,
    requestPermissions,
    getNotificationForType,

    // Service reference
    notificationService: NotificationService,
  };
};