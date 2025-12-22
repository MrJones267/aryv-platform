/**
 * @fileoverview Ride details screen showing comprehensive ride information
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
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppSelector } from '../../store/hooks';
import { ridesApi } from '../../services/api';
import { RideDetailsScreenProps } from '../../navigation/types';

const { width } = Dimensions.get('window');

interface RideDetails {
  id: string;
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    rating: number;
    totalRides: number;
    profileImage?: string;
    phone?: string;
  };
  vehicle: {
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
  };
  origin: {
    address: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    address: string;
    latitude: number;
    longitude: number;
  };
  departureTime: string;
  arrivalTime?: string;
  pricePerSeat: number;
  availableSeats: number;
  totalSeats: number;
  distance: number;
  estimatedDuration: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  description?: string;
  amenities: string[];
  bookings: Array<{
    id: string;
    passenger: {
      firstName: string;
      lastName: string;
      rating: number;
    };
    seatsBooked: number;
    status: string;
  }>;
  preferences: {
    smokingAllowed: boolean;
    petsAllowed: boolean;
    musicAllowed: boolean;
  };
}

const RideDetailsScreen: React.FC<RideDetailsScreenProps> = ({ navigation, route }) => {
  const { rideId } = route.params;
  const { profile: user } = useAppSelector((state) => state.user);
  
  const [ride, setRide] = useState<RideDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);

  useEffect(() => {
    loadRideDetails();
  }, [rideId]);

  const loadRideDetails = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Mock data - replace with actual API call
      const mockRide: RideDetails = {
        id: rideId,
        driver: {
          id: 'driver-123',
          firstName: 'John',
          lastName: 'Smith',
          rating: 4.8,
          totalRides: 156,
          phone: '+1234567890',
        },
        vehicle: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          color: 'Silver',
          licensePlate: 'ABC123',
        },
        origin: {
          address: 'Downtown Shopping Mall, Main Street',
          latitude: 40.7128,
          longitude: -74.0060,
        },
        destination: {
          address: 'Airport Terminal 1, JFK Airport',
          latitude: 40.6413,
          longitude: -73.7781,
        },
        departureTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
        arrivalTime: new Date(Date.now() + 10800000).toISOString(), // 3 hours from now
        pricePerSeat: 25,
        availableSeats: 2,
        totalSeats: 4,
        distance: 45,
        estimatedDuration: 60,
        status: 'confirmed',
        description: 'Comfortable ride to the airport. I\'ll help with luggage if needed.',
        amenities: ['WiFi', 'Phone Charger', 'Air Conditioning', 'Music'],
        bookings: [
          {
            id: 'booking-1',
            passenger: {
              firstName: 'Sarah',
              lastName: 'Johnson',
              rating: 4.9,
            },
            seatsBooked: 1,
            status: 'confirmed',
          },
          {
            id: 'booking-2',
            passenger: {
              firstName: 'Mike',
              lastName: 'Chen',
              rating: 4.7,
            },
            seatsBooked: 1,
            status: 'confirmed',
          },
        ],
        preferences: {
          smokingAllowed: false,
          petsAllowed: true,
          musicAllowed: true,
        },
      };

      setRide(mockRide);
    } catch (error) {
      console.log('Error loading ride details:', error);
      Alert.alert('Error', 'Failed to load ride details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookRide = async (): Promise<void> => {
    if (!ride) return;

    Alert.alert(
      'Book This Ride',
      `Book 1 seat for $${ride.pricePerSeat}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Book Now',
          onPress: async () => {
            setIsBooking(true);
            try {
              const response = await ridesApi.bookRide(ride.id, 1);
              if (response.success) {
                Alert.alert(
                  'Booking Successful',
                  'Your ride has been booked! You can find it in your "Rides" tab.',
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              } else {
                Alert.alert('Booking Failed', response.error || 'Unable to book ride');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Booking failed');
            } finally {
              setIsBooking(false);
            }
          },
        },
      ]
    );
  };

  const handleContactDriver = (): void => {
    if (!ride) return;
    
    (navigation as any).navigate('Chat', {
      chatId: `ride-${ride.id}`,
      recipientName: `${ride.driver.firstName} ${ride.driver.lastName}`,
      rideId: ride.id,
    });
  };

  const handleCallDriver = (): void => {
    if (!ride?.driver.phone) {
      Alert.alert('Contact Info', 'Driver\'s phone number is not available');
      return;
    }

    Alert.alert(
      'Call Driver',
      `Call ${ride.driver.firstName} ${ride.driver.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => console.log('Calling driver...') },
      ]
    );
  };

  const handleReportRide = (): void => {
    Alert.alert('Report Ride', 'Please contact support to report this ride.');
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'confirmed': return '#4CAF50';
      case 'in_progress': return '#2196F3';
      case 'completed': return '#8BC34A';
      case 'cancelled': return '#F44336';
      default: return '#666666';
    }
  };

  const renderDriverInfo = (): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Driver</Text>
      <View style={styles.driverCard}>
        <View style={styles.driverHeader}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverInitial}>
              {ride?.driver.firstName.charAt(0)}
            </Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>
              {ride?.driver.firstName} {ride?.driver.lastName}
            </Text>
            <View style={styles.driverRating}>
              <Icon name="star" size={16} color="#FF9800" />
              <Text style={styles.ratingText}>{ride?.driver.rating}</Text>
              <Text style={styles.ridesCount}>• {ride?.driver.totalRides} rides</Text>
            </View>
          </View>
          <View style={styles.contactButtons}>
            <TouchableOpacity style={styles.contactButton} onPress={handleContactDriver}>
              <Icon name="message" size={20} color="#2196F3" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactButton} onPress={handleCallDriver}>
              <Icon name="call" size={20} color="#2196F3" />
            </TouchableOpacity>
          </View>
        </View>
        
        {ride?.description && (
          <Text style={styles.driverDescription}>{ride.description}</Text>
        )}
      </View>
    </View>
  );

  const renderVehicleInfo = (): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Vehicle</Text>
      <View style={styles.vehicleCard}>
        <View style={styles.vehicleHeader}>
          <Icon name="directions-car" size={32} color="#2196F3" />
          <View style={styles.vehicleDetails}>
            <Text style={styles.vehicleName}>
              {ride?.vehicle.year} {ride?.vehicle.make} {ride?.vehicle.model}
            </Text>
            <Text style={styles.vehicleInfo}>
              {ride?.vehicle.color} • {ride?.vehicle.licensePlate}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderRouteInfo = (): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Route</Text>
      <View style={styles.routeCard}>
        <View style={styles.routeTimeline}>
          <View style={styles.timeColumn}>
            <Text style={styles.timeText}>
              {ride ? new Date(ride.departureTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }) : ''}
            </Text>
            <Text style={styles.durationText}>
              {ride?.estimatedDuration}min
            </Text>
            <Text style={styles.timeText}>
              {ride?.arrivalTime ? new Date(ride.arrivalTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }) : 'TBD'}
            </Text>
          </View>
          
          <View style={styles.routeVisualization}>
            <View style={styles.routePoint}>
              <Icon name="radio-button-checked" size={16} color="#4CAF50" />
              <View style={styles.routeLine} />
              <Icon name="location-on" size={16} color="#F44336" />
            </View>
          </View>
          
          <View style={styles.locationColumn}>
            <View style={styles.locationInfo}>
              <Text style={styles.locationText} numberOfLines={2}>
                {ride?.origin.address}
              </Text>
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationText} numberOfLines={2}>
                {ride?.destination.address}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.routeStats}>
          <View style={styles.routeStat}>
            <Icon name="straighten" size={16} color="#666666" />
            <Text style={styles.routeStatText}>{ride?.distance}km</Text>
          </View>
          <View style={styles.routeStat}>
            <Icon name="schedule" size={16} color="#666666" />
            <Text style={styles.routeStatText}>{ride?.estimatedDuration}min</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderRideInfo = (): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Ride Information</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Icon name="event" size={20} color="#666666" />
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>
              {ride ? new Date(ride.departureTime).toLocaleDateString() : ''}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="attach-money" size={20} color="#666666" />
            <Text style={styles.infoLabel}>Price</Text>
            <Text style={styles.infoValue}>${ride?.pricePerSeat} per seat</Text>
          </View>
        </View>
        
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Icon name="airline-seat-recline-normal" size={20} color="#666666" />
            <Text style={styles.infoLabel}>Seats</Text>
            <Text style={styles.infoValue}>
              {ride?.availableSeats} of {ride?.totalSeats} available
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="flag" size={20} color={getStatusColor(ride?.status || '')} />
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={[styles.infoValue, { color: getStatusColor(ride?.status || '') }]}>
              {ride?.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderAmenities = (): React.ReactNode => {
    if (!ride?.amenities.length) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Amenities</Text>
        <View style={styles.amenitiesContainer}>
          {ride.amenities.map((amenity, index) => (
            <View key={index} style={styles.amenityChip}>
              <Icon name="check" size={14} color="#4CAF50" />
              <Text style={styles.amenityText}>{amenity}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderPreferences = (): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Preferences</Text>
      <View style={styles.preferencesContainer}>
        <View style={styles.preference}>
          <Icon 
            name={ride?.preferences.smokingAllowed ? 'check-circle' : 'cancel'} 
            size={18} 
            color={ride?.preferences.smokingAllowed ? '#4CAF50' : '#F44336'} 
          />
          <Text style={styles.preferenceText}>
            Smoking {ride?.preferences.smokingAllowed ? 'allowed' : 'not allowed'}
          </Text>
        </View>
        <View style={styles.preference}>
          <Icon 
            name={ride?.preferences.petsAllowed ? 'check-circle' : 'cancel'} 
            size={18} 
            color={ride?.preferences.petsAllowed ? '#4CAF50' : '#F44336'} 
          />
          <Text style={styles.preferenceText}>
            Pets {ride?.preferences.petsAllowed ? 'allowed' : 'not allowed'}
          </Text>
        </View>
        <View style={styles.preference}>
          <Icon 
            name={ride?.preferences.musicAllowed ? 'check-circle' : 'cancel'} 
            size={18} 
            color={ride?.preferences.musicAllowed ? '#4CAF50' : '#F44336'} 
          />
          <Text style={styles.preferenceText}>
            Music {ride?.preferences.musicAllowed ? 'allowed' : 'not allowed'}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderBookings = (): React.ReactNode => {
    if (!ride?.bookings.length) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Other Passengers</Text>
        <View style={styles.bookingsContainer}>
          {ride.bookings.map((booking) => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.passengerAvatar}>
                <Text style={styles.passengerInitial}>
                  {booking.passenger.firstName.charAt(0)}
                </Text>
              </View>
              <View style={styles.passengerInfo}>
                <Text style={styles.passengerName}>
                  {booking.passenger.firstName} {booking.passenger.lastName}
                </Text>
                <View style={styles.passengerDetails}>
                  <Icon name="star" size={14} color="#FF9800" />
                  <Text style={styles.passengerRating}>{booking.passenger.rating}</Text>
                  <Text style={styles.seatsBooked}>• {booking.seatsBooked} seat(s)</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderActionButtons = (): React.ReactNode => {
    const isDriverCurrentUser = ride?.driver.id === user?.id;
    const canBook = ride && ride.availableSeats > 0 && !isDriverCurrentUser;

    return (
      <View style={styles.actionContainer}>
        {canBook && (
          <TouchableOpacity
            style={[styles.bookButton, isBooking && styles.bookButtonDisabled]}
            onPress={handleBookRide}
            disabled={isBooking}
            activeOpacity={0.8}
          >
            <Icon name="event-seat" size={20} color="#FFFFFF" />
            <Text style={styles.bookButtonText}>
              {isBooking ? 'Booking...' : `Book for $${ride.pricePerSeat}`}
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.reportButton} onPress={handleReportRide}>
          <Icon name="report" size={16} color="#F44336" />
          <Text style={styles.reportButtonText}>Report</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading ride details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color="#CCCCCC" />
          <Text style={styles.errorText}>Ride not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderDriverInfo()}
        {renderVehicleInfo()}
        {renderRouteInfo()}
        {renderRideInfo()}
        {renderAmenities()}
        {renderPreferences()}
        {renderBookings()}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      
      {renderActionButtons()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#666666',
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  driverInitial: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  ridesCount: {
    fontSize: 14,
    color: '#666666',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleDetails: {
    marginLeft: 16,
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    color: '#666666',
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  routeTimeline: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timeColumn: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  durationText: {
    fontSize: 12,
    color: '#666666',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    textAlign: 'center',
  },
  routeVisualization: {
    width: 32,
    alignItems: 'center',
    paddingVertical: 8,
  },
  routePoint: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'space-between',
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#CCCCCC',
    marginVertical: 8,
  },
  locationColumn: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  locationInfo: {
    height: 40,
    justifyContent: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 18,
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  routeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeStatText: {
    fontSize: 14,
    color: '#666666',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666666',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  amenityText: {
    fontSize: 12,
    color: '#333333',
    fontWeight: '500',
  },
  preferencesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    gap: 12,
  },
  preference: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preferenceText: {
    fontSize: 14,
    color: '#333333',
  },
  bookingsContainer: {
    gap: 8,
  },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  passengerInitial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  passengerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  passengerRating: {
    fontSize: 12,
    color: '#333333',
  },
  seatsBooked: {
    fontSize: 12,
    color: '#666666',
  },
  actionContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 8,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    elevation: 2,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  bookButtonDisabled: {
    backgroundColor: '#CCCCCC',
    elevation: 0,
    shadowOpacity: 0,
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  reportButtonText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 20,
  },
});

export default RideDetailsScreen;