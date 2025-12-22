/**
 * @fileoverview React hook for managing real-time features with Socket.io
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import realTimeService, { 
  RealTimeEvents, 
  LocationUpdate, 
  RideUpdate, 
  NotificationData, 
  PackageUpdate 
} from '../services/RealTimeService';

interface UseRealTimeOptions {
  userId: string;
  autoConnect?: boolean;
  reconnectOnForeground?: boolean;
}

interface RealTimeState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  lastUpdate: Date | null;
}

export const useRealTime = (options: UseRealTimeOptions) => {
  const { userId, autoConnect = true, reconnectOnForeground = true } = options;
  
  const [state, setState] = useState<RealTimeState>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0,
    lastUpdate: null,
  });

  const [locationUpdates, setLocationUpdates] = useState<LocationUpdate[]>([]);
  const [rideUpdates, setRideUpdates] = useState<RideUpdate[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [packageUpdates, setPackageUpdates] = useState<PackageUpdate[]>([]);

  const currentRideId = useRef<string | null>(null);
  const appState = useRef(AppState.currentState);

  /**
   * Connect to real-time service
   */
  const connect = useCallback(async (): Promise<boolean> => {
    if (state.connecting || state.connected) {
      return state.connected;
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const events: RealTimeEvents = {
        onConnected: () => {
          console.log('🟢 Real-time service connected');
          setState(prev => ({
            ...prev,
            connected: true,
            connecting: false,
            error: null,
            reconnectAttempts: 0,
            lastUpdate: new Date(),
          }));
        },

        onDisconnected: () => {
          console.log('🔴 Real-time service disconnected');
          setState(prev => ({
            ...prev,
            connected: false,
            connecting: false,
            lastUpdate: new Date(),
          }));
        },

        onError: (error: string) => {
          console.error('❌ Real-time service error:', error);
          setState(prev => ({
            ...prev,
            error,
            connecting: false,
            reconnectAttempts: prev.reconnectAttempts + 1,
            lastUpdate: new Date(),
          }));
        },

        onLocationUpdate: (location: LocationUpdate) => {
          setLocationUpdates(prev => [...prev.slice(-49), location]);
          setState(prev => ({ ...prev, lastUpdate: new Date() }));
        },

        onRideUpdate: (ride: RideUpdate) => {
          setRideUpdates(prev => [...prev.slice(-49), ride]);
          setState(prev => ({ ...prev, lastUpdate: new Date() }));
        },

        onNotification: (notification: NotificationData) => {
          setNotifications(prev => [...prev.slice(-19), notification]);
          setState(prev => ({ ...prev, lastUpdate: new Date() }));
        },

        onPackageUpdate: (update: PackageUpdate) => {
          setPackageUpdates(prev => [...prev.slice(-49), update]);
          setState(prev => ({ ...prev, lastUpdate: new Date() }));
        },

        onDriverAssigned: (driverInfo) => {
          const notification: NotificationData = {
            type: 'driver_assigned',
            title: 'Driver Assigned',
            message: `${driverInfo.driverName} will be your driver`,
            data: driverInfo,
            timestamp: new Date().toISOString(),
          };
          setNotifications(prev => [...prev.slice(-19), notification]);
        },

        onRideStatusChange: (status: string) => {
          const notification: NotificationData = {
            type: 'ride_status',
            title: 'Ride Update',
            message: `Ride status changed to ${status}`,
            data: { status },
            timestamp: new Date().toISOString(),
          };
          setNotifications(prev => [...prev.slice(-19), notification]);
        },

        onChatMessage: (message) => {
          const notification: NotificationData = {
            type: 'chat',
            title: 'New Message',
            message: message.content || 'You have a new message',
            data: message,
            timestamp: new Date().toISOString(),
          };
          setNotifications(prev => [...prev.slice(-19), notification]);
        },
      };

      const success = await realTimeService.connect(userId, events);
      
      if (!success) {
        setState(prev => ({
          ...prev,
          connecting: false,
          error: 'Failed to connect to real-time service',
        }));
      }

      return success;
    } catch (error) {
      console.error('❌ Failed to connect to real-time service:', error);
      setState(prev => ({
        ...prev,
        connecting: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
      return false;
    }
  }, [userId, state.connecting, state.connected]);

  /**
   * Disconnect from real-time service
   */
  const disconnect = useCallback(() => {
    realTimeService.disconnect();
    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      lastUpdate: new Date(),
    }));
  }, []);

  /**
   * Join a ride room for real-time updates
   */
  const joinRide = useCallback((rideId: string) => {
    currentRideId.current = rideId;
    realTimeService.joinRide(rideId);
    console.log(`🎯 Joined ride room: ${rideId}`);
  }, []);

  /**
   * Leave current ride room
   */
  const leaveRide = useCallback(() => {
    if (currentRideId.current) {
      realTimeService.leaveRide(currentRideId.current);
      console.log(`🚪 Left ride room: ${currentRideId.current}`);
      currentRideId.current = null;
    }
  }, []);

  /**
   * Send location update
   */
  const sendLocation = useCallback((location: Omit<LocationUpdate, 'userId'>) => {
    if (state.connected) {
      realTimeService.sendLocationUpdate({
        userId,
        ...location,
      });
    }
  }, [userId, state.connected]);

  /**
   * Send ride status update
   */
  const sendRideUpdate = useCallback((update: RideUpdate) => {
    if (state.connected) {
      realTimeService.sendRideUpdate(update);
    }
  }, [state.connected]);

  /**
   * Send chat message
   */
  const sendMessage = useCallback((rideId: string, message: string) => {
    if (state.connected) {
      realTimeService.sendChatMessage(rideId, message);
    }
  }, [state.connected]);

  /**
   * Send notification
   */
  const sendNotification = useCallback((notification: Omit<NotificationData, 'timestamp'>) => {
    if (state.connected) {
      realTimeService.sendNotification({
        ...notification,
        timestamp: new Date().toISOString(),
      });
    }
  }, [state.connected]);

  /**
   * Clear old data
   */
  const clearData = useCallback(() => {
    setLocationUpdates([]);
    setRideUpdates([]);
    setNotifications([]);
    setPackageUpdates([]);
  }, []);

  /**
   * Get connection info
   */
  const getConnectionInfo = useCallback(() => {
    return realTimeService.getConnectionInfo();
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && userId && !state.connected && !state.connecting) {
      connect();
    }
  }, [autoConnect, userId, connect, state.connected, state.connecting]);

  // Handle app state changes
  useEffect(() => {
    if (!reconnectOnForeground) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        if (!state.connected && userId) {
          console.log('📱 App foregrounded, reconnecting to real-time service');
          connect();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App has gone to the background
        console.log('📱 App backgrounded, keeping real-time connection');
        // Keep connection alive for notifications
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [reconnectOnForeground, state.connected, userId, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentRideId.current) {
        leaveRide();
      }
      disconnect();
    };
  }, [disconnect, leaveRide]);

  return {
    // Connection state
    ...state,
    
    // Connection controls
    connect,
    disconnect,
    
    // Ride management
    joinRide,
    leaveRide,
    currentRideId: currentRideId.current,
    
    // Data sending
    sendLocation,
    sendRideUpdate,
    sendMessage,
    sendNotification,
    
    // Real-time data
    locationUpdates,
    rideUpdates,
    notifications,
    packageUpdates,
    
    // Utilities
    clearData,
    getConnectionInfo,
    
    // Computed properties
    hasNewNotifications: notifications.length > 0,
    latestLocation: locationUpdates[locationUpdates.length - 1] || null,
    latestRideUpdate: rideUpdates[rideUpdates.length - 1] || null,
  };
};