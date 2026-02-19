/**
 * @fileoverview Delivery tier selector component with dynamic pricing
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import packageService, { DeliveryTier, PricingSuggestion, DemandInfo } from '../../services/PackageService';
import logger from '../../services/LoggingService';

const log = logger.createLogger('DeliveryTierSelector');

interface DeliveryTierSelectorProps {
  pickupCoordinates?: [number, number];
  dropoffCoordinates?: [number, number];
  packageSize?: 'small' | 'medium' | 'large' | 'custom';
  fragile?: boolean;
  valuable?: boolean;
  requestedDeliveryTime?: Date;
  selectedTierId?: string;
  selectedPrice?: number;
  onTierSelect: (tierId: string, suggestion: PricingSuggestion) => void;
  onPriceChange?: (price: number) => void;
}

const DeliveryTierSelector: React.FC<DeliveryTierSelectorProps> = ({
  pickupCoordinates,
  dropoffCoordinates,
  packageSize = 'medium',
  fragile = false,
  valuable = false,
  requestedDeliveryTime,
  selectedTierId,
  selectedPrice,
  onTierSelect,
  onPriceChange,
}) => {
  const [deliveryTiers, setDeliveryTiers] = useState<DeliveryTier[]>([]);
  const [pricingSuggestions, setPricingSuggestions] = useState<PricingSuggestion[]>([]);
  const [demandInfo, setDemandInfo] = useState<DemandInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPricing, setLoadingPricing] = useState(false);

  // packageService is already imported as an instantiated singleton

  useEffect(() => {
    loadDeliveryTiers();
  }, []);

  useEffect(() => {
    if (pickupCoordinates && dropoffCoordinates) {
      loadPricingSuggestions();
    }
  }, [pickupCoordinates, dropoffCoordinates, packageSize, fragile, valuable, requestedDeliveryTime]);

  const loadDeliveryTiers = async () => {
    setLoading(true);
    try {
      const response = await packageService.getDeliveryTiers();
      if (response.success && (response.tiers || response.data)) {
        setDeliveryTiers(response.tiers || response.data || []);
      } else {
        Alert.alert('Error', response.error || 'Failed to load delivery tiers');
      }
    } catch (error) {
      log.error('Error loading delivery tiers:', error);
      Alert.alert('Error', 'Failed to load delivery tiers');
    } finally {
      setLoading(false);
    }
  };

  const loadPricingSuggestions = async () => {
    if (!pickupCoordinates || !dropoffCoordinates) return;

    setLoadingPricing(true);
    try {
      const response = await packageService.getPricingSuggestions({
        pickupCoordinates,
        dropoffCoordinates,
        packageSize,
        fragile,
        valuable,
        requestedDeliveryTime: requestedDeliveryTime?.toISOString(),
      });

      if (response.success && response.data) {
        setPricingSuggestions(response.data.pricingSuggestions);
        setDemandInfo(response.data.demandInfo);
      } else {
        log.error('Failed to load pricing suggestions:', response.error);
      }
    } catch (error) {
      log.error('Error loading pricing suggestions:', error);
    } finally {
      setLoadingPricing(false);
    }
  };

  const getDemandLevelColor = (level: string) => {
    switch (level) {
      case 'LOW': return colors.success;
      case 'NORMAL': return colors.primary;
      case 'HIGH': return colors.warning;
      case 'SURGE': return colors.error;
      default: return colors.text.primary;
    }
  };

  const getTierIcon = (tierType: string) => {
    switch (tierType) {
      case 'lightning': return 'flash-on';
      case 'express': return 'local-shipping';
      case 'standard': return 'schedule';
      case 'economy': return 'access-time';
      default: return 'local-shipping';
    }
  };

  const renderTierCard = (tier: DeliveryTier, suggestion?: PricingSuggestion) => {
    const isSelected = selectedTierId === tier.id;
    const price = suggestion?.finalPrice || 0;
    const demandLevel = suggestion?.demandLevel || 'NORMAL';

    return (
      <TouchableOpacity
        key={tier.id}
        style={[
          styles.tierCard,
          isSelected && styles.selectedTierCard,
          !suggestion && styles.disabledTierCard
        ]}
        onPress={() => {
          if (suggestion) {
            onTierSelect(tier.id, suggestion);
            if (onPriceChange) {
              onPriceChange(suggestion.finalPrice);
            }
          }
        }}
        disabled={!suggestion}
      >
        <View style={styles.tierHeader}>
          <Icon 
            name={getTierIcon(tier.tierType)} 
            size={24} 
            color={isSelected ? colors.white : colors.primary} 
          />
          <View style={styles.tierInfo}>
            <Text style={[
              styles.tierName,
              isSelected && styles.selectedTierText
            ]}>
              {tier.tierName}
            </Text>
            <Text style={[
              styles.tierDescription,
              isSelected && styles.selectedTierText
            ]}>
              {tier.description}
            </Text>
          </View>
          {suggestion && (
            <View style={styles.priceContainer}>
              <Text style={[
                styles.tierPrice,
                isSelected && styles.selectedTierText
              ]}>
                P{price.toFixed(2)}
              </Text>
              <View style={[
                styles.demandBadge,
                { backgroundColor: getDemandLevelColor(demandLevel) }
              ]}>
                <Text style={styles.demandText}>{demandLevel}</Text>
              </View>
            </View>
          )}
        </View>

        {suggestion && (
          <View style={styles.tierDetails}>
            <View style={styles.tierDetailRow}>
              <Text style={[
                styles.tierDetailLabel,
                isSelected && styles.selectedTierText
              ]}>
                Delivery Time:
              </Text>
              <Text style={[
                styles.tierDetailValue,
                isSelected && styles.selectedTierText
              ]}>
                {suggestion.estimatedDeliveryTime}
              </Text>
            </View>
            
            <View style={styles.tierDetailRow}>
              <Text style={[
                styles.tierDetailLabel,
                isSelected && styles.selectedTierText
              ]}>
                Your Earnings:
              </Text>
              <Text style={[
                styles.tierDetailValue,
                isSelected && styles.selectedTierText,
                styles.earningsText
              ]}>
                P{suggestion.courierEarnings.toFixed(2)}
              </Text>
            </View>

            <View style={styles.tierDetailRow}>
              <Text style={[
                styles.tierDetailLabel,
                isSelected && styles.selectedTierText
              ]}>
                SLA Guarantee:
              </Text>
              <Text style={[
                styles.tierDetailValue,
                isSelected && styles.selectedTierText
              ]}>
                {tier.slaGuarantee}%
              </Text>
            </View>

            {suggestion.demandMultiplier !== 1.0 && (
              <View style={styles.tierDetailRow}>
                <Text style={[
                  styles.tierDetailLabel,
                  isSelected && styles.selectedTierText
                ]}>
                  Demand Multiplier:
                </Text>
                <Text style={[
                  styles.tierDetailValue,
                  isSelected && styles.selectedTierText,
                  styles.multiplierText
                ]}>
                  {suggestion.demandMultiplier.toFixed(2)}x
                </Text>
              </View>
            )}
          </View>
        )}

        {!suggestion && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.text.primary} />
            <Text style={styles.loadingText}>Calculating...</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading delivery options...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Delivery Speed</Text>
        {demandInfo && (
          <View style={styles.demandInfo}>
            <Icon name="info-outline" size={16} color={colors.text.primary} />
            <Text style={styles.demandInfoText}>
              {demandInfo.availableCouriers} couriers, {demandInfo.activeDemand} requests
            </Text>
          </View>
        )}
      </View>

      {loadingPricing && (
        <View style={styles.pricingLoadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.pricingLoadingText}>Updating prices...</Text>
        </View>
      )}

      <View style={styles.tiersContainer}>
        {deliveryTiers.map(tier => {
          const suggestion = pricingSuggestions.find(s => s.tierType === tier.tierType);
          return renderTierCard(tier, suggestion);
        })}
      </View>

      {selectedPrice && selectedPrice > 0 && (
        <View style={styles.customPriceInfo}>
          <Text style={styles.customPriceLabel}>
            You can still offer your own price:
          </Text>
          <Text style={styles.customPriceValue}>
            Current offer: P{selectedPrice.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  demandInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  demandInfoText: {
    fontSize: 12,
    color: colors.text.primary,
  },
  pricingLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 8,
    gap: 8,
  },
  pricingLoadingText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  tiersContainer: {
    gap: 12,
  },
  tierCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.border.light,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedTierCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  disabledTierCard: {
    opacity: 0.6,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  tierDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  selectedTierText: {
    color: colors.white,
  },
  priceContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  tierPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  demandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  demandText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.white,
  },
  tierDetails: {
    marginTop: 12,
    gap: 6,
  },
  tierDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierDetailLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  tierDetailValue: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.primary,
  },
  earningsText: {
    color: colors.success,
    fontWeight: 'bold',
  },
  multiplierText: {
    color: colors.warning,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  customPriceInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
  },
  customPriceLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  customPriceValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 2,
  },
});

export default DeliveryTierSelector;