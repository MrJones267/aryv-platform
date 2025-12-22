/**
 * @fileoverview Custom MapView component with ride-specific features
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  Circle,
  PROVIDER_GOOGLE,
  Region,
  MapPressEvent,
} from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LocationCoordinates, LocationData } from '../../services/LocationService';
import NavigationService, { NavigationRoute } from '../../services/NavigationService';

export interface RideMapData {
  id: string;
  origin: LocationCoordinates & { address?: string };
  destination: LocationCoordinates & { address?: string };
  route?: LocationCoordinates[];
  driverLocation?: LocationCoordinates;
  passengerPickupPoints?: Array<LocationCoordinates & { passengerId: string }>;
}

interface MapViewProps {
  initialRegion?: Region;
  currentLocation?: LocationData;
  rides?: RideMapData[];
  selectedRideId?: string;
  showCurrentLocation?: boolean;
  showTraffic?: boolean;
  showNavigation?: boolean;
  navigationDestination?: LocationCoordinates;
  onMapPress?: (coordinate: LocationCoordinates) => void;
  onMarkerPress?: (rideId: string) => void;
  onCurrentLocationPress?: () => void;
  onStartNavigation?: (destination: LocationCoordinates) => void;
  style?: any;
}

export const HitchMapView: React.FC<MapViewProps> = ({
  initialRegion,
  currentLocation,
  rides = [],
  selectedRideId,
  showCurrentLocation = true,
  showTraffic = false,
  showNavigation = false,
  navigationDestination,
  onMapPress,
  onMarkerPress,
  onCurrentLocationPress,
  onStartNavigation,
  style,
}) => {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(
    initialRegion || {
      latitude: 37.7749,
      longitude: -122.4194,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }
  );
  const [navigationRoute, setNavigationRoute] = useState<NavigationRoute | null>(null);
  const [loadingNavigation, setLoadingNavigation] = useState(false);

  useEffect(() => {
    if (currentLocation && !initialRegion) {
      const newRegion = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
    }
  }, [currentLocation, initialRegion]);

  // Load navigation route when destination changes
  useEffect(() => {
    if (showNavigation && navigationDestination && currentLocation) {
      loadNavigationRoute();
    } else {
      setNavigationRoute(null);
    }
  }, [showNavigation, navigationDestination, currentLocation]);

  const loadNavigationRoute = async () => {
    if (!currentLocation || !navigationDestination) return;
    
    setLoadingNavigation(true);
    try {
      const route = await NavigationService.getDirections({
        origin: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
        destination: navigationDestination,
        mode: 'driving',
      });
      setNavigationRoute(route);
      
      // Fit map to show entire route
      if (mapRef.current) {
        mapRef.current.fitToCoordinates(route.coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.error('Failed to load navigation route:', error);
    } finally {
      setLoadingNavigation(false);
    }
  };

  const handleStartNavigation = async (destination: LocationCoordinates) => {
    try {
      await NavigationService.openExternalNavigation(
        destination,
        currentLocation ? {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        } : undefined
      );
      onStartNavigation?.(destination);
    } catch (error) {
      Alert.alert('Navigation Error', 'Failed to open navigation app. Please check if you have a navigation app installed.');
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    if (onMapPress) {
      const { coordinate } = event.nativeEvent;
      onMapPress({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });
    }
  };

  const handleMyLocationPress = async () => {
    if (onCurrentLocationPress) {
      onCurrentLocationPress();
    } else if (currentLocation) {
      const newRegion = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      mapRef.current?.animateToRegion(newRegion, 1000);
    } else {
      Alert.alert('Location Unavailable', 'Current location is not available');
    }
  };

  const fitToRide = (ride: RideMapData) => {
    if (!mapRef.current) return;

    const coordinates = [ride.origin, ride.destination];
    if (ride.driverLocation) {
      coordinates.push(ride.driverLocation);
    }
    if (ride.passengerPickupPoints) {
      coordinates.push(...ride.passengerPickupPoints);
    }

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
  };

  const getMarkerColor = (rideId: string): string => {
    return selectedRideId === rideId ? '#2196F3' : '#666666';
  };

  const renderCurrentLocationMarker = () => {
    if (!showCurrentLocation || !currentLocation) return null;

    return (
      <Marker
        coordinate={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        }}
        title="Your Location"
        description={currentLocation.address?.fullAddress}
        pinColor="#2196F3"
        identifier="current-location"
      >
        <View style={styles.currentLocationMarker}>
          <View style={styles.currentLocationDot} />
        </View>
      </Marker>
    );
  };

  const renderRideMarkers = () => {
    return rides.map((ride) => (
      <View key={ride.id}>
        {/* Origin Marker */}
        <Marker
          coordinate={ride.origin}
          title="Pickup Location"
          description={ride.origin.address}
          pinColor="#4CAF50"
          identifier={`${ride.id}-origin`}
          onPress={() => onMarkerPress?.(ride.id)}
        >
          <View style={[styles.rideMarker, { backgroundColor: '#4CAF50' }]}>
            <Icon name="my-location" size={16} color="#FFFFFF" />
          </View>
        </Marker>

        {/* Destination Marker */}
        <Marker
          coordinate={ride.destination}
          title="Drop-off Location"
          description={ride.destination.address}
          pinColor="#F44336"
          identifier={`${ride.id}-destination`}
          onPress={() => onMarkerPress?.(ride.id)}
        >
          <View style={[styles.rideMarker, { backgroundColor: '#F44336' }]}>
            <Icon name="location-on" size={16} color="#FFFFFF" />
          </View>
        </Marker>

        {/* Driver Location (if available) */}
        {ride.driverLocation && (
          <Marker
            coordinate={ride.driverLocation}
            title="Driver Location"
            pinColor={getMarkerColor(ride.id)}
            identifier={`${ride.id}-driver`}
            onPress={() => onMarkerPress?.(ride.id)}
          >
            <View style={[styles.driverMarker, { backgroundColor: getMarkerColor(ride.id) }]}>
              <Icon name="directions-car" size={20} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Passenger Pickup Points */}
        {ride.passengerPickupPoints?.map((pickup, index) => (
          <Marker
            key={`${ride.id}-pickup-${index}`}
            coordinate={pickup}
            title={`Passenger Pickup ${index + 1}`}
            pinColor="#FF9800"
            identifier={`${ride.id}-pickup-${index}`}
            onPress={() => onMarkerPress?.(ride.id)}
          >
            <View style={[styles.pickupMarker, { backgroundColor: '#FF9800' }]}>
              <Text style={styles.pickupText}>{index + 1}</Text>
            </View>
          </Marker>
        ))}

        {/* Route Polyline */}
        {ride.route && ride.route.length > 0 && (
          <Polyline
            coordinates={ride.route}
            strokeWidth={4}
            strokeColor={selectedRideId === ride.id ? '#2196F3' : '#666666'}
            lineDashPattern={selectedRideId === ride.id ? undefined : [5, 5]}
          />
        )}
      </View>
    ));
  };

  const renderSelectedRideCircle = () => {
    const selectedRide = rides.find(ride => ride.id === selectedRideId);
    if (!selectedRide) return null;

    return (
      <>
        <Circle
          center={selectedRide.origin}
          radius={100}
          strokeWidth={2}
          strokeColor="#2196F3"
          fillColor="rgba(33, 150, 243, 0.1)"
        />
        <Circle
          center={selectedRide.destination}
          radius={100}
          strokeWidth={2}
          strokeColor="#2196F3"
          fillColor="rgba(33, 150, 243, 0.1)"
        />
      </>
    );
  };

  const renderNavigationRoute = () => {
    if (!navigationRoute || !showNavigation) return null;

    return (
      <>
        {/* Navigation route polyline */}
        <Polyline
          coordinates={navigationRoute.coordinates}
          strokeWidth={6}
          strokeColor="#1976D2"
          lineDashPattern={undefined}
        />
        
        {/* Navigation destination marker */}
        {navigationDestination && (
          <Marker
            coordinate={navigationDestination}
            title="Navigation Destination"
            pinColor="#1976D2"
            identifier="navigation-destination"
          >
            <View style={[styles.navigationMarker, { backgroundColor: '#1976D2' }]}>
              <Icon name="navigation" size={20} color="#FFFFFF" />
            </View>
          </Marker>
        )}
      </>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress}
        showsUserLocation={showCurrentLocation}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
        mapType="standard"
      >
        {renderCurrentLocationMarker()}
        {renderRideMarkers()}
        {renderSelectedRideCircle()}
        {renderNavigationRoute()}
      </MapView>

      {/* Custom Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleMyLocationPress}
          activeOpacity={0.8}
        >
          <Icon name="my-location" size={24} color="#666666" />
        </TouchableOpacity>

        {selectedRideId && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => {
              const ride = rides.find(r => r.id === selectedRideId);
              if (ride) fitToRide(ride);
            }}
            activeOpacity={0.8}
          >
            <Icon name="center-focus-strong" size={24} color="#666666" />
          </TouchableOpacity>
        )}

        {showNavigation && navigationDestination && (
          <TouchableOpacity
            style={[styles.controlButton, styles.navigationButton]}
            onPress={() => handleStartNavigation(navigationDestination)}
            activeOpacity={0.8}
          >
            <Icon name="navigation" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Navigation Info Panel */}
      {showNavigation && navigationRoute && (
        <View style={styles.navigationInfo}>
          <View style={styles.navigationDetails}>
            <Text style={styles.navigationDistance}>
              {(navigationRoute.distance / 1000).toFixed(1)} km
            </Text>
            <Text style={styles.navigationDuration}>
              {Math.round(navigationRoute.duration / 60)} min
            </Text>
          </View>
          {loadingNavigation && (
            <Text style={styles.navigationLoading}>Loading route...</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    right: 16,
    top: 16,
    gap: 8,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  currentLocationMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  currentLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
  },
  rideMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pickupMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pickupText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  navigationButton: {
    backgroundColor: '#1976D2',
  },
  navigationMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  navigationInfo: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minWidth: 120,
  },
  navigationDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navigationDistance: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  navigationDuration: {
    fontSize: 14,
    color: '#666666',
  },
  navigationLoading: {
    fontSize: 12,
    color: '#1976D2',
    marginTop: 4,
  },
});

export default HitchMapView;