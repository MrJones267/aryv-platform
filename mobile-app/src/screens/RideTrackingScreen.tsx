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
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRealTime } from '../hooks/useRealTime';
import { LocationUpdate, RideUpdate } from '../services/RealTimeService';
import { ridesApi } from '../services/api/ridesApi';
import { useAppSelector } from '../store/hooks';
import TripShareSheet from '../components/trip/TripShareSheet';
import { TripShareData } from '../services/TripSharingService';
import DriverVerificationCard from '../components/verification/DriverVerificationCard';
import { PinDisplay, PinEntry } from '../components/trip/PinVerification';
import { Skeleton, SkeletonCircle, ScreenSkeleton } from '../components/ui/Skeleton';
import RouteDeviationService, { DeviationAlert } from '../services/RouteDeviationService';
import logger from '../services/LoggingService';

const log = logger.createLogger('RideTrackingScreen');

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

interface RideDataType {
  origin?: { latitude: number; longitude: number; address?: string };
  destination?: { latitude: number; longitude: number; address?: string };
  waypoints?: Array<{ latitude: number; longitude: number }>;
  driver?: {
    id: string;
    firstName: string;
    lastName: string;
    rating: number;
    totalRides: number;
    profileImage?: string;
  };
  vehicle?: {
    make: string;
    model: string;
    color: string;
    licensePlate: string;
  };
  departureTime?: string;
  status: string;
}

type RideTrackingParamList = {
  RideTracking: {
    rideId: string;
    userId: string;
    isDriver: boolean;
  };
};

