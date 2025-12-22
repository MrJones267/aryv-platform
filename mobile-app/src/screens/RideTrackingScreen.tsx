/**
 * @fileoverview Real-time ride tracking screen with live updates
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRealTime } from '../hooks/useRealTime';
import { LocationUpdate, RideUpdate } from '../services/RealTimeService';
import { ridesApi } from '../services/api/ridesApi';

const { width, height } = Dimensions.get('window');

interface RideTrackingScreenProps {
  route: RouteProp<{
    params: {
      rideId: string;
      userId: string;
      isDriver: boolean;
    };
  }>;
}

interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}

const RideTrackingScreen: React.FC<RideTrackingScreenProps> = () => {
  const route = useRoute<RideTrackingScreenProps['route']>();
  const navigation = useNavigation<StackNavigationProp<any>>();
  
  const { rideId, userId, isDriver } = route.params;
  
  // Real-time hook
  const {
    connected,
    connecting,
    error,
    joinRide,
    leaveRide,
    sendLocation,
    sendRideUpdate,
    sendMessage,
    locationUpdates,
    rideUpdates,
    notifications,
    latestLocation,
    latestRideUpdate,
  } = useRealTime({ userId, autoConnect: true });

  // Local state
  const [rideData, setRideData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [rideStatus, setRideStatus] = useState<string>('pending');
  const [estimatedArrival, setEstimatedArrival] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Map reference
  const mapRef = React.useRef<MapView>(null);

  /**
   * Load ride data
   */
  const loadRideData = async () => {
    try {
      const response = await ridesApi.getRideDetails(rideId);
      if (response.success && response.data) {
        setRideData(response.data);
        setRideStatus(response.data.status);
      }
    } catch (error) {
      console.error('Failed to load ride data:', error);
      Alert.alert('Error', 'Failed to load ride details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update ride status
   */
  const updateRideStatus = async (newStatus: string, message?: string) => {
    try {
      const rideUpdate: RideUpdate = {
        rideId,
        status: newStatus as any,
        message,
        location: driverLocation ? {
          lat: driverLocation.latitude,
          lng: driverLocation.longitude,
        } : undefined,
      };

      sendRideUpdate(rideUpdate);

      // Update local state
      setRideStatus(newStatus);

      // Show confirmation
      Alert.alert('Success', `Ride status updated to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update ride status:', error);
      Alert.alert('Error', 'Failed to update ride status');
    }
  };

  /**
   * Send chat message
   */
  const sendChatMessage = (message: string) => {
    if (message.trim()) {
      sendMessage(rideId, message);
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        userId,
        message: message.trim(),
        timestamp: new Date().toISOString(),
        sent: true,
      }]);
    }
  };

  /**
   * Handle location updates from real-time service
   */
  useEffect(() => {
    if (latestLocation && latestLocation.userId !== userId) {
      // Update driver location from other users
      setDriverLocation({
        latitude: latestLocation.latitude,
        longitude: latestLocation.longitude,
        heading: latestLocation.heading,
        speed: latestLocation.speed,
      });

      // Center map on new location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: latestLocation.latitude,
          longitude: latestLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    }
  }, [latestLocation, userId]);

  /**
   * Handle ride updates from real-time service
   */
  useEffect(() => {
    if (latestRideUpdate && latestRideUpdate.rideId === rideId) {
      setRideStatus(latestRideUpdate.status);
      if (latestRideUpdate.estimatedArrival) {
        setEstimatedArrival(latestRideUpdate.estimatedArrival);
      }
      
      // Show notification for status changes
      if (latestRideUpdate.message) {
        Alert.alert('Ride Update', latestRideUpdate.message);
      }
    }
  }, [latestRideUpdate, rideId]);

  /**
   * Handle new notifications
   */
  useEffect(() => {
    const latestNotification = notifications[notifications.length - 1];
    if (latestNotification) {
      if (latestNotification.type === 'chat') {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          userId: latestNotification.data?.userId,
          message: latestNotification.data?.message,
          timestamp: latestNotification.timestamp,
          sent: false,
        }]);
      }
    }
  }, [notifications]);

  /**
   * Initialize component
   */
  useEffect(() => {
    loadRideData();
    
    // Join ride room when connected
    if (connected) {
      joinRide(rideId);
    }

    return () => {
      leaveRide();
    };
  }, [connected, rideId, joinRide, leaveRide]);

  /**
   * Simulate location updates for driver
   */
  useEffect(() => {
    if (!isDriver || !connected) return;

    const interval = setInterval(() => {
      // Simulate driver location updates
      const mockLocation: LocationUpdate = {
        userId,
        latitude: 6.5244 + (Math.random() - 0.5) * 0.01,
        longitude: 3.3792 + (Math.random() - 0.5) * 0.01,
        heading: Math.random() * 360,
        speed: 20 + Math.random() * 30,
      };

      sendLocation(mockLocation);
      setDriverLocation(mockLocation);
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, [isDriver, connected, userId, sendLocation]);

  const renderConnectionStatus = () => (
    <View style={[
      styles.connectionStatus,
      { backgroundColor: connected ? '#4CAF50' : connecting ? '#FF9800' : '#F44336' }
    ]}>
      <Text style={styles.connectionText}>
        {connected ? '🟢 Real-time Connected' : connecting ? '🟡 Connecting...' : '🔴 Disconnected'}
      </Text>
      {error && <Text style={styles.errorText}>Error: {error}</Text>}
    </View>
  );

  const renderDriverActions = () => {
    if (!isDriver) return null;

    return (
      <View style={styles.driverActions}>
        <Text style={styles.sectionTitle}>Driver Controls</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.startButton]}
            onPress={() => updateRideStatus('in_progress', 'Ride started!')}
          >
            <Text style={styles.buttonText}>Start Ride</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.arriveButton]}
            onPress={() => updateRideStatus('driver_arrived', 'Driver has arrived')}
          >
            <Text style={styles.buttonText}>Mark Arrived</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => updateRideStatus('completed', 'Ride completed successfully!')}
          >
            <Text style={styles.buttonText}>Complete Ride</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRideInfo = () => (
    <View style={styles.rideInfo}>
      <Text style={styles.sectionTitle}>Ride Information</Text>
      <Text style={styles.infoText}>Ride ID: {rideId}</Text>
      <Text style={[styles.statusText, { color: getStatusColor(rideStatus) }]}>
        Status: {rideStatus.toUpperCase()}
      </Text>
      {estimatedArrival && (
        <Text style={styles.infoText}>ETA: {estimatedArrival}</Text>
      )}
      {driverLocation && (
        <Text style={styles.infoText}>
          Driver Location: {driverLocation.latitude.toFixed(4)}, {driverLocation.longitude.toFixed(4)}
        </Text>
      )}
    </View>
  );

  const renderRecentUpdates = () => (
    <View style={styles.recentUpdates}>
      <Text style={styles.sectionTitle}>Recent Updates ({rideUpdates.length})</Text>
      <ScrollView style={styles.updatesList} nestedScrollEnabled>
        {rideUpdates.slice(-5).reverse().map((update, index) => (
          <View key={index} style={styles.updateItem}>
            <Text style={styles.updateStatus}>{update.status}</Text>
            {update.message && <Text style={styles.updateMessage}>{update.message}</Text>}
            <Text style={styles.updateTime}>
              {new Date().toLocaleTimeString()}
            </Text>
          </View>
        ))}
        {rideUpdates.length === 0 && (
          <Text style={styles.noUpdates}>No updates yet</Text>
        )}
      </ScrollView>
    </View>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'confirmed': return '#2196F3';
      case 'in_progress': return '#4CAF50';
      case 'completed': return '#8BC34A';
      case 'cancelled': return '#F44336';
      default: return '#757575';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading ride details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderConnectionStatus()}
      
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: driverLocation?.latitude || 6.5244,
            longitude: driverLocation?.longitude || 3.3792,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          {driverLocation && (
            <Marker
              coordinate={driverLocation}
              title={isDriver ? "Your Location" : "Driver Location"}
              description={`Speed: ${driverLocation.speed?.toFixed(0) || 0} km/h`}
            />
          )}
        </MapView>
      </View>

      <ScrollView style={styles.infoContainer}>
        {renderRideInfo()}
        {renderDriverActions()}
        {renderRecentUpdates()}
      </ScrollView>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectionStatus: {
    padding: 10,
    alignItems: 'center',
  },
  connectionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  errorText: {
    color: 'white',
    fontSize: 12,
    marginTop: 2,
  },
  mapContainer: {
    height: height * 0.4,
  },
  map: {
    flex: 1,
  },
  infoContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  rideInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  driverActions: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: '30%',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  arriveButton: {
    backgroundColor: '#2196F3',
  },
  completeButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  recentUpdates: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    maxHeight: 200,
  },
  updatesList: {
    maxHeight: 120,
  },
  updateItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  updateStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  updateMessage: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  updateTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  noUpdates: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default RideTrackingScreen;