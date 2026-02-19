/**
 * @fileoverview Real-time updates component for ride and message notifications
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import logger from '../../services/LoggingService';

const log = logger.createLogger('RealTimeUpdates');
import { useSocket, useSocketEvent } from '../../hooks/useSocket';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { MessageData, RideUpdate, BookingUpdate } from '../../services/SocketService';

interface RideUpdateWithDetails extends RideUpdate {
  rideId: string;
  driverName?: string;
  origin?: string;
  destination?: string;
}

interface RealTimeUpdatesProps {
  children: React.ReactNode;
}

/**
 * Component that manages real-time updates and notifications
 * Should be placed high in the component tree to handle global updates
 */
export const RealTimeUpdates: React.FC<RealTimeUpdatesProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<{ navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void }>();
  const { isAuthenticated } = useAppSelector(state => state.auth);
  const { profile: user } = useAppSelector(state => state.user);
  
  const { connected, connect, disconnect } = useSocket({
    autoConnect: true,
    joinRooms: user ? [`user:${user.id}`] : [],
  });

  // Handle connection status
  useEffect(() => {
    log.info('Socket connection status:', connected);
  }, [connected]);

  // Handle incoming messages
  useSocketEvent<MessageData>('message_received', (message) => {
    log.info('Received message:', message);
    
    // Update message store/state here if needed
    // dispatch(addMessage(message));
    
    // Show notification for messages when app is active
    if (message.type === 'text') {
      // Could show in-app notification here
      log.info(`New message from ${message.senderId}: ${message.message}`);
    }
  });

  // Handle ride updates
  useSocketEvent<RideUpdate>('ride_update', (rideUpdate) => {
    log.info('Received ride update:', rideUpdate);
    
    // Update rides store
    // dispatch(updateRideStatus(rideUpdate));
    
    // Show relevant notifications
    switch (rideUpdate.status) {
      case 'confirmed':
        Alert.alert(
          'Ride Confirmed',
          rideUpdate.message || 'Your ride has been confirmed!'
        );
        break;
      case 'in_progress':
        Alert.alert(
          'Ride Started',
          rideUpdate.message || 'Your ride has started. Have a safe journey!'
        );
        break;
      case 'completed':
        Alert.alert(
          'Ride Completed',
          rideUpdate.message || 'Your ride has been completed. Would you like to rate your trip?',
          [
            {
              text: 'Rate Now',
              onPress: () => {
                try {
                  const details = rideUpdate as RideUpdateWithDetails;
                  navigation.navigate('RideRating', {
                    rideId: details.rideId || '',
                    driverName: details.driverName,
                    origin: details.origin,
                    destination: details.destination,
                  });
                } catch (e) {
                  log.info('Could not navigate to rating:', e);
                }
              },
            },
            { text: 'Later', style: 'cancel' },
          ]
        );
        break;
      case 'cancelled':
        Alert.alert(
          'Ride Cancelled',
          rideUpdate.message || 'Your ride has been cancelled.'
        );
        break;
    }
  });

  // Handle booking updates
  useSocketEvent<BookingUpdate>('booking_update', (bookingUpdate) => {
    log.info('Received booking update:', bookingUpdate);
    
    // Update bookings store
    // dispatch(updateBookingStatus(bookingUpdate));
    
    // Show relevant notifications
    switch (bookingUpdate.status) {
      case 'confirmed':
        Alert.alert(
          'Booking Confirmed',
          bookingUpdate.message || 'Your booking has been confirmed!'
        );
        break;
      case 'cancelled':
        Alert.alert(
          'Booking Cancelled',
          bookingUpdate.message || 'A booking has been cancelled.'
        );
        break;
    }
  });

  // Handle general notifications
  useSocketEvent<{
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    data?: unknown;
  }>('notification', (notification) => {
    log.info('Received notification:', notification);
    
    Alert.alert(notification.title, notification.message);
  });

  // Handle socket errors
  useSocketEvent<{ message: string; code?: string }>('socket_error', (error) => {
    log.error('Socket error received:', error);
    
    // Don't show alert for every error as it might be spammy
    // Only show for critical errors
    if (error.code === 'AUTHENTICATION_FAILED') {
      Alert.alert(
        'Connection Error',
        'Authentication failed. Please log in again.',
        [
          {
            text: 'OK',
            onPress: () => {
              // dispatch(logout());
            },
          },
        ]
      );
    }
  });

  // Handle typing indicators for active chat
  useSocketEvent<{
    userId: string;
    conversationId: string;
    isTyping: boolean;
    userName?: string;
  }>('typing', (typingData) => {
    log.info('Typing indicator:', typingData);
    
    // This would be handled by individual chat components
    // Global handling isn't necessary for typing indicators
  });

  // Handle location updates
  useSocketEvent<{
    rideId: string;
    userId: string;
    location: { latitude: number; longitude: number };
    timestamp: string;
  }>('location_update', (locationUpdate) => {
    log.info('Location update:', locationUpdate);
    
    // Update location in relevant components
    // dispatch(updateUserLocation(locationUpdate));
  });

  // Reconnection handling
  useEffect(() => {
    if (isAuthenticated && !connected) {
      log.info('Attempting to reconnect socket...');
      connect();
    } else if (!isAuthenticated && connected) {
      log.info('User not authenticated, disconnecting socket...');
      disconnect();
    }
  }, [isAuthenticated, connected, connect, disconnect]);

  return <>{children}</>;
};

export default RealTimeUpdates;