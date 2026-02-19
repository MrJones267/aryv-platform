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
import { BookingScreenProps } from '../../navigation/types';
import AIPricingService, { PricingRequest, PricingResponse } from '../../services/AIPricingService';
import PricingDisplay from '../../components/pricing/PricingDisplay';
import PaymentMethodSelector, { PaymentMethodType } from '../../components/payment/PaymentMethodSelector';
import { paymentApi } from '../../services/api';
import { CurrencyService, Currency } from '../../services/CurrencyService';
import logger from '../../services/LoggingService';

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

const BookingScreen: React.FC<BookingScreenProps> = ({ navigation, route }) => {
  const typedNavigation = navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
  const { rideId } = route.params;
  const seatsRequested = (route.params as Record<string, unknown>).seatsRequested as number || 1;
  const dispatch = useAppDispatch();
  const { profile: user } = useAppSelector((state) => state.user);
  
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState(seatsRequested);
  const [aiPricing, setAiPricing] = useState<PricingResponse | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [rideType, setRideType] = useState<'economy' | 'comfort' | 'premium' | 'shared'>('economy');
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);

  useEffect(() => {
    loadBookingDetails();
  }, [rideId]);

  useEffect(() => {
    if (bookingDetails) {
      calculateAIPricing();
    }
  }, [bookingDetails, rideType, selectedSeats]);

  const loadBookingDetails = async () => {
    setIsLoading(true);
    try {
      // Mock booking details - replace with actual API call
      const mockBooking: BookingDetails = {
        ride: {
          id: rideId,
          driver: {
            id: 'driver-123',
            firstName: 'John',
            lastName: 'Smith',
            rating: 4.8,
            totalRides: 156,
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
          departureTime: new Date(Date.now() + 7200000).toISOString(),
          pricePerSeat: 25,
          availableSeats: 3,
          distance: 45,
          estimatedDuration: 60,
          amenities: ['WiFi', 'Phone Charger', 'Air Conditioning'],
          preferences: {
            smokingAllowed: false,
            petsAllowed: true,
            musicAllowed: true,
          },
        },
        seatsToBook: selectedSeats,
        totalAmount: 0, // Will be calculated
        platformFee: 0, // Will be calculated
        paymentMethod: null,
      };

      // Calculate pricing
      const subtotal = mockBooking.ride.pricePerSeat * selectedSeats;
      const platformFee = Math.max(1, subtotal * 0.05); // 5% or minimum P1
      mockBooking.totalAmount = subtotal + platformFee;
      mockBooking.platformFee = platformFee;

      setBookingDetails(mockBooking);
    } catch (error) {
      log.error('Error loading booking details:', error);
      Alert.alert('Error', 'Failed to load booking details');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAIPricing = async () => {
    if (!bookingDetails) return;

    setIsPricingLoading(true);
    try {
      const pricingRequest: PricingRequest = {
        origin: {
          latitude: bookingDetails.ride.origin.latitude,
          longitude: bookingDetails.ride.origin.longitude,
          address: bookingDetails.ride.origin.address,
        },
        destination: {
          latitude: bookingDetails.ride.destination.latitude,
          longitude: bookingDetails.ride.destination.longitude,
          address: bookingDetails.ride.destination.address,
        },
        rideType,
        requestTime: new Date().toISOString(),
        passengerCount: selectedSeats,
        scheduledTime: bookingDetails.ride.departureTime,
      };

      const pricing = await AIPricingService.calculatePrice(pricingRequest);
      setAiPricing(pricing);

      // Update booking details with AI pricing
      setBookingDetails(prev => prev ? {
        ...prev,
        totalAmount: pricing.finalPrice * selectedSeats,
        platformFee: pricing.breakdown.fees,
      } : null);
    } catch (error) {
      log.error('AI Pricing calculation failed:', error);
      // Fallback to basic pricing
      const subtotal = bookingDetails.ride.pricePerSeat * selectedSeats;
      const platformFee = Math.max(1, subtotal * 0.05);
      setBookingDetails(prev => prev ? {
        ...prev,
        totalAmount: subtotal + platformFee,
        platformFee,
      } : null);
    } finally {
      setIsPricingLoading(false);
    }
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
      'Confirm Booking',
      `Book ${selectedSeats} seat${selectedSeats > 1 ? 's' : ''} for ${displayAmount}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Pay',
          onPress: async () => {
            setIsBooking(true);
            try {
              // Step 1: Create payment intent
              const paymentMethodMap: Record<PaymentMethodType, string> = {
                cash: 'cash',
                stripe: 'card',
                mobile_money: 'mobile_money',
                wallet: 'wallet',
              };
              const paymentResponse = await paymentApi.createPaymentIntent({
                amount: bookingDetails.totalAmount,
                currency,
                paymentMethod: paymentMethodMap[selectedPaymentMethod] as 'card' | 'mobile_money' | 'cash' | 'wallet',
                rideId,
                metadata: {
                  seats: selectedSeats.toString(),
                  rideType,
                },
              });

              // Step 2: Book the ride
              const response = await ridesApi.bookRide(rideId, selectedSeats);

              if (response.success) {
                // Step 3: Confirm payment (for non-cash methods)
                if (selectedPaymentMethod !== 'cash' && paymentResponse.data?.id) {
                  await paymentApi.confirmPayment({
                    paymentIntentId: paymentResponse.data.id,
                  });
                }

                Alert.alert(
                  'Booking Confirmed!',
                  selectedPaymentMethod === 'cash'
                    ? 'Your booking is confirmed. Please pay the driver in cash upon meeting.'
                    : 'Your booking and payment have been confirmed.',
                  [
                    {
                      text: 'View Booking',
                      onPress: () => {
                        typedNavigation.navigate('Rides');
                      },
                    },
                    {
                      text: 'Contact Driver',
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
                // Cancel payment intent if booking fails
                if (paymentResponse.data?.id) {
                  await paymentApi.cancelPayment(paymentResponse.data.id).catch(() => {});
                }
                Alert.alert('Booking Failed', response.error || 'Unable to complete booking');
              }
            } catch (error: unknown) {
              const errMsg = error instanceof Error ? error.message : String(error);
              Alert.alert('Error', errMsg || 'Booking failed. No payment was charged.');
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
              <Text style={styles.sectionTitle}>Amenities</Text>
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

  const renderRideTypeSelector = () => {
    const rideTypes = [
      { id: 'economy', name: 'Economy', icon: 'directions-car', description: 'Affordable rides' },
      { id: 'comfort', name: 'Comfort', icon: 'airline-seat-recline-extra', description: 'Extra legroom' },
      { id: 'premium', name: 'Premium', icon: 'star', description: 'Luxury vehicles' },
      { id: 'shared', name: 'Shared', icon: 'people', description: 'Split the cost' },
    ];

    return (
      <Card style={styles.rideTypeCard}>
        <Text style={styles.sectionTitle}>Ride Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.rideTypeList}>
            {rideTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.rideTypeItem,
                  rideType === type.id && styles.rideTypeItemSelected,
                ]}
                onPress={() => setRideType(type.id as 'economy' | 'comfort' | 'premium' | 'shared')}
              >
                <Icon 
                  name={type.icon} 
                  size={24} 
                  color={rideType === type.id ? '#FFFFFF' : '#666666'} 
                />
                <Text style={[
                  styles.rideTypeName,
                  rideType === type.id && styles.rideTypeNameSelected,
                ]}>
                  {type.name}
                </Text>
                <Text style={[
                  styles.rideTypeDescription,
                  rideType === type.id && styles.rideTypeDescriptionSelected,
                ]}>
                  {type.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>
    );
  };

  const renderBookingOptions = () => {
    if (!bookingDetails) return null;

    return (
      <Card style={styles.bookingCard}>
        <Text style={styles.sectionTitle}>Booking Details</Text>
        
        <View style={styles.seatSelection}>
          <Text style={styles.seatLabel}>Number of Seats</Text>
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
            <Text style={styles.paymentMethodLabel}>Payment Method</Text>
          </View>
          <View style={styles.paymentMethodRight}>
            <Text style={styles.paymentMethodText}>
              {bookingDetails.paymentMethod || 'Select method'}
            </Text>
            <Icon name="chevron-right" size={20} color="#CCCCCC" />
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  const renderAIPricing = () => {
    return (
      <PricingDisplay
        pricing={aiPricing}
        isLoading={isPricingLoading}
        alternatives={aiPricing?.alternatives}
        onSelectAlternative={(alternative) => {
          setRideType(alternative.rideType);
        }}
        onRefresh={() => {
          if (bookingDetails) {
            calculateAIPricing();
          }
        }}
        showBreakdown={true}
      />
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bookingDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color="#CCCCCC" />
          <Text style={styles.errorText}>Unable to load booking details</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.screenTitle}>Confirm Your Booking</Text>
          
          {renderRideDetails()}
          {renderRideTypeSelector()}
          {renderBookingOptions()}
          {renderAIPricing()}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={isBooking ? 'Booking...' : 'Confirm & Pay'}
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
            <Text style={styles.paymentModalTitle}>Payment Method</Text>
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