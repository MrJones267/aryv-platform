/**
 * @fileoverview PIN verification components for pickup identity confirmation
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import PinVerificationService from '../../services/PinVerificationService';
import { haptic } from '../../services/HapticService';

// ─── Passenger PIN Display ───────────────────────────────────────────

interface PinDisplayProps {
  rideId: string;
  visible: boolean;
}

export const PinDisplay: React.FC<PinDisplayProps> = ({ rideId, visible }) => {
  const [pin, setPin] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pinService = PinVerificationService.getInstance();

  useEffect(() => {
    if (visible && rideId) {
      loadOrCreatePin();
    }
  }, [visible, rideId]);

  useEffect(() => {
    if (visible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible, pulseAnim]);

  const loadOrCreatePin = async () => {
    let existingPin = await pinService.getPinForRide(rideId);
    if (!existingPin) {
      existingPin = await pinService.createPinForRide(rideId);
    }
    setPin(existingPin);
  };

  if (!visible || !pin) return null;

  return (
    <Animated.View style={[styles.pinDisplayCard, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.pinDisplayHeader}>
        <Icon name="lock" size={18} color={colors.primary} />
        <Text style={styles.pinDisplayTitle}>Your Pickup PIN</Text>
      </View>
      <Text style={styles.pinDisplaySubtitle}>
        Share this PIN with your driver at pickup
      </Text>
      <View style={styles.pinDigitsRow}>
        {pin.split('').map((digit, index) => (
          <View key={index} style={styles.pinDigitBox}>
            <Text style={styles.pinDigitText}>{digit}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.pinDisplayHint}>
        Driver must enter this to start the ride
      </Text>
    </Animated.View>
  );
};

// ─── Driver PIN Entry Modal ──────────────────────────────────────────

interface PinEntryProps {
  visible: boolean;
  rideId: string;
  onVerified: () => void;
  onCancel: () => void;
}

export const PinEntry: React.FC<PinEntryProps> = ({
  visible,
  rideId,
  onVerified,
  onCancel,
}) => {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pinService = PinVerificationService.getInstance();

  useEffect(() => {
    if (visible) {
      setDigits(['', '', '', '']);
      setError(false);
      setVerifying(false);
      // Focus first input when modal opens
      setTimeout(() => inputRefs.current[0]?.focus(), 300);
    }
  }, [visible]);

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste: distribute digits across boxes
      const pastedDigits = value.replace(/\D/g, '').slice(0, 4).split('');
      const newDigits = [...digits];
      pastedDigits.forEach((d, i) => {
        if (index + i < 4) newDigits[index + i] = d;
      });
      setDigits(newDigits);
      setError(false);

      const nextFocusIndex = Math.min(index + pastedDigits.length, 3);
      inputRefs.current[nextFocusIndex]?.focus();

      if (newDigits.every(d => d !== '')) {
        verifyPin(newDigits.join(''));
      }
      return;
    }

    const cleanValue = value.replace(/\D/g, '');
    const newDigits = [...digits];
    newDigits[index] = cleanValue;
    setDigits(newDigits);
    setError(false);

    // Auto-focus next input
    if (cleanValue && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 4 digits entered
    if (cleanValue && index === 3 && newDigits.every(d => d !== '')) {
      verifyPin(newDigits.join(''));
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
    }
  };

  const verifyPin = async (pin: string) => {
    setVerifying(true);
    try {
      const isCorrect = await pinService.verifyPin(rideId, pin);
      if (isCorrect) {
        onVerified();
      } else {
        setError(true);
        haptic.errorFeedback();
        triggerShake();
        setDigits(['', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 400);
      }
    } catch {
      setError(true);
      triggerShake();
    } finally {
      setVerifying(false);
    }
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.entryOverlay}>
        <View style={styles.entryCard}>
          <TouchableOpacity style={styles.entryCloseBtn} onPress={onCancel}>
            <Icon name="close" size={22} color={colors.text.secondary} />
          </TouchableOpacity>

          <View style={styles.entryIconContainer}>
            <Icon name="lock" size={32} color={colors.primary} />
          </View>

          <Text style={styles.entryTitle}>Enter Pickup PIN</Text>
          <Text style={styles.entrySubtitle}>
            Ask the passenger for their 4-digit PIN
          </Text>

          <Animated.View
            style={[styles.entryDigitsRow, { transform: [{ translateX: shakeAnim }] }]}
          >
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={ref => { inputRefs.current[index] = ref; }}
                style={[
                  styles.entryDigitInput,
                  digit ? styles.entryDigitFilled : null,
                  error ? styles.entryDigitError : null,
                ]}
                value={digit}
                onChangeText={(value) => handleDigitChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={4}
                selectTextOnFocus
              />
            ))}
          </Animated.View>

          {error && (
            <Text style={styles.entryErrorText}>
              Incorrect PIN. Please try again.
            </Text>
          )}

          {verifying && (
            <Text style={styles.entryVerifyingText}>Verifying...</Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // PIN Display styles (passenger side)
  pinDisplayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  pinDisplayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pinDisplayTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  pinDisplaySubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 14,
  },
  pinDigitsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  pinDigitBox: {
    width: 48,
    height: 56,
    borderRadius: 10,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary + '40',
  },
  pinDigitText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 2,
  },
  pinDisplayHint: {
    fontSize: 11,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },

  // PIN Entry styles (driver side)
  entryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
  },
  entryCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 4,
  },
  entryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  entryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 6,
  },
  entrySubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  entryDigitsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  entryDigitInput: {
    width: 52,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  entryDigitFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  entryDigitError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  entryErrorText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  entryVerifyingText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
});
