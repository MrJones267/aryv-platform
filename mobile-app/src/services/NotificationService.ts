/**
 * @fileoverview Push notification service for real-time updates with FCM integration
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-09-07
 */

import { Platform, Alert, PermissionsAndroid, Linking } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { AuthService } from './AuthService';
import { ApiClient } from './ApiClient';

export interface NotificationPayload {
  id?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  type: 'ride_request' | 'ride_matched' | 'driver_arrived' | 'ride_started' | 'ride_completed' | 
        'booking_update' | 'delivery_update' | 'payment_received' | 'chat_message' | 'system_alert';
  priority?: 'high' | 'normal' | 'low';
  timestamp?: string;
  read?: boolean;
}

export interface PushNotificationToken {
  token: string;
  platform: 'ios' | 'android';
  deviceId: string;
}

class NotificationService {
  private apiClient: ApiClient;
  private authService: AuthService;
  private isInitialized = false;
  private notificationToken: string | null = null;
  private useFCM = false; // Flag to enable FCM or use mock
  private unsubscribeTokenRefresh: (() => void) | null = null;
  private unsubscribeForegroundMessages: (() => void) | null = null;

  constructor() {
    this.apiClient = new ApiClient();
    this.authService = new AuthService();
    // Enable FCM if Firebase is available and not in development
    this.useFCM = !__DEV__ && this.isFirebaseAvailable();
  }

