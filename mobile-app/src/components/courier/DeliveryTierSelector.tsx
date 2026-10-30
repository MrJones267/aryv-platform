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
import CurrencyService, { Currency } from '../../services/CurrencyService';
import logger from '../../services/LoggingService';
import { useI18n } from '../../i18n/I18nContext';

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
  /** Currency to show until the API says which one the prices are in. */
  currency?: Currency | null;
  /** Called when the pricing response names the currency it priced in. */
  onCurrencyResolved?: (currency: Currency) => void;
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
  currency: initialCurrency,
  onCurrencyResolved,
}) => {
  const { t } = useI18n();
  // Every price here was printed with a hardcoded "P", so a rand or kwacha
  // price read as pula. The pricing response names its currency; until it
  // arrives, the screen's currency (the sender's own) is shown.
  const [pricedCurrency, setPricedCurrency] = useState<Currency | null>(null);
  const currency = pricedCurrency ?? initialCurrency ?? null;
  const money = (amount: number) =>
    currency ? CurrencyService.formatAmount(amount, currency) : amount.toFixed(2);

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
        Alert.alert(t('common.error'), response.error || t('cf2.failedToLoadDeliveryTiers'));
      }
    } catch (error) {
      log.error('Error loading delivery tiers:', error);
      Alert.alert(t('common.error'), t('cf2.failedToLoadDeliveryTiers'));
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
        if (response.data.currency) {
          const resolved = await CurrencyService.getCurrencyByCode(response.data.currency);
          if (resolved) {
            setPricedCurrency(resolved);
            onCurrencyResolved?.(resolved);
          }
        }
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
                {money(price)}
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
                {t('cf.deliveryTime')}
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
                {t('cf.yourEarnings2')}
              </Text>
              <Text style={[
                styles.tierDetailValue,
                isSelected && styles.selectedTierText,
                styles.earningsText
              ]}>
                {money(suggestion.courierEarnings)}
              </Text>
            </View>

            <View style={styles.tierDetailRow}>
              <Text style={[
                styles.tierDetailLabel,
                isSelected && styles.selectedTierText
              ]}>
                {t('cf.slaGuarantee')}
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
                  {t('cf.demandMultiplier')}
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
            <Text style={styles.loadingText}>{t('cf.calculating')}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('cf.loadingDeliveryOptions')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('cf.chooseDeliverySpeed')}</Text>
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
          <Text style={styles.pricingLoadingText}>{t('cf.updatingPrices')}</Text>
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
            {t('cf.youCanStillOfferYour')}
          </Text>
          <Text style={styles.customPriceValue}>
            Current offer: {money(selectedPrice)}
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