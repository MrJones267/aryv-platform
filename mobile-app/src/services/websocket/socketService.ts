/**
 * @fileoverview WebSocket service for real-time features
 * @author Oabona-Majoko
 * @created 2025-12-14
 * @lastModified 2025-12-14
 * 
 * @deprecated This service is deprecated. Use ../SocketService.ts instead for all real-time features.
 * 
 * MIGRATION: Replace calls to websocket/socketService with SocketService.getInstance()
 */

import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiConfig } from '../../config/api';
import logger from '../LoggingService';

const log = logger.createLogger('WebSocketService');

// Types
export interface LocationUpdate {
  packageId?: number;
  rideId?: number;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

export interface ChatMessage {
  packageId?: number;
  rideId?: number;
  message: string;
  type: 'text' | 'image' | 'location';
  sender: string;
  senderId: string;
  timestamp: string;
}

export interface StatusUpdate {
  packageId?: number;
  rideId?: number;
  status: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  timestamp: string;
}

export interface NotificationData {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  data?: unknown;
  timestamp: string;
}

class SocketService {
  private socket: Socket | null = null;
  private isAuthenticated = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Event listeners
  private locationListeners: Array<(data: LocationUpdate) => void> = [];
  private messageListeners: Array<(data: ChatMessage) => void> = [];
  private statusListeners: Array<(data: StatusUpdate) => void> = [];
  private notificationListeners: Array<(data: NotificationData) => void> = [];

  /**
   * Initialize WebSocket connection
   */
  async connect(): Promise<boolean> {
    try {
      const config = getApiConfig();
      const socketUrl = config.socketUrl || 'http://localhost:3001';
      
      log.info('🔌 Connecting to WebSocket:', socketUrl);

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
      });

      this.setupEventListeners();
      await this.authenticate();
      
      return true;
    } catch (error) {
      log.error('WebSocket connection failed:', error);
      return false;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      log.info('📡 Disconnecting WebSocket');
      this.socket.disconnect();
      this.socket = null;
      this.isAuthenticated = false;
    }
  }

  /**
   * Authenticate user for real-time features
   */
  private async authenticate(): Promise<void> {
    if (!this.socket) return;

    try {
      const token = await AsyncStorage.getItem('accessToken');
      const userId = await AsyncStorage.getItem('userId');

      if (token) {
        this.socket.emit('authenticate', { token, userId });
      }
    } catch (error) {
      log.error('WebSocket authentication failed:', error);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      log.info('✅ WebSocket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      log.info('📡 WebSocket disconnected:', reason);
      this.isAuthenticated = false;
    });

    this.socket.on('connect_error', (error) => {
      log.error('🔌 WebSocket connection error:', error);
      this.reconnectAttempts++;
    });

    this.socket.on('authenticated', (data) => {
      log.info('🔐 WebSocket authenticated:', data);
      this.isAuthenticated = true;
    });

    this.socket.on('authentication_error', (error) => {
      log.error('❌ WebSocket authentication failed:', error);
    });

    // Real-time event listeners
    this.socket.on('location_update', (data: LocationUpdate) => {
      this.locationListeners.forEach(listener => listener(data));
    });

    this.socket.on('new_message', (data: ChatMessage) => {
      this.messageListeners.forEach(listener => listener(data));
    });

    this.socket.on('status_update', (data: StatusUpdate) => {
      this.statusListeners.forEach(listener => listener(data));
    });

    this.socket.on('notification', (data: NotificationData) => {
      this.notificationListeners.forEach(listener => listener(data));
    });

    this.socket.on('package_status', (data) => {
      log.info('📦 Package status received:', data);
    });

    this.socket.on('passenger_joined', (data) => {
      log.info('👥 Passenger joined:', data);
    });
  }

  /**
   * Join ride tracking room
   */
  joinRide(rideId: number): void {
    if (this.socket && this.isAuthenticated) {
      this.socket.emit('join_ride', rideId);
      log.info(`🚗 Joined ride tracking: ${rideId}`);
    }
  }

  /**
   * Join package tracking room
   */
  joinPackage(packageId: number): void {
    if (this.socket && this.isAuthenticated) {
      this.socket.emit('join_package', packageId);
      log.info(`📦 Joined package tracking: ${packageId}`);
    }
  }

  /**
   * Send location update
   */
  sendLocationUpdate(data: Omit<LocationUpdate, 'timestamp'>): void {
    if (this.socket && this.isAuthenticated) {
      this.socket.emit('location_update', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send chat message
   */
  sendMessage(data: Omit<ChatMessage, 'sender' | 'senderId' | 'timestamp'>): void {
    if (this.socket && this.isAuthenticated) {
      this.socket.emit('send_message', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update package/ride status
   */
  updateStatus(data: Omit<StatusUpdate, 'timestamp'>): void {
    if (this.socket && this.isAuthenticated) {
      if (data.packageId) {
        this.socket.emit('update_package_status', {
          packageId: data.packageId,
          status: data.status,
          location: data.location
        });
      }
    }
  }

  /**
   * Event listener management
   */
  onLocationUpdate(listener: (data: LocationUpdate) => void): () => void {
    this.locationListeners.push(listener);
    return () => {
      this.locationListeners = this.locationListeners.filter(l => l !== listener);
    };
  }

  onMessage(listener: (data: ChatMessage) => void): () => void {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter(l => l !== listener);
    };
  }

  onStatusUpdate(listener: (data: StatusUpdate) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  onNotification(listener: (data: NotificationData) => void): () => void {
    this.notificationListeners.push(listener);
    return () => {
      this.notificationListeners = this.notificationListeners.filter(l => l !== listener);
    };
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Check authentication status
   */
  isAuth(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;