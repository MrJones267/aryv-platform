/**
 * @fileoverview Package details screen for viewing package information
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
import PackageService, { Package } from '../../services/PackageService';
import LoadingScreen from '../../components/common/LoadingScreen';
import { CourierStackParamList } from '../../navigation/CourierNavigator';

type PackageDetailsRouteProp = RouteProp<CourierStackParamList, 'PackageDetails'>;

const PackageDetailsScreen: React.FC = () => {
  const route = useRoute<PackageDetailsRouteProp>();
  const navigation = useNavigation();
  const { packageId } = route.params;
  
  const [package_, setPackage] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPackageDetails();
  }, [packageId]);

  const loadPackageDetails = async () => {
    try {
      const response = await PackageService.getPackageById(packageId);
      if (response.success && response.data) {
        setPackage(response.data);
      } else {
        Alert.alert('Error', response.error || 'Package not found');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load package details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptPackage = async () => {
    if (!package_) return;

    Alert.alert(
      'Accept Delivery',
      `Accept this package delivery for P${(package_.senderPriceOffer ?? 0).toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              const response = await PackageService.acceptPackage(package_.id);
              if (response.success) {
                Alert.alert(
                  'Success!',
                  'Package accepted! Check your active deliveries.',
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation.goBack(),
                    },
                  ]
                );
              } else {
                Alert.alert('Error', response.error || 'Failed to accept package');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to accept package');
            }
          },
        },
      ]
    );
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

  if (loading) {
    return <LoadingScreen message="Loading package details..." />;
  }

  if (!package_) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={80} color={colors.error} />
        <Text style={styles.errorText}>Package not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Package Header */}
        <View style={styles.headerCard}>
          <View style={styles.titleRow}>
            <Icon name="local-shipping" size={24} color={colors.primary} />
            <Text style={styles.packageTitle}>{package_.title}</Text>
          </View>
          
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Offered Amount</Text>
            <Text style={styles.priceValue}>P{(package_.senderPriceOffer ?? 0).toFixed(2)}</Text>
          </View>

          {package_.systemSuggestedPrice && (
            <View style={styles.suggestionRow}>
              <Text style={styles.suggestionLabel}>Suggested Price</Text>
              <Text style={styles.suggestionValue}>P{(package_.systemSuggestedPrice ?? 0).toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* Package Info */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Package Information</Text>
          
          <View style={styles.infoRow}>
            <Icon name="category" size={20} color={colors.text.secondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Size</Text>
              <Text style={styles.infoValue}>{package_.packageSize}</Text>
            </View>
          </View>

          {package_.description && (
            <View style={styles.infoRow}>
              <Icon name="description" size={20} color={colors.text.secondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Description</Text>
                <Text style={styles.infoValue}>{package_.description}</Text>
              </View>
            </View>
          )}

          <View style={styles.tagsRow}>
            {package_.fragile && (
              <View style={styles.fragileTag}>
                <Icon name="warning" size={16} color={colors.warning} />
                <Text style={styles.fragileText}>Fragile</Text>
              </View>
            )}
            {package_.valuable && (
              <View style={styles.valuableTag}>
                <Icon name="diamond" size={16} color={colors.primary} />
                <Text style={styles.valuableText}>Valuable</Text>
              </View>
            )}
          </View>
        </View>

        {/* Pickup Location */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Icon name="place" size={24} color={colors.primary} />
            <Text style={styles.locationTitle}>Pickup Location</Text>
          </View>
          
          <Text style={styles.address}>{package_.pickupAddress}</Text>
          
          <View style={styles.locationActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleOpenMaps(package_.pickupAddress)}
            >
              <Icon name="directions" size={20} color={colors.primary} />
              <Text style={styles.actionText}>Directions</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Location */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Icon name="flag" size={24} color={colors.success} />
            <Text style={styles.locationTitle}>Delivery Location</Text>
          </View>
          
          <Text style={styles.address}>{package_.dropoffAddress}</Text>
          
          <View style={styles.locationActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleOpenMaps(package_.dropoffAddress)}
            >
              <Icon name="directions" size={20} color={colors.primary} />
              <Text style={styles.actionText}>Directions</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Distance & Earnings */}
        {package_.distance && (
          <View style={styles.earningsCard}>
            <Text style={styles.cardTitle}>Trip Details</Text>
            
            <View style={styles.tripRow}>
              <View style={styles.tripItem}>
                <Icon name="straighten" size={20} color={colors.text.secondary} />
                <Text style={styles.tripLabel}>Distance</Text>
                <Text style={styles.tripValue}>{package_.distance.toFixed(1)} km</Text>
              </View>
              
              <View style={styles.tripItem}>
                <Icon name="attach-money" size={20} color={colors.success} />
                <Text style={styles.tripLabel}>Earnings</Text>
                <Text style={styles.tripValue}>P{(package_.senderPriceOffer * 0.9).toFixed(2)}</Text>
              </View>
            </View>
            
            <View style={styles.feeBreakdown}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Package Price</Text>
                <Text style={styles.feeValue}>P{package_.senderPriceOffer.toFixed(2)}</Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Platform Fee (10%)</Text>
                <Text style={styles.feeValue}>-P{(package_.senderPriceOffer * 0.1).toFixed(2)}</Text>
              </View>
              <View style={[styles.feeRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Your Earnings</Text>
                <Text style={styles.totalValue}>P{(package_.senderPriceOffer * 0.9).toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Created Date */}
        <View style={styles.metaCard}>
          <Text style={styles.metaText}>
            Created {new Date(package_.createdAt).toLocaleString()}
          </Text>
        </View>
      </ScrollView>

      {/* Accept Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={handleAcceptPackage}
        >
          <Icon name="check" size={24} color={colors.text.inverse} />
          <Text style={styles.acceptButtonText}>Accept Delivery</Text>
        </TouchableOpacity>
      </View>
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
  headerCard: {
    backgroundColor: colors.background.secondary,
    padding: 20,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  packageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginLeft: 12,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.success,
  },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  suggestionValue: {
    fontSize: 16,
    color: colors.text.secondary,
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
  earningsCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  tripRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  tripItem: {
    alignItems: 'center',
  },
  tripLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  tripValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 2,
  },
  feeBreakdown: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: 16,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feeLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  feeValue: {
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
  metaCard: {
    backgroundColor: colors.background.secondary,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.secondary,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  acceptButtonText: {
    color: colors.text.inverse,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default PackageDetailsScreen;