  /**
   * Initialize push notification service
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) {
        return true;
      }

      console.log('Initializing NotificationService with FCM:', this.useFCM);

      // Request permissions
      const hasPermission = await this.requestNotificationPermissions();
      if (!hasPermission) {
        console.warn('Notification permissions denied');
        return false;
      }

      if (this.useFCM) {
        // Initialize FCM
        await this.initializeFCM();
      }

      // Get device token (FCM or mock)
      const token = await this.getDeviceToken();
      if (token) {
        this.notificationToken = token;
        await this.registerTokenWithBackend(token);
        this.setupNotificationHandlers();
        this.isInitialized = true;
        console.log('NotificationService initialized successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      return false;
    }
  }

  /**
   * Request notification permissions
   */
  private async requestNotificationPermissions(): Promise<boolean> {
    try {
      if (this.useFCM) {
        // Use FCM permission request
        const authStatus = await messaging().requestPermission();
        const granted = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                       authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        return granted;
      } else {
        // Use platform-specific permissions for mock
        if (Platform.OS === 'android') {
          if (Platform.Version >= 33) {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
          }
          return true; // Android < 13 doesn't need explicit permission
        } else {
          // iOS permission handling for mock
          return true;
        }
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Get device token for push notifications
   */
  private async getDeviceToken(): Promise<string | null> {
    try {
      if (this.useFCM) {
        // Get FCM token
        if (!messaging().isDeviceRegisteredForRemoteMessages) {
          await messaging().registerDeviceForRemoteMessages();
        }
        const token = await messaging().getToken();
        console.log('FCM token obtained:', token.substring(0, 20) + '...');
        return token;
      } else {
        // Mock implementation for development
        const mockToken = `mock_device_token_${Platform.OS}_${Date.now()}`;
        console.log('Mock device token generated:', mockToken);
        return mockToken;
      }
    } catch (error) {
      console.error('Error getting device token:', error);
      return null;
    }
  }

  /**
   * Register device token with backend
   */
  private async registerTokenWithBackend(token: string): Promise<boolean> {
    try {
      const authToken = await this.authService.getValidToken();
      if (!authToken) {
        throw new Error('No auth token available');
      }

      const deviceInfo: PushNotificationToken = {
        token,
        platform: Platform.OS as 'ios' | 'android',
        deviceId: await this.getDeviceId(),
      };

      const response = await this.apiClient.post('/notifications/register-token', deviceInfo, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.success;
    } catch (error) {
      console.error('Failed to register token with backend:', error);
      return false;
    }
  }

  /**
   * Initialize FCM-specific functionality
   */
  private async initializeFCM(): Promise<void> {
    try {
      // Handle background messages
      messaging().setBackgroundMessageHandler(async (remoteMessage) => {
        console.log('FCM background message:', remoteMessage);
        const notification = this.parseFirebaseMessage(remoteMessage);
        this.handleNotificationReceived(notification, false);
      });

      // Handle initial notification (when app opened from quit state)
      const initialNotification = await messaging().getInitialNotification();
      if (initialNotification) {
        console.log('FCM initial notification:', initialNotification);
        const notification = this.parseFirebaseMessage(initialNotification);
        this.handleNotificationTap(notification);
      }
    } catch (error) {
      console.error('Error initializing FCM:', error);
    }
  }

  /**
   * Setup notification event handlers
   */
  private setupNotificationHandlers(): void {
    if (this.useFCM) {
      // Setup FCM handlers
      this.unsubscribeForegroundMessages = messaging().onMessage(async (remoteMessage) => {
        console.log('FCM foreground message:', remoteMessage);
        const notification = this.parseFirebaseMessage(remoteMessage);
        this.handleNotificationReceived(notification, true);
      });

      // Handle notification opened app
      messaging().onNotificationOpenedApp((remoteMessage) => {
        console.log('FCM notification opened app:', remoteMessage);
        const notification = this.parseFirebaseMessage(remoteMessage);
        this.handleNotificationTap(notification);
      });

      // Handle token refresh
      this.unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
        console.log('FCM token refreshed:', token.substring(0, 20) + '...');
        this.notificationToken = token;
        await this.registerTokenWithBackend(token);
      });
    } else {
      // Mock notification handlers for development
      this.onForegroundNotification = (notification: NotificationPayload) => {
        console.log('Mock foreground notification received:', notification);
        this.handleNotificationReceived(notification, true);
      };

      this.onBackgroundNotification = (notification: NotificationPayload) => {
        console.log('Mock background notification received:', notification);
        this.handleNotificationReceived(notification, false);
      };

      this.onNotificationTap = (notification: NotificationPayload) => {
        console.log('Mock notification tapped:', notification);
        this.handleNotificationTap(notification);
      };
    }
  }

  /**
   * Handle received notifications
   */
  private handleNotificationReceived(notification: NotificationPayload, isForeground: boolean): void {
    try {
      if (isForeground) {
        // Show in-app notification for foreground
        this.showInAppNotification(notification);
      }

      // Update app badge count
      this.updateBadgeCount();

      // Trigger any registered callbacks
      this.notifyListeners('notification_received', notification);
    } catch (error) {
      console.error('Error handling notification:', error);
    }
  }

  /**
   * Handle notification taps
   */
  private handleNotificationTap(notification: NotificationPayload): void {
    try {
      const { type, data } = notification;

      // Navigate based on notification type
      switch (type) {
        case 'ride_request':
          this.navigateToRideRequest(data?.rideId);
          break;
        case 'ride_matched':
          this.navigateToActiveRide(data?.rideId);
          break;
        case 'driver_arrived':
          this.navigateToPickup(data?.rideId);
          break;
        case 'ride_started':
          this.navigateToTripTracking(data?.rideId);
          break;
        case 'ride_completed':
          this.navigateToTripSummary(data?.rideId);
          break;
        case 'booking_update':
          this.navigateToBooking(data?.bookingId);
          break;
        case 'delivery_update':
          this.navigateToDelivery(data?.deliveryId);
          break;
        case 'payment_received':
          this.navigateToPayments();
          break;
        case 'chat_message':
          this.navigateToChat(data?.chatId);
          break;
        default:
          console.log('Unknown notification type:', type);
      }

      this.notifyListeners('notification_tapped', notification);
    } catch (error) {
      console.error('Error handling notification tap:', error);
    }
  }

  /**
   * Show in-app notification for foreground messages
   */
  private showInAppNotification(notification: NotificationPayload): void {
    // Simple alert for demo - in production, use custom notification component
    Alert.alert(
      notification.title,
      notification.body,
      [
        {
          text: 'Dismiss',
          style: 'cancel',
        },
        {
          text: 'View',
          onPress: () => this.handleNotificationTap(notification),
        },
      ]
    );
  }

  /**
   * Send local notification (for testing)
   */
  async sendLocalNotification(notification: NotificationPayload): Promise<void> {
    try {
      // Mock local notification - in production, use appropriate library
      console.log('Sending local notification:', notification);
      
      setTimeout(() => {
        this.handleNotificationReceived(notification, true);
      }, 100);
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(preferences: {
    bookingUpdates: boolean;
    deliveryUpdates: boolean;
    paymentAlerts: boolean;
    chatMessages: boolean;
    marketingEmails: boolean;
  }): Promise<boolean> {
    try {
      const authToken = await this.authService.getValidToken();
      if (!authToken) {
        throw new Error('No auth token available');
      }

      const response = await this.apiClient.put('/notifications/preferences', preferences, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.success;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      return false;
    }
  }

  /**
   * Get current notification preferences
   */
  async getNotificationPreferences(): Promise<any> {
    try {
      const authToken = await this.authService.getValidToken();
      if (!authToken) {
        throw new Error('No auth token available');
      }

      const response = await this.apiClient.get('/notifications/preferences', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      return response.data || {};
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      return {};
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      // Clear badge count
      this.updateBadgeCount(0);

      // Clear notification center (mock implementation)
      console.log('Clearing all notifications');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  /**
   * Update app badge count
   */
  private updateBadgeCount(count?: number): void {
    try {
      // Mock badge update - in production, use appropriate library
      console.log('Updating badge count:', count || 'increment');
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  }

  /**
   * Parse Firebase remote message to NotificationPayload
   */
  private parseFirebaseMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): NotificationPayload {
    const { notification, data, messageId } = remoteMessage;
    
    return {
      id: messageId || `fcm_${Date.now()}`,
      title: notification?.title || 'Hitch Notification',
      body: notification?.body || 'You have a new notification',
      data: data || {},
      type: (data?.type as NotificationPayload['type']) || 'system_alert',
      priority: (data?.priority as NotificationPayload['priority']) || 'normal',
      timestamp: new Date().toISOString(),
      read: false,
    };
  }

  /**
   * Check if Firebase is available
   */
  private isFirebaseAvailable(): boolean {
    try {
      // Try to access Firebase messaging
      return messaging() !== null;
    } catch (error) {
      console.warn('Firebase is not available:', error);
      return false;
    }
  }

  /**
   * Subscribe to FCM topic
   */
  async subscribeToTopic(topic: string): Promise<boolean> {
    try {
      if (!this.useFCM) {
        console.log(`Mock subscribe to topic: ${topic}`);
        return true;
      }

      await messaging().subscribeToTopic(topic);
      console.log(`Subscribed to FCM topic: ${topic}`);
      return true;
    } catch (error) {
      console.error(`Failed to subscribe to topic ${topic}:`, error);
      return false;
    }
  }

  /**
   * Unsubscribe from FCM topic
   */
  async unsubscribeFromTopic(topic: string): Promise<boolean> {
    try {
      if (!this.useFCM) {
        console.log(`Mock unsubscribe from topic: ${topic}`);
        return true;
      }

      await messaging().unsubscribeFromTopic(topic);
      console.log(`Unsubscribed from FCM topic: ${topic}`);
      return true;
    } catch (error) {
      console.error(`Failed to unsubscribe from topic ${topic}:`, error);
      return false;
    }
  }

  /**
   * Get device ID
   */
  private async getDeviceId(): Promise<string> {
    // Mock device ID - in production, use react-native-device-info
    return `device_${Platform.OS}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Navigation helpers (these would integrate with your navigation system)
  private navigateToRideRequest(rideId?: string): void {
    console.log('Navigate to ride request:', rideId);
    // Implement navigation to ride request screen
  }

  private navigateToActiveRide(rideId?: string): void {
    console.log('Navigate to active ride:', rideId);
    // Implement navigation to active ride screen
  }

  private navigateToPickup(rideId?: string): void {
    console.log('Navigate to pickup:', rideId);
    // Implement navigation to pickup screen
  }

  private navigateToTripTracking(rideId?: string): void {
    console.log('Navigate to trip tracking:', rideId);
    // Implement navigation to trip tracking screen
  }

  private navigateToTripSummary(rideId?: string): void {
    console.log('Navigate to trip summary:', rideId);
    // Implement navigation to trip summary screen
  }

  private navigateToBooking(bookingId?: string): void {
    console.log('Navigate to booking:', bookingId);
    // Implement navigation to booking screen
  }

  private navigateToDelivery(deliveryId?: string): void {
    console.log('Navigate to delivery:', deliveryId);
    // Implement navigation to delivery screen
  }

  private navigateToPayments(): void {
    console.log('Navigate to payments');
    // Implement navigation to payments screen
  }

  private navigateToChat(chatId?: string): void {
    console.log('Navigate to chat:', chatId);
    // Implement navigation to chat screen
  }

  // Event listener system
  private listeners: Map<string, Function[]> = new Map();

  addListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  removeListener(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private notifyListeners(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in notification listener:', error);
        }
      });
    }
  }

  // Mock handler properties (these would be set by Firebase/APNS)
  private onForegroundNotification?: (notification: NotificationPayload) => void;
  private onBackgroundNotification?: (notification: NotificationPayload) => void;
  private onNotificationTap?: (notification: NotificationPayload) => void;

  /**
   * Get initialization status
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current device token
   */
  get deviceToken(): string | null {
    return this.notificationToken;
  }

  /**
   * Clean up and dispose of the service
   */
  dispose(): void {
    if (this.useFCM) {
      this.unsubscribeForegroundMessages?.();
      this.unsubscribeTokenRefresh?.();
    }
    this.listeners.clear();
    this.isInitialized = false;
    console.log('NotificationService disposed');
  }

  /**
   * Check if notifications are available
   */
  async hasPermission(): Promise<boolean> {
    try {
      if (this.useFCM) {
        const authStatus = await messaging().hasPermission();
        return authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
               authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      } else {
        return true; // Mock always has permission
      }
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return false;
    }
  }

  /**
   * Open device notification settings
   */
  async openNotificationSettings(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      console.error('Failed to open notification settings:', error);
    }
  }
}

export { NotificationService };
export default new NotificationService();