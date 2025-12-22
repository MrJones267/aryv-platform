/**
 * @fileoverview Home screen with ride discovery and quick actions
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-26
 */

import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchUserProfile } from '../../store/slices/userSlice';
import { getCurrentLocation } from '../../store/slices/locationSlice';
import { ridesApi } from '../../services/api';
import { HomeScreenProps } from '../../navigation/types';
import { colors } from '../../theme';
import AIRecommendationsService, { RecommendationsResponse } from '../../services/AIRecommendationsService';
import EmergencyService, { EmergencyAlert } from '../../services/EmergencyServiceSimple';
import EmergencyAlertModal from '../../components/emergency/EmergencyAlertModal';

const { width } = Dimensions.get('window');

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { profile: user } = useAppSelector((state) => state.user);
  const { currentLocation } = useAppSelector((state) => state.location);
  
  const [nearbyRides, setNearbyRides] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [activeEmergency, setActiveEmergency] = useState<EmergencyAlert | null>(null);

  useEffect(() => {
    initializeScreen();
    
    // Safety fallback - force completion after 8 seconds
    const safetyTimer = setTimeout(() => {
      console.log('HomeScreen: Safety timer triggered - forcing initialization completion');
      setIsInitializing(false);
    }, 8000);
    
    return () => clearTimeout(safetyTimer);
  }, []);

  const initializeScreen = async (): Promise<void> => {
    console.log('HomeScreen: Starting initialization...');
    
    try {
      // Fetch user profile if not loaded
      console.log('HomeScreen: Checking user profile...');
      if (!user) {
        console.log('HomeScreen: Fetching user profile...');
        await dispatch(fetchUserProfile()).unwrap();
        console.log('HomeScreen: User profile fetched successfully');
      } else {
        console.log('HomeScreen: User profile already available');
      }

      // Try to get current location (with timeout to prevent hanging)
      console.log('HomeScreen: Getting current location...');
      try {
        const locationTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Location timeout after 3 seconds')), 3000)
        );
        await Promise.race([
          dispatch(getCurrentLocation()).unwrap(),
          locationTimeout
        ]);
        console.log('HomeScreen: Location obtained successfully');
      } catch (locationError) {
        console.log('HomeScreen: Location access failed:', locationError);
        // Continue without location - app should still work
      }
      
      // Load nearby rides
      console.log('HomeScreen: Loading nearby rides...');
      await loadNearbyRides();
      console.log('HomeScreen: Nearby rides loaded');
      
      // Load AI recommendations
      console.log('HomeScreen: Loading AI recommendations...');
      await loadRecommendations();
      console.log('HomeScreen: AI recommendations loaded');
      
      console.log('HomeScreen: Initialization completed successfully');
    } catch (error) {
      console.log('HomeScreen: Error during initialization:', error);
    } finally {
      console.log('HomeScreen: Setting isInitializing to false');
      setIsInitializing(false);
    }
  };

  const loadNearbyRides = async (): Promise<void> => {
    try {
      if (currentLocation) {
        const response = await ridesApi.getNearbyRides(
          currentLocation.latitude,
          currentLocation.longitude,
          10 // 10km radius
        );
        
        if (response.success) {
          setNearbyRides(response.data?.slice(0, 5) || []); // Show top 5
        }
      } else {
        // For testing without location - show empty rides
        console.log('No location available, showing empty rides list');
        setNearbyRides([]);
      }
    } catch (error) {
      console.log('Error loading nearby rides:', error);
      setNearbyRides([]);
    }
  };

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await Promise.all([loadNearbyRides(), loadRecommendations()]);
    setIsRefreshing(false);
  };

  const handleFindRide = (): void => {
    // Navigate to Search screen for finding rides
    navigation.navigate('Search');
  };

  const handleOfferRide = (): void => {
    // Navigate to Create Ride screen
    navigation.navigate('CreateRide');
  };

  const handleViewRide = (rideId: string): void => {
    navigation.navigate('RideDetails', { rideId });
  };

  const handleEmergency = (): void => {
    // Check if there's already an active emergency
    if (EmergencyService.hasActiveEmergency()) {
      const currentEmergency = EmergencyService.getCurrentEmergency();
      if (currentEmergency) {
        Alert.alert(
          '🚨 Active Emergency',
          `You have an active ${currentEmergency.type} emergency alert since ${new Date(currentEmergency.timestamp).toLocaleTimeString()}.`,
          [
            { text: 'View Details', onPress: () => showActiveEmergencyDetails(currentEmergency) },
            { text: 'I\'m Safe Now', onPress: () => resolveCurrentEmergency() },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }
    }

    // Show emergency alert modal
    setShowEmergencyModal(true);
  };

  const showActiveEmergencyDetails = (emergency: EmergencyAlert): void => {
    Alert.alert(
      '🚨 Emergency Details',
      `Type: ${emergency.type.toUpperCase()}\nTime: ${new Date(emergency.timestamp).toLocaleString()}\nLocation: ${emergency.location.latitude.toFixed(4)}, ${emergency.location.longitude.toFixed(4)}`,
      [
        { text: 'Call 911', onPress: () => EmergencyService.callEmergencyServices() },
        { text: 'Call Emergency Contact', onPress: () => EmergencyService.callPrimaryContact() },
        { text: 'I\'m Safe', onPress: () => resolveCurrentEmergency() },
        { text: 'Cancel', style: 'cancel' }
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
      '🚨 Emergency Alert Sent',
      'Your emergency alert has been sent to your emergency contacts and your location is being shared.',
      [{ text: 'OK' }]
    );
  };

  const loadRecommendations = async (): Promise<void> => {
    try {
      if (user?.id) {
        const request = {
          userId: user.id,
          context: {
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            weather: 'clear',
            urgency: 'low' as const,
            budget: 'normal' as const,
            purpose: 'other' as const,
          },
          requestType: 'all' as const,
          currentLocation: currentLocation ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          } : undefined,
        };
        
        const response = await AIRecommendationsService.getRecommendations(request);
        setRecommendations(response);
      }
    } catch (error) {
      console.log('Error loading recommendations:', error);
      setRecommendations(null);
    }
  };

  const renderQuickActions = (): React.ReactNode => (
    <View style={styles.quickActions}>
      <TouchableOpacity
        style={[styles.actionCard, styles.primaryAction]}
        onPress={handleFindRide}
        activeOpacity={0.8}
      >
        <Icon name="search" size={28} color="#FFFFFF" />
        <Text style={styles.primaryActionText}>Find a Ride</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionCard, styles.secondaryAction]}
        onPress={handleOfferRide}
        activeOpacity={0.8}
      >
        <Icon name="add-circle-outline" size={28} color="#2196F3" />
        <Text style={styles.secondaryActionText}>Offer a Ride</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNearbyRides = (): React.ReactNode => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Nearby Rides</Text>
        <TouchableOpacity onPress={() => (navigation as any).navigate('Home')}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      {nearbyRides.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.ridesContainer}>
            {nearbyRides.map((ride) => (
              <TouchableOpacity
                key={ride.id}
                style={styles.rideCard}
                onPress={() => handleViewRide(ride.id)}
                activeOpacity={0.8}
              >
                <View style={styles.rideHeader}>
                  <View style={styles.driverInfo}>
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverInitial}>
                        {ride.driver?.firstName?.charAt(0) || 'U'}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.driverName}>
                        {ride.driver?.firstName} {ride.driver?.lastName}
                      </Text>
                      <View style={styles.ratingContainer}>
                        <Icon name="star" size={14} color="#FF9800" />
                        <Text style={styles.rating}>{ride.driver?.rating || '4.5'}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.price}>${ride.pricePerSeat}</Text>
                </View>

                <View style={styles.routeInfo}>
                  <View style={styles.routePoint}>
                    <Icon name="radio-button-checked" size={12} color="#4CAF50" />
                    <Text style={styles.routeText} numberOfLines={1}>
                      {ride.origin?.address || 'Origin'}
                    </Text>
                  </View>
                  <View style={styles.routeLine} />
                  <View style={styles.routePoint}>
                    <Icon name="location-on" size={12} color="#F44336" />
                    <Text style={styles.routeText} numberOfLines={1}>
                      {ride.destination?.address || 'Destination'}
                    </Text>
                  </View>
                </View>

                <View style={styles.rideDetails}>
                  <View style={styles.detailItem}>
                    <Icon name="schedule" size={14} color="#666666" />
                    <Text style={styles.detailText}>
                      {new Date(ride.departureTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Icon name="person" size={14} color="#666666" />
                    <Text style={styles.detailText}>{ride.availableSeats} seats</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Icon name="near-me" size={48} color="#CCCCCC" />
          <Text style={styles.emptyStateText}>No nearby rides found</Text>
          <Text style={styles.emptyStateSubtext}>
            Try searching in different locations or offer your own ride
          </Text>
        </View>
      )}
    </View>
  );

  const renderWelcomeSection = (): React.ReactNode => (
    <View style={styles.welcomeSection}>
      <Text style={styles.welcomeText}>
        Good {getGreeting()}, {user?.firstName || 'there'}!
      </Text>
      <Text style={styles.welcomeSubtext}>Where would you like to go today?</Text>
      
      {currentLocation && (
        <View style={styles.locationInfo}>
          <Icon name="location-on" size={16} color="#666666" />
          <Text style={styles.locationText} numberOfLines={1}>
            {currentLocation.address || 'Current location'}
          </Text>
        </View>
      )}
    </View>
  );

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  const renderAIRecommendations = (): React.ReactNode => {
    if (!recommendations || recommendations.recommendations.length === 0) {
      return null;
    }

    const topRecommendations = recommendations.recommendations.slice(0, 2);

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.aiSectionTitle}>
            <Icon name="auto-awesome" size={20} color="#2196F3" />
            <Text style={styles.sectionTitle}>AI Recommendations</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('AIRecommendations')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.recommendationsContainer}>
            {topRecommendations.map((recommendation) => {
              const getIcon = () => {
                switch (recommendation.type) {
                  case 'route': return 'route';
                  case 'driver': return 'person';
                  case 'timing': return 'schedule';
                  case 'price': return 'attach-money';
                  default: return 'lightbulb-outline';
                }
              };

              const getColor = () => {
                switch (recommendation.impact) {
                  case 'high': return '#4CAF50';
                  case 'medium': return '#FF9800';
                  case 'low': return '#2196F3';
                  default: return '#9E9E9E';
                }
              };

              return (
                <TouchableOpacity
                  key={recommendation.id}
                  style={styles.recommendationCard}
                  onPress={() => navigation.navigate('AIRecommendations')}
                  activeOpacity={0.8}
                >
                  <View style={styles.recommendationHeader}>
                    <View style={[styles.recommendationIcon, { backgroundColor: getColor() + '20' }]}>
                      <Icon name={getIcon()} size={24} color={getColor()} />
                    </View>
                    <View style={[styles.confidenceBadge, { backgroundColor: getColor() }]}>
                      <Text style={styles.confidenceText}>
                        {Math.round(recommendation.confidence * 100)}%
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.recommendationTitle} numberOfLines={2}>
                    {recommendation.title}
                  </Text>
                  <Text style={styles.recommendationDescription} numberOfLines={3}>
                    {recommendation.description}
                  </Text>
                  {recommendation.actionable && (
                    <View style={styles.recommendationAction}>
                      <Icon name="touch-app" size={14} color={getColor()} />
                      <Text style={[styles.actionText, { color: getColor() }]}>Take Action</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {renderWelcomeSection()}
        {renderQuickActions()}
        {renderAIRecommendations()}
        {renderNearbyRides()}

        {/* Emergency Button */}
        <TouchableOpacity
          style={[
            styles.emergencyButton,
            activeEmergency && styles.emergencyButtonActive
          ]}
          onPress={handleEmergency}
          activeOpacity={0.8}
        >
          <Icon 
            name={activeEmergency ? "warning" : "emergency"} 
            size={20} 
            color="#FFFFFF" 
          />
          <Text style={styles.emergencyText}>
            {activeEmergency ? "EMERGENCY ACTIVE" : "Emergency"}
          </Text>
        </TouchableOpacity>
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
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  welcomeSection: {
    padding: 20,
    paddingBottom: 10,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  primaryAction: {
    backgroundColor: colors.primary,
  },
  secondaryAction: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  secondaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  ridesContainer: {
    flexDirection: 'row',
    gap: 16,
    paddingRight: 20,
  },
  rideCard: {
    width: width * 0.75,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInitial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  driverName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 12,
    color: '#666666',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  routeInfo: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  routeLine: {
    width: 1,
    height: 16,
    backgroundColor: '#CCCCCC',
    marginLeft: 5,
    marginBottom: 4,
  },
  routeText: {
    fontSize: 12,
    color: '#666666',
    flex: 1,
  },
  rideDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#666666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    elevation: 4,
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  emergencyButtonActive: {
    backgroundColor: '#FF5722',
    shadowColor: '#FF5722',
  },
  emergencyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  aiSectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendationsContainer: {
    flexDirection: 'row',
    gap: 16,
    paddingRight: 20,
  },
  recommendationCard: {
    width: width * 0.7,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
    lineHeight: 18,
  },
  recommendationDescription: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
    marginBottom: 12,
  },
  recommendationAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default HomeScreen;