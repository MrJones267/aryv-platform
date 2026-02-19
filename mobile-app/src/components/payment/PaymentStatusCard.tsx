/**
 * @fileoverview Payment status display card component
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';

export interface PaymentStatus {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  method: 'card' | 'wallet' | 'bank_transfer' | 'cash';
  transactionId?: string;
  createdAt: string;
  completedAt?: string;
  description: string;
  fee?: number;
}

interface PaymentStatusCardProps {
  payment: PaymentStatus;
  onPress?: () => void;
  showDetails?: boolean;
  animated?: boolean;
}

const PaymentStatusCard: React.FC<PaymentStatusCardProps> = ({
  payment,
  onPress,
  showDetails = false,
  animated = true,
}) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (animated) {
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [animated, animatedValue]);

  const getStatusColor = (status: PaymentStatus['status']) => {
    switch (status) {
      case 'completed': return colors.success;
      case 'processing': return colors.warning;
      case 'pending': return colors.info;
      case 'failed': return colors.error;
      case 'refunded': return colors.warning;
      case 'cancelled': return colors.text.secondary;
      default: return colors.text.secondary;
    }
  };

  const getStatusIcon = (status: PaymentStatus['status']) => {
    switch (status) {
      case 'completed': return 'check-circle';
      case 'processing': return 'hourglass-empty';
      case 'pending': return 'schedule';
      case 'failed': return 'error';
      case 'refunded': return 'undo';
      case 'cancelled': return 'cancel';
      default: return 'help';
    }
  };

  const getMethodIcon = (method: PaymentStatus['method']) => {
    switch (method) {
      case 'card': return 'credit-card';
      case 'wallet': return 'account-balance-wallet';
      case 'bank_transfer': return 'account-balance';
      case 'cash': return 'money';
      default: return 'payment';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BW', {
      style: 'currency',
      currency: 'BWP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColor = getStatusColor(payment.status);

  const cardContent = (
    <View style={[styles.card, { borderLeftColor: statusColor }]}>
      <View style={styles.header}>
        <View style={styles.statusSection}>
          <Icon 
            name={getStatusIcon(payment.status)} 
            size={20} 
            color={statusColor} 
          />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
          </Text>
        </View>
        
        <View style={styles.amountSection}>
          <Text style={styles.amount}>{formatCurrency(payment.amount)}</Text>
          {payment.fee && (
            <Text style={styles.fee}>Fee: {formatCurrency(payment.fee)}</Text>
          )}
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.description} numberOfLines={showDetails ? undefined : 2}>
          {payment.description}
        </Text>
        
        <View style={styles.details}>
          <View style={styles.methodSection}>
            <Icon 
              name={getMethodIcon(payment.method)} 
              size={16} 
              color={colors.text.secondary} 
            />
            <Text style={styles.method}>
              {payment.method.charAt(0).toUpperCase() + payment.method.slice(1).replace('_', ' ')}
            </Text>
          </View>
          
          <Text style={styles.date}>{formatDate(payment.createdAt)}</Text>
        </View>

        {showDetails && (
          <View style={styles.additionalDetails}>
            {payment.transactionId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Transaction ID:</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {payment.transactionId}
                </Text>
              </View>
            )}
            
            {payment.completedAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Completed:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(payment.completedAt)}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {payment.status === 'processing' && (
        <View style={styles.progressBar}>
          <Animated.View 
            style={[
              styles.progressFill,
              {
                transform: [{
                  scaleX: animatedValue,
                }],
              },
            ]} 
          />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    marginVertical: 6,
    marginHorizontal: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    shadowColor: colors.text.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  amountSection: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  fee: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  content: {
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 8,
    lineHeight: 20,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  method: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  date: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  additionalDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.border.light,
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.warning,
    borderRadius: 2,
  },
});

export default PaymentStatusCard;