/**
 * @fileoverview Currency Settings Screen for managing user currency preferences
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

import { colors } from '../../theme';
import { Button } from '../../components/ui';
import { Currency, CurrencyService, CurrencyPreferences } from '../../services/CurrencyService';
import CurrencySelector from '../../components/currency/CurrencySelector';
import CurrencyConverter from '../../components/currency/CurrencyConverter';

const CurrencySettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<CurrencyPreferences | null>(null);
  const [primaryCurrency, setPrimaryCurrency] = useState<Currency | null>(null);
  const [showConverter, setShowConverter] = useState(false);
  const [selectedPaymentCurrencies, setSelectedPaymentCurrencies] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCurrencyPreferences();
  }, []);

  const loadCurrencyPreferences = async () => {
    try {
      setLoading(true);
      const userPreferences = await CurrencyService.getUserCurrencies();
      
      if (userPreferences) {
        setPreferences(userPreferences);
        setPrimaryCurrency(userPreferences.primaryCurrency);
        
        const paymentCurrencyCodes = new Set(
          userPreferences.paymentCurrencies.map(c => c.code)
        );
        setSelectedPaymentCurrencies(paymentCurrencyCodes);
      }
    } catch (error) {
      console.error('Error loading currency preferences:', error);
      Alert.alert('Error', 'Failed to load currency settings');
    } finally {
      setLoading(false);
    }
  };

  const handlePrimaryCurrencyChange = async (currency: Currency) => {
    if (currency.code === primaryCurrency?.code) return;

    try {
      setSaving(true);
      const success = await CurrencyService.setPrimaryCurrency(currency.code);
      
      if (success) {
        setPrimaryCurrency(currency);
        
        // Add to payment currencies if not already there
        if (!selectedPaymentCurrencies.has(currency.code)) {
          await CurrencyService.addPaymentCurrency(currency.code);
          setSelectedPaymentCurrencies(prev => new Set([...prev, currency.code]));
        }
        
        Alert.alert('Success', `Primary currency changed to ${currency.name}`);
        
        // Reload preferences to get updated data
        await loadCurrencyPreferences();
      } else {
        Alert.alert('Error', 'Failed to update primary currency');
      }
    } catch (error) {
      console.error('Error updating primary currency:', error);
      Alert.alert('Error', 'Failed to update primary currency');
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentCurrencyToggle = async (currency: Currency, isEnabled: boolean) => {
    try {
      setSaving(true);
      
      if (isEnabled) {
        const success = await CurrencyService.addPaymentCurrency(currency.code);
        if (success) {
          setSelectedPaymentCurrencies(prev => new Set([...prev, currency.code]));
        } else {
          Alert.alert('Error', `Failed to add ${currency.name} to payment options`);
        }
      } else {
        // Don't allow removing primary currency from payment options
        if (currency.code === primaryCurrency?.code) {
          Alert.alert(
            'Cannot Remove', 
            'Primary currency cannot be removed from payment options. Set another currency as primary first.'
          );
          return;
        }
        
        const success = await CurrencyService.removePaymentCurrency(currency.code);
        if (success) {
          setSelectedPaymentCurrencies(prev => {
            const newSet = new Set(prev);
            newSet.delete(currency.code);
            return newSet;
          });
        } else {
          Alert.alert('Error', `Failed to remove ${currency.name} from payment options`);
        }
      }
    } catch (error) {
      console.error('Error toggling payment currency:', error);
      Alert.alert('Error', 'Failed to update payment currency');
    } finally {
      setSaving(false);
    }
  };

  const renderPaymentCurrencyItem = (currency: Currency) => {
    const isEnabled = selectedPaymentCurrencies.has(currency.code);
    const isPrimary = currency.code === primaryCurrency?.code;
    
    return (
      <View key={currency.code} style={styles.paymentCurrencyItem}>
        <View style={styles.currencyInfo}>
          <Text style={styles.currencyFlag}>
            {CurrencyService.getCurrencyFlag(currency.countryCode)}
          </Text>
          <View style={styles.currencyDetails}>
            <Text style={styles.currencyCode}>
              {currency.code}
              {isPrimary && <Text style={styles.primaryLabel}> (Primary)</Text>}
            </Text>
            <Text style={styles.currencyName}>{currency.name}</Text>
          </View>
          <Text style={styles.currencySymbol}>{currency.symbol}</Text>
        </View>
        
        <Switch
          value={isEnabled}
          onValueChange={(value) => handlePaymentCurrencyToggle(currency, value)}
          disabled={saving || isPrimary}
          thumbColor={isEnabled ? colors.primary : colors.textSecondary}
          trackColor={{ false: colors.border.light, true: colors.primaryLight }}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading currency settings...</Text>
      </View>
    );
  }

  if (!preferences) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error-outline" size={48} color={colors.error} />
        <Text style={styles.errorText}>Failed to load currency settings</Text>
        <Button
          title="Retry"
          onPress={loadCurrencyPreferences}
          style={styles.retryButton}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Currency Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        {/* Primary Currency Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary Currency</Text>
          <Text style={styles.sectionDescription}>
            Your primary currency is used for displaying prices and your main payment option.
          </Text>
          
          <CurrencySelector
            selectedCurrency={primaryCurrency}
            onCurrencySelect={handlePrimaryCurrencyChange}
            showPopularOnly={true}
            disabled={saving}
            label=""
            placeholder="Select primary currency"
          />
        </View>

        {/* Payment Currencies Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Currencies</Text>
          <Text style={styles.sectionDescription}>
            Enable currencies you want to use for payments. Your primary currency is always enabled.
          </Text>
          
          <View style={styles.paymentCurrenciesList}>
            {preferences.availableCurrencies.map(renderPaymentCurrencyItem)}
          </View>
        </View>

        {/* Currency Converter Section */}
        <View style={styles.section}>
          <View style={styles.converterHeader}>
            <Text style={styles.sectionTitle}>Currency Converter</Text>
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setShowConverter(!showConverter)}
            >
              <Icon 
                name={showConverter ? 'expand-less' : 'expand-more'} 
                size={24} 
                color={colors.primary} 
              />
            </TouchableOpacity>
          </View>
          
          {showConverter && (
            <CurrencyConverter
              initialFromCurrency={primaryCurrency || undefined}
              showRealTimeConversion={true}
            />
          )}
        </View>

        {/* Exchange Rates Info */}
        <View style={styles.infoSection}>
          <Icon name="info" size={20} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Exchange Rates</Text>
            <Text style={styles.infoText}>
              Exchange rates are updated regularly from reliable financial data sources. 
              Actual rates may vary slightly at the time of transaction.
            </Text>
          </View>
        </View>

        {/* Supported Regions */}
        <View style={styles.infoSection}>
          <Icon name="public" size={20} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Global Support</Text>
            <Text style={styles.infoText}>
              We support major currencies from around the world. Popular currencies for your region 
              are prioritized in the selection lists.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    minWidth: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerRight: {
    width: 32, // Same width as back button for centering
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  paymentCurrenciesList: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
  },
  paymentCurrencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  currencyInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  currencyDetails: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  primaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
  currencyName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 12,
  },
  converterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleButton: {
    padding: 4,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: colors.text.primary,
    lineHeight: 16,
  },
});

export default CurrencySettingsScreen;