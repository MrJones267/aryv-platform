/**
 * @fileoverview Tip selector component for post-ride tipping
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import TippingService from '../../services/TippingService';
import { haptic } from '../../services/HapticService';

interface TipSelectorProps {
  rideId: string;
  driverId: string;
  rideFare: number;
  currency?: string;
  onTipSubmitted: (amount: number) => void;
  onSkip: () => void;
}

const TipSelector: React.FC<TipSelectorProps> = ({
  rideId,
  driverId,
  rideFare,
  currency = 'BWP',
  onTipSubmitted,
  onSkip,
}) => {
  const tippingService = TippingService.getInstance();
  const suggestions = tippingService.getSuggestedAmounts(rideFare);

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handlePresetSelect = (amount: number) => {
    haptic.selection();
    setIsCustom(false);
    setCustomAmount('');
    setSelectedAmount(amount);
  };

  const handleCustomToggle = () => {
    haptic.selection();
    setIsCustom(true);
    setSelectedAmount(null);
  };

  const handleSubmit = async () => {
    const amount = isCustom ? parseFloat(customAmount) : selectedAmount;
    if (!amount || amount <= 0) return;

    haptic.confirm();
    setIsSubmitting(true);

    await tippingService.submitTip(rideId, driverId, amount, currency);

    setSubmitted(true);
    setIsSubmitting(false);
    onTipSubmitted(amount);
  };

  const effectiveAmount = isCustom ? parseFloat(customAmount) || 0 : selectedAmount || 0;

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.thankYouCard}>
          <View style={styles.checkCircle}>
            <Icon name="favorite" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.thankYouTitle}>Thank you!</Text>
          <Text style={styles.thankYouDesc}>
            Your {currency} {effectiveAmount} tip has been sent to the driver
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="volunteer-activism" size={22} color={colors.primary} />
        <Text style={styles.headerTitle}>Add a tip?</Text>
      </View>
      <Text style={styles.headerDesc}>
        100% of tips go directly to your driver
      </Text>

      {/* Preset amounts */}
      <View style={styles.presetsRow}>
        {suggestions.map((amount) => {
          const isActive = !isCustom && selectedAmount === amount;
          return (
            <TouchableOpacity
              key={amount}
              style={[styles.presetBtn, isActive && styles.presetBtnActive]}
              onPress={() => handlePresetSelect(amount)}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetAmount, isActive && styles.presetAmountActive]}>
                {currency} {amount}
              </Text>
              <Text style={[styles.presetPct, isActive && styles.presetPctActive]}>
                {rideFare > 0 ? `${Math.round((amount / rideFare) * 100)}%` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
        {/* Custom */}
        <TouchableOpacity
          style={[styles.presetBtn, isCustom && styles.presetBtnActive]}
          onPress={handleCustomToggle}
          activeOpacity={0.7}
        >
          <Text style={[styles.presetAmount, isCustom && styles.presetAmountActive]}>
            Custom
          </Text>
          <Icon
            name="edit"
            size={14}
            color={isCustom ? '#FFFFFF' : colors.text.secondary}
          />
        </TouchableOpacity>
      </View>

      {/* Custom input */}
      {isCustom && (
        <View style={styles.customRow}>
          <Text style={styles.currencyLabel}>{currency}</Text>
          <TextInput
            style={styles.customInput}
            value={customAmount}
            onChangeText={(text) => setCustomAmount(text.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            placeholderTextColor={colors.text.light}
            keyboardType="decimal-pad"
            autoFocus
          />
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.submitBtn, effectiveAmount <= 0 && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={effectiveAmount <= 0 || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>
              {effectiveAmount > 0
                ? `Tip ${currency} ${effectiveAmount}`
                : 'Select tip amount'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={onSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipBtnText}>No thanks</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    backgroundColor: '#FFFFFF',
  },
  presetBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  presetAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  presetAmountActive: {
    color: '#FFFFFF',
  },
  presetPct: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  presetPctActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  currencyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginRight: 8,
  },
  customInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    paddingVertical: 12,
  },
  actions: {
    gap: 8,
  },
  submitBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipBtnText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  thankYouCard: {
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#10B981' + '30',
  },
  checkCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  thankYouTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 4,
  },
  thankYouDesc: {
    fontSize: 13,
    color: '#047857',
    textAlign: 'center',
  },
});

export default TipSelector;
