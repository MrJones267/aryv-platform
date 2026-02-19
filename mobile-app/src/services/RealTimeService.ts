/**
 * @fileoverview Real-time service using Socket.io for live features
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import logger from './LoggingService';

const log = logger.createLogger('RealTimeService');

// Types
export interface LocationUpdate {
  userId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp?: string;
}

export interface RideUpdate {
  rideId: string;
  status: 'pending' | 'confirmed' | 'driver_assigned' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled';
  location?: { lat: number; lng: number };
  message?: string;
  estimatedArrival?: string;
  driverInfo?: {
    name: string;
    vehicle: string;
    rating: number;
  };
}

export interface NotificationData {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

export interface PackageUpdate {
  trackingNumber: string;
  status: string;
  location: { lat: number; lng: number };
  message: string;
  timestamp: string;
}

export interface DriverAssignedInfo {
  driverId: string;
  driverName: string;
  driverPhoto?: string;
  vehicleInfo?: {
    make: string;
    model: string;
    color: string;
    plateNumber: string;
  };
  rating?: number;
  estimatedArrival?: string;
}

export interface ChatMessage {
  messageId: string;
  rideId: string;
  senderId: string;
  senderName?: string;
  message: string;
  timestamp: string;
}

// Event callbacks
export interface RealTimeEvents {
  onLocationUpdate?: (location: LocationUpdate) => void;
  onRideUpdate?: (ride: RideUpdate) => void;
  onNotification?: (notification: NotificationData) => void;
  onPackageUpdate?: (update: PackageUpdate) => void;
  onDriverAssigned?: (driverInfo: DriverAssignedInfo) => void;
  onRideStatusChange?: (status: string) => void;
  onChatMessage?: (message: ChatMessage) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
}

export class RealTimeService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private events: RealTimeEvents = {};
  private currentUserId: string | null = null;

  // Get server URL based on platform
  private getServerUrl(): string {
    if (__DEV__) {
      return Platform.OS === 'android' 
        ? 'https://api.aryv-app.com'  // Production ARYV API server
        : 'https://api.aryv-app.com';  // Production ARYV API server
    }
    return 'https://api.aryv-app.com'; // Production ARYV API server
  }

  /**
   * Initialize and connect to Socket.io server
   */
  async connect(userId: string, events: RealTimeEvents = {}): Promise<boolean> {
    try {
      if (this.socket?.connected) {
        log.info('Already connected to real-time server');
        return true;
      }

      this.currentUserId = userId;
      this.events = events;

      const token = await AsyncStorage.getItem('accessToken');
      const serverUrl = this.getServerUrl();

      log.info('Connecting to real-time server', { serverUrl });

      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 2000,
        auth: {
          userId,
          token,
        },
      });

      this.setupEventListeners();

      return new Promise((resolve) => {
        this.socket?.on('connect', () => {
          log.info('Connected to real-time server', { socketId: this.socket?.id });
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.authenticate(userId, token || '');
          this.events.onConnected?.();
          resolve(true);
        });

        this.socket?.on('connect_error', (error) => {
          log.error('Real-time connection error', error);
          this.events.onError?.(error.message);
          resolve(false);
        });

        // Timeout fallback
        setTimeout(() => resolve(false), 12000);
      });
    } catch (error) {
      log.error('❌ Failed to connect to real-time server:', error);
      this.events.onError?.('Failed to connect to real-time server');
      return false;
    }
  }

  /**
   * Disconnect from Socket.io server
   */
  disconnect(): void {
    if (this.socket) {
      log.info('🔌 Disconnecting from real-time server');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.events.onDisconnected?.();
    }
  }

  /**
   * Check if connected to server
   */
  isConnectedToServer(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Authenticate user with server
   */
  private authenticate(userId: string, token: string): void {
    if (!this.socket) return;

    this.socket.emit('authenticate', {
      userId,
      token,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Join a ride room for real-time updates
   */
  joinRide(rideId: string): void {
    if (!this.socket) return;

    log.info(`🎯 Joining ride room: ${rideId}`);
    this.socket.emit('join_ride', { rideId });
  }

  /**
   * Leave a ride room
   */
  leaveRide(rideId: string): void {
    if (!this.socket) return;

    log.info(`🚪 Leaving ride room: ${rideId}`);
    this.socket.emit('leave_ride', { rideId });
  }

  /**
   * Send location update to server
   */
  sendLocationUpdate(location: LocationUpdate): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('location_update', {
      ...location,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send ride status update
   */
  sendRideUpdate(update: RideUpdate): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('ride_update', {
      ...update,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send chat message
   */
  sendChatMessage(rideId: string, message: string): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('send_message', {
      rideId,
      userId: this.currentUserId,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send notification
   */
  sendNotification(notification: NotificationData): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('send_notification', {
      ...notification,
      userId: this.currentUserId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Setup all Socket.io event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('disconnect', (reason) => {
      log.info(`🔌 Disconnected from real-time server: ${reason}`);
      this.isConnected = false;
      this.events.onDisconnected?.();
    });

    this.socket.on('reconnect', (attemptNumber) => {
      log.info(`🔄 Reconnected to real-time server (attempt ${attemptNumber})`);
      this.isConnected = true;
      this.events.onConnected?.();
    });

    this.socket.on('reconnect_error', (error) => {
      this.reconnectAttempts++;
      log.error(`❌ Reconnection error (${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error.message);
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.events.onError?.('Max reconnection attempts reached');
      }
    });

    // Authentication response
    this.socket.on('authenticated', (data) => {
      if (data.success) {
        log.info('🔐 Successfully authenticated with real-time server');
        log.info(`👥 Connected users: ${data.connectedUsers}`);
      } else {
        log.error('❌ Authentication failed:', data.message);
        this.events.onError?.('Authentication failed');
      }
    });

    // Real-time data events
    this.socket.on('live_location', (data) => {
      if (this.events.onLocationUpdate && data.data) {
        this.events.onLocationUpdate(data.data);
      }
    });

    this.socket.on('ride_status_update', (data) => {
      if (this.events.onRideUpdate && data.data) {
        this.events.onRideUpdate(data.data);
      }
      if (this.events.onRideStatusChange && data.data?.status) {
        this.events.onRideStatusChange(data.data.status);
      }
    });

    this.socket.on('notification', (data) => {
      log.info('🔔 Received notification:', data.title);
      if (this.events.onNotification) {
        this.events.onNotification(data);
      }
    });

    this.socket.on('package_update', (data) => {
      if (this.events.onPackageUpdate && data.data) {
        this.events.onPackageUpdate(data.data);
      }
    });

    this.socket.on('driver_assigned', (data) => {
      log.info('🚗 Driver assigned:', data.driverName);
      if (this.events.onDriverAssigned) {
        this.events.onDriverAssigned(data);
      }
    });

    this.socket.on('chat_message', (data) => {
      if (this.events.onChatMessage) {
        this.events.onChatMessage(data);
      }
    });

    // Room events
    this.socket.on('joined_ride', (data) => {
      log.info(`🎯 Successfully joined ride: ${data.rideId}`);
    });

    this.socket.on('left_ride', (data) => {
      log.info(`🚪 Left ride: ${data.rideId}`);
    });

    // Error handling
    this.socket.on('error', (error) => {
      log.error('❌ Socket error:', error);
      this.events.onError?.(error.message || 'Socket error occurred');
    });
  }

  /**
   * Update event callbacks
   */
  updateEvents(events: Partial<RealTimeEvents>): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Get current connection status
   */
  getConnectionInfo(): {
    connected: boolean;
    socketId?: string;
    reconnectAttempts: number;
    userId?: string;
  } {
    return {
      connected: this.isConnectedToServer(),
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
      userId: this.currentUserId || undefined,
    };
  }
}

// Export singleton instance
export const realTimeService = new RealTimeService();
export default realTimeService;