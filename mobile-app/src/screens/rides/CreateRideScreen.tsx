/**
 * @fileoverview Create ride screen for drivers to offer rides
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
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
  Switch,
  TextInput,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { Button, Input, Card } from '../../components/ui';
import { LocationPicker } from '../../components/maps';
import PriceSuggestionService, { PriceSuggestion } from '../../services/PriceSuggestionService';
import { ridesApi } from '../../services/api';
import { LocationData } from '../../services/LocationService';

interface CreateRideFormData {
  origin: LocationData | null;
  destination: LocationData | null;
  departureDateTime: Date;
  /**
   * Stops between origin and destination, in travel order. Empty for a direct
   * trip. `fare` is what a passenger riding from the origin to this stop pays,
   * so it rises along the route and stays under the full price of the ride.
   */
  stops: Array<{ location: LocationData; fare: string }>;
  availableSeats: number;
  pricePerSeat: string;
  description: string;
  preferences: {
    smokingAllowed: boolean;
    petsAllowed: boolean;
    musicAllowed: boolean;
  };
  amenities: string[];
  vehicleId?: string;
}

interface CreateRideScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void; replace: (screen: string, params?: Record<string, unknown>) => void };
}

const CreateRideScreen: React.FC<CreateRideScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { profile: user } = useAppSelector((state) => state.user);
  
  const [formData, setFormData] = useState<CreateRideFormData>({
    origin: null,
    destination: null,
    departureDateTime: new Date(Date.now() + 3600000), // 1 hour from now
    stops: [],
    availableSeats: 3,
    pricePerSeat: '',
    description: '',
    preferences: {
      smokingAllowed: false,
      petsAllowed: true,
      musicAllowed: true,
    },
    amenities: [],
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] =
    useState<'origin' | 'destination' | number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState<PriceSuggestion | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableAmenities = [
    { id: 'wifi', label: 'WiFi', icon: 'wifi' },
    { id: 'charger', label: 'Phone Charger', icon: 'battery-charging-full' },
    { id: 'ac', label: 'Air Conditioning', icon: 'ac-unit' },
    { id: 'music', label: 'Music System', icon: 'music-note' },
    { id: 'snacks', label: 'Snacks', icon: 'local-dining' },
    { id: 'luggage', label: 'Luggage Space', icon: 'luggage' },
  ];

  // Auto-select user's first vehicle
  useEffect(() => {
    if (user?.vehicles && user.vehicles.length > 0 && !formData.vehicleId) {
      const activeVehicle = user.vehicles.find((v: { id: string; status?: string }) => v.status === 'active') || user.vehicles[0];
      setFormData(prev => ({ ...prev, vehicleId: activeVehicle.id }));
    }
  }, [user]);

  useEffect(() => {
    validateForm();
  }, [formData]);

  /*
   * What comparable rides charged, once the driver has picked both ends.
   *
   * Advice, not a default: the field is never filled in for them. A driver
   * knows things about their own trip that completed rides do not capture,
   * and the point is to inform the decision rather than make it.
   */
  useEffect(() => {
    const origin = formData.origin;
    const destination = formData.destination;

    if (!origin || !destination) {
      setPriceSuggestion(null);
      return;
    }

    let cancelled = false;

    PriceSuggestionService.forRoute(
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
    ).then((suggestion) => {
      if (!cancelled) {
        setPriceSuggestion(suggestion);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [formData.origin, formData.destination]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.origin) {
      newErrors.origin = 'Pickup location is required';
    }

    if (!formData.destination) {
      newErrors.destination = 'Destination is required';
    }

    if (formData.departureDateTime <= new Date()) {
      newErrors.departureDateTime = 'Departure time must be in the future';
    }

    if (formData.availableSeats < 1 || formData.availableSeats > 7) {
      newErrors.availableSeats = 'Available seats must be between 1 and 7';
    }

    const price = parseFloat(formData.pricePerSeat);
    if (!formData.pricePerSeat || isNaN(price) || price < 0) {
      newErrors.pricePerSeat = 'Valid price is required';
    } else if (price > 5000) {
      newErrors.pricePerSeat = 'Price cannot exceed P5,000';
    }

    // Stop fares must climb along the route and stop short of the full price,
    // or a passenger going part of the way could be charged more than one
    // going the whole way. The server enforces this too; catching it here
    // means the driver sees which stop is wrong while they are still editing.
    let previousFare = 0;
    formData.stops.forEach((stop, index) => {
      if (!stop.location) {
        newErrors[`stop-${index}`] = 'Choose a location for this stop';
        return;
      }

      const fare = parseFloat(stop.fare);

      if (!stop.fare || isNaN(fare)) {
        newErrors[`stop-${index}`] = 'Enter the fare to this stop';
      } else if (fare <= previousFare) {
        newErrors[`stop-${index}`] = index === 0
          ? 'Fare must be more than 0'
          : 'Fare must be more than the previous stop';
      } else if (!isNaN(price) && fare >= price) {
        newErrors[`stop-${index}`] = 'Fare must be less than the full trip price';
      } else {
        previousFare = fare;
      }
    });

    setErrors(newErrors);
  };

  const isFormValid = () => {
    return Object.keys(errors).length === 0 && 
           formData.origin && 
           formData.destination && 
           formData.pricePerSeat;
  };

  const handleLocationSelect = (
    target: 'origin' | 'destination' | number,
    location: LocationData,
  ) => {
    setFormData(prev => {
      if (typeof target === 'number') {
        const stops = [...prev.stops];
        stops[target] = { ...stops[target], location };
        return { ...prev, stops };
      }

      return { ...prev, [target]: location };
    });
    setShowLocationPicker(null);
  };

  const handleAddStop = () => {
    setFormData(prev => ({
      ...prev,
      stops: [...prev.stops, { location: null as unknown as LocationData, fare: '' }],
    }));
  };

  const handleRemoveStop = (index: number) => {
    setFormData(prev => ({
      ...prev,
      stops: prev.stops.filter((_, i) => i !== index),
    }));
  };

  const handleStopFareChange = (index: number, fare: string) => {
    setFormData(prev => {
      const stops = [...prev.stops];
      stops[index] = { ...stops[index], fare };
      return { ...prev, stops };
    });
  };

  const handleDateChange = (event: unknown, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDateTime = new Date(formData.departureDateTime);
      newDateTime.setFullYear(selectedDate.getFullYear());
      newDateTime.setMonth(selectedDate.getMonth());
      newDateTime.setDate(selectedDate.getDate());
      setFormData(prev => ({ ...prev, departureDateTime: newDateTime }));
    }
  };

  const handleTimeChange = (event: unknown, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDateTime = new Date(formData.departureDateTime);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setFormData(prev => ({ ...prev, departureDateTime: newDateTime }));
    }
  };

  const handleSeatCountChange = (increment: boolean) => {
    setFormData(prev => ({
      ...prev,
      availableSeats: increment 
        ? Math.min(7, prev.availableSeats + 1)
        : Math.max(1, prev.availableSeats - 1)
    }));
  };

  const handlePreferenceToggle = (preference: keyof typeof formData.preferences) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [preference]: !prev.preferences[preference],
      },
    }));
  };

  const handleAmenityToggle = (amenityId: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter(id => id !== amenityId)
        : [...prev.amenities, amenityId],
    }));
  };

  const handleCreateRide = async () => {
    if (!isFormValid()) {
      Alert.alert('Form Error', 'Please fix all errors before creating the ride');
      return;
    }

    setIsCreating(true);
    try {
      const originData = formData.origin!;
      const destData = formData.destination!;
      const rideData = {
        origin: {
          latitude: originData.latitude,
          longitude: originData.longitude,
          address: originData.address?.fullAddress || 'Unknown location',
        },
        destination: {
          latitude: destData.latitude,
          longitude: destData.longitude,
          address: destData.address?.fullAddress || 'Unknown location',
        },
        departureTime: formData.departureDateTime.toISOString(),
        stops: formData.stops.map(stop => ({
          latitude: stop.location.latitude,
          longitude: stop.location.longitude,
          address: stop.location.address?.fullAddress || 'Unknown location',
          fareFromOrigin: parseFloat(stop.fare),
        })),
        availableSeats: formData.availableSeats,
        pricePerSeat: parseFloat(formData.pricePerSeat),
        description: formData.description.trim(),
        preferences: formData.preferences,
        amenities: formData.amenities,
        vehicleId: formData.vehicleId || 'default-vehicle-id',
      };

      const response = await ridesApi.createRide(rideData);
      
      if (response.success) {
        Alert.alert(
          'Ride Created!',
          'Your ride has been created successfully. Passengers can now book it.',
          [
            {
              text: 'View Ride',
              onPress: () => {
                navigation.replace('RideDetails', { rideId: response.data?.id || 'unknown' });
              },
            },
            {
              text: 'Create Another',
              onPress: () => {
                // Reset form
                setFormData({
                  origin: null,
                  destination: null,
                  departureDateTime: new Date(Date.now() + 3600000),
                  stops: [],
                  availableSeats: 3,
                  pricePerSeat: '',
                  description: '',
                  preferences: {
                    smokingAllowed: false,
                    petsAllowed: true,
                    musicAllowed: true,
                  },
                  amenities: [],
                });
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to create ride');
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errMsg || 'Failed to create ride');
    } finally {
      setIsCreating(false);
    }
  };

  const renderLocationCard = (
    type: 'origin' | 'destination',
    location: LocationData | null,
    title: string,
    icon: string,
    error?: string
  ) => (
    <Card
      onPress={() => setShowLocationPicker(type)}
      style={error ? {...styles.locationCard, ...styles.errorCard} : styles.locationCard}
    >
      <View style={styles.locationCardContent}>
        <Icon name={icon} size={24} color={location ? '#2196F3' : '#CCCCCC'} />
        <View style={styles.locationText}>
          <Text style={styles.locationTitle}>{title}</Text>
          <Text style={[
            styles.locationAddress,
            !location && styles.placeholderText
          ]}>
            {location?.address?.fullAddress || 'Tap to select location'}
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color="#CCCCCC" />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </Card>
  );

  /**
   * Stops the driver picks up and drops off at along the way.
   *
   * Sits between pickup and destination because that is where they are on the
   * road. Each carries the fare to that point, which is what lets a passenger
   * travelling only part of the route be charged only for that part — and what
   * frees the seat for the rest of the journey once they get out.
   */
  const renderStopsCard = () => (
    <Card style={styles.stopsCard}>
      <View style={styles.stopsHeader}>
        <Text style={styles.sectionTitle}>Stops Along the Way</Text>
        <TouchableOpacity onPress={handleAddStop} style={styles.addStopButton}>
          <Icon name="add" size={20} color="#2196F3" />
          <Text style={styles.addStopText}>Add stop</Text>
        </TouchableOpacity>
      </View>

      {formData.stops.length === 0 ? (
        <Text style={styles.stopsHint}>
          Going straight there? Leave this empty. Add a stop if passengers can
          get on or off part-way — their seat then frees up for the rest of
          the trip.
        </Text>
      ) : (
        formData.stops.map((stop, index) => (
          <View key={`stop-${index}`} style={styles.stopRow}>
            <View style={styles.stopIndexBadge}>
              <Text style={styles.stopIndexText}>{index + 1}</Text>
            </View>

            <View style={styles.stopFields}>
              <TouchableOpacity
                style={styles.stopLocationButton}
                onPress={() => setShowLocationPicker(index)}
              >
                <Icon name="place" size={18} color={stop.location ? '#2196F3' : '#CCCCCC'} />
                <Text
                  style={[
                    styles.stopLocationText,
                    !stop.location && styles.placeholderText,
                  ]}
                  numberOfLines={1}
                >
                  {stop.location?.address?.fullAddress || 'Tap to choose where'}
                </Text>
              </TouchableOpacity>

              <View style={styles.stopFareRow}>
                <Text style={styles.stopFareLabel}>Fare to here</Text>
                <TextInput
                  style={styles.stopFareInput}
                  value={stop.fare}
                  onChangeText={(value: string) => handleStopFareChange(index, value)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  accessibilityLabel={`Fare from pickup to stop ${index + 1}`}
                />
              </View>

              {errors[`stop-${index}`] && (
                <Text style={styles.errorText}>{errors[`stop-${index}`]}</Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => handleRemoveStop(index)}
              style={styles.removeStopButton}
              accessibilityLabel={`Remove stop ${index + 1}`}
            >
              <Icon name="close" size={20} color="#999999" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </Card>
  );

  const renderDateTimeCard = () => (
    <Card style={styles.dateTimeCard}>
      <Text style={styles.sectionTitle}>Departure Time</Text>
      <View style={styles.dateTimeRow}>
        <TouchableOpacity
          style={[styles.dateTimeButton, errors.departureDateTime ? styles.errorButton : undefined]}
          onPress={() => setShowDatePicker(true)}
        >
          <Icon name="event" size={20} color="#666666" />
          <Text style={styles.dateTimeText}>
            {formData.departureDateTime.toLocaleDateString()}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.dateTimeButton, errors.departureDateTime ? styles.errorButton : undefined]}
          onPress={() => setShowTimePicker(true)}
        >
          <Icon name="access-time" size={20} color="#666666" />
          <Text style={styles.dateTimeText}>
            {formData.departureDateTime.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </TouchableOpacity>
      </View>
      {errors.departureDateTime && (
        <Text style={styles.errorText}>{errors.departureDateTime}</Text>
      )}
    </Card>
  );

  const renderSeatsAndPriceCard = () => (
    <Card style={styles.seatsCard}>
      <View style={styles.seatsRow}>
        <View style={styles.seatsSection}>
          <Text style={styles.sectionTitle}>Available Seats</Text>
          <View style={styles.seatsControls}>
            <TouchableOpacity
              style={[styles.seatButton, formData.availableSeats <= 1 && styles.seatButtonDisabled]}
              onPress={() => handleSeatCountChange(false)}
              disabled={formData.availableSeats <= 1}
            >
              <Icon name="remove" size={20} color={formData.availableSeats <= 1 ? '#CCCCCC' : '#2196F3'} />
            </TouchableOpacity>
            <Text style={styles.seatCount}>{formData.availableSeats}</Text>
            <TouchableOpacity
              style={[styles.seatButton, formData.availableSeats >= 7 && styles.seatButtonDisabled]}
              onPress={() => handleSeatCountChange(true)}
              disabled={formData.availableSeats >= 7}
            >
              <Icon name="add" size={20} color={formData.availableSeats >= 7 ? '#CCCCCC' : '#2196F3'} />
            </TouchableOpacity>
          </View>
          {errors.availableSeats && (
            <Text style={styles.errorText}>{errors.availableSeats}</Text>
          )}
        </View>

        <View style={styles.priceSection}>
          <Input
            label="Price per Seat"
            placeholder="P25"
            value={formData.pricePerSeat}
            onChangeText={(text) => setFormData(prev => ({ ...prev, pricePerSeat: text }))}
            keyboardType="numeric"
            leftIcon="attach-money"
            error={errors.pricePerSeat}
            containerStyle={styles.priceInput}
          />

          {priceSuggestion?.suggested != null && (
            <TouchableOpacity
              style={styles.suggestionRow}
              onPress={() => setFormData(prev => ({
                ...prev,
                pricePerSeat: String(priceSuggestion.suggested),
              }))}
            >
              <Icon name="insights" size={16} color="#2196F3" />
              <Text style={styles.suggestionText}>
                {priceSuggestion.basis === 'comparable_routes'
                  ? `Similar trips charge around P${priceSuggestion.suggested}`
                  : `Trips this length charge around P${priceSuggestion.suggested}`}
                {priceSuggestion.range
                  ? ` (most are P${priceSuggestion.range.low}–P${priceSuggestion.range.high})`
                  : ''}
                {/* The sample size is shown so a driver can weigh the advice
                    rather than take it as fact. */}
                {` · based on ${priceSuggestion.sampleSize} rides`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Card>
  );

  const renderDescriptionCard = () => (
    <Card style={styles.descriptionCard}>
      <Input
        label="Description (Optional)"
        placeholder="Tell passengers about your ride, vehicle, or any special instructions..."
        value={formData.description}
        onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
        multiline
        numberOfLines={3}
        maxLength={500}
        containerStyle={styles.descriptionInput}
      />
      <Text style={styles.characterCount}>
        {formData.description.length}/500
      </Text>
    </Card>
  );

  const renderPreferencesCard = () => (
    <Card style={styles.preferencesCard}>
      <Text style={styles.sectionTitle}>Ride Preferences</Text>
      <View style={styles.preferencesList}>
        <View style={styles.preference}>
          <View style={styles.preferenceLeft}>
            <Icon name="smoking-rooms" size={20} color="#666666" />
            <Text style={styles.preferenceText}>Smoking allowed</Text>
          </View>
          <Switch
            value={formData.preferences.smokingAllowed}
            onValueChange={() => handlePreferenceToggle('smokingAllowed')}
            trackColor={{ false: '#E0E0E0', true: '#2196F3' }}
          />
        </View>

        <View style={styles.preference}>
          <View style={styles.preferenceLeft}>
            <Icon name="pets" size={20} color="#666666" />
            <Text style={styles.preferenceText}>Pets allowed</Text>
          </View>
          <Switch
            value={formData.preferences.petsAllowed}
            onValueChange={() => handlePreferenceToggle('petsAllowed')}
            trackColor={{ false: '#E0E0E0', true: '#2196F3' }}
          />
        </View>

        <View style={styles.preference}>
          <View style={styles.preferenceLeft}>
            <Icon name="music-note" size={20} color="#666666" />
            <Text style={styles.preferenceText}>Music allowed</Text>
          </View>
          <Switch
            value={formData.preferences.musicAllowed}
            onValueChange={() => handlePreferenceToggle('musicAllowed')}
            trackColor={{ false: '#E0E0E0', true: '#2196F3' }}
          />
        </View>
      </View>
    </Card>
  );

  const renderAmenitiesCard = () => (
    <Card style={styles.amenitiesCard}>
      <Text style={styles.sectionTitle}>Available Amenities</Text>
      <View style={styles.amenitiesGrid}>
        {availableAmenities.map((amenity) => (
          <TouchableOpacity
            key={amenity.id}
            style={[
              styles.amenityChip,
              formData.amenities.includes(amenity.id) && styles.amenityChipSelected,
            ]}
            onPress={() => handleAmenityToggle(amenity.id)}
          >
            <Icon
              name={amenity.icon}
              size={16}
              color={formData.amenities.includes(amenity.id) ? '#FFFFFF' : '#666666'}
            />
            <Text style={[
              styles.amenityText,
              formData.amenities.includes(amenity.id) && styles.amenityTextSelected,
            ]}>
              {amenity.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.screenTitle}>Create a New Ride</Text>
          <Text style={styles.screenSubtitle}>
            Share your journey and help others get around
          </Text>

          {renderLocationCard(
            'origin',
            formData.origin,
            'Pickup Location',
            'my-location',
            errors.origin
          )}

          {renderLocationCard(
            'destination',
            formData.destination,
            'Destination',
            'location-on',
            errors.destination
          )}

          {renderStopsCard()}

          {renderDateTimeCard()}
          {renderSeatsAndPriceCard()}
          {renderDescriptionCard()}
          {renderPreferencesCard()}
          {renderAmenitiesCard()}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={isCreating ? 'Creating Ride...' : 'Create Ride'}
          onPress={handleCreateRide}
          disabled={!isFormValid() || isCreating}
          loading={isCreating}
          variant="primary"
          size="large"
          icon="add-circle"
          fullWidth
        />
      </View>

      {/* Location Picker Modal */}
      <LocationPicker
        visible={showLocationPicker !== null}
        onClose={() => setShowLocationPicker(null)}
        onLocationSelect={(location) => {
          if (showLocationPicker !== null) {
            handleLocationSelect(showLocationPicker, location);
          }
        }}
        title={
          showLocationPicker === 'origin'
            ? 'Select Pickup Location'
            : showLocationPicker === 'destination'
              ? 'Select Destination'
              : 'Select Stop'
        }
      />

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={formData.departureDateTime}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={formData.departureDateTime}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
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
    paddingBottom: 100,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  screenSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  locationCard: {
    marginBottom: 16,
    padding: 16,
  },
  errorCard: {
    borderColor: '#F44336',
    borderWidth: 1,
  },
  locationCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    flex: 1,
    marginLeft: 16,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 16,
    color: '#333333',
  },
  placeholderText: {
    color: '#999999',
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 8,
  },
  dateTimeCard: {
    marginBottom: 16,
    padding: 16,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#0D47A1',
  },
  stopsCard: {
    marginBottom: 16,
    padding: 16,
  },
  stopsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  addStopText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  stopsHint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#777777',
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  stopIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  stopIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1976D2',
  },
  stopFields: {
    flex: 1,
    gap: 8,
  },
  stopLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  stopLocationText: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
  },
  stopFareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stopFareLabel: {
    fontSize: 13,
    color: '#666666',
  },
  stopFareInput: {
    minWidth: 90,
    textAlign: 'right',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#333333',
  },
  removeStopButton: {
    padding: 6,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 8,
  },
  errorButton: {
    borderColor: '#F44336',
  },
  dateTimeText: {
    fontSize: 14,
    color: '#333333',
  },
  seatsCard: {
    marginBottom: 16,
    padding: 16,
  },
  seatsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  seatsSection: {
    flex: 1,
  },
  seatsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 8,
  },
  seatButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  seatButtonDisabled: {
    opacity: 0.5,
  },
  seatCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginHorizontal: 16,
  },
  priceSection: {
    flex: 1,
  },
  priceInput: {
    marginBottom: 0,
  },
  descriptionCard: {
    marginBottom: 16,
    padding: 16,
  },
  descriptionInput: {
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'right',
  },
  preferencesCard: {
    marginBottom: 16,
    padding: 16,
  },
  preferencesList: {
    gap: 16,
  },
  preference: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preferenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preferenceText: {
    fontSize: 14,
    color: '#333333',
  },
  amenitiesCard: {
    marginBottom: 16,
    padding: 16,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  amenityChipSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  amenityText: {
    fontSize: 12,
    color: '#666666',
  },
  amenityTextSelected: {
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
});

export default CreateRideScreen;