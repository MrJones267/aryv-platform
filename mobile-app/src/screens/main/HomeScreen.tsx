/**
 * @fileoverview Home screen with intercity route search, map, and quick actions
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2026-02-04
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Dimensions,
  Alert,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region, Marker, Polyline } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchUserProfile } from '../../store/slices/userSlice';
import { getCurrentLocation } from '../../store/slices/locationSlice';
import { ridesApi } from '../../services/api';
import { HomeScreenProps } from '../../navigation/types';
import { colors } from '../../theme';
import { haptic } from '../../services/HapticService';
import { FadeIn, ScaleIn } from '../../components/ui/AnimatedComponents';
import EmergencyService, { EmergencyAlert } from '../../services/EmergencyServiceSimple';
import EmergencyAlertModal from '../../components/emergency/EmergencyAlertModal';
import OfflineBanner from '../../components/common/OfflineBanner';
import logger from '../../services/LoggingService';

const log = logger.createLogger('HomeScreen');

const { width, height } = Dimensions.get('window');
const MAP_HEIGHT = height * 0.35;

// Default region: Botswana/Southern Africa
const DEFAULT_REGION: Region = {
  latitude: -24.6282,
  longitude: 25.9231,
  latitudeDelta: 4,
  longitudeDelta: 4,
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { profile: user } = useAppSelector((state) => state.user);
  const { currentLocation } = useAppSelector((state) => state.location);
  const mapRef = useRef<MapView>(null);

  interface NearbyRide {
    id: string;
    origin?: { latitude: number; longitude: number; address?: string; city?: string };
    destination?: { latitude: number; longitude: number; address?: string; city?: string };
    route?: Array<{ latitude: number; longitude: number }>;
    pricePerSeat?: number;
    availableSeats?: number;
    departureTime?: string;
  }
  const [nearbyRides, setNearbyRides] = useState<NearbyRide[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [activeEmergency, setActiveEmergency] = useState<EmergencyAlert | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);

  useEffect(() => {
    initializeScreen();
    const safetyTimer = setTimeout(() => {
      setIsInitializing(false);
    }, 8000);
    return () => clearTimeout(safetyTimer);
  }, []);

  useEffect(() => {
    if (currentLocation) {
      const newRegion = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 2,
        longitudeDelta: 2,
      };
      setMapRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
    }
  }, [currentLocation]);

  const initializeScreen = async (): Promise<void> => {
    try {
      if (!user) {
        await dispatch(fetchUserProfile()).unwrap();
      }
      try {
        const locationTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Location timeout')), 3000)
        );
        await Promise.race([
          dispatch(getCurrentLocation()).unwrap(),
          locationTimeout,
        ]);
      } catch (locationError) {
        log.info('Location access failed', { error: String(locationError) });
      }
      await loadNearbyRides();
    } catch (error) {
      log.info('Error during initialization', { error: String(error) });
    } finally {
      setIsInitializing(false);
    }
  };

  const loadNearbyRides = async (): Promise<void> => {
    try {
      if (currentLocation) {
        const response = await ridesApi.getNearbyRides(
          currentLocation.latitude,
          currentLocation.longitude,
          50 // 50km radius for intercity
        );
        if (response.success) {
          setNearbyRides((response.data?.slice(0, 10) || []) as unknown as NearbyRide[]);
        }
      } else {
        setNearbyRides([]);
      }
    } catch (error) {
      log.info('Error loading nearby rides', { error: String(error) });
      setNearbyRides([]);
    }
  };

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await loadNearbyRides();
    setIsRefreshing(false);
  };

  const handleFindRide = (): void => {
    haptic.tap();
    navigation.navigate('Search');
  };

  const handleOfferRide = (): void => {
    haptic.tap();
    // If user is not yet a driver, route to driver onboarding
    const isDriver = user?.roles?.includes('driver') || user?.primaryRole === 'driver';
    if (!isDriver) {
      navigation.navigate('DriverOnboarding');
    } else {
      navigation.navigate('CreateRide');
    }
  };

  const handleSendPackage = (): void => {
    haptic.tap();
    (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('Packages');
  };

  const handleDeliverPackages = (): void => {
    haptic.tap();
    (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('Courier');
  };

  const handleViewRide = (rideId: string): void => {
    navigation.navigate('RideDetails', { rideId });
  };

  const handleMyLocation = (): void => {
    if (currentLocation) {
      mapRef.current?.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      }, 1000);
    }
  };

  const handleEmergency = (): void => {
    haptic.impact();
    if (EmergencyService.hasActiveEmergency()) {
      const currentEmergency = EmergencyService.getCurrentEmergency();
      if (currentEmergency) {
        Alert.alert(
          'Active Emergency',
          `You have an active ${currentEmergency.type} emergency alert.`,
          [
            { text: 'View Details', onPress: () => showActiveEmergencyDetails(currentEmergency) },
            { text: "I'm Safe Now", onPress: () => resolveCurrentEmergency() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }
    }
    setShowEmergencyModal(true);
  };

  const showActiveEmergencyDetails = (emergency: EmergencyAlert): void => {
    Alert.alert(
      'Emergency Details',
      `Type: ${emergency.type.toUpperCase()}\nTime: ${new Date(emergency.timestamp).toLocaleString()}`,
      [
        { text: 'Call 999', onPress: () => EmergencyService.callEmergencyServices() },
        { text: 'Call Emergency Contact', onPress: () => EmergencyService.callPrimaryContact() },
        { text: "I'm Safe", onPress: () => resolveCurrentEmergency() },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const resolveCurrentEmergency = (): void => {
    EmergencyService.resolveEmergency();
    setActiveEmergency(null);
  };

  const handleEmergencyTriggered = (alert: EmergencyAlert): void => {
    setActiveEmergency(alert);
    Alert.alert(
      'Emergency Alert Sent',
      'Your emergency alert has been sent to your emergency contacts and your location is being shared.',
      [{ text: 'OK' }]
    );
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  // Map section with route overview
  const renderMap = (): React.ReactNode => (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={mapRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
        mapType="standard"
      >
        {/* Show nearby ride routes on map */}
        {nearbyRides.map((ride) => {
          if (!ride.origin?.latitude || !ride.destination?.latitude) return null;
          return (
            <React.Fragment key={ride.id}>
              <Marker
                coordinate={{
                  latitude: ride.origin.latitude,
                  longitude: ride.origin.longitude,
                }}
                onPress={() => handleViewRide(ride.id)}
              >
                <View style={styles.mapMarkerOrigin}>
                  <View style={styles.mapMarkerDot} />
                </View>
              </Marker>
              <Marker
                coordinate={{
                  latitude: ride.destination.latitude,
                  longitude: ride.destination.longitude,
                }}
                onPress={() => handleViewRide(ride.id)}
              >
                <View style={styles.mapMarkerDest}>
                  <Icon name="location-on" size={14} color="#FFFFFF" />
                </View>
              </Marker>
              {ride.route && ride.route.length > 0 && (
                <Polyline
                  coordinates={ride.route}
                  strokeWidth={2}
                  strokeColor={colors.primary + '80'}
                  lineDashPattern={[5, 5]}
                />
              )}
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Gradient overlay at bottom of map */}
      <View style={styles.mapGradient} />

      {/* My location button */}
      <TouchableOpacity
        style={styles.myLocationBtn}
        onPress={handleMyLocation}
        activeOpacity={0.8}
      >
        <Icon name="my-location" size={22} color={colors.text.primary} />
      </TouchableOpacity>

      {/* Emergency SOS button */}
      <TouchableOpacity
        style={[styles.sosButton, activeEmergency && styles.sosButtonActive]}
        onPress={handleEmergency}
        activeOpacity={0.8}
      >
        <Icon name="emergency" size={18} color="#FFFFFF" />
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>
    </View>
  );

  // Route search bar overlaying the bottom of the map
  const renderSearchBar = (): React.ReactNode => (
    <TouchableOpacity
      style={styles.searchBar}
      onPress={handleFindRide}
      activeOpacity={0.9}
    >
      <View style={styles.searchIconContainer}>
        <Icon name="search" size={22} color={colors.primary} />
      </View>
      <View style={styles.searchTextContainer}>
        <Text style={styles.searchPlaceholder}>Where are you travelling to?</Text>
        <Text style={styles.searchSubtext}>
          {currentLocation?.address || 'Search intercity routes'}
        </Text>
      </View>
      <View style={styles.searchDivider} />
      <TouchableOpacity style={styles.searchTimeBtn} onPress={handleFindRide}>
        <Icon name="schedule" size={18} color={colors.text.secondary} />
        <Text style={styles.searchTimeText}>Now</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // 4 core quick action buttons matching the business model
  const renderQuickActions = (): React.ReactNode => (
    <View style={styles.quickActions}>
      <ScaleIn delay={0}>
        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={handleFindRide}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: colors.primary + '15' }]}>
            <Icon name="search" size={24} color={colors.primary} />
          </View>
          <Text style={styles.quickActionLabel}>Find Ride</Text>
        </TouchableOpacity>
      </ScaleIn>

      <ScaleIn delay={60}>
        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={handleOfferRide}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#10B981' + '15' }]}>
            <Icon name="add-circle-outline" size={24} color="#10B981" />
          </View>
          <Text style={styles.quickActionLabel}>Offer Ride</Text>
        </TouchableOpacity>
      </ScaleIn>

      <ScaleIn delay={120}>
        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={handleSendPackage}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#F59E0B' + '15' }]}>
            <Icon name="local-shipping" size={24} color="#F59E0B" />
          </View>
          <Text style={styles.quickActionLabel}>Send Parcel</Text>
        </TouchableOpacity>
      </ScaleIn>

      <ScaleIn delay={180}>
        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={handleDeliverPackages}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
            <Icon name="delivery-dining" size={24} color="#8B5CF6" />
          </View>
          <Text style={styles.quickActionLabel}>Deliver</Text>
        </TouchableOpacity>
      </ScaleIn>
    </View>
  );

  // Upcoming rides section
  const renderUpcomingRides = (): React.ReactNode => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Available Rides</Text>
        <TouchableOpacity onPress={handleFindRide}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      {nearbyRides.length > 0 ? (
        nearbyRides.slice(0, 5).map((ride) => (
          <TouchableOpacity
            key={ride.id as string}
            style={styles.rideCard}
            onPress={() => handleViewRide(ride.id as string)}
            activeOpacity={0.7}
          >
            <View style={styles.rideCardLeft}>
              {/* Route indicator */}
              <View style={styles.routeIndicator}>
                <View style={styles.routeDotGreen} />
                <View style={styles.routeLineVertical} />
                <View style={styles.routeDotRed} />
              </View>

              {/* Route info */}
              <View style={styles.rideRouteInfo}>
                <Text style={styles.rideCity} numberOfLines={1}>
                  {ride.origin?.address || ride.origin?.city || 'Origin'}
                </Text>
                <Text style={styles.rideCity} numberOfLines={1}>
                  {ride.destination?.address || ride.destination?.city || 'Destination'}
                </Text>
              </View>
            </View>

            <View style={styles.rideCardRight}>
              {/* Price */}
              <Text style={styles.ridePrice}>
                P{(ride.pricePerSeat ?? 0).toFixed(0)}
              </Text>
              <Text style={styles.ridePriceLabel}>per seat</Text>

              {/* Details row */}
              <View style={styles.rideMetaRow}>
                <View style={styles.rideMeta}>
                  <Icon name="person" size={12} color={colors.text.secondary} />
                  <Text style={styles.rideMetaText}>
                    {ride.availableSeats ?? 0}
                  </Text>
                </View>
                <View style={styles.rideMeta}>
                  <Icon name="schedule" size={12} color={colors.text.secondary} />
                  <Text style={styles.rideMetaText}>
                    {ride.departureTime
                      ? new Date(ride.departureTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'TBD'}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Icon name="directions-car" size={40} color={colors.border.light} />
          <Text style={styles.emptyStateTitle}>No rides available</Text>
          <Text style={styles.emptyStateSubtext}>
            Be the first to offer a ride or search for upcoming routes
          </Text>
          <TouchableOpacity style={styles.emptyActionBtn} onPress={handleOfferRide}>
            <Icon name="add" size={18} color="#FFFFFF" />
            <Text style={styles.emptyActionText}>Offer a Ride</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // How it works section for new users
  const renderHowItWorks = (): React.ReactNode => (
    <View style={styles.howItWorksSection}>
      <Text style={styles.sectionTitle}>How ARYV Works</Text>
      <View style={styles.howItWorksCards}>
        <View style={styles.howCard}>
          <View style={[styles.howCardIcon, { backgroundColor: colors.primary + '15' }]}>
            <Icon name="search" size={22} color={colors.primary} />
          </View>
          <Text style={styles.howCardTitle}>Search</Text>
          <Text style={styles.howCardDesc}>Find rides on your route</Text>
        </View>
        <View style={styles.howCard}>
          <View style={[styles.howCardIcon, { backgroundColor: '#10B981' + '15' }]}>
            <Icon name="event-seat" size={22} color="#10B981" />
          </View>
          <Text style={styles.howCardTitle}>Reserve</Text>
          <Text style={styles.howCardDesc}>Book a seat or cargo space</Text>
        </View>
        <View style={styles.howCard}>
          <View style={[styles.howCardIcon, { backgroundColor: '#F59E0B' + '15' }]}>
            <Icon name="directions-car" size={22} color="#F59E0B" />
          </View>
          <Text style={styles.howCardTitle}>Travel</Text>
          <Text style={styles.howCardDesc}>Share the journey safely</Text>
        </View>
      </View>
    </View>
  );

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />
        <View style={styles.loadingContainer}>
          <Icon name="directions-car" size={48} color={colors.primary} />
          <Text style={styles.loadingText}>Loading ARYV...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />
      <OfflineBanner />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>
            Good {getGreeting()}, {user?.firstName || 'there'}
          </Text>
          {currentLocation && (
            <View style={styles.headerLocation}>
              <Icon name="location-on" size={14} color={colors.text.secondary} />
              <Text style={styles.headerLocationText} numberOfLines={1}>
                {currentLocation.address || 'Current location'}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.headerProfileBtn}
          onPress={() => (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('Profile')}
        >
          <Text style={styles.headerProfileInitial}>
            {user?.firstName?.charAt(0) || 'U'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Map */}
        {renderMap()}

        {/* Search Bar */}
        {renderSearchBar()}

        {/* Quick Actions */}
        {renderQuickActions()}

        {/* Available Rides */}
        {renderUpcomingRides()}

        {/* How It Works (for new users or empty state) */}
        {nearbyRides.length === 0 && renderHowItWorks()}

        {/* Bottom spacing */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Emergency Alert Modal */}
      <EmergencyAlertModal
        visible={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        onEmergencyTriggered={handleEmergencyTriggered}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerGreeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  headerLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerLocationText: {
    fontSize: 13,
    color: colors.text.secondary,
    maxWidth: width * 0.6,
  },
  headerProfileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerProfileInitial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  // Map
  mapContainer: {
    height: MAP_HEIGHT,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'transparent',
  },
  myLocationBtn: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  sosButton: {
    position: 'absolute',
    left: 16,
    top: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
    elevation: 4,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  sosButtonActive: {
    backgroundColor: '#DC2626',
  },
  sosText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  mapMarkerOrigin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  mapMarkerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  mapMarkerDest: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  searchIconContainer: {
    marginRight: 12,
  },
  searchTextContainer: {
    flex: 1,
  },
  searchPlaceholder: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  searchSubtext: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  searchDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border.light,
    marginHorizontal: 12,
  },
  searchTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  searchTimeText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  quickActionItem: {
    alignItems: 'center',
    width: (width - 60) / 4,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },

  // Section
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },

  // Ride Cards
  rideCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  rideCardLeft: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 12,
  },
  routeIndicator: {
    alignItems: 'center',
    marginRight: 10,
    paddingTop: 4,
  },
  routeDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  routeLineVertical: {
    width: 2,
    height: 20,
    backgroundColor: colors.border.light,
  },
  routeDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  rideRouteInfo: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  rideCity: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  rideCardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  ridePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  ridePriceLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 6,
  },
  rideMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rideMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rideMetaText: {
    fontSize: 11,
    color: colors.text.secondary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // How It Works
  howItWorksSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  howItWorksCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 10,
  },
  howCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  howCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  howCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  howCardDesc: {
    fontSize: 11,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 14,
  },
});

export default HomeScreen;
