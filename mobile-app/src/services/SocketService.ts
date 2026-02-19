/**
 * @fileoverview Socket.io service for real-time updates and messaging
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import io, { Socket } from 'socket.io-client';
import { store } from '../store';
import { LocationData } from './LocationService';
import { getApiConfig } from '../config/api';
import logger from './LoggingService';

const log = logger.createLogger('SocketService');

export interface MessageData {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  type: 'text' | 'location' | 'system';
  timestamp: string;
  rideId?: string;
  bookingId?: string;
}

export interface RideUpdate {
  rideId: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  driverLocation?: LocationData;
  estimatedArrival?: string;
  message?: string;
}

export interface BookingUpdate {
  bookingId: string;
  rideId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  passengerId: string;
  message?: string;
}

export interface TypingData {
  userId: string;
  conversationId: string;
  isTyping: boolean;
}

// Additional interfaces from other services for consolidation
export interface LocationUpdate {
  packageId?: number;
  rideId?: number | string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

export interface ChatMessage {
  packageId?: number;
  rideId?: number | string;
  message: string;
  type: 'text' | 'image' | 'location';
  sender: string;
  senderId: string;
  timestamp: string;
}

export interface StatusUpdate {
  packageId?: number;
  rideId?: number | string;
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
  data?: Record<string, unknown>;
  timestamp: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketEventCallback = (...args: any[]) => void;

class SocketService {
  private static instance: SocketService | null = null;
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<SocketEventCallback>> = new Map();

  private constructor() {
    this.setupEventListeners();
  }

  /**
   * Get singleton instance of SocketService
   */
  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Connect to the Socket.io server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const state = store.getState();
        const token = state.auth.accessToken;
        
        if (!token) {
          reject(new Error('No authentication token available'));
          return;
        }

        // Get proper API configuration
        const config = getApiConfig();
        const socketUrl = config.socketUrl || config.apiUrl.replace('/api', '');
        
        log.info('Connecting to Socket.io server', { socketUrl });
        
        this.socket = io(socketUrl, {
          auth: {
            token,
          },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          forceNew: false,
          upgrade: true,
        });

        this.socket.on('connect', () => {
          log.info('Socket connected', { socketId: this.socket?.id });
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Join user room for personal notifications
          const userId = state.user.profile?.id;
          if (userId) {
            this.socket?.emit('join_user_room', { userId });
          }
          
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          log.info('Socket disconnected', { reason });
          this.isConnected = false;

          // Only attempt reconnection for certain disconnect reasons
          if (reason === 'io client disconnect' || reason === 'io server disconnect') {
            // Intentional disconnect, don't reconnect
            log.info('Intentional disconnect, not attempting reconnection');
          } else {
            // Network or server issues, attempt reconnection
            this.handleReconnection();
          }
        });

        this.socket.on('connect_error', (error) => {
          log.error('Socket connection error', error);
          this.isConnected = false;
          reject(error);
        });

        this.setupSocketEventHandlers();
      } catch (error) {
        log.error('Error connecting to socket', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the Socket.io server
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.eventListeners.clear();
  }

  /**
   * Check if socket is connected
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Join a ride room for real-time updates
   */
  joinRide(rideId: string): void {
    if (this.isSocketConnected()) {
      this.socket?.emit('join_ride', { rideId });
      log.info('Joined ride', { rideId });
    }
  }

  /**
   * Leave a ride room
   */
  leaveRide(rideId: string): void {
    if (this.isSocketConnected()) {
      this.socket?.emit('leave_ride', { rideId });
      log.info('Left ride', { rideId });
    }
  }

  /**
   * Send a message
   */
  sendMessage(rideId: string, message: string, type: 'text' | 'location' | 'system' = 'text'): void {
    if (this.isSocketConnected()) {
      const state = store.getState();
      const userId = state.user.profile?.id;
      
      if (userId) {
        this.socket?.emit('send_message', {
          rideId,
          message,
          type,
          senderId: userId,
          timestamp: new Date(),
        });
      }
    } else {
      log.error('Cannot send message: Socket not connected');
    }
  }

  /**
   * Send typing indicator
   */
  sendTyping(rideId: string, isTyping: boolean): void {
    if (this.isSocketConnected()) {
      if (isTyping) {
        this.socket?.emit('typing_start', { rideId });
      } else {
        this.socket?.emit('typing_stop', { rideId });
      }
    }
  }

  /**
   * Share location with ride participants (for drivers)
   */
  updateDriverLocation(rideId: string, location: LocationData): void {
    if (this.isSocketConnected()) {
      this.socket?.emit('driver_location_update', {
        rideId,
        latitude: location.latitude,
        longitude: location.longitude,
        heading: location.heading,
        speed: location.speed,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Update ride status
   */
  updateRideStatus(rideId: string, status: RideUpdate['status']): void {
    if (this.isSocketConnected()) {
      const state = store.getState();
      const userId = state.user.profile?.id;
      
      if (userId) {
        this.socket?.emit('ride_status_update', {
          rideId,
          status,
          driverId: userId,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Update booking status
   */
  updateBookingStatus(bookingId: string, rideId: string, status: BookingUpdate['status']): void {
    if (this.isSocketConnected()) {
      const state = store.getState();
      const userId = state.user.profile?.id;
      
      if (userId) {
        this.socket?.emit('booking_status_update', {
          bookingId,
          rideId,
          status,
          passengerId: userId,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Additional methods for package/courier functionality
   */
  
  // Package tracking methods
  joinPackage(packageId: string): void {
    if (this.isSocketConnected()) {
      this.socket?.emit('join_package', { packageId });
      log.info(`Joined package tracking: ${packageId}`);
    }
  }
  
  leavePackage(packageId: string): void {
    if (this.isSocketConnected()) {
      this.socket?.emit('leave_package', { packageId });
      log.info(`Left package tracking: ${packageId}`);
    }
  }
  
  updatePackageLocation(packageId: string, location: LocationData): void {
    if (this.isSocketConnected()) {
      this.socket?.emit('package_location_update', {
        packageId,
        latitude: location.latitude,
        longitude: location.longitude,
        heading: location.heading,
        speed: location.speed,
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  updatePackageStatus(packageId: string, status: string): void {
    if (this.isSocketConnected()) {
      const state = store.getState();
      const userId = state.user.profile?.id;
      
      if (userId) {
        this.socket?.emit('package_status_update', {
          packageId,
          status,
          courierId: userId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
  
  // General notification methods
  sendNotification(notification: NotificationData): void {
    if (this.isSocketConnected()) {
      this.socket?.emit('send_notification', notification);
    }
  }
  
  // Admin/Broadcasting methods
  broadcastToRoom(room: string, event: string, data: unknown): void {
    if (this.isSocketConnected()) {
      this.socket?.emit('broadcast_to_room', { room, event, data });
    }
  }

  /**
   * Subscribe to an event
   */
  on(event: string, callback: SocketEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)?.add(callback);
    this.socket?.on(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback?: SocketEventCallback): void {
    if (callback) {
      this.eventListeners.get(event)?.delete(callback);
      this.socket?.off(event, callback);
    } else {
      this.eventListeners.delete(event);
      this.socket?.off(event);
    }
  }

  /**
   * Emit a custom event
   */
  emit(event: string, data: unknown): void {
    if (this.isSocketConnected()) {
      this.socket?.emit(event, data);
    }
  }

  /**
   * Setup socket event handlers
   */
  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connected', (data: unknown) => {
      log.info('Socket connection confirmed:', data);
      this.notifyListeners('connected', data);
    });

    this.socket.on('joined_ride', (data: unknown) => {
      log.info('Joined ride:', data);
      this.notifyListeners('joined_ride', data);
    });

    this.socket.on('left_ride', (data: unknown) => {
      log.info('Left ride:', data);
      this.notifyListeners('left_ride', data);
    });

    // Message events
    this.socket.on('new_message', (message: MessageData) => {
      log.info('New message received:', message);
      this.notifyListeners('new_message', message);
    });

    // Typing indicators
    this.socket.on('user_typing', (data: unknown) => {
      this.notifyListeners('user_typing', data);
    });

    // Location updates
    this.socket.on('driver_location', (data: unknown) => {
      log.info('Driver location update:', data);
      this.notifyListeners('driver_location', data);
    });

    // Status updates
    this.socket.on('ride_status_update', (data: unknown) => {
      log.info('Ride status update:', data);
      this.notifyListeners('ride_status_update', data);
    });

    this.socket.on('booking_status_update', (data: unknown) => {
      log.info('Booking status update:', data);
      this.notifyListeners('booking_status_update', data);
    });

    // User events
    this.socket.on('user_joined_ride', (data: unknown) => {
      log.info('User joined ride:', data);
      this.notifyListeners('user_joined_ride', data);
    });

    this.socket.on('user_left_ride', (data: unknown) => {
      log.info('User left ride:', data);
      this.notifyListeners('user_left_ride', data);
    });

    this.socket.on('online_users', (data: unknown) => {
      log.info('Online users:', data);
      this.notifyListeners('online_users', data);
    });

    // System events
    this.socket.on('notification', (notification: NotificationData) => {
      log.info('Notification received:', notification);
      this.notifyListeners('notification', notification);
    });

    // Error handling
    this.socket.on('error', (error: unknown) => {
      log.error('Socket error:', error);
      this.notifyListeners('socket_error', error);
    });
  }

  /**
   * Setup general event listeners for reconnection
   */
  private setupEventListeners(): void {
    // Listen to Redux state changes for authentication
    store.subscribe(() => {
      const state = store.getState();
      const isAuthenticated = state.auth.isAuthenticated;
      
      if (!isAuthenticated && this.isConnected) {
        log.info('User logged out, disconnecting socket');
        this.disconnect();
      } else if (isAuthenticated && !this.isConnected) {
        log.info('User logged in, connecting socket');
        this.connect().catch((err) => log.error('Socket connection error', err));
      }
    });
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.info('Max reconnection attempts reached');
      return;
    }

    // Clear any existing reconnection timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = Math.min(2000 * this.reconnectAttempts, 10000); // Start with 2s, max 10s
    
    log.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      const state = store.getState();
      if (state.auth.isAuthenticated && !this.isSocketConnected()) {
        log.info('Reconnecting to socket...');
        this.connect().catch((error) => {
          log.error('Reconnection failed:', error);
          // Only retry if we haven't hit max attempts
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.handleReconnection();
          }
        });
      }
    }, delay);
  }

  /**
   * Notify all listeners for a specific event
   */
  private notifyListeners(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          log.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    socketId?: string;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Export the SocketService class, not an instance
export default SocketService;