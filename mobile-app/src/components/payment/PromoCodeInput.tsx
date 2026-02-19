/**
 * @fileoverview Promo code input component for applying discounts at booking
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import PromoCodeService, { PromoCode } from '../../services/PromoCodeService';

interface PromoCodeInputProps {
  rideAmount: number;
  onPromoApplied: (discount: number, code: string) => void;
  onPromoRemoved: () => void;
}

const PromoCodeInput: React.FC<PromoCodeInputProps> = ({
  rideAmount,
  onPromoApplied,
  onPromoRemoved,
}) => {
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [error, setError] = useState('');
  const promoService = PromoCodeService.getInstance();

  const handleApply = async () => {
    if (!code.trim()) return;
    setError('');
    setIsValidating(true);

    try {
      const promo = await promoService.validateCode(code);

      if (!promo) {
        setError('Invalid promo code');
        return;
      }

      if (!promo.isActive) {
        setError('This code has expired');
        return;
      }

      const discount = promoService.calculateDiscount(promo, rideAmount);

      if (discount === 0) {
        setError(
          promo.minRideAmount
            ? `Minimum ride amount: ${promo.currency || 'BWP'} ${promo.minRideAmount}`
            : 'Code not applicable to this ride',
        );
        return;
      }

      setAppliedPromo(promo);
      onPromoApplied(discount, promo.code);
    } catch {
      setError('Could not validate code');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemove = () => {
    setAppliedPromo(null);
    setCode('');
    setError('');
    onPromoRemoved();
  };

  if (appliedPromo) {
    const discount = promoService.calculateDiscount(appliedPromo, rideAmount);
    return (
      <View style={styles.appliedContainer}>
        <View style={styles.appliedBadge}>
          <Icon name="local-offer" size={16} color="#10B981" />
          <View style={styles.appliedInfo}>
            <Text style={styles.appliedCode}>{appliedPromo.code}</Text>
            <Text style={styles.appliedDesc}>{appliedPromo.description}</Text>
          </View>
          <Text style={styles.appliedDiscount}>-BWP {discount.toFixed(0)}</Text>
        </View>
        <TouchableOpacity onPress={handleRemove} style={styles.removeBtn}>
          <Icon name="close" size={16} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <Icon name="local-offer" size={18} color={colors.text.secondary} style={styles.icon} />
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(text) => {
            setCode(text.toUpperCase());
            setError('');
          }}
          placeholder="Enter promo code"
          placeholderTextColor={colors.text.light}
          autoCapitalize="characters"
          returnKeyType="done"
          onSubmitEditing={handleApply}
        />
        <TouchableOpacity
          style={[styles.applyBtn, !code.trim() && styles.applyBtnDisabled]}
          onPress={handleApply}
          disabled={!code.trim() || isValidating}
        >
          {isValidating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.applyText}>Apply</Text>
          )}
        </TouchableOpacity>
      </View>
      {error !== '' && (
        <View style={styles.errorRow}>
          <Icon name="error-outline" size={14} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingLeft: 12,
    overflow: 'hidden',
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    paddingVertical: 12,
    letterSpacing: 1,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  applyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingLeft: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
  },
  appliedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#10B981' + '30',
    marginVertical: 8,
  },
  appliedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appliedInfo: {
    flex: 1,
  },
  appliedCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  appliedDesc: {
    fontSize: 11,
    color: '#047857',
    marginTop: 1,
  },
  appliedDiscount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  removeBtn: {
    padding: 4,
    marginLeft: 8,
  },
});

export default PromoCodeInput;