const RideTrackingScreen: React.FC<RideTrackingScreenProps> = () => {
  const route = useRoute<RideTrackingScreenProps['route']>();
  const navigation = useNavigation<StackNavigationProp<RideTrackingParamList>>();

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

  // User profile for trip sharing
  const { profile: userProfile } = useAppSelector((state) => state.user);

  // Local state
  const [rideData, setRideData] = useState<RideDataType | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [rideStatus, setRideStatus] = useState<string>('pending');
  const [estimatedArrival, setEstimatedArrival] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, unknown>[]>([]);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [routeDeviation, setRouteDeviation] = useState<DeviationAlert | null>(null);

  // Map reference
  const mapRef = React.useRef<MapView>(null);

  /**
   * Load ride data
   */
  const loadRideData = async () => {
    try {
      const response = await ridesApi.getRideDetails(rideId);
      if (response.success && response.data) {
        setRideData(response.data as unknown as RideDataType);
        setRideStatus((response.data as unknown as RideDataType).status);
      }
    } catch (error) {
      log.error('Failed to load ride data:', error);
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
        status: newStatus as RideUpdate['status'],
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
      log.error('Failed to update ride status:', error);
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

      // Check for route deviation (passenger only, during active ride)
      if (!isDriver && rideStatus === 'in_progress') {
        const deviationService = RouteDeviationService.getInstance();
        deviationService.checkLocation({
          latitude: latestLocation.latitude,
          longitude: latestLocation.longitude,
        });
      }

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
   * Start route deviation monitoring for passengers when ride is in progress
   */
  useEffect(() => {
    if (!isDriver && rideStatus === 'in_progress' && rideData) {
      const deviationService = RouteDeviationService.getInstance();
      const route: Array<{ latitude: number; longitude: number }> = [];

      if (rideData.origin) {
        route.push({ latitude: rideData.origin.latitude, longitude: rideData.origin.longitude });
      }
      if (rideData.waypoints) {
        rideData.waypoints.forEach((wp: { latitude: number; longitude: number }) => {
          if (wp.latitude && wp.longitude) route.push({ latitude: wp.latitude, longitude: wp.longitude });
        });
      }
      if (rideData.destination) {
        route.push({ latitude: rideData.destination.latitude, longitude: rideData.destination.longitude });
      }

      if (route.length >= 2) {
        deviationService.startMonitoring(rideId, route, (alert) => {
          setRouteDeviation(alert);
        });
      }
    }

    return () => {
      RouteDeviationService.getInstance().stopMonitoring();
    };
  }, [rideStatus, rideData, isDriver, rideId]);

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

  const handleStartRide = () => {
    if (!pinVerified) {
      setShowPinEntry(true);
    } else {
      updateRideStatus('in_progress', 'Ride started!');
    }
  };

  const handlePinVerified = () => {
    setPinVerified(true);
    setShowPinEntry(false);
    updateRideStatus('in_progress', 'PIN verified. Ride started!');
  };

  const renderDriverActions = () => {
    if (!isDriver) return null;

    return (
      <View style={styles.driverActions}>
        <Text style={styles.sectionTitle}>Driver Controls</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={handleStartRide}
          >
            <Text style={styles.buttonText}>
              {pinVerified ? 'Start Ride' : 'Verify PIN & Start'}
            </Text>
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

      {/* Driver verification card (compact) */}
      {!isDriver && rideData?.driver && (
        <View style={styles.driverCardContainer}>
          <DriverVerificationCard
            driver={{
              id: rideData.driver.id || 'unknown',
              firstName: rideData.driver.firstName || 'Driver',
              lastName: rideData.driver.lastName || '',
              rating: rideData.driver.rating || 0,
              totalRides: rideData.driver.totalRides || 0,
              profileImage: rideData.driver.profileImage,
              isVerified: true,
            }}
            vehicle={rideData.vehicle ? {
              make: rideData.vehicle.make || '',
              model: rideData.vehicle.model || '',
              color: rideData.vehicle.color || '',
              licensePlate: rideData.vehicle.licensePlate || '',
            } : undefined}
            compact
          />
        </View>
      )}

      <Text style={[styles.statusText, { color: getStatusColor(rideStatus) }]}>
        Status: {rideStatus.toUpperCase()}
      </Text>
      {estimatedArrival && (
        <Text style={styles.infoText}>ETA: {estimatedArrival}</Text>
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

  /**
   * Build trip share data from current ride state
   */
  const buildTripShareData = (): TripShareData => ({
    rideId,
    driverName: rideData?.driver?.firstName
      ? `${rideData.driver.firstName} ${rideData.driver.lastName || ''}`
      : 'Driver',
    vehicleInfo: rideData?.vehicle
      ? `${rideData.vehicle.color || ''} ${rideData.vehicle.make || ''} ${rideData.vehicle.model || ''} (${rideData.vehicle.licensePlate || ''})`.trim()
      : undefined,
    origin: rideData?.origin?.address || 'Origin',
    destination: rideData?.destination?.address || 'Destination',
    departureTime: rideData?.departureTime
      ? new Date(rideData.departureTime).toLocaleString()
      : undefined,
    estimatedArrival: estimatedArrival || undefined,
    passengerName: userProfile
      ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim()
      : 'Passenger',
    currentLocation: driverLocation
      ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
      : undefined,
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenSkeleton type="rides" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderConnectionStatus()}

      {/* Route deviation warning */}
      {routeDeviation && (
        <TouchableOpacity
          style={[
            styles.deviationBanner,
            routeDeviation.severity === 'critical' && styles.deviationCritical,
          ]}
          onPress={() => {
            Alert.alert(
              'Route Deviation Detected',
              `The vehicle is ${routeDeviation.deviationDistance}m off the expected route. If you feel unsafe, tap SOS or call emergency services.`,
              [
                { text: 'Dismiss', onPress: () => setRouteDeviation(null) },
                { text: 'Call 999', onPress: () => Linking.openURL('tel:999'), style: 'destructive' },
              ],
            );
          }}
        >
          <Icon name="warning" size={18} color="#FFFFFF" />
          <Text style={styles.deviationText}>
            Route deviation: {routeDeviation.deviationDistance}m off route
          </Text>
        </TouchableOpacity>
      )}

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

      {/* Share trip button */}
      {!isDriver && rideStatus !== 'completed' && rideStatus !== 'cancelled' && (
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => setShowShareSheet(true)}
          activeOpacity={0.8}
        >
          <Icon name="share" size={20} color="#FFFFFF" />
          <Text style={styles.shareButtonText}>Share Trip</Text>
        </TouchableOpacity>
      )}

      {/* Passenger: Show PIN when driver has arrived */}
      {!isDriver && (rideStatus === 'driver_arrived' || rideStatus === 'confirmed') && (
        <View style={styles.pinDisplayContainer}>
          <PinDisplay rideId={rideId} visible />
        </View>
      )}

      {/* Driver: PIN entry modal */}
      <PinEntry
        visible={showPinEntry}
        rideId={rideId}
        onVerified={handlePinVerified}
        onCancel={() => setShowPinEntry(false)}
      />

      {/* Trip share sheet */}
      <TripShareSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        tripData={buildTripShareData()}
      />
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
  driverCardContainer: {
    marginBottom: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    overflow: 'hidden',
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
  deviationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  deviationCritical: {
    backgroundColor: '#EF4444',
  },
  deviationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  pinDisplayContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  shareButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default RideTrackingScreen;