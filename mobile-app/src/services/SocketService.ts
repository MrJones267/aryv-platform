/**
 * @fileoverview Socket.io service for real-time updates and messaging
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import io, { Socket } from 'socket.io-client';
import { store } from '../store';
import { LocationData } from './LocationService';

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

        // Connect to Socket.io server
        const socketUrl = `https://api.aryv-app.com`;
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
        });

        this.socket.on('connect', () => {
          console.log('Socket connected:', this.socket?.id);
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
          console.log('Socket disconnected:', reason);
          this.isConnected = false;
          
          // Only attempt reconnection for certain disconnect reasons
          if (reason === 'io client disconnect' || reason === 'io server disconnect') {
            // Intentional disconnect, don't reconnect
            console.log('Intentional disconnect, not attempting reconnection');
          } else {
            // Network or server issues, attempt reconnection
            this.handleReconnection();
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          this.isConnected = false;
          reject(error);
        });

        this.setupSocketEventHandlers();
      } catch (error) {
        console.error('Error connecting to socket:', error);
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
      console.log(`Joined ride: ${rideId}`);
    }
  }

  /**
   * Leave a ride room
   */
  leaveRide(rideId: string): void {
    if (this.isSocketConnected()) {
      this.socket?.emit('leave_ride', { rideId });
      console.log(`Left ride: ${rideId}`);
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
      console.error('Cannot send message: Socket not connected');
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
  emit(event: string, data: any): void {
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
    this.socket.on('connected', (data: any) => {
      console.log('Socket connection confirmed:', data);
      this.notifyListeners('connected', data);
    });

    this.socket.on('joined_ride', (data: any) => {
      console.log('Joined ride:', data);
      this.notifyListeners('joined_ride', data);
    });

    this.socket.on('left_ride', (data: any) => {
      console.log('Left ride:', data);
      this.notifyListeners('left_ride', data);
    });

    // Message events
    this.socket.on('new_message', (message: any) => {
      console.log('New message received:', message);
      this.notifyListeners('new_message', message);
    });

    // Typing indicators
    this.socket.on('user_typing', (data: any) => {
      this.notifyListeners('user_typing', data);
    });

    // Location updates
    this.socket.on('driver_location', (data: any) => {
      console.log('Driver location update:', data);
      this.notifyListeners('driver_location', data);
    });

    // Status updates
    this.socket.on('ride_status_update', (data: any) => {
      console.log('Ride status update:', data);
      this.notifyListeners('ride_status_update', data);
    });

    this.socket.on('booking_status_update', (data: any) => {
      console.log('Booking status update:', data);
      this.notifyListeners('booking_status_update', data);
    });

    // User events
    this.socket.on('user_joined_ride', (data: any) => {
      console.log('User joined ride:', data);
      this.notifyListeners('user_joined_ride', data);
    });

    this.socket.on('user_left_ride', (data: any) => {
      console.log('User left ride:', data);
      this.notifyListeners('user_left_ride', data);
    });

    this.socket.on('online_users', (data: any) => {
      console.log('Online users:', data);
      this.notifyListeners('online_users', data);
    });

    // System events
    this.socket.on('notification', (notification: any) => {
      console.log('Notification received:', notification);
      this.notifyListeners('notification', notification);
    });

    // Error handling
    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
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
        console.log('User logged out, disconnecting socket');
        this.disconnect();
      } else if (isAuthenticated && !this.isConnected) {
        console.log('User logged in, connecting socket');
        this.connect().catch(console.error);
      }
    });
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    // Clear any existing reconnection timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = Math.min(2000 * this.reconnectAttempts, 10000); // Start with 2s, max 10s
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      const state = store.getState();
      if (state.auth.isAuthenticated && !this.isSocketConnected()) {
        console.log('Reconnecting to socket...');
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
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
  private notifyListeners(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
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