/**
 * @fileoverview Driver Cash Receipt Screen for confirming cash received
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
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Geolocation from '@react-native-community/geolocation';

import { colors } from '../../theme';
import { Button } from '../../components/ui';
import { useAppSelector } from '../../store/hooks';
import { CashPaymentService } from '../../services/CashPaymentService';
import logger from '../../services/LoggingService';

const log = logger.createLogger('DriverCashReceiptScreen');

interface DriverCashReceiptScreenProps {
  route: {
    params: {
      transactionId: string;
      expectedAmount: number;
      riderName: string;
      bookingId: string;
    };
  };
}

const DriverCashReceiptScreen: React.FC<DriverCashReceiptScreenProps> = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { transactionId, expectedAmount, riderName, bookingId } = route.params as DriverCashReceiptScreenProps['route']['params'];
  
  const [receivedAmount, setReceivedAmount] = useState(expectedAmount.toString());
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const currentUser = useAppSelector((state) => (state.auth as { user?: Record<string, unknown> }).user);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    setLocationLoading(true);
    Geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationLoading(false);
      },
      (error) => {
        log.info('Location error:', error);
        setLocationLoading(false);
        // Continue without location
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleConfirmReceipt = async () => {
    const amount = parseFloat(receivedAmount);
    
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const amountDifference = Math.abs(amount - expectedAmount);
    
    if (amountDifference > 0.50) {
      Alert.alert(
        'Amount Discrepancy',
        `Expected: P${expectedAmount.toFixed(2)}\\nReceived: P${amount.toFixed(2)}\\nDifference: P${amountDifference.toFixed(2)}\\n\\nContinue anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => submitConfirmation(amount),
            style: 'destructive'
          }
        ]
      );
      return;
    }

    await submitConfirmation(amount);
  };

  const submitConfirmation = async (amount: number) => {
    setLoading(true);
    
    try {
      const result = await CashPaymentService.confirmCashReceived(
        transactionId,
        amount,
        location || undefined
      );

      if (result.success) {
        if (result.status === 'completed') {
          Alert.alert(
            'Payment Completed',
            'Cash payment has been confirmed by both parties!',
            [
              {
                text: 'OK',
                onPress: () => (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('RideInProgress'),
              },
            ]
          );
        } else {
          Alert.alert(
            'Receipt Confirmed',
            'Cash receipt confirmed. Waiting for rider to enter their confirmation code.',
            [
              {
                text: 'OK',
                onPress: () => (navigation as unknown as { navigate: (screen: string, params?: Record<string, unknown>) => void }).navigate('RideInProgress'),
              },
            ]
          );
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to confirm cash receipt');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to confirm cash receipt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReportProblem = () => {
    Alert.alert(
      'Report Problem',
      'What type of problem are you experiencing?',
      [
        {
          text: 'Rider not paying',
          onPress: () => reportDispute('no_payment_received'),
        },
        {
          text: 'Rider paying wrong amount',
          onPress: () => reportDispute('wrong_amount'),
        },
        {
          text: 'Other issue',
          onPress: () => reportDispute('other'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const reportDispute = async (reason: string) => {
    try {
      const result = await CashPaymentService.reportDispute(transactionId, {
        reason,
        description: `Driver reporting: ${reason}`,
      });

      if (result.success) {
        Alert.alert(
          'Dispute Reported',
          'Your dispute has been reported and will be reviewed within 24-48 hours.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to report dispute');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to report dispute. Please try again.');
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
    setReceivedAmount(cleanText);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="attach-money" size={60} color={colors.success} />
        <Text style={styles.title}>Confirm Cash Received</Text>
        <Text style={styles.subtitle}>Confirm cash payment from {riderName}</Text>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Rider:</Text>
          <Text style={styles.detailValue}>{riderName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Expected Amount:</Text>
          <Text style={styles.expectedAmountValue}>P{expectedAmount.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.locationStatus}>
        <Icon 
          name={location ? 'location-on' : 'location-off'} 
          size={20} 
          color={location ? colors.success : colors.text.secondary} 
        />
        <Text style={styles.locationText}>
          {locationLoading 
            ? 'Getting location...' 
            : location 
              ? 'Location verified' 
              : 'Location unavailable'
          }
        </Text>
      </View>

      <View style={styles.amountInputContainer}>
        <Text style={styles.amountInputLabel}>Amount Received:</Text>
        <View style={styles.amountInputWrapper}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={receivedAmount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
            placeholder="0.00"
            autoFocus={false}
          />
        </View>
        
        {Math.abs(parseFloat(receivedAmount) - expectedAmount) > 0.01 && (
          <View style={styles.amountWarning}>
            <Icon name="warning" size={16} color={colors.warning} />
            <Text style={styles.amountWarningText}>
              Amount differs from expected by $
              {Math.abs(parseFloat(receivedAmount) - expectedAmount).toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Confirmation Steps:</Text>
        <View style={styles.instructionStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <Text style={styles.stepText}>
            Verify the amount received matches the expected amount
          </Text>
        </View>
        <View style={styles.instructionStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <Text style={styles.stepText}>
            Confirm receipt to notify the rider
          </Text>
        </View>
        <View style={styles.instructionStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <Text style={styles.stepText}>
            Rider will enter their confirmation code to complete payment
          </Text>
        </View>
      </View>

      <Button
        title={loading ? 'Confirming...' : 'Confirm Cash Received'}
        onPress={handleConfirmReceipt}
        disabled={loading || !receivedAmount || parseFloat(receivedAmount) <= 0}
        style={styles.confirmButton}
        icon="check-circle"
      />

      <TouchableOpacity 
        style={styles.reportButton}
        onPress={handleReportProblem}
        disabled={loading}
      >
        <Icon name="report-problem" size={20} color={colors.warning} />
        <Text style={styles.reportButtonText}>Report Problem</Text>
      </TouchableOpacity>

      <View style={styles.securityNote}>
        <Icon name="security" size={16} color={colors.text.secondary} />
        <Text style={styles.securityNoteText}>
          Confirming will notify the rider and start the payment completion process.
          Only confirm if you have actually received the cash payment.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  paymentDetails: {
    padding: 20,
    backgroundColor: colors.surface,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  expectedAmountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  locationText: {
    fontSize: 14,
    color: colors.text.primary,
    marginLeft: 8,
  },
  amountInputContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  amountInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  dollarSign: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    paddingVertical: 16,
    textAlign: 'right',
  },
  amountWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.warning + '20',
    borderRadius: 8,
  },
  amountWarningText: {
    flex: 1,
    fontSize: 14,
    color: colors.warning,
    marginLeft: 8,
  },
  instructionsContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 16,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.surface,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  confirmButton: {
    margin: 16,
    backgroundColor: colors.success,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  reportButtonText: {
    color: colors.warning,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 16,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  securityNoteText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: 8,
    lineHeight: 16,
  },
});

export default DriverCashReceiptScreen;