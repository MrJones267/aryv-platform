/**
 * @fileoverview Cash Payment Screen for riders
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

import { colors } from '../../theme';
import { Button } from '../../components/ui';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { CashPaymentService } from '../../services/CashPaymentService';

interface CashPaymentScreenProps {
  route: {
    params: {
      bookingId: string;
      driverId: string;
      amount: number;
      driverName: string;
    };
  };
}

const CashPaymentScreen: React.FC<CashPaymentScreenProps> = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { bookingId, driverId, amount, driverName } = route.params as CashPaymentScreenProps['route']['params'];
  
  const [confirmationCode, setConfirmationCode] = useState('');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [riderCode, setRiderCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentCreated, setPaymentCreated] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'driver_confirmed' | 'completed' | 'failed'>('pending');
  const [trustScore, setTrustScore] = useState<number>(50);

  const currentUser = useAppSelector((state) => (state.auth as any).user);

  useEffect(() => {
    createCashPayment();
  }, []);

  const createCashPayment = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const result = await CashPaymentService.createCashPayment({
        bookingId,
        driverId,
        amount,
      });

      if (result.success) {
        setTransactionId(result.transactionId);
        setRiderCode(result.riderCode);
        setPaymentCreated(true);
        setTrustScore(result.trustScore || 50);
      } else {
        Alert.alert(
          'Payment Error',
          result.error || 'Failed to create cash payment',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to create cash payment. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!transactionId || confirmationCode.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit confirmation code');
      return;
    }

    setLoading(true);
    try {
      const result = await CashPaymentService.confirmCashPaid(
        transactionId,
        confirmationCode
      );

      if (result.success) {
        if (result.status === 'completed') {
          setPaymentStatus('completed');
          Alert.alert(
            'Payment Completed',
            'Your cash payment has been confirmed successfully!',
            [
              {
                text: 'OK',
                onPress: () => (navigation as any).navigate('RideComplete'),
              },
            ]
          );
        } else {
          setPaymentStatus('driver_confirmed');
          Alert.alert(
            'Confirmation Received',
            'Your confirmation has been recorded. Waiting for driver confirmation.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to confirm payment');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to confirm payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReportProblem = () => {
    if (!transactionId) return;

    Alert.alert(
      'Report Problem',
      'What type of problem are you experiencing?',
      [
        {
          text: 'Driver asking for wrong amount',
          onPress: () => reportDispute('wrong_amount'),
        },
        {
          text: 'Driver not confirming payment',
          onPress: () => reportDispute('driver_issue'),
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
    if (!transactionId) return;

    try {
      const result = await CashPaymentService.reportDispute(transactionId, {
        reason,
        description: `Cash payment issue: ${reason}`,
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

  if (loading && !paymentCreated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Creating cash payment...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="account-balance-wallet" size={60} color={colors.primary} />
        <Text style={styles.title}>Cash Payment</Text>
        <Text style={styles.subtitle}>Pay with cash directly to your driver</Text>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Driver:</Text>
          <Text style={styles.detailValue}>{driverName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount to Pay:</Text>
          <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.trustScoreContainer}>
        <View style={styles.trustScoreHeader}>
          <Icon name="verified-user" size={20} color={colors.success} />
          <Text style={styles.trustScoreLabel}>Trust Score: {trustScore}/100</Text>
        </View>
        <View style={styles.trustScoreBar}>
          <View 
            style={[
              styles.trustScoreFill, 
              { width: `${trustScore}%`, backgroundColor: getTrustColor(trustScore) }
            ]} 
          />
        </View>
      </View>

      {riderCode && (
        <View style={styles.confirmationCodeContainer}>
          <Text style={styles.confirmationCodeLabel}>Your Confirmation Code:</Text>
          <View style={styles.confirmationCodeBox}>
            <Text style={styles.confirmationCodeText}>{riderCode}</Text>
          </View>
          <Text style={styles.confirmationCodeNote}>
            Show this code to your driver after payment
          </Text>
        </View>
      )}

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Payment Instructions:</Text>
        <View style={styles.instructionStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <Text style={styles.stepText}>
            Pay exactly ${amount.toFixed(2)} in cash to your driver
          </Text>
        </View>
        <View style={styles.instructionStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <Text style={styles.stepText}>
            Driver will confirm receipt on their app
          </Text>
        </View>
        <View style={styles.instructionStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <Text style={styles.stepText}>
            Enter your confirmation code below to complete payment
          </Text>
        </View>
      </View>

      <View style={styles.confirmationSection}>
        <Text style={styles.confirmationLabel}>Enter Confirmation Code:</Text>
        <TextInput
          style={styles.codeInput}
          placeholder="123456"
          value={confirmationCode}
          onChangeText={setConfirmationCode}
          maxLength={6}
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <Button
          title={loading ? 'Confirming...' : 'Confirm Cash Payment'}
          onPress={handleConfirmPayment}
          disabled={loading || confirmationCode.length !== 6}
          style={styles.confirmButton}
        />
      </View>

      <TouchableOpacity 
        style={styles.reportButton}
        onPress={handleReportProblem}
        disabled={loading}
      >
        <Icon name="report-problem" size={20} color={colors.warning} />
        <Text style={styles.reportButtonText}>Report Problem</Text>
      </TouchableOpacity>

      <View style={styles.securityNote}>
        <Icon name="security" size={16} color={colors.textSecondary} />
        <Text style={styles.securityNoteText}>
          Your payment is protected by our trust system and dispute resolution process
        </Text>
      </View>
    </ScrollView>
  );
};

const getTrustColor = (score: number): string => {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.error;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  trustScoreContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  trustScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  trustScoreLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: 8,
  },
  trustScoreBar: {
    height: 8,
    backgroundColor: colors.background.primary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trustScoreFill: {
    height: '100%',
    borderRadius: 4,
  },
  confirmationCodeContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmationCodeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 12,
  },
  confirmationCodeBox: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  confirmationCodeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: 2,
  },
  confirmationCodeNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
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
    backgroundColor: colors.primary,
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
  confirmationSection: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  confirmationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  codeInput: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 16,
  },
  confirmButton: {
    marginTop: 8,
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
    color: colors.textSecondary,
    marginLeft: 8,
    lineHeight: 16,
  },
});

export default CashPaymentScreen;