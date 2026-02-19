/**
 * @fileoverview Push notifications hook for handling FCM notifications
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  receivedAt: Date;
  read: boolean;
}

export interface UsePushNotificationsReturn {
  token: string | null;
  notifications: PushNotification[];
  hasPermission: boolean;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  markAsRead: (notificationId: string) => void;
  clearAll: () => void;
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const [token, setToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          const permitted = granted === PermissionsAndroid.RESULTS.GRANTED;
          setHasPermission(permitted);
          return permitted;
        }
        setHasPermission(true);
        return true;
      }

      // iOS permission handling would go here
      setHasPermission(true);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to request notification permission');
      return false;
    }
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        await requestPermission();

        // Generate a mock token for development
        setToken('mock_fcm_token_' + Date.now());
      } catch (err: any) {
        setError(err.message || 'Failed to initialize push notifications');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [requestPermission]);

  return {
    token,
    notifications,
    hasPermission,
    isLoading,
    error,
    requestPermission,
    markAsRead,
    clearAll,
  };
};

export default usePushNotifications;
