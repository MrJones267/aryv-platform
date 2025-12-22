/**
 * @fileoverview React hook for Socket.io integration
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import SocketService from '../services/SocketService';
import { RootState } from '../store';
import { LocationData } from '../services/LocationService';

interface UseSocketOptions {
  autoConnect?: boolean;
  joinRooms?: string[];
}

interface SocketState {
  connected: boolean;
  error: string | null;
  reconnectAttempts: number;
}

/**
 * Hook for managing Socket.io connection and events
 */
export const useSocket = (options: UseSocketOptions = {}) => {
  const { autoConnect = true, joinRooms = [] } = options;
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const token = useSelector((state: RootState) => state.auth.accessToken);
  
  const [socketState, setSocketState] = useState<SocketState>({
    connected: false,
    error: null,
    reconnectAttempts: 0,
  });

  const joinedRoomsRef = useRef<Set<string>>(new Set());

  // Update socket state
  const updateSocketState = useCallback(() => {
    const status = SocketService.getInstance().getConnectionStatus();
    setSocketState({
      connected: status.connected,
      error: null,
      reconnectAttempts: status.reconnectAttempts,
    });
  }, []);

  // Connect to socket
  const connect = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setSocketState(prev => ({ ...prev, error: 'Not authenticated' }));
      return;
    }

    try {
      await SocketService.getInstance().connect();
      updateSocketState();
      
      // Join specified rooms
      joinRooms.forEach(room => {
        SocketService.getInstance().joinRide(room);
        joinedRoomsRef.current.add(room);
      });
    } catch (error: any) {
      setSocketState(prev => ({ 
        ...prev, 
        error: error.message || 'Connection failed',
        connected: false,
      }));
    }
  }, [isAuthenticated, token, joinRooms, updateSocketState]);

  // Disconnect from socket
  const disconnect = useCallback(() => {
    SocketService.getInstance().disconnect();
    joinedRoomsRef.current.clear();
    setSocketState({
      connected: false,
      error: null,
      reconnectAttempts: 0,
    });
  }, []);

  // Join a ride room
  const joinRide = useCallback((rideId: string) => {
    SocketService.getInstance().joinRide(rideId);
    joinedRoomsRef.current.add(rideId);
  }, []);

  // Leave a ride room
  const leaveRide = useCallback((rideId: string) => {
    SocketService.getInstance().leaveRide(rideId);
    joinedRoomsRef.current.delete(rideId);
  }, []);

  // Send message
  const sendMessage = useCallback((rideId: string, message: string, type: 'text' | 'location' | 'system' = 'text') => {
    SocketService.getInstance().sendMessage(rideId, message, type);
  }, []);

  // Send typing indicator
  const sendTyping = useCallback((rideId: string, isTyping: boolean) => {
    SocketService.getInstance().sendTyping(rideId, isTyping);
  }, []);

  // Update driver location
  const updateDriverLocation = useCallback((rideId: string, location: LocationData) => {
    SocketService.getInstance().updateDriverLocation(rideId, location);
  }, []);

  // Update ride status
  const updateRideStatus = useCallback((rideId: string, status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled') => {
    SocketService.getInstance().updateRideStatus(rideId, status);
  }, []);

  // Update booking status
  const updateBookingStatus = useCallback((bookingId: string, rideId: string, status: 'pending' | 'confirmed' | 'cancelled' | 'completed') => {
    SocketService.getInstance().updateBookingStatus(bookingId, rideId, status);
  }, []);

  // Generic emit function
  const emit = useCallback((event: string, data: any) => {
    SocketService.getInstance().emit(event, data);
  }, []);

  // Setup connection on mount and auth changes
  useEffect(() => {
    if (autoConnect && isAuthenticated && !socketState.connected) {
      connect();
    } else if (!isAuthenticated && socketState.connected) {
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      if (joinedRoomsRef.current.size > 0) {
        joinedRoomsRef.current.forEach(rideId => {
          SocketService.getInstance().leaveRide(rideId);
        });
        joinedRoomsRef.current.clear();
      }
    };
  }, [autoConnect, isAuthenticated, socketState.connected, connect, disconnect]);

  // Periodic status updates
  useEffect(() => {
    const interval = setInterval(updateSocketState, 1000);
    return () => clearInterval(interval);
  }, [updateSocketState]);

  return {
    // State
    connected: socketState.connected,
    error: socketState.error,
    reconnectAttempts: socketState.reconnectAttempts,
    
    // Actions
    connect,
    disconnect,
    joinRide,
    leaveRide,
    sendMessage,
    sendTyping,
    updateDriverLocation,
    updateRideStatus,
    updateBookingStatus,
    emit,
    
    // Socket service reference for advanced usage
    socketService: SocketService.getInstance(),
  };
};

/**
 * Hook for listening to specific socket events
 */
export const useSocketEvent = <T = any>(
  event: string,
  handler: (data: T) => void,
  deps: React.DependencyList = []
) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const eventHandler = (data: T) => {
      handlerRef.current(data);
    };

    SocketService.getInstance().on(event, eventHandler);

    return () => {
      SocketService.getInstance().off(event, eventHandler);
    };
  }, [event, ...deps]);
};

/**
 * Hook for managing chat messages in a ride
 */
export const useChatMessages = (rideId: string) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [typing, setTyping] = useState<string[]>([]);
  
  const { sendMessage, sendTyping } = useSocket();

  // Handle incoming messages
  useSocketEvent('new_message', (message: any) => {
    if (message.rideId === rideId) {
      setMessages(prev => [...prev, message]);
    }
  }, [rideId]);

  // Handle typing indicators
  useSocketEvent('user_typing', (data: any) => {
    setTyping(prev => {
      const filtered = prev.filter(userId => userId !== data.userId);
      return data.isTyping 
        ? [...filtered, data.userId]
        : filtered;
    });
  }, []);

  // Send message function
  const sendChatMessage = useCallback((message: string, type: 'text' | 'location' | 'system' = 'text') => {
    sendMessage(rideId, message, type);
  }, [sendMessage, rideId]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    sendTyping(rideId, isTyping);
  }, [sendTyping, rideId]);

  return {
    messages,
    typing,
    sendMessage: sendChatMessage,
    sendTyping: sendTypingIndicator,
  };
};

/**
 * Hook for ride real-time updates
 */
export const useRideUpdates = (rideId?: string) => {
  const [rideStatus, setRideStatus] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);

  // Handle ride status updates
  useSocketEvent('ride_status_update', (update: any) => {
    if (!rideId || update.rideId === rideId) {
      setRideStatus(update);
    }
  }, [rideId]);

  // Handle driver location updates
  useSocketEvent('driver_location', (data: any) => {
    if (!rideId || data.rideId === rideId) {
      setDriverLocation(data);
    }
  }, [rideId]);

  return {
    rideStatus,
    driverLocation,
  };
};

/**
 * Hook for booking real-time updates
 */
export const useBookingUpdates = (bookingId?: string) => {
  const [bookingStatus, setBookingStatus] = useState<any>(null);

  // Handle booking updates
  useSocketEvent('booking_status_update', (update: any) => {
    if (!bookingId || update.bookingId === bookingId) {
      setBookingStatus(update);
    }
  }, [bookingId]);

  return {
    bookingStatus,
  };
};