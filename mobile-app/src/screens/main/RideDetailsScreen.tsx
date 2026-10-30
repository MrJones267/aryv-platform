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
import TripShareSheet from '../../components/trip/TripShareSheet';
import { TripShareData } from '../../services/TripSharingService';
import DriverVerificationCard from '../../components/verification/DriverVerificationCard';
import DriverProfileCard from '../../components/profile/DriverProfileCard';
import UserProfileCard from '../../components/profile/UserProfileCard';
import { Skeleton, SkeletonCircle, RideCardSkeleton } from '../../components/ui/Skeleton';
import { haptic } from '../../services/HapticService';
import AnonymizedCallService from '../../services/AnonymizedCallService';
import PromoCodeInput from '../../components/payment/PromoCodeInput';
import logger from '../../services/LoggingService';
import { driverDisplayName } from '../../utils/driverName';
import { useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/translations';

const log = logger.createLogger('RideDetailsScreen');

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
  const { t } = useI18n();
  const { rideId } = route.params;
  const { profile: user } = useAppSelector((state) => state.user);
  
  const [ride, setRide] = useState<RideDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);

  useEffect(() => {
    loadRideDetails();
  }, [rideId]);

  const loadRideDetails = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await ridesApi.getRideById(rideId);
      if (response.success && response.data) {
        setRide(response.data as unknown as RideDetails);
      } else {
        throw new Error(response.error || 'Ride not found');
      }
    } catch (error) {
      log.error('Error loading ride details:', error);
      Alert.alert(t('common.error'), t('rideDetails.loadFailed'), [
        { text: t('common.retry'), onPress: loadRideDetails },
        { text: t('rideDetails.goBack'), onPress: () => navigation.goBack() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookRide = async (): Promise<void> => {
    if (!ride) return;
    haptic.confirm();

    Alert.alert(
      t('rideDetails.bookTitle'),
      t('rideDetails.bookBody', { price: ride.pricePerSeat.toFixed(2) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('rides.bookNow'),
          onPress: async () => {
            setIsBooking(true);
            try {
              const response = await ridesApi.bookRide(ride.id, 1);
              if (response.success) {
                Alert.alert(
                  t('rideDetails.bookSuccess'),
                  t('rideDetails.bookSuccessBody'),
                  [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
                );
              } else {
                Alert.alert(t('rideDetails.bookFailed'), response.error || t('rideDetails.bookFailedBody'));
              }
            } catch (error: unknown) {
              const errMsg = error instanceof Error ? error.message : String(error);
              Alert.alert(t('common.error'), errMsg || t('rideDetails.bookingFailed'));
            } finally {
              setIsBooking(false);
            }
          },
        },
      ]
    );
  };

  const typedNavigation = navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };

  const handleContactDriver = (): void => {
    if (!ride) return;

    typedNavigation.navigate('Chat', {
      chatId: `ride-${ride.id}`,
      recipientName: driverDisplayName(ride.driver),
      rideId: ride.id,
    });
  };

  const handleCallDriver = (): void => {
    if (!ride) return;
    haptic.tap();

    const callService = AnonymizedCallService.getInstance();
    callService.initiateCall(
      ride.id,
      user?.id || '',
      ride.driver.id,
      driverDisplayName(ride.driver),
      ride.driver.phone,
    );
  };

  const handleStartRide = async (): Promise<void> => {
    if (!ride) return;
    haptic.confirm();

    Alert.alert(
      t('rideDetails.startTitle'),
      t('rideDetails.startBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('rideDetails.startRide'),
          onPress: async () => {
            setIsUpdatingStatus(true);
            try {
              const response = await ridesApi.startRide(ride.id);
              if (response.success) {
                setRide(prev => prev ? { ...prev, status: 'in_progress' } : null);
                Alert.alert(t('rideDetails.started'), t('rideDetails.startedNotified'));
              } else {
                Alert.alert(t('common.error'), response.error || t('rideDetails.startFailed'));
              }
            } catch (error: unknown) {
              // Update locally even if API fails
              setRide(prev => prev ? { ...prev, status: 'in_progress' } : null);
              Alert.alert(t('rideDetails.started'), t('rideDetails.startedBody'));
            } finally {
              setIsUpdatingStatus(false);
            }
          },
        },
      ]
    );
  };

  const handleCompleteRide = async (): Promise<void> => {
    if (!ride) return;
    haptic.confirm();

    Alert.alert(
      t('rideDetails.completeTitle'),
      t('rideDetails.completeBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('rideDetails.completeRide'),
          onPress: async () => {
            setIsUpdatingStatus(true);
            try {
              const response = await ridesApi.completeRide(ride.id);
              if (response.success) {
                setRide(prev => prev ? { ...prev, status: 'completed' } : null);
              }
            } catch (error: unknown) {
              setRide(prev => prev ? { ...prev, status: 'completed' } : null);
            } finally {
              setIsUpdatingStatus(false);
              // Navigate to rating screen
              typedNavigation.navigate('RideRating', {
                rideId: ride.id,
                origin: ride.origin.address,
                destination: ride.destination.address,
                rideFare: ride.pricePerSeat * (ride.totalSeats - ride.availableSeats),
                currency: 'BWP',
                role: 'driver',
              });
            }
          },
        },
      ]
    );
  };

  const handleCancelRide = async (): Promise<void> => {
    if (!ride) return;
    haptic.tap();

    Alert.alert(
      t('rideDetails.cancelTitle'),
      t('rideDetails.cancelBody'),
      [
        { text: t('rideDetails.keepRide'), style: 'cancel' },
        {
          text: t('rides.cancelRide'),
          style: 'destructive',
          onPress: async () => {
            setIsUpdatingStatus(true);
            try {
              await ridesApi.cancelRide(ride.id, 'Driver cancelled');
              setRide(prev => prev ? { ...prev, status: 'cancelled' } : null);
              Alert.alert(t('rideDetails.cancelled'), t('rideDetails.passengersNotified'), [
                { text: t('common.ok'), onPress: () => navigation.goBack() },
              ]);
            } catch (error: unknown) {
              Alert.alert(t('common.error'), t('myRides.cancelRideFailed'));
            } finally {
              setIsUpdatingStatus(false);
            }
          },
        },
      ]
    );
  };

  const handleReportRide = (): void => {
    Alert.alert(t('rideDetails.reportTitle'), t('rideDetails.reportBody'));
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

  const renderDriverAndVehicle = (): React.ReactNode => {
    if (!ride) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('rideDetails.driverVehicle')}</Text>
        <DriverProfileCard
          driver={{
            id: ride.driver.id,
            firstName: ride.driver.firstName,
            lastName: ride.driver.lastName ?? '',
            rating: ride.driver.rating,
            totalRides: ride.driver.totalRides,
            profilePicture: ride.driver.profileImage,
            isPhoneVerified: true,
            isIdentityVerified: true,
            isDriverVerified: true,
            primaryRole: 'driver',
          }}
          vehicle={{
            make: ride.vehicle.make,
            model: ride.vehicle.model,
            year: ride.vehicle.year,
            color: ride.vehicle.color,
            licensePlate: ride.vehicle.licensePlate,
            isVerified: true,
            isInspected: true,
          }}
          onContactPress={handleContactDriver}
          onCallPress={handleCallDriver}
        />
        {ride.description && (
          <Text style={styles.driverDescription}>{ride.description}</Text>
        )}
      </View>
    );
  };

  const renderRouteInfo = (): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('rideDetails.route')}</Text>
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
      <Text style={styles.sectionTitle}>{t('rideDetails.info')}</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Icon name="event" size={20} color="#666666" />
            <Text style={styles.infoLabel}>{t('search.date')}</Text>
            <Text style={styles.infoValue}>
              {ride ? new Date(ride.departureTime).toLocaleDateString() : ''}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="attach-money" size={20} color="#666666" />
            <Text style={styles.infoLabel}>{t('rideDetails.price')}</Text>
            <Text style={styles.infoValue}>P{ride?.pricePerSeat?.toFixed(2)} per seat</Text>
          </View>
        </View>
        
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Icon name="airline-seat-recline-normal" size={20} color="#666666" />
            <Text style={styles.infoLabel}>{t('rideDetails.seats')}</Text>
            <Text style={styles.infoValue}>
              {t('rideDetails.seatsOf', { available: ride?.availableSeats ?? 0, total: ride?.totalSeats ?? 0 })}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="flag" size={20} color={getStatusColor(ride?.status || '')} />
            <Text style={styles.infoLabel}>{t('rideDetails.status')}</Text>
            <Text style={[styles.infoValue, { color: getStatusColor(ride?.status || '') }]}>
              {ride ? t(`status.${ride.status}` as TranslationKey).toUpperCase() : ''}
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
        <Text style={styles.sectionTitle}>{t('rideDetails.amenities')}</Text>
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
      <Text style={styles.sectionTitle}>{t('rideDetails.preferences')}</Text>
      <View style={styles.preferencesContainer}>
        <View style={styles.preference}>
          <Icon 
            name={ride?.preferences.smokingAllowed ? 'check-circle' : 'cancel'} 
            size={18} 
            color={ride?.preferences.smokingAllowed ? '#4CAF50' : '#F44336'} 
          />
          <Text style={styles.preferenceText}>
            {ride?.preferences.smokingAllowed ? t('rideDetails.smokingAllowed') : t('rideDetails.smokingNotAllowed')}
          </Text>
        </View>
        <View style={styles.preference}>
          <Icon 
            name={ride?.preferences.petsAllowed ? 'check-circle' : 'cancel'} 
            size={18} 
            color={ride?.preferences.petsAllowed ? '#4CAF50' : '#F44336'} 
          />
          <Text style={styles.preferenceText}>
            {ride?.preferences.petsAllowed ? t('rideDetails.petsAllowed') : t('rideDetails.petsNotAllowed')}
          </Text>
        </View>
        <View style={styles.preference}>
          <Icon 
            name={ride?.preferences.musicAllowed ? 'check-circle' : 'cancel'} 
            size={18} 
            color={ride?.preferences.musicAllowed ? '#4CAF50' : '#F44336'} 
          />
          <Text style={styles.preferenceText}>
            {ride?.preferences.musicAllowed ? t('rideDetails.musicAllowed') : t('rideDetails.musicNotAllowed')}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderBookings = (): React.ReactNode => {
    if (!ride?.bookings.length) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('rideDetails.otherPassengers')}</Text>
        <View style={styles.bookingsContainer}>
          {ride.bookings.map((booking) => (
            <View key={booking.id} style={styles.bookingCard}>
              <UserProfileCard
                user={{
                  id: booking.id,
                  firstName: booking.passenger.firstName,
                  lastName: booking.passenger.lastName,
                  rating: booking.passenger.rating,
                  totalRides: 0,
                }}
                variant="inline"
              />
              <Text style={styles.seatsBooked}>{booking.seatsBooked} seat(s)</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const buildTripShareData = (): TripShareData => ({
    rideId: ride?.id || rideId,
    driverName: ride ? driverDisplayName(ride.driver) : t('rideDetails.driver'),
    vehicleInfo: ride?.vehicle
      ? `${ride.vehicle.color} ${ride.vehicle.make} ${ride.vehicle.model} (${ride.vehicle.licensePlate})`
      : undefined,
    origin: ride?.origin.address || t('home.origin'),
    destination: ride?.destination.address || t('home.destination'),
    departureTime: ride?.departureTime
      ? new Date(ride.departureTime).toLocaleString()
      : undefined,
    estimatedArrival: ride?.arrivalTime
      ? new Date(ride.arrivalTime).toLocaleString()
      : undefined,
    passengerName: user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : t('rideDetails.passenger'),
  });

  const renderActionButtons = (): React.ReactNode => {
    const isDriverCurrentUser = ride?.driver.id === user?.id;
    const canBook = ride && ride.availableSeats > 0 && !isDriverCurrentUser && ride.status !== 'completed' && ride.status !== 'cancelled';
    const finalPrice = ride ? Math.max(0, ride.pricePerSeat - promoDiscount) : 0;

    return (
      <View style={styles.actionContainer}>
        {/* Driver actions based on ride status */}
        {isDriverCurrentUser && ride && (
          <View style={styles.driverActions}>
            {ride.status === 'confirmed' && (
              <>
                <TouchableOpacity
                  style={styles.startRideButton}
                  onPress={handleStartRide}
                  disabled={isUpdatingStatus}
                  activeOpacity={0.8}
                >
                  <Icon name="play-arrow" size={22} color="#FFFFFF" />
                  <Text style={styles.startRideButtonText}>
                    {isUpdatingStatus ? t('rideDetails.starting') : t('rideDetails.startRide')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelRideButton}
                  onPress={handleCancelRide}
                  disabled={isUpdatingStatus}
                >
                  <Text style={styles.cancelRideButtonText}>{t('rides.cancelRide')}</Text>
                </TouchableOpacity>
              </>
            )}
            {ride.status === 'in_progress' && (
              <TouchableOpacity
                style={styles.completeRideButton}
                onPress={handleCompleteRide}
                disabled={isUpdatingStatus}
                activeOpacity={0.8}
              >
                <Icon name="check-circle" size={22} color="#FFFFFF" />
                <Text style={styles.completeRideButtonText}>
                  {isUpdatingStatus ? t('rideDetails.completing') : t('rideDetails.completeRide')}
                </Text>
              </TouchableOpacity>
            )}
            {ride.status === 'completed' && (
              <View style={styles.statusBanner}>
                <Icon name="check-circle" size={20} color="#10B981" />
                <Text style={styles.statusBannerText}>{t('rideDetails.completed')}</Text>
              </View>
            )}
            {ride.status === 'cancelled' && (
              <View style={[styles.statusBanner, styles.cancelledBanner]}>
                <Icon name="cancel" size={20} color="#EF4444" />
                <Text style={[styles.statusBannerText, styles.cancelledText]}>{t('rideDetails.cancelled')}</Text>
              </View>
            )}
          </View>
        )}

        {/* Passenger booking action */}
        {canBook && (
          <>
            <PromoCodeInput
              rideAmount={ride.pricePerSeat}
              onPromoApplied={(discount) => setPromoDiscount(discount)}
              onPromoRemoved={() => setPromoDiscount(0)}
            />
            <TouchableOpacity
              style={[styles.bookButton, isBooking && styles.bookButtonDisabled]}
              onPress={handleBookRide}
              disabled={isBooking}
              activeOpacity={0.8}
            >
              <Icon name="event-seat" size={20} color="#FFFFFF" />
              <Text style={styles.bookButtonText}>
                {isBooking
                  ? t('rideDetails.booking')
                  : promoDiscount > 0
                    ? t('rideDetails.bookForWas', { price: finalPrice.toFixed(2), was: ride.pricePerSeat.toFixed(2) })
                    : t('rideDetails.bookFor', { price: ride.pricePerSeat.toFixed(2) })}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Passenger post-ride rating (when ride is completed and user is not driver) */}
        {!isDriverCurrentUser && ride?.status === 'completed' && (
          <TouchableOpacity
            style={styles.rateRideButton}
            onPress={() => typedNavigation.navigate('RideRating', {
              rideId: ride.id,
              driverId: ride.driver.id,
              driverName: driverDisplayName(ride.driver),
              origin: ride.origin.address,
              destination: ride.destination.address,
              rideFare: ride.pricePerSeat,
              currency: 'BWP',
              role: 'passenger',
            })}
            activeOpacity={0.8}
          >
            <Icon name="star" size={20} color="#FFFFFF" />
            <Text style={styles.rateRideButtonText}>{t('rideDetails.rateThis')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={styles.shareRideButton}
            onPress={() => setShowShareSheet(true)}
          >
            <Icon name="share" size={16} color="#2563EB" />
            <Text style={styles.shareRideButtonText}>{t('rides.shareTrip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportButton} onPress={handleReportRide}>
            <Icon name="report" size={16} color="#F44336" />
            <Text style={styles.reportButtonText}>{t('rideDetails.report')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Driver skeleton */}
          <View style={styles.section}>
            <Skeleton width={140} height={20} style={{ marginBottom: 12 }} />
            <View style={styles.skeletonDriverCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <SkeletonCircle size={54} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Skeleton width={120} height={16} />
                  <Skeleton width={100} height={12} style={{ marginTop: 6 }} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Skeleton width={44} height={44} borderRadius={10} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Skeleton width={140} height={14} />
                  <Skeleton width={80} height={11} style={{ marginTop: 4 }} />
                </View>
                <Skeleton width={70} height={28} borderRadius={6} />
              </View>
            </View>
          </View>
          {/* Route skeleton */}
          <View style={styles.section}>
            <Skeleton width={80} height={20} style={{ marginBottom: 12 }} />
            <RideCardSkeleton />
          </View>
          {/* Info skeleton */}
          <View style={styles.section}>
            <Skeleton width={140} height={20} style={{ marginBottom: 12 }} />
            <View style={styles.skeletonDriverCard}>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <Skeleton width={24} height={24} borderRadius={12} />
                  <Skeleton width={40} height={10} />
                  <Skeleton width={60} height={14} />
                </View>
                <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <Skeleton width={24} height={24} borderRadius={12} />
                  <Skeleton width={40} height={10} />
                  <Skeleton width={60} height={14} />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color="#CCCCCC" />
          <Text style={styles.errorText}>{t('rideDetails.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderDriverAndVehicle()}
        {renderRouteInfo()}
        {renderRideInfo()}
        {renderAmenities()}
        {renderPreferences()}
        {renderBookings()}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      
      {renderActionButtons()}

      {/* Trip share sheet */}
      {ride && (
        <TripShareSheet
          visible={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          tripData={buildTripShareData()}
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
  driverDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    fontStyle: 'italic',
    marginTop: 10,
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
  // Driver action buttons
  driverActions: {
    marginBottom: 12,
  },
  startRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  startRideButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  completeRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    elevation: 2,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  completeRideButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelRideButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelRideButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },
  rateRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  rateRideButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  cancelledBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  statusBannerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
  },
  cancelledText: {
    color: '#EF4444',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  shareRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  shareRideButtonText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
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
  skeletonDriverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  bottomSpacer: {
    height: 20,
  },
});

export default RideDetailsScreen;