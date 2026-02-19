/**
 * @fileoverview Courier dashboard for delivery operations
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
  RefreshControl,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import PackageService, { Package, DeliveryAgreement } from '../../services/PackageService';
import LoadingScreen from '../../components/common/LoadingScreen';

const CourierScreen: React.FC = () => {
  const navigation = useNavigation();
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<DeliveryAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'active'>('available');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [packagesResponse, deliveriesResponse] = await Promise.all([
        PackageService.getAvailablePackages(),
        PackageService.getCourierDeliveries(),
      ]);

      if (packagesResponse.success && packagesResponse.data) {
        setAvailablePackages(packagesResponse.data);
      }

      if (deliveriesResponse.success && deliveriesResponse.data) {
        setActiveDeliveries(deliveriesResponse.data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load courier data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAcceptPackage = async (packageId: string) => {
    try {
      const response = await PackageService.acceptPackage(packageId);
      if (response.success) {
        Alert.alert('Success', 'Package accepted! Check your active deliveries.');
        loadData(); // Refresh data
      } else {
        Alert.alert('Error', response.error || 'Failed to accept package');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to accept package');
    }
  };

  const navigateToDeliveryDetails = (agreementId: string) => {
    (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('DeliveryDetails', { agreementId });
  };

  const navigateToPackageDetails = (packageId: string) => {
    (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('PackageDetails', { packageId });
  };

  const renderAvailablePackageCard = (package_: Package) => (
    <View key={package_.id} style={styles.packageCard}>
      <View style={styles.packageHeader}>
        <View style={styles.packageTitleRow}>
          <Icon name="local-shipping" size={20} color={colors.primary} />
          <Text style={styles.packageTitle}>{package_.title}</Text>
        </View>
        <Text style={styles.priceText}>P{(package_.senderPriceOffer ?? 0).toFixed(2)}</Text>
      </View>

      <View style={styles.packageDetails}>
        <View style={styles.addressRow}>
          <Icon name="place" size={16} color={colors.text.secondary} />
          <Text style={styles.addressText} numberOfLines={1}>
            Pickup: {package_.pickupAddress}
          </Text>
        </View>
        <View style={styles.addressRow}>
          <Icon name="flag" size={16} color={colors.text.secondary} />
          <Text style={styles.addressText} numberOfLines={1}>
            Dropoff: {package_.dropoffAddress}
          </Text>
        </View>
      </View>

      <View style={styles.packageInfo}>
        <View style={styles.packageMeta}>
          <Text style={styles.packageSize}>Size: {package_.packageSize}</Text>
          {package_.distance && (
            <Text style={styles.distanceText}>
              {package_.distance.toFixed(1)} km
            </Text>
          )}
        </View>
        <View style={styles.packageTags}>
          {package_.fragile && (
            <View style={styles.fragileTag}>
              <Icon name="warning" size={12} color={colors.warning} />
              <Text style={styles.fragileText}>Fragile</Text>
            </View>
          )}
          {package_.valuable && (
            <View style={styles.valuableTag}>
              <Icon name="diamond" size={12} color={colors.primary} />
              <Text style={styles.valuableText}>Valuable</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => navigateToPackageDetails(package_.id)}
        >
          <Text style={styles.detailsButtonText}>Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptPackage(package_.id)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const getDeliveryStatusColor = (status: string) => {
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

  const renderActiveDeliveryCard = (delivery: DeliveryAgreement) => (
    <TouchableOpacity
      key={delivery.id}
      style={styles.packageCard}
      onPress={() => navigateToDeliveryDetails(delivery.id)}
    >
      <View style={styles.packageHeader}>
        <View style={styles.packageTitleRow}>
          <Icon name="local-shipping" size={20} color={colors.primary} />
          <Text style={styles.packageTitle}>
            {delivery.package?.title || 'Package'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getDeliveryStatusColor(delivery.status) }]}>
          <Text style={styles.statusText}>{delivery.status.replace('_', ' ')}</Text>
        </View>
      </View>

      {delivery.package && (
        <View style={styles.packageDetails}>
          <View style={styles.addressRow}>
            <Icon name="place" size={16} color={colors.text.secondary} />
            <Text style={styles.addressText} numberOfLines={1}>
              Pickup: {delivery.package.pickupAddress}
            </Text>
          </View>
          <View style={styles.addressRow}>
            <Icon name="flag" size={16} color={colors.text.secondary} />
            <Text style={styles.addressText} numberOfLines={1}>
              Dropoff: {delivery.package.dropoffAddress}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.deliveryFooter}>
        <Text style={styles.earningsText}>
          Earnings: P{(delivery.agreedPrice - delivery.platformFee).toFixed(2)}
        </Text>
        {delivery.qrCodeToken && (
          <View style={styles.qrInfo}>
            <Icon name="qr-code" size={16} color={colors.success} />
            <Text style={styles.qrText}>QR Ready</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return <LoadingScreen message="Loading courier dashboard..." />;
  }

  return (
    <View style={styles.container}>
      {/* Status Header */}
      <View style={styles.statusHeader}>
        <View style={styles.onlineToggle}>
          <Text style={styles.statusLabel}>Available for deliveries</Text>
          <Switch
            value={isOnline}
            onValueChange={setIsOnline}
            trackColor={{ false: colors.border.light, true: colors.success }}
            thumbColor={isOnline ? colors.text.inverse : colors.text.secondary}
          />
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{activeDeliveries.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{availablePackages.length}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'available' && styles.activeTab]}
          onPress={() => setActiveTab('available')}
        >
          <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>
            Available ({availablePackages.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active ({activeDeliveries.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'available' ? (
          <>
            {!isOnline && (
              <View style={styles.offlineNotice}>
                <Icon name="info" size={20} color={colors.warning} />
                <Text style={styles.offlineText}>
                  Turn on availability to see delivery requests
                </Text>
              </View>
            )}
            
            {availablePackages.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="local-shipping" size={80} color={colors.text.secondary} />
                <Text style={styles.emptyTitle}>No packages available</Text>
                <Text style={styles.emptyDescription}>
                  Check back later for new delivery opportunities
                </Text>
              </View>
            ) : (
              <View style={styles.packagesList}>
                {availablePackages.map(renderAvailablePackageCard)}
              </View>
            )}
          </>
        ) : (
          <>
            {activeDeliveries.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="delivery-dining" size={80} color={colors.text.secondary} />
                <Text style={styles.emptyTitle}>No active deliveries</Text>
                <Text style={styles.emptyDescription}>
                  Accept packages from the Available tab to start earning
                </Text>
              </View>
            ) : (
              <View style={styles.packagesList}>
                {activeDeliveries.map(renderActiveDeliveryCard)}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  statusHeader: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  onlineToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  offlineNotice: {
    backgroundColor: colors.warning + '20',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  offlineText: {
    color: colors.warning,
    marginLeft: 8,
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  packagesList: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  packageCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  packageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.success,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: colors.text.inverse,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  packageDetails: {
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 8,
    flex: 1,
  },
  packageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  packageMeta: {
    flexDirection: 'row',
  },
  packageSize: {
    fontSize: 14,
    color: colors.text.secondary,
    marginRight: 12,
  },
  distanceText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  packageTags: {
    flexDirection: 'row',
  },
  fragileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  fragileText: {
    fontSize: 12,
    color: colors.warning,
    marginLeft: 2,
  },
  valuableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  valuableText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 2,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailsButton: {
    flex: 1,
    backgroundColor: colors.background.primary,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  detailsButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  deliveryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
  },
  qrInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrText: {
    fontSize: 12,
    color: colors.success,
    marginLeft: 4,
  },
});

export default CourierScreen;