/**
 * @fileoverview Delivery details screen for managing active deliveries
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import PackageService, { DeliveryAgreement } from '../../services/PackageService';
import locationService from '../../services/LocationService';
import LoadingScreen from '../../components/common/LoadingScreen';
import { CourierStackParamList } from '../../navigation/CourierNavigator';
import logger from '../../services/LoggingService';

const log = logger.createLogger('DeliveryDetailsScreen');

type DeliveryDetailsRouteProp = RouteProp<CourierStackParamList, 'DeliveryDetails'>;

const DeliveryDetailsScreen: React.FC = () => {
  const route = useRoute<DeliveryDetailsRouteProp>();
  const navigation = useNavigation();
  const { agreementId } = route.params;
  
  const [delivery, setDelivery] = useState<DeliveryAgreement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeliveryDetails();
  }, [agreementId]);

  const loadDeliveryDetails = async () => {
    try {
      const response = await PackageService.getCourierDeliveries();
      if (response.success && response.data) {
        const foundDelivery = response.data.find(d => d.id === agreementId);
        if (foundDelivery) {
          setDelivery(foundDelivery);
        } else {
          Alert.alert('Error', 'Delivery not found');
          navigation.goBack();
        }
      } else {
        Alert.alert('Error', response.error || 'Failed to load delivery details');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load delivery details');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPickup = async () => {
    if (!delivery) return;

    Alert.alert(
      'Confirm Pickup',
      'Have you picked up the package from the sender?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              // Get current location for pickup confirmation
              let location: [number, number] | undefined;
              try {
                const currentLocation = await locationService.getCurrentLocation();
                location = [currentLocation.latitude, currentLocation.longitude];
              } catch (locationError) {
                log.warn('Could not get location for pickup confirmation:', locationError);
                // Continue without location if unavailable
              }

              const response = await PackageService.confirmPickup(delivery.id, location);
              if (response.success) {
                Alert.alert('Success', 'Pickup confirmed! You can now proceed to delivery.');
                loadDeliveryDetails(); // Refresh data
              } else {
                Alert.alert('Error', response.error || 'Failed to confirm pickup');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to confirm pickup');
            }
          },
        },
      ]
    );
  };

  const handleOpenQRScanner = () => {
    (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('QRScanner', { agreementId: delivery?.id });
  };

  const handleCallContact = (phoneNumber: string) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

  const handleOpenMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${encodedAddress}`,
      android: `geo:0,0?q=${encodedAddress}`,
    });
    
    if (url) {
      Linking.openURL(url);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_pickup':
        return colors.warning;
      case 'in_transit':
        return colors.primary;
      case 'completed':
        return colors.success;
      case 'disputed':
        return colors.error;
      default:
        return colors.text.secondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_pickup':
        return 'Waiting for Pickup';
      case 'in_transit':
        return 'In Transit';
      case 'completed':
        return 'Delivered';
      case 'disputed':
        return 'Disputed';
      default:
        return status;
    }
  };

  const getNextAction = () => {
    if (!delivery) return null;

    switch (delivery.status) {
      case 'pending_pickup':
        return {
          text: 'Confirm Pickup',
          action: handleConfirmPickup,
          icon: 'check-circle',
          color: colors.warning,
        };
      case 'in_transit':
        return {
          text: 'Scan QR Code',
          action: handleOpenQRScanner,
          icon: 'qr-code-scanner',
          color: colors.primary,
        };
      default:
        return null;
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading delivery details..." />;
  }

  if (!delivery) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={80} color={colors.error} />
        <Text style={styles.errorText}>Delivery not found</Text>
      </View>
    );
  }

  const nextAction = getNextAction();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Status Header */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(delivery.status) }]}>
              <Text style={styles.statusText}>{getStatusText(delivery.status)}</Text>
            </View>
            <Text style={styles.deliveryId}>#{delivery.id.slice(-6)}</Text>
          </View>
          
          <Text style={styles.packageTitle}>
            {delivery.package?.title || 'Package Delivery'}
          </Text>
          
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Your Earnings</Text>
            <Text style={styles.earningsValue}>
              P{(delivery.agreedPrice - delivery.platformFee).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Package Information */}
        {delivery.package && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Package Information</Text>
            
            <View style={styles.infoRow}>
              <Icon name="category" size={20} color={colors.text.secondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Size</Text>
                <Text style={styles.infoValue}>{delivery.package.packageSize}</Text>
              </View>
            </View>

            {delivery.package.description && (
              <View style={styles.infoRow}>
                <Icon name="description" size={20} color={colors.text.secondary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Description</Text>
                  <Text style={styles.infoValue}>{delivery.package.description}</Text>
                </View>
              </View>
            )}

            <View style={styles.tagsRow}>
              {delivery.package.fragile && (
                <View style={styles.fragileTag}>
                  <Icon name="warning" size={16} color={colors.warning} />
                  <Text style={styles.fragileText}>Fragile</Text>
                </View>
              )}
              {delivery.package.valuable && (
                <View style={styles.valuableTag}>
                  <Icon name="diamond" size={16} color={colors.primary} />
                  <Text style={styles.valuableText}>Valuable</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Pickup Location */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Icon name="place" size={24} color={colors.primary} />
            <Text style={styles.locationTitle}>Pickup Location</Text>
            {delivery.status === 'pending_pickup' && (
              <View style={styles.activeIndicator}>
                <Icon name="radio-button-checked" size={16} color={colors.warning} />
              </View>
            )}
          </View>
          
          <Text style={styles.address}>{delivery.package?.pickupAddress}</Text>
          
          <View style={styles.locationActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleOpenMaps(delivery.package?.pickupAddress || '')}
            >
              <Icon name="directions" size={20} color={colors.primary} />
              <Text style={styles.actionText}>Directions</Text>
            </TouchableOpacity>
            
            {!!(delivery.package as unknown as Record<string, unknown>)?.pickupContactPhone && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCallContact((delivery.package as unknown as Record<string, unknown>)?.pickupContactPhone as string || '')}
              >
                <Icon name="phone" size={20} color={colors.primary} />
                <Text style={styles.actionText}>Call</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Delivery Location */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Icon name="flag" size={24} color={colors.success} />
            <Text style={styles.locationTitle}>Delivery Location</Text>
            {delivery.status === 'in_transit' && (
              <View style={styles.activeIndicator}>
                <Icon name="radio-button-checked" size={16} color={colors.primary} />
              </View>
            )}
          </View>
          
          <Text style={styles.address}>{delivery.package?.dropoffAddress}</Text>
          
          <View style={styles.locationActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleOpenMaps(delivery.package?.dropoffAddress || '')}
            >
              <Icon name="directions" size={20} color={colors.primary} />
              <Text style={styles.actionText}>Directions</Text>
            </TouchableOpacity>
            
            {!!(delivery.package as unknown as Record<string, unknown>)?.dropoffContactPhone && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCallContact((delivery.package as unknown as Record<string, unknown>)?.dropoffContactPhone as string || '')}
              >
                <Icon name="phone" size={20} color={colors.primary} />
                <Text style={styles.actionText}>Call</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Payment Information */}
        <View style={styles.paymentCard}>
          <Text style={styles.cardTitle}>Payment Details</Text>
          
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Package Price</Text>
            <Text style={styles.paymentValue}>P{(delivery.agreedPrice ?? 0).toFixed(2)}</Text>
          </View>

          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Platform Fee</Text>
            <Text style={styles.paymentValue}>-P{(delivery.platformFee ?? 0).toFixed(2)}</Text>
          </View>

          <View style={[styles.paymentRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Your Earnings</Text>
            <Text style={styles.totalValue}>
              P{((delivery.agreedPrice ?? 0) - (delivery.platformFee ?? 0)).toFixed(2)}
            </Text>
          </View>

          <View style={styles.escrowInfo}>
            <Icon name="security" size={16} color={colors.success} />
            <Text style={styles.escrowText}>
              Payment secured in escrow - released upon delivery
            </Text>
          </View>
        </View>

        {/* QR Code Info */}
        {delivery.qrCodeToken && (
          <View style={styles.qrCard}>
            <View style={styles.qrHeader}>
              <Icon name="qr-code" size={24} color={colors.success} />
              <Text style={styles.qrTitle}>Delivery Verification</Text>
            </View>
            <Text style={styles.qrDescription}>
              Scan the QR code with the recipient to complete delivery and release payment.
            </Text>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.cardTitle}>Delivery Timeline</Text>
          
          <View style={styles.timelineItem}>
            <View style={[styles.timelineIcon, { backgroundColor: colors.success }]}>
              <Icon name="check" size={16} color={colors.text.inverse} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Delivery Accepted</Text>
              <Text style={styles.timelineTime}>
                {new Date(delivery.createdAt).toLocaleString()}
              </Text>
            </View>
          </View>

          {delivery.status !== 'pending_pickup' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineIcon, { backgroundColor: colors.success }]}>
                <Icon name="check" size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Package Picked Up</Text>
                <Text style={styles.timelineTime}>Confirmed</Text>
              </View>
            </View>
          )}

          {delivery.status === 'completed' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineIcon, { backgroundColor: colors.success }]}>
                <Icon name="check" size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Package Delivered</Text>
                <Text style={styles.timelineTime}>Completed</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Button */}
      {nextAction && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.actionButton_, { backgroundColor: nextAction.color }]}
            onPress={nextAction.action}
          >
            <Icon name={nextAction.icon} size={24} color={colors.text.inverse} />
            <Text style={styles.actionButtonText}>{nextAction.text}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  errorText: {
    fontSize: 18,
    color: colors.error,
    marginTop: 16,
  },
  statusCard: {
    backgroundColor: colors.background.secondary,
    padding: 20,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    color: colors.text.inverse,
    fontWeight: 'bold',
  },
  deliveryId: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  packageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 12,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  earningsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.success,
  },
  infoCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: colors.text.primary,
  },
  tagsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  fragileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  fragileText: {
    fontSize: 12,
    color: colors.warning,
    marginLeft: 4,
  },
  valuableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  valuableText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 4,
  },
  locationCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  activeIndicator: {
    marginLeft: 8,
  },
  address: {
    fontSize: 16,
    color: colors.text.primary,
    lineHeight: 22,
    marginBottom: 12,
  },
  locationActions: {
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  actionText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 4,
  },
  paymentCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  paymentValue: {
    fontSize: 14,
    color: colors.text.primary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.success,
  },
  escrowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: colors.success + '20',
    borderRadius: 8,
  },
  escrowText: {
    fontSize: 12,
    color: colors.success,
    marginLeft: 8,
    flex: 1,
  },
  qrCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginLeft: 8,
  },
  qrDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  timelineCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  timelineTime: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.secondary,
  },
  actionButton_: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  actionButtonText: {
    color: colors.text.inverse,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default DeliveryDetailsScreen;