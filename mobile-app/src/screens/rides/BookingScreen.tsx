/**
 * @fileoverview Booking screen for passengers to book rides
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
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { Button, Card, Badge, Avatar } from '../../components/ui';
import { ridesApi } from '../../services/api';
import type { RideStop } from '../../services/api';
import { BookingScreenProps } from '../../navigation/types';
import PaymentMethodSelector, { PaymentMethodType } from '../../components/payment/PaymentMethodSelector';
import { paymentApi } from '../../services/api';
import { CurrencyService, Currency } from '../../services/CurrencyService';
import logger from '../../services/LoggingService';
import { useI18n } from '../../i18n/I18nContext';

const log = logger.createLogger('BookingScreen');

interface BookingDetails {
  ride: {
    id: string;
    driver: {
      id: string;
      firstName: string;
      lastName: string;
      rating: number;
      totalRides: number;
      profileImage?: string;
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
    pricePerSeat: number;
    availableSeats: number;
    distance: number;
    estimatedDuration: number;
    amenities: string[];
    preferences: {
      smokingAllowed: boolean;
      petsAllowed: boolean;
      musicAllowed: boolean;
    };
  };
  seatsToBook: number;
  totalAmount: number;
  platformFee: number;
  paymentMethod: string | null;
}

/**
 * The platform's cut, matching BOOKING_PLATFORM_FEE_RATE on the server. Both
 * must agree or the screen quotes a total the server will not charge.
 */
const PLATFORM_FEE_RATE = 0.05;

/**
 * What the ride from one stop to another costs per seat.
 *
 * Stop fares are cumulative from the origin, so a segment is one subtraction.
 * Returns null when either stop is not on the route, which is the caller's cue
 * to fall back to the ride's own price.
 */
const fareBetween = (
  stops: RideStop[],
  boardingSequence: number,
  alightingSequence: number,
): number | null => {
  const boarding = stops.find((stop) => stop.sequence === boardingSequence);
  const alighting = stops.find((stop) => stop.sequence === alightingSequence);

  if (!boarding || !alighting) {
    return null;
  }

  return Math.max(0, alighting.fareFromOrigin - boarding.fareFromOrigin);
};

