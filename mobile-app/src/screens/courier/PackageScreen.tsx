/**
 * @fileoverview Package management screen for sending packages
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import PackageService, { Package } from '../../services/PackageService';
import LoadingScreen from '../../components/common/LoadingScreen';

const PackageScreen: React.FC = () => {
  const navigation = useNavigation();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const response = await PackageService.getUserPackages();
      if (response.success && response.data) {
        setPackages(response.data);
      } else {
        Alert.alert('Error', response.error || 'Failed to load packages');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load packages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPackages();
  };

  const navigateToCreatePackage = () => {
    // Navigate to package creation screen
    navigation.navigate('CreatePackage' as never);
  };

  const navigateToPackageDetails = (packageId: string) => {
    (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('PackageDetails', { packageId });
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase().replace(/ /g, '_');
    switch (normalizedStatus) {
      case 'active':
      case 'awaiting_courier':
        return colors.info;
      case 'courier_assigned':
      case 'pending_pickup':
        return colors.warning;
      case 'in_transit':
        return colors.primary;
      case 'delivered':
      case 'completed':
        return colors.success;
      case 'cancelled':
      case 'disputed':
        return colors.error;
      default:
        return colors.text.secondary;
    }
  };

  const getStatusText = (package_: Package) => {
    if (!package_.isActive) {
      return 'Cancelled';
    }

    // Check the package status field if available
    if (package_.status) {
      switch (package_.status.toLowerCase()) {
        case 'pending':
        case 'awaiting_courier':
          return 'Awaiting Courier';
        case 'accepted':
        case 'courier_assigned':
          return 'Courier Assigned';
        case 'pending_pickup':
          return 'Pending Pickup';
        case 'in_transit':
        case 'picked_up':
          return 'In Transit';
        case 'delivered':
        case 'completed':
          return 'Delivered';
        case 'disputed':
          return 'Disputed';
        case 'cancelled':
          return 'Cancelled';
        default:
          return package_.status.charAt(0).toUpperCase() + package_.status.slice(1).replace(/_/g, ' ');
      }
    }

    // Default to Active if no status is set but package is active
    return 'Active';
  };

  const renderPackageCard = (package_: Package) => (
    <TouchableOpacity
      key={package_.id}
      style={styles.packageCard}
      onPress={() => navigateToPackageDetails(package_.id)}
    >
      <View style={styles.packageHeader}>
        <View style={styles.packageTitleRow}>
          <Icon name="local-shipping" size={20} color={colors.primary} />
          <Text style={styles.packageTitle}>{package_.title}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(getStatusText(package_)) }]}>
          <Text style={styles.statusText}>{getStatusText(package_)}</Text>
        </View>
      </View>

      <View style={styles.packageDetails}>
        <View style={styles.addressRow}>
          <Icon name="place" size={16} color={colors.text.secondary} />
          <Text style={styles.addressText} numberOfLines={1}>
            From: {package_.pickupAddress}
          </Text>
        </View>
        <View style={styles.addressRow}>
          <Icon name="flag" size={16} color={colors.text.secondary} />
          <Text style={styles.addressText} numberOfLines={1}>
            To: {package_.dropoffAddress}
          </Text>
        </View>
      </View>

      <View style={styles.packageFooter}>
        <View style={styles.packageInfo}>
          <Text style={styles.packageSize}>Size: {package_.packageSize}</Text>
          {package_.fragile && (
            <View style={styles.fragileTag}>
              <Icon name="warning" size={12} color={colors.warning} />
              <Text style={styles.fragileText}>Fragile</Text>
            </View>
          )}
        </View>
        <Text style={styles.priceText}>P{package_.senderPriceOffer.toFixed(2)}</Text>
      </View>

      <Text style={styles.dateText}>
        Created {new Date(package_.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return <LoadingScreen message="Loading your packages..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {packages.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="local-shipping" size={80} color={colors.text.secondary} />
            <Text style={styles.emptyTitle}>No packages yet</Text>
            <Text style={styles.emptyDescription}>
              Send your first package with our secure delivery service
            </Text>
          </View>
        ) : (
          <View style={styles.packagesList}>
            {packages.map(renderPackageCard)}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.createButton}
        onPress={navigateToCreatePackage}
      >
        <Icon name="add" size={24} color={colors.text.inverse} />
        <Text style={styles.createButtonText}>Send Package</Text>
      </TouchableOpacity>
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
    paddingHorizontal: 16,
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
    paddingBottom: 100,
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: colors.text.inverse,
    fontWeight: 'bold',
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
  packageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packageSize: {
    fontSize: 14,
    color: colors.text.secondary,
    marginRight: 12,
  },
  fragileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  fragileText: {
    fontSize: 12,
    color: colors.warning,
    marginLeft: 2,
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.success,
  },
  dateText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  createButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  createButtonText: {
    color: colors.text.inverse,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default PackageScreen;