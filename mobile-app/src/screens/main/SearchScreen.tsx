/**
 * @fileoverview Search screen for finding rides
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { searchRides, setSearchFilters } from '../../store/slices/ridesSlice';
import { getCurrentLocation } from '../../store/slices/locationSlice';

const SearchScreen: React.FC = () => {
  const dispatch = useAppDispatch();
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

  useEffect(() => {
    // Load current location
    if (!currentLocation) {
      dispatch(getCurrentLocation());
    }
  }, [currentLocation, dispatch]);

  useEffect(() => {
    // Validate form
    const isValid = formData.origin.length > 0 && 
                   formData.destination.length > 0 &&
                   formData.passengers > 0;
    setIsFormValid(isValid);
  }, [formData]);

  const handleInputChange = (field: keyof typeof formData, value: any): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (event: any, selectedDate?: Date): void => {
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

  const handleSearch = async (): Promise<void> => {
    if (!isFormValid) return;

    try {
      // Update search filters in store
      dispatch(setSearchFilters({
        passengers: formData.passengers,
        maxPrice: formData.maxPrice ? parseFloat(formData.maxPrice) : undefined,
      }));

      // Perform search
      const searchParams = {
        origin: {
          latitude: currentLocation?.latitude || 0,
          longitude: currentLocation?.longitude || 0,
          address: formData.origin,
        },
        destination: {
          latitude: 0, // TODO: Geocode destination
          longitude: 0,
          address: formData.destination,
        },
        departureDate: formData.departureDate,
        passengers: formData.passengers,
        maxPrice: formData.maxPrice ? parseFloat(formData.maxPrice) : undefined,
      };

      await dispatch(searchRides(searchParams)).unwrap();
    } catch (error: any) {
      Alert.alert('Search Failed', error.message || 'Unable to search for rides');
    }
  };

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
          <Icon name="remove" size={20} color={formData.passengers <= 1 ? '#CCCCCC' : '#2196F3'} />
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
          <Icon name="add" size={20} color={formData.passengers >= 7 ? '#CCCCCC' : '#2196F3'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchResults = (): React.ReactNode => {
    if (searchLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Searching for rides...</Text>
        </View>
      );
    }

    if (searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Icon name="search-off" size={48} color="#CCCCCC" />
          <Text style={styles.emptyStateText}>No rides found</Text>
          <Text style={styles.emptyStateSubtext}>
            Try adjusting your search criteria or check back later
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsHeader}>
          {searchResults.length} rides found
        </Text>
        
        <ScrollView showsVerticalScrollIndicator={false}>
          {searchResults.map((ride) => (
            <TouchableOpacity
              key={ride.id}
              style={styles.rideResultCard}
              activeOpacity={0.8}
            >
              <View style={styles.rideResultHeader}>
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
                <View style={styles.priceContainer}>
                  <Text style={styles.price}>${ride.pricePerSeat}</Text>
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
              </View>

              <View style={styles.rideFooter}>
                <View style={styles.rideDetails}>
                  <View style={styles.detailItem}>
                    <Icon name="person" size={14} color="#666666" />
                    <Text style={styles.detailText}>{ride.availableSeats} seats</Text>
                  </View>
                  {ride.distance && (
                    <View style={styles.detailItem}>
                      <Icon name="straighten" size={14} color="#666666" />
                      <Text style={styles.detailText}>{ride.distance}km</Text>
                    </View>
                  )}
                  {ride.estimatedDuration && (
                    <View style={styles.detailItem}>
                      <Icon name="schedule" size={14} color="#666666" />
                      <Text style={styles.detailText}>{ride.estimatedDuration}min</Text>
                    </View>
                  )}
                </View>
                
                <TouchableOpacity style={styles.bookButton}>
                  <Text style={styles.bookButtonText}>Book</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
              <Icon name="radio-button-checked" size={16} color="#4CAF50" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Enter pickup location"
                value={formData.origin}
                onChangeText={(text) => handleInputChange('origin', text)}
                returnKeyType="next"
              />
              <TouchableOpacity
                style={styles.locationButton}
                onPress={handleUseCurrentLocation}
              >
                <Icon name="my-location" size={16} color="#2196F3" />
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
              <Icon name="location-on" size={16} color="#F44336" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Enter destination"
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
                  {formData.departureDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              {renderPassengerSelector()}
            </View>
          </View>

          {/* Max Price Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Max Price (Optional)</Text>
            <View style={styles.inputWrapper}>
              <Icon name="attach-money" size={16} color="#666666" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Maximum price per seat"
                value={formData.maxPrice}
                onChangeText={(text) => handleInputChange('maxPrice', text)}
                keyboardType="numeric"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
            </View>
          </View>

          {/* Search Button */}
          <TouchableOpacity
            style={[
              styles.searchButton,
              (!isFormValid || searchLoading) && styles.searchButtonDisabled,
            ]}
            onPress={handleSearch}
            disabled={!isFormValid || searchLoading}
            activeOpacity={0.8}
          >
            <Icon name="search" size={20} color="#FFFFFF" />
            <Text style={styles.searchButtonText}>
              {searchLoading ? 'Searching...' : 'Search Rides'}
            </Text>
          </TouchableOpacity>
        </View>

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
    fontSize: 16,
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
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
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
  },
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
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
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
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
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
    gap: 16,
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
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SearchScreen;