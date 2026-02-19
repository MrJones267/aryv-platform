/**
 * @fileoverview Ride request screen with AI matching for passengers
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { Button, Card, Input } from '../../components/ui';
import { LocationPicker } from '../../components/maps';
import { LocationData } from '../../services/LocationService';
import AIMatchingService, { 
  MatchingRequest, 
  MatchingResponse, 
  DriverMatch, 
  PassengerProfile, 
  RidePreferences 
} from '../../services/AIMatchingService';
import DriverMatchCard from '../../components/matching/DriverMatchCard';
import logger from '../../services/LoggingService';

const log = logger.createLogger('RideRequestScreen');

interface RideRequestScreenProps {
  navigation?: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
  route?: { params?: Record<string, unknown> };
}

const RideRequestScreen: React.FC<RideRequestScreenProps> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const { profile: user } = useAppSelector((state) => state.user);
  
  const [origin, setOrigin] = useState<LocationData | null>(null);
  const [destination, setDestination] = useState<LocationData | null>(null);
  const [preferences, setPreferences] = useState<RidePreferences>({
    rideType: 'economy',
    maxPassengers: 4,
    amenities: [],
    requiredFeatures: [],
    avoidFeatures: [],
    preferredDriverRating: 4.0,
    prioritizeBy: 'time',
  });
  
  const [isSearching, setIsSearching] = useState(false);
  const [matchingResults, setMatchingResults] = useState<MatchingResponse | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<DriverMatch | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  
  // Mock passenger profile - in production, this would come from user profile
  const passengerProfile: PassengerProfile = {
    id: user?.id || 'passenger-1',
    rating: 4.6,
    totalRides: 23,
    preferences: {
      smokingTolerance: 'none',
      musicPreference: 'moderate',
      conversationLevel: 'friendly',
      petsComfort: 'small',
      temperaturePreference: 'moderate',
    },
    behaviorProfile: {
      punctuality: 0.9,
      cleanliness: 0.85,
      respectfulness: 0.95,
      reliability: 0.88,
    },
    rideHistory: [],
  };

  useEffect(() => {
    // Pre-populate locations from route params if available
    if (route?.params?.origin) {
      setOrigin(route.params.origin as LocationData);
    }
    if (route?.params?.destination) {
      setDestination(route.params.destination as LocationData);
    }
  }, [route?.params]);

  const handleSearchRides = async () => {
    if (!origin || !destination) {
      Alert.alert('Missing Information', 'Please select both pickup and destination locations.');
      return;
    }

    setIsSearching(true);
    try {
      const matchingRequest: MatchingRequest = {
        passengerProfile,
        ridePreferences: preferences,
        origin: {
          latitude: origin.latitude,
          longitude: origin.longitude,
          address: origin.address?.fullAddress,
        },
        destination: {
          latitude: destination.latitude,
          longitude: destination.longitude,
          address: destination.address?.fullAddress,
        },
        requestTime: new Date().toISOString(),
        maxWaitTime: 15, // 15 minutes
        maxDetour: 3, // 3 km
        priceRange: { min: 5, max: 50 },
      };

      const results = await AIMatchingService.findMatches(matchingRequest);
      setMatchingResults(results);
      
      if (results.matches.length === 0) {
        Alert.alert(
          'No Matches Found',
          'No compatible drivers found for your request. Try adjusting your preferences or expanding your search area.',
          [
            { text: 'Adjust Preferences', onPress: () => setShowPreferences(true) },
            { text: 'OK' },
          ]
        );
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      Alert.alert('Search Error', errMsg || 'Failed to find matching rides');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectMatch = (match: DriverMatch) => {
    setSelectedMatch(match);
    
    Alert.alert(
      'Request Ride?',
      `Send ride request to ${match.driver.firstName} ${match.driver.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Ride',
          onPress: () => handleRequestRide(match),
        },
      ]
    );
  };

  const handleRequestRide = async (match: DriverMatch) => {
    try {
      // In production, this would send a ride request to the backend
      log.info('Sending ride request to driver:', match.driver.id);
      
      Alert.alert(
        'Request Sent!',
        `Your ride request has been sent to ${match.driver.firstName}. They will be notified and can accept or decline your request.`,
        [
          {
            text: 'Track Request',
            onPress: () => {
              // Navigate to request tracking screen
              navigation?.navigate('RideTracking', { 
                requestId: `request_${Date.now()}`,
                driverId: match.driver.id,
              });
            },
          },
          { text: 'OK' },
        ]
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      Alert.alert('Request Error', errMsg || 'Failed to send ride request');
    }
  };

  const handleMessageDriver = (driverId: string) => {
    const match = matchingResults?.matches.find(m => m.driver.id === driverId);
    if (match) {
      navigation?.navigate('Chat', {
        messageId: `driver-${driverId}`,
        participantName: `${match.driver.firstName} ${match.driver.lastName}`,
        driverId,
      });
    }
  };

  const renderLocationPicker = () => (
    <Card style={styles.locationCard}>
      <Text style={styles.sectionTitle}>Trip Details</Text>
      
      <View style={styles.locationPickers}>
        <LocationPicker
          visible={false}
          onClose={() => {}}
          onLocationSelect={setOrigin}
          placeholder="Pickup location"
        />
        
        <View style={styles.locationDivider}>
          <Icon name="more-vert" size={20} color="#CCCCCC" />
        </View>
        
        <LocationPicker
          visible={false}
          onClose={() => {}}
          onLocationSelect={setDestination}
          placeholder="Where to?"
        />
      </View>
    </Card>
  );

  const renderRideTypeSelector = () => (
    <Card style={styles.rideTypeCard}>
      <Text style={styles.sectionTitle}>Ride Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.rideTypeList}>
          {[
            { id: 'economy', name: 'Economy', icon: 'directions-car', description: 'Affordable rides' },
            { id: 'comfort', name: 'Comfort', icon: 'airline-seat-recline-extra', description: 'Extra legroom' },
            { id: 'premium', name: 'Premium', icon: 'star', description: 'Luxury vehicles' },
            { id: 'shared', name: 'Shared', icon: 'people', description: 'Split the cost' },
          ].map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.rideTypeItem,
                preferences.rideType === type.id && styles.rideTypeItemSelected,
              ]}
              onPress={() => setPreferences(prev => ({ ...prev, rideType: type.id as 'economy' | 'comfort' | 'premium' | 'shared' }))}
            >
              <Icon 
                name={type.icon} 
                size={24} 
                color={preferences.rideType === type.id ? '#FFFFFF' : '#666666'} 
              />
              <Text style={[
                styles.rideTypeName,
                preferences.rideType === type.id && styles.rideTypeNameSelected,
              ]}>
                {type.name}
              </Text>
              <Text style={[
                styles.rideTypeDescription,
                preferences.rideType === type.id && styles.rideTypeDescriptionSelected,
              ]}>
                {type.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Card>
  );

  const renderQuickPreferences = () => (
    <Card style={styles.preferencesCard}>
      <View style={styles.preferencesHeader}>
        <Text style={styles.sectionTitle}>Quick Preferences</Text>
        <TouchableOpacity 
          style={styles.morePreferencesButton}
          onPress={() => setShowPreferences(true)}
        >
          <Text style={styles.morePreferencesText}>More Options</Text>
          <Icon name="chevron-right" size={16} color="#2196F3" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.quickPreferences}>
        <View style={styles.preferenceItem}>
          <Text style={styles.preferenceLabel}>Max Wait Time</Text>
          <View style={styles.preferenceButtons}>
            {[5, 10, 15].map(time => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.preferenceButton,
                  // Add selected state logic here
                ]}
                onPress={() => {/* Handle preference change */}}
              >
                <Text style={styles.preferenceButtonText}>{time}min</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <View style={styles.preferenceItem}>
          <Text style={styles.preferenceLabel}>Priority</Text>
          <View style={styles.preferenceButtons}>
            {[
              { id: 'time', label: 'Speed' },
              { id: 'price', label: 'Price' },
              { id: 'rating', label: 'Rating' },
            ].map(priority => (
              <TouchableOpacity
                key={priority.id}
                style={[
                  styles.preferenceButton,
                  preferences.prioritizeBy === priority.id && styles.preferenceButtonSelected,
                ]}
                onPress={() => setPreferences(prev => ({ ...prev, prioritizeBy: priority.id as 'time' | 'price' | 'rating' }))}
              >
                <Text style={[
                  styles.preferenceButtonText,
                  preferences.prioritizeBy === priority.id && styles.preferenceButtonTextSelected,
                ]}>
                  {priority.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Card>
  );

  const renderSearchButton = () => (
    <View style={styles.searchButtonContainer}>
      <Button
        title={isSearching ? 'Finding Matches...' : 'Find Matching Drivers'}
        onPress={handleSearchRides}
        disabled={isSearching || !origin || !destination}
        loading={isSearching}
        variant="primary"
        size="large"
        icon="search"
        fullWidth
      />
    </View>
  );

  const renderMatchingResults = () => {
    if (!matchingResults) return null;

    return (
      <View style={styles.resultsContainer}>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            {matchingResults.matches.length} Compatible Driver{matchingResults.matches.length !== 1 ? 's' : ''} Found
          </Text>
          <Text style={styles.resultsSubtitle}>
            Avg. Compatibility: {Math.round(matchingResults.averageCompatibility * 100)}% • 
            Search took {(matchingResults.searchTime / 1000).toFixed(1)}s
          </Text>
        </View>
        
        <ScrollView 
          style={styles.matchesList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isSearching}
              onRefresh={handleSearchRides}
            />
          }
        >
          {matchingResults.matches.map((match, index) => (
            <DriverMatchCard
              key={match.driver.id}
              match={match}
              onSelect={handleSelectMatch}
              onMessage={handleMessageDriver}
            />
          ))}
          
          {matchingResults.recommendations.length > 0 && (
            <Card style={styles.recommendationsCard}>
              <Text style={styles.recommendationsTitle}>Suggestions</Text>
              {matchingResults.recommendations.map((rec, index) => (
                <TouchableOpacity key={index} style={styles.recommendationItem}>
                  <Icon 
                    name={rec.type === 'expand_search' ? 'zoom-out-map' : 
                          rec.type === 'adjust_preferences' ? 'tune' :
                          rec.type === 'try_different_time' ? 'schedule' : 'help-outline'}
                    size={20} 
                    color="#2196F3" 
                  />
                  <View style={styles.recommendationText}>
                    <Text style={styles.recommendationTitle}>{rec.title}</Text>
                    <Text style={styles.recommendationDescription}>{rec.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Card>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.screenTitle}>Request a Ride</Text>
          
          {!matchingResults ? (
            <>
              {renderLocationPicker()}
              {renderRideTypeSelector()}
              {renderQuickPreferences()}
              {renderSearchButton()}
            </>
          ) : (
            <>
              <TouchableOpacity 
                style={styles.newSearchButton}
                onPress={() => {
                  setMatchingResults(null);
                  setSelectedMatch(null);
                }}
              >
                <Icon name="arrow-back" size={20} color="#2196F3" />
                <Text style={styles.newSearchText}>New Search</Text>
              </TouchableOpacity>
              {renderMatchingResults()}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 24,
    textAlign: 'center',
  },
  locationCard: {
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  locationPickers: {
    gap: 0,
  },
  locationPicker: {
    marginBottom: 0,
  },
  locationDivider: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  rideTypeCard: {
    marginBottom: 16,
    padding: 16,
  },
  rideTypeList: {
    flexDirection: 'row',
    gap: 12,
  },
  rideTypeItem: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 100,
    gap: 8,
  },
  rideTypeItemSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  rideTypeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },
  rideTypeNameSelected: {
    color: '#FFFFFF',
  },
  rideTypeDescription: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
  },
  rideTypeDescriptionSelected: {
    color: '#E3F2FD',
  },
  preferencesCard: {
    marginBottom: 16,
    padding: 16,
  },
  preferencesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  morePreferencesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  morePreferencesText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  quickPreferences: {
    gap: 16,
  },
  preferenceItem: {
    gap: 8,
  },
  preferenceLabel: {
    fontSize: 14,
    color: '#666666',
  },
  preferenceButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  preferenceButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  preferenceButtonSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  preferenceButtonText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  preferenceButtonTextSelected: {
    color: '#2196F3',
  },
  searchButtonContainer: {
    marginTop: 8,
  },
  newSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  newSearchText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsHeader: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: 12,
    color: '#666666',
  },
  matchesList: {
    flex: 1,
  },
  recommendationsCard: {
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  recommendationText: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 2,
  },
  recommendationDescription: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
  },
});

export default RideRequestScreen;