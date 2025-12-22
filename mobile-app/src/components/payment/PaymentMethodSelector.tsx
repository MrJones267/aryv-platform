/**
 * @fileoverview Payment Method Selector with cash payment option
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import { CashPaymentService } from '../../services/CashPaymentService';
import { Currency, CurrencyService } from '../../services/CurrencyService';
import CurrencySelector from '../currency/CurrencySelector';

export type PaymentMethodType = 'cash' | 'stripe' | 'paypal' | 'wallet';

export interface PaymentMethod {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  icon: string;
  isDefault?: boolean;
  isAvailable?: boolean;
  lastFour?: string;
  expiryDate?: string;
  fee?: number;
  estimatedTime?: string;
  balance?: number;
}

interface PaymentMethodOption {
  id: PaymentMethodType;
  title: string;
  subtitle: string;
  icon: string;
  available: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

interface PaymentMethodSelectorProps {
  amount: number;
  selectedMethod: PaymentMethodType | null;
  onMethodSelect: (method: PaymentMethodType) => void;
  onCashEligibilityCheck?: (canPay: boolean, trustScore?: number) => void;
  selectedCurrency?: Currency | null;
  onCurrencyChange?: (currency: Currency) => void;
  showCurrencySelector?: boolean;
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  amount,
  selectedMethod,
  onMethodSelect,
  onCashEligibilityCheck,
  selectedCurrency,
  onCurrencyChange,
  showCurrencySelector = true,
}) => {
  const [cashEligibility, setCashEligibility] = useState<{
    canPay: boolean;
    reason?: string;
    trustScore?: number;
  }>({ canPay: false });
  const [checkingCashEligibility, setCheckingCashEligibility] = useState(true);
  const [primaryCurrency, setPrimaryCurrency] = useState<Currency | null>(null);

  useEffect(() => {
    checkCashPaymentEligibility();
    loadUserCurrency();
  }, [amount]);

  useEffect(() => {
    if (selectedCurrency) {
      checkCashPaymentEligibility();
    }
  }, [selectedCurrency]);

  const loadUserCurrency = async () => {
    try {
      const preferences = await CurrencyService.getUserCurrencies();
      if (preferences && !selectedCurrency) {
        setPrimaryCurrency(preferences.primaryCurrency);
        onCurrencyChange?.(preferences.primaryCurrency);
      }
    } catch (error) {
      console.error('Error loading user currency:', error);
    }
  };

  const checkCashPaymentEligibility = async () => {
    setCheckingCashEligibility(true);
    try {
      const eligibility = await CashPaymentService.canMakeCashPayment(amount);
      setCashEligibility(eligibility);
      onCashEligibilityCheck?.(eligibility.canPay, eligibility.trustScore);
    } catch (error) {
      console.error('Error checking cash eligibility:', error);
      setCashEligibility({
        canPay: false,
        reason: 'Unable to verify eligibility',
      });
    } finally {
      setCheckingCashEligibility(false);
    }
  };

  const paymentMethods: PaymentMethodOption[] = [
    {
      id: 'cash',
      title: 'Cash Payment',
      subtitle: cashEligibility.canPay 
        ? `Pay directly to driver • Trust Score: ${cashEligibility.trustScore || 0}/100`
        : cashEligibility.reason || 'Not available',
      icon: 'attach-money',
      available: true,
      disabled: !cashEligibility.canPay,
      disabledReason: cashEligibility.reason,
    },
    {
      id: 'stripe',
      title: 'Credit/Debit Card',
      subtitle: 'Pay with your card via Stripe',
      icon: 'credit-card',
      available: true,
    },
    {
      id: 'paypal',
      title: 'PayPal',
      subtitle: 'Pay with your PayPal account',
      icon: 'account-balance',
      available: false, // Not implemented yet
      disabled: true,
      disabledReason: 'Coming soon',
    },
    {
      id: 'wallet',
      title: 'Digital Wallet',
      subtitle: 'Pay from your in-app wallet',
      icon: 'account-balance-wallet',
      available: false, // Not implemented yet
      disabled: true,
      disabledReason: 'Coming soon',
    },
  ];

  const handleMethodPress = (method: PaymentMethodOption) => {
    if (method.disabled) {
      Alert.alert(
        'Payment Method Not Available',
        method.disabledReason || 'This payment method is not available',
        [{ text: 'OK' }]
      );
      return;
    }

    if (method.id === 'cash' && !cashEligibility.canPay) {
      Alert.alert(
        'Cash Payment Not Available',
        cashEligibility.reason || 'You cannot use cash payment for this transaction',
        [
          {
            text: 'Check Requirements',
            onPress: () => showCashRequirements(),
          },
          { text: 'OK' },
        ]
      );
      return;
    }

    onMethodSelect(method.id);
  };

  const showCashRequirements = () => {
    const requiredTrust = calculateRequiredTrust(amount);
    Alert.alert(
      'Cash Payment Requirements',
      `To use cash payment, you need:
      
• Trust Score: ${requiredTrust}/100 (Current: ${cashEligibility.trustScore || 0}/100)
• Verified phone number
• Within daily/weekly limits
• Account in good standing

Build your trust score by:
• Completing rides successfully
• Avoiding disputes
• Verifying your identity`,
      [
        {
          text: 'View Wallet',
          onPress: () => {
            // Navigate to wallet screen
            // navigation.navigate('Wallet');
          },
        },
        { text: 'OK' },
      ]
    );
  };

  const calculateRequiredTrust = (amount: number): number => {
    if (amount <= 10) return 20;
    if (amount <= 50) return 40;
    if (amount <= 100) return 60;
    if (amount <= 500) return 80;
    return 90;
  };

  const currentCurrency = selectedCurrency || primaryCurrency;
  const displayAmount = currentCurrency 
    ? CurrencyService.formatAmount(amount, currentCurrency)
    : `$${amount.toFixed(2)}`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Payment Method</Text>
      <Text style={styles.subtitle}>Amount: {displayAmount}</Text>

      {showCurrencySelector && (
        <View style={styles.currencySelectorContainer}>
          <CurrencySelector
            selectedCurrency={currentCurrency}
            onCurrencySelect={(currency) => {
              onCurrencyChange?.(currency);
              setPrimaryCurrency(currency);
            }}
            showPopularOnly={true}
            label="Currency"
          />
        </View>
      )}

      {checkingCashEligibility && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Checking cash payment eligibility...</Text>
        </View>
      )}

      <View style={styles.methodsList}>
        {paymentMethods.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={[
              styles.methodOption,
              selectedMethod === method.id && styles.selectedMethod,
              method.disabled && styles.disabledMethod,
            ]}
            onPress={() => handleMethodPress(method)}
            disabled={method.disabled && method.id !== 'cash'} // Allow cash to show reasons
          >
            <View style={styles.methodIcon}>
              <Icon
                name={method.icon}
                size={24}
                color={
                  method.disabled
                    ? colors.text.secondary
                    : selectedMethod === method.id
                      ? colors.primary
                      : colors.text.primary
                }
              />
            </View>

            <View style={styles.methodInfo}>
              <Text
                style={[
                  styles.methodTitle,
                  method.disabled && styles.disabledText,
                  selectedMethod === method.id && styles.selectedText,
                ]}
              >
                {method.title}
              </Text>
              <Text
                style={[
                  styles.methodSubtitle,
                  method.disabled && styles.disabledText,
                ]}
              >
                {method.subtitle}
              </Text>
            </View>

            <View style={styles.methodIndicator}>
              {selectedMethod === method.id && (
                <Icon name="check-circle" size={20} color={colors.primary} />
              )}
              {method.disabled && method.id !== 'cash' && (
                <Icon name="lock" size={16} color={colors.text.secondary} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {selectedMethod === 'cash' && cashEligibility.canPay && (
        <View style={styles.cashNotice}>
          <Icon name="info" size={16} color={colors.primary} />
          <Text style={styles.cashNoticeText}>
            You'll pay the driver directly in cash ({displayAmount}). Both you and the driver will confirm the payment.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  currencySelectorContainer: {
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 8,
  },
  methodsList: {
    gap: 12,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  selectedMethod: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  disabledMethod: {
    opacity: 0.6,
  },
  methodIcon: {
    width: 40,
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
    marginLeft: 12,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  methodSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  selectedText: {
    color: colors.primary,
  },
  disabledText: {
    color: colors.text.secondary,
  },
  methodIndicator: {
    width: 24,
    alignItems: 'center',
  },
  cashNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  cashNoticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.primary,
    marginLeft: 8,
    lineHeight: 16,
  },
});

export default PaymentMethodSelector;