const BookingScreen: React.FC<BookingScreenProps> = ({ navigation, route }) => {
  const { t } = useI18n();
  const typedNavigation = navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
  const { rideId } = route.params;
  const params = route.params as Record<string, unknown>;
  const seatsRequested = (params.seatsRequested as number) || 1;

  // A search result already knows which part of the ride matched what the
  // passenger asked for, and passes it through. Absent, the passenger is
  // taking the whole journey — which is what a direct trip always is.
  const suggestedBoarding = params.boardingStop as number | undefined;
  const suggestedAlighting = params.alightingStop as number | undefined;
  const dispatch = useAppDispatch();
  const { profile: user } = useAppSelector((state) => state.user);
  
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState(seatsRequested);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);

  // The ride's route, and the part of it this passenger is taking.
  const [stops, setStops] = useState<RideStop[]>([]);
  const [boardingSequence, setBoardingSequence] = useState<number | null>(
    suggestedBoarding ?? null,
  );
  const [alightingSequence, setAlightingSequence] = useState<number | null>(
    suggestedAlighting ?? null,
  );
  const [editingSegment, setEditingSegment] = useState<'boarding' | 'alighting' | null>(null);

  useEffect(() => {
    loadBookingDetails();
  }, [rideId]);

  // Keyed on the seat count only. It previously also depended on
  // bookingDetails, which the same effect then wrote to — so each run
  // scheduled the next.
  useEffect(() => {
    recalculateTotal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeats]);

  const loadBookingDetails = async () => {
    setIsLoading(true);
    try {
      const response = await ridesApi.getRideDetails(rideId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Ride not found');
      }

      const ride = response.data;

      // The server always reports a route, even for a direct trip, where it is
      // just the two ends. Default to riding the whole of it.
      const rideStops = ride.stops ?? [];
      setStops(rideStops);

      const firstStop = rideStops[0]?.sequence ?? 0;
      const lastStop = rideStops[rideStops.length - 1]?.sequence ?? 1;

      const boarding = suggestedBoarding ?? boardingSequence ?? firstStop;
      const alighting = suggestedAlighting ?? alightingSequence ?? lastStop;
      setBoardingSequence(boarding);
      setAlightingSequence(alighting);

      // Charge for the part of the journey being travelled, not the whole
      // ride. On a direct trip these are the two ends and this is the full
      // price, unchanged.
      const farePerSeat = fareBetween(rideStops, boarding, alighting) ?? ride.pricePerSeat;
      const subtotal = farePerSeat * selectedSeats;
      const platformFee = Math.max(1, subtotal * 0.05);

      setBookingDetails({
        ride: {
          id: ride.id,
          driver: {
            id: ride.driver.id,
            firstName: ride.driver.firstName,
            lastName: ride.driver.lastName ?? '',
            rating: ride.driver.rating ?? 0,
            totalRides: ride.driver.totalRides ?? 0,
            profileImage: ride.driver.profilePicture,
          },
          vehicle: {
            make: ride.vehicle.make,
            model: ride.vehicle.model,
            year: ride.vehicle.year,
            color: ride.vehicle.color,
            // Withheld until the booking exists — the public ride view does
            // not carry a plate. It arrives once this passenger is on the ride.
            licensePlate: ride.vehicle.licensePlate ?? '',
          },
          origin: {
            address: ride.origin.address,
            latitude: ride.origin.latitude,
            longitude: ride.origin.longitude,
          },
          destination: {
            address: ride.destination.address,
            latitude: ride.destination.latitude,
            longitude: ride.destination.longitude,
          },
          departureTime: ride.departureTime,
          pricePerSeat: farePerSeat,
          availableSeats: ride.availableSeats,
          distance: ride.distance ?? 0,
          estimatedDuration: ride.estimatedDuration ?? 0,
          amenities: [],
          preferences: { smokingAllowed: false, petsAllowed: false, musicAllowed: true },
        },
        seatsToBook: selectedSeats,
        totalAmount: subtotal + platformFee,
        platformFee,
        paymentMethod: null,
      });
    } catch (error) {
      log.error('Error loading booking details:', error);
      Alert.alert('Error', 'Failed to load booking details');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Price the booking from the driver's fare.
   *
   * This used to call a client-side pricing model and overwrite the total with
   * its "final price" — a figure built partly from Math.random(), so two
   * passengers could see different prices for the same ride, varying by up to
   * half again. The server meanwhile charged the driver's actual fare, so the
   * number on this screen was not the number billed.
   *
   * ARYV is carpooling: the driver sets the price, and that is the price. The
   * arithmetic here now matches the server's exactly — fare for the segment
   * being travelled, plus the platform fee.
   */
  const recalculateTotal = () => {
    if (!bookingDetails) return;

    const farePerSeat = boardingSequence !== null && alightingSequence !== null
      ? fareBetween(stops, boardingSequence, alightingSequence) ?? bookingDetails.ride.pricePerSeat
      : bookingDetails.ride.pricePerSeat;

    const subtotal = farePerSeat * selectedSeats;
    const platformFee = Math.max(1, subtotal * PLATFORM_FEE_RATE);

    setBookingDetails(prev => prev ? {
      ...prev,
      ride: { ...prev.ride, pricePerSeat: farePerSeat },
      totalAmount: subtotal + platformFee,
      platformFee,
    } : null);
  };

  const handleSeatChange = (increment: boolean) => {
    if (!bookingDetails) return;

    const newSeats = increment 
      ? Math.min(bookingDetails.ride.availableSeats, selectedSeats + 1)
      : Math.max(1, selectedSeats - 1);
    
    setSelectedSeats(newSeats);
    setBookingDetails(prev => prev ? {
      ...prev,
      seatsToBook: newSeats,
    } : null);
    // AI pricing will recalculate automatically via useEffect
  };

  const handlePaymentMethodSelect = () => {
    setShowPaymentSelector(true);
  };

  const handlePaymentMethodConfirm = (method: PaymentMethodType) => {
    setSelectedPaymentMethod(method);
    const methodLabels: Record<PaymentMethodType, string> = {
      cash: 'Cash',
      stripe: 'Credit/Debit Card',
      mobile_money: 'Mobile Money',
      wallet: 'ARYV Wallet',
    };
    if (bookingDetails) {
      setBookingDetails(prev => prev ? {
        ...prev,
        paymentMethod: methodLabels[method],
      } : null);
    }
    setShowPaymentSelector(false);
  };

  const handleConfirmBooking = async () => {
    if (!bookingDetails) return;

    if (!bookingDetails.paymentMethod || !selectedPaymentMethod) {
      Alert.alert('Payment Method Required', 'Please select a payment method to continue');
      return;
    }

    const currency = selectedCurrency?.code || 'BWP';
    const displayAmount = selectedCurrency
      ? CurrencyService.formatAmount(bookingDetails.totalAmount, selectedCurrency)
      : `P${bookingDetails.totalAmount.toFixed(2)}`;

    Alert.alert(
      t('booking.confirmTitle'),
      selectedSeats > 1
        ? t('booking.confirmBodyMany', { count: selectedSeats, amount: displayAmount })
        : t('booking.confirmBodyOne', { amount: displayAmount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('booking.confirmPay'),
          onPress: async () => {
            setIsBooking(true);
            try {
              const paymentMethodMap: Record<PaymentMethodType, string> = {
                cash: 'cash',
                stripe: 'card',
                mobile_money: 'mobile_money',
                wallet: 'wallet',
              };

              // Step 1: Book the ride. This has to come first — the fare is
              // calculated by the server from the ride and the seats taken, and
              // the payment is raised against that booking. Creating the
              // payment first meant paying an amount this screen had worked out
              // for itself, against nothing in particular.
              const response = await ridesApi.bookRide(
                rideId,
                selectedSeats,
                undefined,
                boardingSequence !== null && alightingSequence !== null
                  ? { boardingStop: boardingSequence, alightingStop: alightingSequence }
                  : undefined,
              );

              if (response.success) {
                const bookingId = response.data?.id;
                let paymentSettled = false;

                // Step 2 & 3: Raise and settle the payment for that booking.
                if (selectedPaymentMethod !== 'cash' && bookingId) {
                  const paymentResponse = await paymentApi.createPaymentIntent({
                    bookingId,
                    paymentMethod: paymentMethodMap[selectedPaymentMethod] as 'card' | 'mobile_money' | 'cash' | 'wallet',
                    metadata: { seats: selectedSeats.toString() },
                  });

                  if (!paymentResponse.success || !paymentResponse.data?.id) {
                    Alert.alert(
                      t('booking.heldNotTaken'),
                      `${paymentResponse.error || t('booking.paymentNotStarted')}\n\n${t('booking.heldOpenToPay')}`,
                    );
                    typedNavigation.navigate('Rides');
                    return;
                  }

                  if (selectedPaymentMethod === 'mobile_money') {
                    // Mobile money settles when the provider reports it over a
                    // signed webhook, never from here. The seat is held as a
                    // pending booking until that arrives.
                    Alert.alert(
                      t('booking.heldApprove'),
                      t('booking.heldApproveBody'),
                    );
                    typedNavigation.navigate('Rides');
                    return;
                  }

                  const confirmation = await paymentApi.confirmPayment({
                    paymentIntentId: paymentResponse.data.id,
                  });
                  paymentSettled = confirmation.success;

                  if (!paymentSettled) {
                    // The server refuses to call a payment settled unless the
                    // processor says so, so this is a real "not paid yet" —
                    // never tell the passenger it went through.
                    Alert.alert(
                      t('booking.heldPending'),
                      `${confirmation.error || t('booking.paymentNotComplete')}\n\n${t('booking.heldFinishPaying')}`,
                    );
                    typedNavigation.navigate('Rides');
                    return;
                  }
                }

                Alert.alert(
                  t('booking.confirmed'),
                  selectedPaymentMethod === 'cash'
                    ? t('booking.confirmedCash')
                    : t('booking.confirmedPaid'),
                  [
                    {
                      text: t('booking.viewBooking'),
                      onPress: () => {
                        typedNavigation.navigate('Rides');
                      },
                    },
                    {
                      text: t('myRides.contactDriver'),
                      onPress: () => {
                        typedNavigation.navigate('Chat', {
                          chatId: `ride-${rideId}`,
                          recipientName: `${bookingDetails.ride.driver.firstName} ${bookingDetails.ride.driver.lastName}`,
                          rideId: rideId,
                        });
                      },
                    },
                  ]
                );
              } else {
                // Nothing to unwind: no payment is raised until the booking
                // exists, so a failed booking has taken no money.
                Alert.alert(t('rideDetails.bookFailed'), response.error || t('booking.failedBody'));
              }
            } catch (error: unknown) {
              const errMsg = error instanceof Error ? error.message : String(error);
              Alert.alert(t('common.error'), errMsg || t('booking.failedNoCharge'));
            } finally {
              setIsBooking(false);
            }
          },
        },
      ]
    );
  };

  const renderRideDetails = () => {
    if (!bookingDetails) return null;

    const { ride } = bookingDetails;

    return (
      <Card style={styles.rideCard}>
        <View style={styles.driverSection}>
          <Avatar
            size="medium"
            name={`${ride.driver.firstName} ${ride.driver.lastName}`}
            backgroundColor="#2196F3"
          />
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>
              {ride.driver.firstName} {ride.driver.lastName}
            </Text>
            <View style={styles.driverRating}>
              <Icon name="star" size={14} color="#FF9800" />
              <Text style={styles.ratingText}>{ride.driver.rating}</Text>
              <Text style={styles.ridesCount}>• {ride.driver.totalRides} rides</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => {
              typedNavigation.navigate('Chat', {
                chatId: `ride-${rideId}`,
                recipientName: `${ride.driver.firstName} ${ride.driver.lastName}`,
                rideId: rideId,
              });
            }}
          >
            <Icon name="message" size={20} color="#2196F3" />
          </TouchableOpacity>
        </View>

        <View style={styles.separator} />

        <View style={styles.vehicleSection}>
          <Icon name="directions-car" size={24} color="#666666" />
          <Text style={styles.vehicleText}>
            {ride.vehicle.year} {ride.vehicle.make} {ride.vehicle.model} ({ride.vehicle.color})
          </Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.routeSection}>
          <View style={styles.routeTimeline}>
            <View style={styles.timeColumn}>
              <Text style={styles.timeText}>
                {new Date(ride.departureTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <Text style={styles.durationText}>{ride.estimatedDuration}min</Text>
            </View>
            
            <View style={styles.routeVisualization}>
              <Icon name="radio-button-checked" size={16} color="#4CAF50" />
              <View style={styles.routeLine} />
              <Icon name="location-on" size={16} color="#F44336" />
            </View>
            
            <View style={styles.locationColumn}>
              <View style={styles.locationInfo}>
                <Text style={styles.locationText} numberOfLines={2}>
                  {ride.origin.address}
                </Text>
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationText} numberOfLines={2}>
                  {ride.destination.address}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {ride.amenities.length > 0 && (
          <>
            <View style={styles.separator} />
            <View style={styles.amenitiesSection}>
              <Text style={styles.sectionTitle}>{t('rideDetails.amenities')}</Text>
              <View style={styles.amenitiesList}>
                {ride.amenities.map((amenity, index) => (
                  <Badge
                    key={index}
                    text={amenity}
                    variant="info"
                    size="small"
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </Card>
    );
  };

  /**
   * Where the passenger gets on and off.
   *
   * Only shown when the driver listed stops — on a direct trip there is
   * nothing to choose, and a control with one option is noise. Changing either
   * end reprices the booking, because a shorter ride costs less.
   */
  const renderSegmentSelector = () => {
    if (stops.length <= 2 || boardingSequence === null || alightingSequence === null) {
      return null;
    }

    const boardingStop = stops.find((stop) => stop.sequence === boardingSequence);
    const alightingStop = stops.find((stop) => stop.sequence === alightingSequence);

    // A passenger can only get off after they get on, so each list is bounded
    // by the other's choice.
    const options = editingSegment === 'boarding'
      ? stops.filter((stop) => stop.sequence < alightingSequence)
      : stops.filter((stop) => stop.sequence > boardingSequence);

    const applyChoice = (sequence: number) => {
      const nextBoarding = editingSegment === 'boarding' ? sequence : boardingSequence;
      const nextAlighting = editingSegment === 'alighting' ? sequence : alightingSequence;

      setBoardingSequence(nextBoarding);
      setAlightingSequence(nextAlighting);
      setEditingSegment(null);

      // Reprice here rather than in an effect: the pricing effect already
      // depends on bookingDetails and writes to it, so adding another writer
      // keyed on the same object would make the two chase each other.
      const farePerSeat = fareBetween(stops, nextBoarding, nextAlighting);

      if (farePerSeat === null) {
        return;
      }

      const subtotal = farePerSeat * selectedSeats;
      const platformFee = Math.max(1, subtotal * 0.05);

      setBookingDetails(prev => prev ? {
        ...prev,
        ride: { ...prev.ride, pricePerSeat: farePerSeat },
        totalAmount: subtotal + platformFee,
        platformFee,
      } : null);
    };

    return (
      <Card style={styles.segmentCard}>
        <Text style={styles.sectionTitle}>{t('booking.yourPart')}</Text>

        <TouchableOpacity
          style={styles.segmentRow}
          onPress={() => setEditingSegment(editingSegment === 'boarding' ? null : 'boarding')}
        >
          <Icon name="trip-origin" size={20} color="#2196F3" />
          <View style={styles.segmentTextGroup}>
            <Text style={styles.segmentLabel}>{t('booking.getOn')}</Text>
            <Text style={styles.segmentValue} numberOfLines={1}>
              {boardingStop?.address ?? t('booking.startOfTrip')}
            </Text>
          </View>
          <Icon
            name={editingSegment === 'boarding' ? 'expand-less' : 'expand-more'}
            size={22}
            color="#999999"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.segmentRow}
          onPress={() => setEditingSegment(editingSegment === 'alighting' ? null : 'alighting')}
        >
          <Icon name="place" size={20} color="#4CAF50" />
          <View style={styles.segmentTextGroup}>
            <Text style={styles.segmentLabel}>{t('booking.getOff')}</Text>
            <Text style={styles.segmentValue} numberOfLines={1}>
              {alightingStop?.address ?? t('booking.endOfTrip')}
            </Text>
          </View>
          <Icon
            name={editingSegment === 'alighting' ? 'expand-less' : 'expand-more'}
            size={22}
            color="#999999"
          />
        </TouchableOpacity>

        {editingSegment && (
          <View style={styles.segmentOptions}>
            {options.map((stop) => (
              <TouchableOpacity
                key={stop.sequence}
                style={styles.segmentOption}
                onPress={() => applyChoice(stop.sequence)}
              >
                <Text style={styles.segmentOptionText} numberOfLines={1}>
                  {stop.address}
                </Text>
                {stop.sequence === (editingSegment === 'boarding' ? boardingSequence : alightingSequence) && (
                  <Icon name="check" size={18} color="#2196F3" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.segmentHint}>
          {t('booking.payForPart')}
        </Text>
      </Card>
    );
  };

  /*
   * The "Ride Type" selector (Economy / Comfort / Premium / Shared) used to
   * sit here, above a pricing panel showing a demand score, a weather
   * condition and a surge multiplier.
   *
   * Both are gone. A passenger booking a carpool seat is booking one named
   * driver's one specific vehicle — there is no tier to pick, and the driver
   * set the fare, so nothing on this screen can change what it costs. The
   * panel's figures were largely Math.random() and did not match what the
   * server charged.
   */

  const renderBookingOptions = () => {
    if (!bookingDetails) return null;

    return (
      <Card style={styles.bookingCard}>
        <Text style={styles.sectionTitle}>{t('booking.details')}</Text>
        
        <View style={styles.seatSelection}>
          <Text style={styles.seatLabel}>{t('booking.numberOfSeats')}</Text>
          <View style={styles.seatControls}>
            <TouchableOpacity
              style={[styles.seatButton, selectedSeats <= 1 && styles.seatButtonDisabled]}
              onPress={() => handleSeatChange(false)}
              disabled={selectedSeats <= 1}
            >
              <Icon name="remove" size={20} color={selectedSeats <= 1 ? '#CCCCCC' : '#2196F3'} />
            </TouchableOpacity>
            <Text style={styles.seatCount}>{selectedSeats}</Text>
            <TouchableOpacity
              style={[styles.seatButton, selectedSeats >= bookingDetails.ride.availableSeats && styles.seatButtonDisabled]}
              onPress={() => handleSeatChange(true)}
              disabled={selectedSeats >= bookingDetails.ride.availableSeats}
            >
              <Icon name="add" size={20} color={selectedSeats >= bookingDetails.ride.availableSeats ? '#CCCCCC' : '#2196F3'} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.separator} />

        <TouchableOpacity
          style={styles.paymentMethodButton}
          onPress={handlePaymentMethodSelect}
        >
          <View style={styles.paymentMethodLeft}>
            <Icon name="credit-card" size={20} color="#666666" />
            <Text style={styles.paymentMethodLabel}>{t('booking.paymentMethod')}</Text>
          </View>
          <View style={styles.paymentMethodRight}>
            <Text style={styles.paymentMethodText}>
              {bookingDetails.paymentMethod || t('booking.selectMethod')}
            </Text>
            <Icon name="chevron-right" size={20} color="#CCCCCC" />
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>{t('booking.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bookingDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color="#CCCCCC" />
          <Text style={styles.errorText}>{t('booking.loadFailed')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.screenTitle}>{t('booking.confirmYour')}</Text>
          
          {renderRideDetails()}
          {renderSegmentSelector()}
          {renderBookingOptions()}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={isBooking ? t('rideDetails.booking') : t('booking.confirmPay')}
          onPress={handleConfirmBooking}
          disabled={isBooking || !bookingDetails.paymentMethod}
          loading={isBooking}
          variant="primary"
          size="large"
          icon="check-circle"
          fullWidth
        />
      </View>

      {/* Payment Method Selector Modal */}
      <Modal
        visible={showPaymentSelector}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.paymentModalContainer}>
          <View style={styles.paymentModalHeader}>
            <TouchableOpacity onPress={() => setShowPaymentSelector(false)}>
              <Icon name="close" size={24} color="#333333" />
            </TouchableOpacity>
            <Text style={styles.paymentModalTitle}>{t('booking.paymentMethod')}</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={styles.paymentModalContent}>
            <PaymentMethodSelector
              amount={bookingDetails.totalAmount}
              selectedMethod={selectedPaymentMethod}
              onMethodSelect={handlePaymentMethodConfirm}
              selectedCurrency={selectedCurrency}
              onCurrencyChange={setSelectedCurrency}
              showCurrencySelector={true}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
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
    marginBottom: 24,
    textAlign: 'center',
  },
  rideCard: {
    marginBottom: 16,
    padding: 16,
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
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
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  vehicleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  vehicleText: {
    fontSize: 14,
    color: '#333333',
  },
  routeSection: {
    marginBottom: 16,
  },
  routeTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeColumn: {
    width: 50,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  routeVisualization: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    height: 80,
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
    height: 32,
    justifyContent: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 16,
  },
  amenitiesSection: {
    marginBottom: 0,
  },
  segmentCard: {
    marginBottom: 16,
    padding: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  segmentTextGroup: {
    flex: 1,
  },
  segmentLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 2,
  },
  segmentValue: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '500',
  },
  segmentOptions: {
    paddingTop: 8,
  },
  segmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F7F9FA',
    borderRadius: 8,
    marginBottom: 6,
  },
  segmentOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
  },
  segmentHint: {
    fontSize: 12,
    color: '#777777',
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bookingCard: {
    marginBottom: 16,
    padding: 16,
  },
  seatSelection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seatLabel: {
    fontSize: 16,
    color: '#333333',
  },
  seatControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginHorizontal: 16,
  },
  paymentMethodButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentMethodLabel: {
    fontSize: 16,
    color: '#333333',
  },
  paymentMethodRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#666666',
  },
  pricingCard: {
    marginBottom: 16,
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666666',
  },
  priceValue: {
    fontSize: 14,
    color: '#333333',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
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
  paymentModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  paymentModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  paymentModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  paymentModalContent: {
    flex: 1,
    padding: 16,
  },
});

export default BookingScreen;