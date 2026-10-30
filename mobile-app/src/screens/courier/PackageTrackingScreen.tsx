/**
 * @fileoverview Package tracking screen with real-time location updates
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2026-10-30
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import PackageService from '../../services/PackageService';
import LoadingScreen from '../../components/common/LoadingScreen';
import ReportDeliveryProblem from '../../components/courier/ReportDeliveryProblem';
import DeliveryTrackingMap from '../../components/courier/DeliveryTrackingMap';
import { CourierStackParamList } from '../../navigation/CourierNavigator';
import { useI18n } from '../../i18n/I18nContext';

type PackageTrackingRouteProp = RouteProp<CourierStackParamList, 'PackageTracking'>;

const PackageTrackingScreen: React.FC = () => {
  const { t } = useI18n();
  const route = useRoute<PackageTrackingRouteProp>();
  const navigation = useNavigation();
  const { packageId } = route.params;
  
  interface PackageData {
    id: string;
    title: string;
    pickupAddress: string;
    dropoffAddress: string;
    packageSize: string;
    fragile: boolean;
    valuable: boolean;
    senderPriceOffer: number;
    createdAt: string;
  }
  interface CourierData {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  }
  interface DeliveryAgreementData {
    id: string;
    status: string;
    courierId: string;
    agreedPrice: number;
    platformFee: number;
    courier?: CourierData;
  }
  interface CourierLocationData {
    location: [number, number];
    timestamp: string;
    accuracy?: number;
    speed?: number;
  }
  interface TrackingData {
    package: PackageData;
    deliveryAgreement?: DeliveryAgreementData;
    pickupLocation?: [number, number] | null;
    dropoffLocation?: [number, number] | null;
    courierLocations?: CourierLocationData[];
  }
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  // One alert per visit: the screen refreshes every 30 seconds.
  const alertedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const inTransit = trackingData?.deliveryAgreement?.status === 'in_transit';

  // Refresh often while the package is moving, the courier's phone reports
  // about every 20 seconds; otherwise only to notice a change of status.
  useEffect(() => {
    loadTrackingData();
    const interval = setInterval(loadTrackingData, inTransit ? 15000 : 60000);
    return () => clearInterval(interval);
  }, [packageId, inTransit]);

  const loadTrackingData = async () => {
    try {
      const response = await PackageService.getPackageTracking(packageId);
      if (response.success && response.data) {
        setTrackingData(response.data);
      } else {
        // This used to show an invented package and courier ("John Doe", in
        // New York) whenever loading failed, which a sender could mistake
        // for their real delivery. Now a failed first load shows the "not
        // available" screen, and a failed refresh keeps what was shown.
        if (!alertedRef.current) {
          alertedRef.current = true;
          Alert.alert(t('common.error'), response.error || t('cf2.failedToLoadTrackingInformation'));
        }
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('cf2.failedToLoadTrackingInformation'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTrackingData();
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
        return t('cf2.unknown');
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (loading) {
    return <LoadingScreen message={t('cf.loadingPackageTracking')} />;
  }

  if (!trackingData) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={80} color={colors.error} />
        <Text style={styles.errorText}>{t('cf.trackingInformationNotAvailable')}</Text>
      </View>
    );
  }

  const { package: pkg, deliveryAgreement, courierLocations } = trackingData;

  return (
    <View style={styles.container}>
      {/* Map View */}
      <DeliveryTrackingMap
        pickup={trackingData.pickupLocation}
        dropoff={trackingData.dropoffLocation}
        courierTrail={courierLocations}
        inTransit={deliveryAgreement?.status === 'in_transit'}
      />
      <ScrollView style={styles.content}>
        {/* Status Header */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(deliveryAgreement?.status as string) }
            ]}>
              <Text style={styles.statusText}>
                {getStatusText(deliveryAgreement?.status as string)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
            >
              <Icon 
                name="refresh" 
                size={20} 
                color={refreshing ? colors.warning : colors.text.secondary} 
              />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.packageTitle}>{pkg.title}</Text>
          
          {deliveryAgreement?.courier && (
            <View style={styles.courierInfo}>
              <Icon name="person" size={20} color={colors.text.secondary} />
              <Text style={styles.courierName}>
                {deliveryAgreement.courier.firstName} {deliveryAgreement.courier.lastName}
              </Text>
            </View>
          )}
        </View>

        {/* Live Updates */}
        {courierLocations && courierLocations.length > 0 && (
          <View style={styles.liveCard}>
            <View style={styles.liveHeader}>
              <Icon name="my-location" size={20} color={colors.success} />
              <Text style={styles.liveTitle}>{t('cf.liveTracking')}</Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{t('cf.live')}</Text>
              </View>
            </View>
            
            <View style={styles.speedInfo}>
              <View style={styles.speedItem}>
                <Text style={styles.speedLabel}>{t('cf.speed')}</Text>
                <Text style={styles.speedValue}>
                  {(courierLocations[courierLocations.length - 1]?.speed as number) || 0} km/h
                </Text>
              </View>
              <View style={styles.speedItem}>
                <Text style={styles.speedLabel}>{t('cf.lastUpdate')}</Text>
                <Text style={styles.speedValue}>
                  {formatTime(courierLocations[courierLocations.length - 1]?.timestamp as string)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Package Information */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>{t('cf.packageDetails')}</Text>
          
          <View style={styles.infoRow}>
            <Icon name="category" size={20} color={colors.text.secondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{t('cf.size2')}</Text>
              <Text style={styles.infoValue}>{pkg.packageSize}</Text>
            </View>
          </View>

          <View style={styles.tagsRow}>
            {pkg.fragile && (
              <View style={styles.fragileTag}>
                <Icon name="warning" size={16} color={colors.warning} />
                <Text style={styles.fragileText}>{t('cf.fragile')}</Text>
              </View>
            )}
            {pkg.valuable && (
              <View style={styles.valuableTag}>
                <Icon name="diamond" size={16} color={colors.primary} />
                <Text style={styles.valuableText}>{t('cf.valuable')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Address Information */}
        <View style={styles.addressCard}>
          <Text style={styles.cardTitle}>{t('cf.deliveryRoute')}</Text>
          
          <View style={styles.addressItem}>
            <View style={styles.addressIcon}>
              <Icon name="place" size={20} color={colors.primary} />
            </View>
            <View style={styles.addressContent}>
              <Text style={styles.addressLabel}>{t('cf.pickup')}</Text>
              <Text style={styles.addressText}>{pkg.pickupAddress}</Text>
            </View>
          </View>
          
          <View style={styles.routeConnector}>
            <View style={styles.routeDots}>
              <View style={styles.routeDot} />
              <View style={styles.routeDot} />
              <View style={styles.routeDot} />
            </View>
          </View>
          
          <View style={styles.addressItem}>
            <View style={styles.addressIcon}>
              <Icon name="flag" size={20} color={colors.success} />
            </View>
            <View style={styles.addressContent}>
              <Text style={styles.addressLabel}>{t('cf.delivery')}</Text>
              <Text style={styles.addressText}>{pkg.dropoffAddress}</Text>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.cardTitle}>{t('cf.deliveryTimeline')}</Text>
          
          <View style={styles.timelineItem}>
            <View style={[styles.timelineIcon, { backgroundColor: colors.success }]}>
              <Icon name="check" size={16} color={colors.text.inverse} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>{t('cf.packageCreated')}</Text>
              <Text style={styles.timelineTime}>
                {formatDate(pkg.createdAt)} at {formatTime(pkg.createdAt)}
              </Text>
            </View>
          </View>

          {deliveryAgreement && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineIcon, { backgroundColor: colors.success }]}>
                <Icon name="check" size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{t('cf.courierAssigned')}</Text>
                <Text style={styles.timelineTime}>
                  {deliveryAgreement.courier?.firstName} {deliveryAgreement.courier?.lastName}
                </Text>
              </View>
            </View>
          )}

          {deliveryAgreement?.status !== 'pending_pickup' && (
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

          {deliveryAgreement?.status === 'in_transit' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineIcon, { backgroundColor: colors.primary }]}>
                <Icon name="local-shipping" size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{t('cf.inTransit')}</Text>
                <Text style={styles.timelineTime}>{t('cf.liveTrackingActive')}</Text>
              </View>
            </View>
          )}

          {deliveryAgreement?.status === 'completed' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineIcon, { backgroundColor: colors.success }]}>
                <Icon name="check" size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{t('cf.packageDelivered')}</Text>
                <Text style={styles.timelineTime}>{t('cf.completedSuccessfully')}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Contact Information */}
        {deliveryAgreement?.courier && (
          <View style={styles.contactCard}>
            <Text style={styles.cardTitle}>{t('cf.contactCourier')}</Text>
            
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => {
                if (deliveryAgreement.courier?.phone) {
                  Linking.openURL(`tel:${deliveryAgreement.courier.phone}`);
                }
              }}
            >
              <Icon name="phone" size={20} color={colors.primary} />
              <Text style={styles.contactButtonText}>
                Call {deliveryAgreement.courier.firstName}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {deliveryAgreement?.id && (
          <ReportDeliveryProblem
            agreementId={deliveryAgreement.id}
            deliveryStatus={deliveryAgreement.status as string}
            onReported={loadTrackingData}
          />
        )}
      </ScrollView>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
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
    padding: 16,
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
  refreshButton: {
    padding: 8,
  },
  packageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  courierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courierName: {
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: 8,
  },
  liveCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 4,
  },
  liveText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: 'bold',
  },
  speedInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  speedItem: {
    alignItems: 'center',
  },
  speedLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  speedValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 4,
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
    alignItems: 'center',
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
  addressCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIcon: {
    width: 40,
    alignItems: 'center',
    paddingTop: 2,
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 16,
    color: colors.text.primary,
    lineHeight: 22,
  },
  routeConnector: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  routeDots: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  routeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.light,
    marginVertical: 2,
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
  contactCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '20',
    paddingVertical: 12,
    borderRadius: 8,
  },
  contactButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default PackageTrackingScreen;