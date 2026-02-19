/**
 * @fileoverview Search screen for finding intercity rides
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-02-05
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { searchRides, setSearchFilters } from '../../store/slices/ridesSlice';
import { getCurrentLocation } from '../../store/slices/locationSlice';
import { locationService } from '../../services/LocationService';
import { ridesApi } from '../../services/api/ridesApi';
import type { Location } from '../../services/api/ridesApi';
import logger from '../../services/LoggingService';

const log = logger.createLogger('SearchScreen');

const VEHICLE_TYPES = ['Any', 'Sedan', 'SUV', 'Minivan', 'Pickup'] as const;

interface PopularRoute {
  origin: Location;
  destination: Location;
  count: number;
  averagePrice: number;
}

const SearchScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<{ navigate: (screen: string, params?: Record<string, unknown>) => void }>();
  const { searchResults, searchLoading, searchFilters } = useAppSelector((state) => state.rides);
  const { currentLocation } = useAppSelector((state) => state.location);

  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    departureDate: new Date(),
    passengers: 1,
    maxPrice: '',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('Any');
  const [flexibleDates, setFlexibleDates] = useState(false);

  // Popular routes
  const [popularRoutes, setPopularRoutes] = useState<PopularRoute[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  useEffect(() => {
    if (!currentLocation) {
      dispatch(getCurrentLocation());
    }
  }, [currentLocation, dispatch]);

  useEffect(() => {
    loadPopularRoutes();
  }, []);

  useEffect(() => {
    const isValid = formData.origin.length > 0 &&
                   formData.destination.length > 0 &&
                   formData.passengers > 0;
    setIsFormValid(isValid);
  }, [formData]);

  const loadPopularRoutes = useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const response = await ridesApi.getPopularRoutes();
      if (response.success && response.data) {
        setPopularRoutes(response.data);
      }
    } catch (error) {
      // Silently fail - popular routes are optional
      log.warn('Failed to load popular routes:', error);
    } finally {
      setLoadingRoutes(false);
    }
  }, []);

  const handleInputChange = (field: keyof typeof formData, value: string | number | boolean): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (_event: unknown, selectedDate?: Date): void => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData(prev => ({ ...prev, departureDate: selectedDate }));
    }
  };

  const handleUseCurrentLocation = (): void => {
    if (currentLocation?.address) {
      setFormData(prev => ({ ...prev, origin: currentLocation.address || '' }));
    } else {
      Alert.alert(
        'Location Not Available',
        'Unable to get your current location. Please enter manually.'
      );
    }
  };

  const handleSwapLocations = (): void => {
    setFormData(prev => ({
      ...prev,
      origin: prev.destination,
      destination: prev.origin,
    }));
  };

  const handlePopularRoutePress = (route: PopularRoute): void => {
    setFormData(prev => ({
      ...prev,
      origin: route.origin.address,
      destination: route.destination.address,
    }));
  };

  const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number }> => {
    const results = await locationService.geocodeAddressDetailed(address);
    if (results.length > 0) {
      return { latitude: results[0].latitude, longitude: results[0].longitude };
    }
    throw new Error(`Could not find location: "${address}"`);
  };

  const handleSearch = async (): Promise<void> => {
    if (!isFormValid) return;

    setIsGeocoding(true);
    setHasSearched(true);

    try {
      // Geocode origin - use current GPS coords if available and address matches
      let originCoords: { latitude: number; longitude: number };
      if (currentLocation?.address && formData.origin === currentLocation.address) {
        originCoords = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        };
      } else {
        originCoords = await geocodeAddress(formData.origin);
      }

      // Geocode destination
      const destCoords = await geocodeAddress(formData.destination);

      setIsGeocoding(false);

      dispatch(setSearchFilters({
        passengers: formData.passengers,
        maxPrice: formData.maxPrice ? parseFloat(formData.maxPrice) : undefined,
      }));

      const searchParams = {
        origin: {
          latitude: originCoords.latitude,
          longitude: originCoords.longitude,
          address: formData.origin,
        },
        destination: {
          latitude: destCoords.latitude,
          longitude: destCoords.longitude,
          address: formData.destination,
        },
        departureDate: formData.departureDate,
        passengers: formData.passengers,
        maxPrice: formData.maxPrice ? parseFloat(formData.maxPrice) : undefined,
        maxDistance: 500,
      };

      await dispatch(searchRides(searchParams)).unwrap();
    } catch (error: unknown) {
      setIsGeocoding(false);
      const errMsg = error instanceof Error ? error.message : String(error);
      Alert.alert('Search Failed', errMsg || 'Unable to search for rides');
    }
  };

  const handleRidePress = (rideId: string): void => {
    navigation.navigate('RideDetails', { rideId });
  };

  const handleBookPress = (rideId: string): void => {
    navigation.navigate('Booking', { rideId });
  };

  const formatPrice = (amount: number): string => {
    return `P${amount.toFixed(2)}`;
  };

  const renderFilters = (): React.ReactNode => (
    <View style={styles.filtersSection}>
      {/* Vehicle type chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChipsRow}
      >
        {VEHICLE_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterChip,
              selectedVehicleType === type && styles.filterChipActive,
            ]}
            onPress={() => setSelectedVehicleType(type)}
          >
            <Text style={[
              styles.filterChipText,
              selectedVehicleType === type && styles.filterChipTextActive,
            ]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Flexible dates toggle */}
      <TouchableOpacity
        style={[styles.flexDateToggle, flexibleDates && styles.flexDateToggleActive]}
        onPress={() => setFlexibleDates(!flexibleDates)}
      >
        <Icon
          name="date-range"
          size={16}
          color={flexibleDates ? '#FFFFFF' : '#3B82F6'}
        />
        <Text style={[
          styles.flexDateText,
          flexibleDates && styles.flexDateTextActive,
        ]}>
          +/- 1 day
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderPassengerSelector = (): React.ReactNode => (
    <View style={styles.passengerSelector}>
      <Text style={styles.inputLabel}>Passengers</Text>
      <View style={styles.passengerControls}>
        <TouchableOpacity
          style={[
            styles.passengerButton,
            formData.passengers <= 1 && styles.passengerButtonDisabled,
          ]}
          onPress={() => handleInputChange('passengers', Math.max(1, formData.passengers - 1))}
          disabled={formData.passengers <= 1}
        >
          <Icon name="remove" size={20} color={formData.passengers <= 1 ? '#CCCCCC' : '#3B82F6'} />
        </TouchableOpacity>

        <Text style={styles.passengerCount}>{formData.passengers}</Text>

        <TouchableOpacity
          style={[
            styles.passengerButton,
            formData.passengers >= 7 && styles.passengerButtonDisabled,
          ]}
          onPress={() => handleInputChange('passengers', Math.min(7, formData.passengers + 1))}
          disabled={formData.passengers >= 7}
        >
          <Icon name="add" size={20} color={formData.passengers >= 7 ? '#CCCCCC' : '#3B82F6'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPopularRoutes = (): React.ReactNode => {
    if (hasSearched || popularRoutes.length === 0) return null;

    return (
      <View style={styles.popularSection}>
        <Text style={styles.sectionTitle}>Popular Routes</Text>
        {loadingRoutes ? (
          <ActivityIndicator size="small" color="#3B82F6" style={{ marginVertical: 12 }} />
        ) : (
          popularRoutes.slice(0, 5).map((route, index) => (
            <TouchableOpacity
              key={index}
              style={styles.popularRouteCard}
              onPress={() => handlePopularRoutePress(route)}
              activeOpacity={0.7}
            >
              <View style={styles.popularRouteIcon}>
                <Icon name="trending-up" size={20} color="#3B82F6" />
              </View>
              <View style={styles.popularRouteInfo}>
                <Text style={styles.popularRouteText} numberOfLines={1}>
                  {route.origin.address} → {route.destination.address}
                </Text>
                <View style={styles.popularRouteMeta}>
                  <Text style={styles.popularRouteMetaText}>
                    {route.count} rides
                  </Text>
                  <Text style={styles.popularRouteDot}>·</Text>
                  <Text style={styles.popularRouteMetaText}>
                    avg {formatPrice(route.averagePrice)}
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={20} color="#CCCCCC" />
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

  const renderSearchResults = (): React.ReactNode => {
    if (isGeocoding) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Finding location...</Text>
        </View>
      );
    }

    if (searchLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Searching for rides...</Text>
        </View>
      );
    }

    if (!hasSearched) return null;

    if (searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Icon name="search-off" size={48} color="#CCCCCC" />
          <Text style={styles.emptyStateText}>No rides found</Text>
          <Text style={styles.emptyStateSubtext}>
            Try adjusting your search criteria, or post a ride request so drivers can find you
          </Text>
          <TouchableOpacity
            style={styles.requestRideButton}
            onPress={() => navigation.navigate('RideRequest', {
              origin: formData.origin,
              destination: formData.destination,
            })}
          >
            <Icon name="add-circle-outline" size={18} color="#3B82F6" />
            <Text style={styles.requestRideText}>Post a Ride Request</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Filter results by vehicle type if selected
    const filteredResults = selectedVehicleType === 'Any'
      ? searchResults
      : searchResults.filter(ride =>
          ride.vehicle?.model?.toLowerCase().includes(selectedVehicleType.toLowerCase()) ||
          ride.description?.toLowerCase().includes(selectedVehicleType.toLowerCase())
        );

    return (
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsHeader}>
          {filteredResults.length} ride{filteredResults.length !== 1 ? 's' : ''} found
        </Text>
        {flexibleDates && (
          <View style={styles.flexDateNotice}>
            <Icon name="info-outline" size={14} color="#3B82F6" />
            <Text style={styles.flexDateNoticeText}>
              Showing rides within 1 day of your selected date
            </Text>
          </View>
        )}

        {filteredResults.map((ride) => (
          <TouchableOpacity
            key={ride.id}
            style={styles.rideResultCard}
            activeOpacity={0.8}
            onPress={() => handleRidePress(ride.id)}
          >
            <View style={styles.rideResultHeader}>
              <View style={styles.driverInfo}>
                <View style={styles.driverAvatar}>
                  {ride.driver?.profilePicture ? (
                    <Image
                      source={{ uri: ride.driver.profilePicture }}
                      style={styles.driverAvatarImage}
                    />
                  ) : (
                    <Text style={styles.driverInitial}>
                      {ride.driver?.firstName?.charAt(0) || 'U'}
                    </Text>
                  )}
                </View>
                <View>
                  <Text style={styles.driverName}>
                    {ride.driver?.firstName} {ride.driver?.lastName?.charAt(0)}.
                  </Text>
                  <View style={styles.ratingContainer}>
                    <Icon name="star" size={14} color="#F59E0B" />
                    <Text style={styles.rating}>{ride.driver?.rating || '4.5'}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.price}>{formatPrice(ride.pricePerSeat)}</Text>
                <Text style={styles.priceLabel}>per seat</Text>
              </View>
            </View>

            <View style={styles.routeContainer}>
              <View style={styles.timeInfo}>
                <Text style={styles.timeText}>
                  {new Date(ride.departureTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Text style={styles.dateSmall}>
                  {new Date(ride.departureTime).toLocaleDateString([], {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>

              <View style={styles.routeInfo}>
                <View style={styles.routePoint}>
                  <Icon name="radio-button-checked" size={12} color="#10B981" />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {ride.origin?.address || 'Origin'}
                  </Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routePoint}>
                  <Icon name="location-on" size={12} color="#EF4444" />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {ride.destination?.address || 'Destination'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.rideFooter}>
              <View style={styles.rideDetails}>
                <View style={styles.detailItem}>
                  <Icon name="event-seat" size={14} color="#666666" />
                  <Text style={styles.detailText}>{ride.availableSeats} left</Text>
                </View>
                {ride.distance && (
                  <View style={styles.detailItem}>
                    <Icon name="straighten" size={14} color="#666666" />
                    <Text style={styles.detailText}>{Math.round(ride.distance)}km</Text>
                  </View>
                )}
                {ride.estimatedDuration && (
                  <View style={styles.detailItem}>
                    <Icon name="schedule" size={14} color="#666666" />
                    <Text style={styles.detailText}>
                      {ride.estimatedDuration >= 60
                        ? `${Math.floor(ride.estimatedDuration / 60)}h${ride.estimatedDuration % 60 > 0 ? ` ${ride.estimatedDuration % 60}m` : ''}`
                        : `${ride.estimatedDuration}m`}
                    </Text>
                  </View>
                )}
                {ride.vehicle && (
                  <View style={styles.detailItem}>
                    <Icon name="directions-car" size={14} color="#666666" />
                    <Text style={styles.detailText}>
                      {ride.vehicle.make} {ride.vehicle.model}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.bookButton}
                onPress={() => handleBookPress(ride.id)}
              >
                <Text style={styles.bookButtonText}>Book</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* Search Form */}
        <View style={styles.searchForm}>
          {/* Origin Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>From</Text>
            <View style={styles.inputWrapper}>
              <Icon name="radio-button-checked" size={16} color="#10B981" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Gaborone"
                placeholderTextColor="#999999"
                value={formData.origin}
                onChangeText={(text) => handleInputChange('origin', text)}
                returnKeyType="next"
              />
              <TouchableOpacity
                style={styles.locationButton}
                onPress={handleUseCurrentLocation}
              >
                <Icon name="my-location" size={16} color="#3B82F6" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Swap Button */}
          <View style={styles.swapContainer}>
            <TouchableOpacity style={styles.swapButton} onPress={handleSwapLocations}>
              <Icon name="swap-vert" size={20} color="#666666" />
            </TouchableOpacity>
          </View>

          {/* Destination Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>To</Text>
            <View style={styles.inputWrapper}>
              <Icon name="location-on" size={16} color="#EF4444" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Francistown"
                placeholderTextColor="#999999"
                value={formData.destination}
                onChangeText={(text) => handleInputChange('destination', text)}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Date and Passenger Row */}
          <View style={styles.rowInputs}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Icon name="event" size={16} color="#666666" />
                <Text style={styles.dateText}>
                  {formData.departureDate.toLocaleDateString([], {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              {renderPassengerSelector()}
            </View>
          </View>

          {/* Max Price Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Max Price in BWP (Optional)</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>P</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Maximum price per seat"
                placeholderTextColor="#999999"
                value={formData.maxPrice}
                onChangeText={(text) => handleInputChange('maxPrice', text)}
                keyboardType="numeric"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
            </View>
          </View>

          {/* Filters */}
          {renderFilters()}

          {/* Search Button */}
          <TouchableOpacity
            style={[
              styles.searchButton,
              (!isFormValid || searchLoading || isGeocoding) && styles.searchButtonDisabled,
            ]}
            onPress={handleSearch}
            disabled={!isFormValid || searchLoading || isGeocoding}
            activeOpacity={0.8}
          >
            <Icon name="search" size={20} color="#FFFFFF" />
            <Text style={styles.searchButtonText}>
              {isGeocoding ? 'Locating...' : searchLoading ? 'Searching...' : 'Search Rides'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Popular Routes (shown before search) */}
        {renderPopularRoutes()}

        {/* Search Results */}
        {renderSearchResults()}

        {/* Date Picker Modal */}
        {showDatePicker && (
          <DateTimePicker
            value={formData.departureDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  searchForm: {
    padding: 20,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    height: 48,
  },
  inputIcon: {
    marginRight: 12,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    paddingVertical: 0,
  },
  locationButton: {
    padding: 4,
  },
  swapContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  dateText: {
    fontSize: 14,
    color: '#333333',
  },
  passengerSelector: {
    gap: 8,
  },
  passengerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 48,
  },
  passengerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerButtonDisabled: {
    opacity: 0.3,
  },
  passengerCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginHorizontal: 20,
  },
  // Filters
  filtersSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  flexDateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    gap: 4,
  },
  flexDateToggleActive: {
    backgroundColor: '#3B82F6',
  },
  flexDateText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  flexDateTextActive: {
    color: '#FFFFFF',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  searchButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Popular Routes
  popularSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  popularRouteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    gap: 12,
  },
  popularRouteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularRouteInfo: {
    flex: 1,
  },
  popularRouteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  popularRouteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  popularRouteMetaText: {
    fontSize: 12,
    color: '#999999',
  },
  popularRouteDot: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  // Loading / Empty
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
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
    marginBottom: 20,
  },
  requestRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  requestRideText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  flexDateNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  flexDateNoticeText: {
    fontSize: 12,
    color: '#3B82F6',
  },
  // Results
  resultsContainer: {
    padding: 20,
  },
  resultsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  rideResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  rideResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  driverAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  priceLabel: {
    fontSize: 12,
    color: '#666666',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  timeInfo: {
    alignItems: 'center',
    minWidth: 48,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  dateSmall: {
    fontSize: 11,
    color: '#999999',
    marginTop: 2,
  },
  routeInfo: {
    flex: 1,
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
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rideDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    flex: 1,
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
  bookButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SearchScreen;
