/**
 * @fileoverview Currency Converter Component
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import { Currency, CurrencyService, CurrencyConversion } from '../../services/CurrencyService';
import CurrencySelector from './CurrencySelector';

interface CurrencyConverterProps {
  initialFromCurrency?: Currency;
  initialToCurrency?: Currency;
  initialAmount?: number;
  onConversionResult?: (conversion: CurrencyConversion) => void;
  showRealTimeConversion?: boolean;
}

const CurrencyConverter: React.FC<CurrencyConverterProps> = ({
  initialFromCurrency,
  initialToCurrency,
  initialAmount = 0,
  onConversionResult,
  showRealTimeConversion = false,
}) => {
  const [fromCurrency, setFromCurrency] = useState<Currency | null>(initialFromCurrency || null);
  const [toCurrency, setToCurrency] = useState<Currency | null>(initialToCurrency || null);
  const [amount, setAmount] = useState<string>(initialAmount ? initialAmount.toString() : '');
  const [convertedAmount, setConvertedAmount] = useState<string>('0.00');
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    if (showRealTimeConversion && amount && fromCurrency && toCurrency) {
      performConversion();
    }
  }, [amount, fromCurrency, toCurrency, showRealTimeConversion]);

  useEffect(() => {
    loadDefaultCurrencies();
  }, []);

  const loadDefaultCurrencies = async () => {
    if (!fromCurrency || !toCurrency) {
      try {
        const userPreferences = await CurrencyService.getUserCurrencies();
        if (userPreferences && !fromCurrency) {
          setFromCurrency(userPreferences.primaryCurrency);
        }
        
        if (!toCurrency && userPreferences) {
          // Set to different currency than primary for conversion
          const otherCurrency = userPreferences.paymentCurrencies.find(
            c => c.code !== userPreferences.primaryCurrency.code
          );
          if (otherCurrency) {
            setToCurrency(otherCurrency);
          } else {
            // Default to USD if no other currencies
            const usdCurrency = await CurrencyService.getCurrencyByCode('USD');
            if (usdCurrency && usdCurrency.code !== fromCurrency?.code) {
              setToCurrency(usdCurrency);
            }
          }
        }
      } catch (error) {
        console.error('Error loading default currencies:', error);
      }
    }
  };

  const performConversion = async () => {
    if (!fromCurrency || !toCurrency || !amount) {
      setConvertedAmount('0.00');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setConvertedAmount('0.00');
      return;
    }

    // Validate conversion amount
    const validation = CurrencyService.validateConversionAmount(numericAmount);
    if (!validation.isValid) {
      Alert.alert('Conversion Error', validation.message);
      return;
    }

    setLoading(true);
    
    try {
      if (fromCurrency.code === toCurrency.code) {
        // Same currency - no conversion needed
        setConvertedAmount(amount);
        setExchangeRate(1);
        setLastUpdated(new Date().toISOString());
      } else if (showRealTimeConversion) {
        // Use cached rates for real-time conversion (faster)
        const converted = CurrencyService.calculateConversion(
          numericAmount,
          fromCurrency,
          toCurrency
        );
        setConvertedAmount(converted.toFixed(toCurrency.decimalPlaces));
        setExchangeRate(toCurrency.exchangeRate / fromCurrency.exchangeRate);
        setLastUpdated(new Date().toISOString());
      } else {
        // Use API for accurate conversion
        const conversion = await CurrencyService.convertCurrency({
          fromCurrency: fromCurrency.code,
          toCurrency: toCurrency.code,
          amount: numericAmount,
        });

        if (conversion) {
          setConvertedAmount(conversion.convertedAmount.toFixed(toCurrency.decimalPlaces));
          setExchangeRate(conversion.exchangeRate);
          setLastUpdated(conversion.timestamp);
          
          onConversionResult?.(conversion);
        } else {
          Alert.alert('Conversion Error', 'Failed to convert currency. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error performing conversion:', error);
      Alert.alert('Error', 'Failed to convert currency. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwapCurrencies = () => {
    const tempCurrency = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(tempCurrency);
    
    // Swap amounts too
    if (convertedAmount && convertedAmount !== '0.00') {
      setAmount(convertedAmount);
    }
  };

  const handleAmountChange = (text: string) => {
    // Only allow numbers and decimal point
    const cleanText = text.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = cleanText.split('.');
    if (parts.length > 2) {
      return;
    }
    
    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) {
      return;
    }
    
    setAmount(cleanText);
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    
    try {
      const date = new Date(lastUpdated);
      return `Updated ${date.toLocaleTimeString()}`;
    } catch (error) {
      return 'Recently updated';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Currency Converter</Text>

      <View style={styles.conversionContainer}>
        {/* From Currency Section */}
        <View style={styles.currencySection}>
          <Text style={styles.sectionLabel}>From</Text>
          <CurrencySelector
            selectedCurrency={fromCurrency}
            onCurrencySelect={setFromCurrency}
            showPopularOnly={true}
            placeholder="Select source currency"
          />
          <View style={styles.amountInputContainer}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            <Text style={styles.currencySymbol}>
              {fromCurrency?.symbol || '$'}
            </Text>
          </View>
        </View>

        {/* Swap Button */}
        <View style={styles.swapButtonContainer}>
          <TouchableOpacity
            style={styles.swapButton}
            onPress={handleSwapCurrencies}
            disabled={!fromCurrency || !toCurrency}
          >
            <Icon name="swap-vert" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* To Currency Section */}
        <View style={styles.currencySection}>
          <Text style={styles.sectionLabel}>To</Text>
          <CurrencySelector
            selectedCurrency={toCurrency}
            onCurrencySelect={setToCurrency}
            showPopularOnly={true}
            placeholder="Select target currency"
          />
          <View style={[styles.amountInputContainer, styles.convertedAmountContainer]}>
            <Text style={styles.convertedAmount}>{convertedAmount}</Text>
            <Text style={styles.currencySymbol}>
              {toCurrency?.symbol || '$'}
            </Text>
            {loading && (
              <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
            )}
          </View>
        </View>
      </View>

      {/* Exchange Rate Info */}
      {exchangeRate !== 1 && fromCurrency && toCurrency && (
        <View style={styles.rateInfoContainer}>
          <View style={styles.rateInfo}>
            <Icon name="trending-up" size={16} color={colors.text.secondary} />
            <Text style={styles.rateText}>
              1 {fromCurrency.code} = {exchangeRate.toFixed(4)} {toCurrency.code}
            </Text>
          </View>
          {lastUpdated && (
            <Text style={styles.lastUpdated}>{formatLastUpdated()}</Text>
          )}
        </View>
      )}

      {/* Convert Button (for non-real-time mode) */}
      {!showRealTimeConversion && (
        <TouchableOpacity
          style={[
            styles.convertButton,
            (!fromCurrency || !toCurrency || !amount || loading) && styles.disabledButton
          ]}
          onPress={performConversion}
          disabled={!fromCurrency || !toCurrency || !amount || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <>
              <Icon name="currency-exchange" size={20} color={colors.surface} />
              <Text style={styles.convertButtonText}>Convert</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Conversion Limits Notice */}
      <View style={styles.noticeContainer}>
        <Icon name="info" size={16} color={colors.text.secondary} />
        <Text style={styles.noticeText}>
          Conversion limits: $0.01 - $10,000 USD equivalent
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    margin: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  conversionContainer: {
    marginBottom: 16,
  },
  currencySection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  convertedAmountContainer: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'right',
  },
  convertedAmount: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'right',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: 8,
  },
  loader: {
    marginLeft: 8,
  },
  swapButtonContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  swapButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  rateInfoContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  rateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  rateText: {
    fontSize: 14,
    color: colors.text.primary,
    marginLeft: 6,
  },
  lastUpdated: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  convertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  convertButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  noticeText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: 6,
  },
});

export default CurrencyConverter;