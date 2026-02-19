/**
 * @fileoverview My Rides screen showing user's rides and bookings
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchMyRides } from '../../store/slices/ridesSlice';
import { ridesApi } from '../../services/api';
import { RidesScreenProps } from '../../navigation/types';
import logger from '../../services/LoggingService';

const log = logger.createLogger('RidesScreen');

type TabType = 'driving' | 'riding';
type RideStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

interface RideLocation {
  address?: string;
  lat?: number;
  lng?: number;
}

interface RideDriver {
  id?: string;
  firstName?: string;
  lastName?: string;
  rating?: string | number;
}

interface RideBooking {
  id: string;
  status: string;
}

interface RideRecord {
  id: string;
  status: string;
  departureTime: string;
  origin?: RideLocation;
  destination?: RideLocation;
  availableSeats: number;
  totalSeats: number;
  pricePerSeat: number;
  bookings?: RideBooking[];
}

interface BookingRecord {
  id: string;
  status: string;
  seatsBooked: number;
  totalAmount: number;
  ride: {
    id: string;
    departureTime: string;
    origin?: RideLocation;
    destination?: RideLocation;
    driver?: RideDriver;
  };
}

const RidesScreen: React.FC<RidesScreenProps> = ({ navigation }) => {
  const nav = navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void };
  const dispatch = useAppDispatch();
  const { myRides, isLoading } = useAppSelector((state) => state.rides);
  const { profile: user } = useAppSelector((state) => state.user);

  const [activeTab, setActiveTab] = useState<TabType>('driving');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<RideStatus | 'all'>('all');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      if (activeTab === 'driving') {
        await dispatch(fetchMyRides()).unwrap();
      } else {
        const response = await ridesApi.getMyBookings();
        if (response.success) {
          setBookings(response.data?.bookings || []);
        }
      }
    } catch (error) {
      log.info('Error loading rides data:', error);
    }
  }, [activeTab, dispatch]);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleCancelRide = async (rideId: string): Promise<void> => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ridesApi.cancelRide(rideId);
              if (response.success) {
                Alert.alert('Success', 'Ride cancelled successfully');
                await loadData();
              } else {
                Alert.alert('Error', response.error || 'Failed to cancel ride');
              }
            } catch (error: unknown) {
              const errMsg = error instanceof Error ? error.message : String(error);
              Alert.alert('Error', errMsg || 'Failed to cancel ride');
            }
          },
        },
      ]
    );
  };

  const handleCancelBooking = async (bookingId: string): Promise<void> => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ridesApi.cancelBooking(bookingId);
              if (response.success) {
                Alert.alert('Success', 'Booking cancelled successfully');
                await loadData();
              } else {
                Alert.alert('Error', response.error || 'Failed to cancel booking');
              }
            } catch (error: unknown) {
              const errMsg = error instanceof Error ? error.message : String(error);
              Alert.alert('Error', errMsg || 'Failed to cancel booking');
            }
          },
        },
      ]
    );
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

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'pending': return 'hourglass-empty';
      case 'confirmed': return 'check-circle';
      case 'in_progress': return 'directions-car';
      case 'completed': return 'done-all';
      case 'cancelled': return 'cancel';
      default: return 'help';
    }
  };

  const filteredRides = (myRides || []).filter(ride => 
    ride && ride.id && (filterStatus === 'all' || ride.status === filterStatus)
  );

  const filteredBookings = (bookings || []).filter(booking => 
    booking && booking.id && (filterStatus === 'all' || booking.status === filterStatus)
  );

  const renderTabSelector = (): React.ReactNode => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'driving' && styles.activeTab]}
        onPress={() => setActiveTab('driving')}
      >
        <Icon 
          name="drive-eta" 
          size={20} 
          color={activeTab === 'driving' ? '#2196F3' : '#666666'} 
        />
        <Text style={[
          styles.tabText,
          activeTab === 'driving' && styles.activeTabText
        ]}>
          Driving ({myRides.length})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'riding' && styles.activeTab]}
        onPress={() => setActiveTab('riding')}
      >
        <Icon 
          name="person" 
          size={20} 
          color={activeTab === 'riding' ? '#2196F3' : '#666666'} 
        />
        <Text style={[
          styles.tabText,
          activeTab === 'riding' && styles.activeTabText
        ]}>
          Riding ({bookings.length})
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderFilterBar = (): React.ReactNode => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.filterBar}
      contentContainerStyle={styles.filterBarContent}
    >
      {['all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((status) => (
        <TouchableOpacity
          key={status}
          style={[
            styles.filterChip,
            filterStatus === status && styles.activeFilterChip
          ]}
          onPress={() => setFilterStatus(status as RideStatus | 'all')}
        >
          <Text style={[
            styles.filterChipText,
            filterStatus === status && styles.activeFilterChipText
          ]}>
            {status === 'all' ? 'All' : status.replace('_', ' ')}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderRideCard = (ride: RideRecord): React.ReactNode => (
    <View key={ride.id} style={styles.rideCard}>
      {/* Header */}
      <View style={styles.rideHeader}>
        <View style={styles.statusContainer}>
          <Icon 
            name={getStatusIcon(ride.status)} 
            size={16} 
            color={getStatusColor(ride.status)} 
          />
          <Text style={[
            styles.statusText,
            { color: getStatusColor(ride.status) }
          ]}>
            {ride.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.rideDate}>
          {new Date(ride.departureTime).toLocaleDateString()}
        </Text>
      </View>

      {/* Route */}
      <View style={styles.routeContainer}>
        <View style={styles.timeColumn}>
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

      {/* Details */}
      <View style={styles.rideDetails}>
        <View style={styles.detailItem}>
          <Icon name="person" size={14} color="#666666" />
          <Text style={styles.detailText}>
            {ride.availableSeats} seats available
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Icon name="attach-money" size={14} color="#666666" />
          <Text style={styles.detailText}>
            P{ride.pricePerSeat} per seat
          </Text>
        </View>
        {ride.bookings && ride.bookings.length > 0 && (
          <View style={styles.detailItem}>
            <Icon name="people" size={14} color="#666666" />
            <Text style={styles.detailText}>
              {ride.bookings.length} booking{ride.bookings.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      {(ride.status === 'pending' || ride.status === 'confirmed') && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => handleCancelRide(ride.id)}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => nav.navigate('RideDetails', { rideId: ride.id })}
          >
            <Text style={styles.primaryButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* In-progress ride actions */}
      {ride.status === 'in_progress' && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => nav.navigate('RideDetails', { rideId: ride.id })}
          >
            <Text style={styles.primaryButtonText}>View Active Ride</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Rate button for completed rides */}
      {ride.status === 'completed' && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#F59E0B' }]}
            onPress={() => nav.navigate('RideRating', {
              rideId: ride.id,
              origin: ride.origin?.address,
              destination: ride.destination?.address,
              rideFare: ride.pricePerSeat * (ride.totalSeats - ride.availableSeats),
              currency: 'BWP',
              role: 'driver',
            })}
          >
            <Text style={styles.primaryButtonText}>Rate Passengers</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderBookingCard = (booking: BookingRecord): React.ReactNode => (
    <View key={booking.id} style={styles.rideCard}>
      {/* Header */}
      <View style={styles.rideHeader}>
        <View style={styles.statusContainer}>
          <Icon 
            name={getStatusIcon(booking.status)} 
            size={16} 
            color={getStatusColor(booking.status)} 
          />
          <Text style={[
            styles.statusText,
            { color: getStatusColor(booking.status) }
          ]}>
            {booking.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.rideDate}>
          {new Date(booking.ride.departureTime).toLocaleDateString()}
        </Text>
      </View>

      {/* Driver Info */}
      <View style={styles.driverContainer}>
        <View style={styles.driverAvatar}>
          <Text style={styles.driverInitial}>
            {booking.ride.driver?.firstName?.charAt(0) || 'D'}
          </Text>
        </View>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>
            {booking.ride.driver?.firstName} {booking.ride.driver?.lastName}
          </Text>
          <View style={styles.ratingContainer}>
            <Icon name="star" size={14} color="#FF9800" />
            <Text style={styles.rating}>
              {booking.ride.driver?.rating || '4.5'}
            </Text>
          </View>
        </View>
      </View>

      {/* Route */}
      <View style={styles.routeContainer}>
        <View style={styles.timeColumn}>
          <Text style={styles.timeText}>
            {new Date(booking.ride.departureTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        
        <View style={styles.routeInfo}>
          <View style={styles.routePoint}>
            <Icon name="radio-button-checked" size={12} color="#4CAF50" />
            <Text style={styles.routeText} numberOfLines={1}>
              {booking.ride.origin?.address || 'Origin'}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <Icon name="location-on" size={12} color="#F44336" />
            <Text style={styles.routeText} numberOfLines={1}>
              {booking.ride.destination?.address || 'Destination'}
            </Text>
          </View>
        </View>
      </View>

      {/* Details */}
      <View style={styles.rideDetails}>
        <View style={styles.detailItem}>
          <Icon name="person" size={14} color="#666666" />
          <Text style={styles.detailText}>
            {booking.seatsBooked} seat{booking.seatsBooked !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Icon name="attach-money" size={14} color="#666666" />
          <Text style={styles.detailText}>
            P{booking.totalAmount} total
          </Text>
        </View>
      </View>

      {/* Actions */}
      {(booking.status === 'pending' || booking.status === 'confirmed') && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => handleCancelBooking(booking.id)}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              const driverName = `${booking.ride.driver?.firstName || ''} ${booking.ride.driver?.lastName || ''}`.trim() || 'Driver';
              nav.navigate('Messages', {
                screen: 'Chat',
                params: {
                  chatId: `ride_${booking.ride.id}_${booking.id}`,
                  recipientName: driverName,
                  rideId: booking.ride.id,
                  bookingId: booking.id,
                },
              });
            }}
          >
            <Text style={styles.primaryButtonText}>Contact Driver</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* In-progress booking actions */}
      {booking.status === 'in_progress' && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => nav.navigate('RideDetails', { rideId: booking.ride.id })}
          >
            <Text style={styles.primaryButtonText}>Track Ride</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Rate ride for completed bookings */}
      {booking.status === 'completed' && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => nav.navigate('RideDetails', { rideId: booking.ride.id })}
          >
            <Text style={styles.secondaryButtonText}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#F59E0B' }]}
            onPress={() => nav.navigate('RideRating', {
              rideId: booking.ride.id,
              driverId: booking.ride.driver?.id,
              driverName: `${booking.ride.driver?.firstName || ''} ${booking.ride.driver?.lastName || ''}`.trim(),
              origin: booking.ride.origin?.address,
              destination: booking.ride.destination?.address,
              rideFare: booking.totalAmount,
              currency: 'BWP',
              role: 'passenger',
            })}
          >
            <Text style={styles.primaryButtonText}>Rate Ride</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderEmptyState = (): React.ReactNode => (
    <View style={styles.emptyState}>
      <Icon 
        name={activeTab === 'driving' ? 'drive-eta' : 'person'} 
        size={48} 
        color="#CCCCCC" 
      />
      <Text style={styles.emptyStateText}>
        No {activeTab === 'driving' ? 'rides offered' : 'bookings'} yet
      </Text>
      <Text style={styles.emptyStateSubtext}>
        {activeTab === 'driving' 
          ? 'Start offering rides to help others get around'
          : 'Search for rides to book your first trip'
        }
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderTabSelector()}
      {renderFilterBar()}
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'driving' ? (
          filteredRides.length > 0 ? (
            filteredRides.map((ride) => renderRideCard(ride as unknown as RideRecord))
          ) : (
            renderEmptyState()
          )
        ) : (
          filteredBookings.length > 0 ? (
            filteredBookings.map(renderBookingCard)
          ) : (
            renderEmptyState()
          )
        )}
      </ScrollView>

      {/* Floating Action Button for creating rides (only show on driving tab) */}
      {activeTab === 'driving' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => nav.navigate('CreateRide')}
          activeOpacity={0.8}
        >
          <Icon name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  filterBar: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterBarContent: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  activeFilterChip: {
    backgroundColor: '#2196F3',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    textTransform: 'capitalize',
  },
  activeFilterChipText: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  rideCard: {
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
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rideDate: {
    fontSize: 12,
    color: '#666666',
  },
  driverContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  driverAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInitial: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  driverInfo: {
    flex: 1,
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
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  timeColumn: {
    width: 50,
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
  rideDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
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
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
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
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});

export default RidesScreen;