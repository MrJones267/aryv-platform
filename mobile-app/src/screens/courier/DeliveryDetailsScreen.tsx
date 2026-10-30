/**
 * @fileoverview Delivery details screen for managing active deliveries
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2026-10-30
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
import ReportDeliveryProblem from '../../components/courier/ReportDeliveryProblem';
import useShareDeliveryLocation from '../../hooks/useShareDeliveryLocation';
import DeliveryLocationService from '../../services/DeliveryLocationService';
import { CourierStackParamList } from '../../navigation/CourierNavigator';
import logger from '../../services/LoggingService';
import { useI18n } from '../../i18n/I18nContext';

const log = logger.createLogger('DeliveryDetailsScreen');

type DeliveryDetailsRouteProp = RouteProp<CourierStackParamList, 'DeliveryDetails'>;

const DeliveryDetailsScreen: React.FC = () => {
  const { t } = useI18n();
  const route = useRoute<DeliveryDetailsRouteProp>();
  const navigation = useNavigation();
  const { agreementId } = route.params;
  
  const [delivery, setDelivery] = useState<DeliveryAgreement | null>(null);
  const [loading, setLoading] = useState(true);
  const sharing = useShareDeliveryLocation(delivery?.id, delivery?.status === 'in_transit');

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
          Alert.alert(t('common.error'), t('cf.deliveryNotFound'));
          navigation.goBack();
        }
      } else {
        Alert.alert(t('common.error'), response.error || t('cf2.failedToLoadDeliveryDetails'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('cf2.failedToLoadDeliveryDetails'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPickup = async () => {
    if (!delivery) return;

    Alert.alert(
      t('cf.confirmPickup'),
      t('cf3.haveYouPickedUpThe'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            try {
              // Get current location for pickup confirmation
              let location: [number, number] | undefined;
              try {
                const currentLocation = await locationService.getCurrentLocation();
                // The server takes [longitude, latitude]; this used to send them swapped.
                location = [currentLocation.longitude, currentLocation.latitude];
              } catch (locationError) {
                log.warn('Could not get location for pickup confirmation:', locationError);
                // Continue without location if unavailable
              }

              const response = await PackageService.confirmPickup(delivery.id, location);
              if (response.success) {
                Alert.alert(t('common.success'), t('cf2.pickupConfirmedYouCanNow'));
                loadDeliveryDetails(); // Refresh data
              } else {
                Alert.alert(t('common.error'), response.error || t('cf2.failedToConfirmPickup'));
              }
            } catch (error) {
              Alert.alert(t('common.error'), t('cf2.failedToConfirmPickup'));
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
        return t('cf2.waitingForPickup');
      case 'in_transit':
        return t('cf.inTransit');
      case 'completed':
        return t('cf2.delivered');
      case 'disputed':
        return t('cf2.disputed');
      default:
        return status;
    }
  };

  const getNextAction = () => {
    if (!delivery) return null;

    switch (delivery.status) {
      case 'pending_pickup':
        return {
          text: t('cf.confirmPickup'),
          action: handleConfirmPickup,
          icon: 'check-circle',
          color: colors.warning,
        };
      case 'in_transit':
        return {
          text: t('cf.scanQrCode'),
          action: handleOpenQRScanner,
          icon: 'qr-code-scanner',
          color: colors.primary,
        };
      default:
        return null;
    }
  };

  if (loading) {
    return <LoadingScreen message={t('cf.loadingDeliveryDetails')} />;
  }

  if (!delivery) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={80} color={colors.error} />
        <Text style={styles.errorText}>{t('cf.deliveryNotFound')}</Text>
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
            {delivery.package?.title || t('cf2.packageDelivery')}
          </Text>
          
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>{t('cf.yourEarnings')}</Text>
            <Text style={styles.earningsValue}>
              P{(delivery.agreedPrice - delivery.platformFee).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Package Information */}
        {delivery.package && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>{t('cf.packageInformation')}</Text>
            
            <View style={styles.infoRow}>
              <Icon name="category" size={20} color={colors.text.secondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('cf.size2')}</Text>
                <Text style={styles.infoValue}>{delivery.package.packageSize}</Text>
              </View>
            </View>

            {delivery.package.description && (
              <View style={styles.infoRow}>
                <Icon name="description" size={20} color={colors.text.secondary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t('cf.description3')}</Text>
                  <Text style={styles.infoValue}>{delivery.package.description}</Text>
                </View>
              </View>
            )}

            <View style={styles.tagsRow}>
              {delivery.package.fragile && (
                <View style={styles.fragileTag}>
                  <Icon name="warning" size={16} color={colors.warning} />
                  <Text style={styles.fragileText}>{t('cf.fragile')}</Text>
                </View>
              )}
              {delivery.package.valuable && (
                <View style={styles.valuableTag}>
                  <Icon name="diamond" size={16} color={colors.primary} />
                  <Text style={styles.valuableText}>{t('cf.valuable')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Pickup Location */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Icon name="place" size={24} color={colors.primary} />
            <Text style={styles.locationTitle}>{t('cf.pickupLocation')}</Text>
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
              <Text style={styles.actionText}>{t('cf.directions')}</Text>
            </TouchableOpacity>
            
            {!!(delivery.package as unknown as Record<string, unknown>)?.pickupContactPhone && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCallContact((delivery.package as unknown as Record<string, unknown>)?.pickupContactPhone as string || '')}
              >
                <Icon name="phone" size={20} color={colors.primary} />
                <Text style={styles.actionText}>{t('cf.call')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Delivery Location */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Icon name="flag" size={24} color={colors.success} />
            <Text style={styles.locationTitle}>{t('cf.deliveryLocation')}</Text>
            {delivery.status === 'in_transit' && (
              <View style={styles.activeIndicator}>
                <Icon name="radio-button-checked" size={16} color={colors.primary} />
              </View>
            )}
          </View>
          
          <Text style={styles.address}>{delivery.package?.dropoffAddress}</Text>

          {delivery.status === 'in_transit' && (
            <Text style={styles.sharingText}>
              {sharing === 'sharing'
                ? (DeliveryLocationService.supported
                  ? t('cf2.sharingYourLocationWithThe')
                  : t('cf2.sharingYourLocationWithThe2'))
                : sharing === 'no_permission'
                  ? t('cf2.allowLocationAccessSoThe')
                  : sharing === 'unavailable'
                    ? t('cf2.yourLocationIsUnavailableSo')
                    : t('cf2.findingYourLocation')}
            </Text>
          )}
          
          <View style={styles.locationActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleOpenMaps(delivery.package?.dropoffAddress || '')}
            >
              <Icon name="directions" size={20} color={colors.primary} />
              <Text style={styles.actionText}>{t('cf.directions')}</Text>
            </TouchableOpacity>
            
            {!!(delivery.package as unknown as Record<string, unknown>)?.dropoffContactPhone && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCallContact((delivery.package as unknown as Record<string, unknown>)?.dropoffContactPhone as string || '')}
              >
                <Icon name="phone" size={20} color={colors.primary} />
                <Text style={styles.actionText}>{t('cf.call')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Payment Information */}
        <View style={styles.paymentCard}>
          <Text style={styles.cardTitle}>{t('cf.paymentDetails')}</Text>
          
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>{t('cf.packagePrice')}</Text>
            <Text style={styles.paymentValue}>P{(delivery.agreedPrice ?? 0).toFixed(2)}</Text>
          </View>

          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>{t('cf.platformFee')}</Text>
            <Text style={styles.paymentValue}>-P{(delivery.platformFee ?? 0).toFixed(2)}</Text>
          </View>

          <View style={[styles.paymentRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>{t('cf.yourEarnings')}</Text>
            <Text style={styles.totalValue}>
              P{((delivery.agreedPrice ?? 0) - (delivery.platformFee ?? 0)).toFixed(2)}
            </Text>
          </View>

          <View style={styles.escrowInfo}>
            <Icon name="security" size={16} color={colors.success} />
            <Text style={styles.escrowText}>
              {t('cf.paymentSecuredInEscrowReleased')}
            </Text>
          </View>
        </View>

        {/* QR Code Info */}
        {delivery.qrCodeToken && (
          <View style={styles.qrCard}>
            <View style={styles.qrHeader}>
              <Icon name="qr-code" size={24} color={colors.success} />
              <Text style={styles.qrTitle}>{t('cf.deliveryVerification')}</Text>
            </View>
            <Text style={styles.qrDescription}>
              {t('cf.scanTheQrCodeWith')}
            </Text>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.cardTitle}>{t('cf.deliveryTimeline')}</Text>
          
          <View style={styles.timelineItem}>
            <View style={[styles.timelineIcon, { backgroundColor: colors.success }]}>
              <Icon name="check" size={16} color={colors.text.inverse} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>{t('cf.deliveryAccepted')}</Text>
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
                <Text style={styles.timelineTitle}>{t('cf.packagePickedUp')}</Text>
                <Text style={styles.timelineTime}>{t('cf.confirmed')}</Text>
              </View>
            </View>
          )}

          {delivery.status === 'completed' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineIcon, { backgroundColor: colors.success }]}>
                <Icon name="check" size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{t('cf.packageDelivered')}</Text>
                <Text style={styles.timelineTime}>{t('cf.completed')}</Text>
              </View>
            </View>
          )}
        </View>

        <ReportDeliveryProblem
          agreementId={delivery.id}
          deliveryStatus={delivery.status}
          onReported={loadDeliveryDetails}
        />
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
  sharingText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 12,
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