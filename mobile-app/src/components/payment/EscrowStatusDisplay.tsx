/**
 * @fileoverview Escrow status display component for package deliveries
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

export interface EscrowData {
  id: string;
  packageId: string;
  amount: number;
  platformFee: number;
  courierEarnings: number;
  status: 'created' | 'funded' | 'held' | 'disputed' | 'released' | 'refunded';
  createdAt: string;
  expectedReleaseAt?: string;
  actualReleaseAt?: string;
  holdReason?: string;
  disputeReason?: string;
  qrCodeVerified?: boolean;
  deliveryConfirmed?: boolean;
}

interface EscrowStatusDisplayProps {
  escrow: EscrowData;
  packageTitle: string;
  onPress?: () => void;
  showTimeline?: boolean;
  compact?: boolean;
}

const EscrowStatusDisplay: React.FC<EscrowStatusDisplayProps> = ({
  escrow,
  packageTitle,
  onPress,
  showTimeline = true,
  compact = false,
}) => {
  const pulseAnimation = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (escrow.status === 'held' || escrow.status === 'disputed') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [escrow.status, pulseAnimation]);

  const getStatusColor = (status: EscrowData['status']) => {
    switch (status) {
      case 'created': return colors.info;
      case 'funded': return colors.warning;
      case 'held': return colors.primary;
      case 'disputed': return colors.error;
      case 'released': return colors.success;
      case 'refunded': return colors.warning;
      default: return colors.text.secondary;
    }
  };

  const getStatusIcon = (status: EscrowData['status']) => {
    switch (status) {
      case 'created': return 'account-balance-wallet';
      case 'funded': return 'lock';
      case 'held': return 'schedule';
      case 'disputed': return 'warning';
      case 'released': return 'check-circle';
      case 'refunded': return 'undo';
      default: return 'help';
    }
  };

  const getStatusMessage = (status: EscrowData['status']) => {
    switch (status) {
      case 'created': return 'Escrow created, awaiting payment';
      case 'funded': return 'Payment secured in escrow';
      case 'held': return 'Funds held pending delivery confirmation';
      case 'disputed': return 'Payment under dispute review';
      case 'released': return 'Payment released to courier';
      case 'refunded': return 'Payment refunded to sender';
      default: return 'Unknown status';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
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

  const getTimeRemaining = () => {
    if (!escrow.expectedReleaseAt) return null;
    
    const now = new Date();
    const releaseDate = new Date(escrow.expectedReleaseAt);
    const diff = releaseDate.getTime() - now.getTime();
    
    if (diff <= 0) return 'Release time passed';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }
    
    return `${hours}h ${minutes}m remaining`;
  };

  const statusColor = getStatusColor(escrow.status);

  const renderCompactView = () => (
    <View style={[styles.compactCard, { borderLeftColor: statusColor }]}>
      <View style={styles.compactHeader}>
        <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
          <Icon name={getStatusIcon(escrow.status)} size={20} color={statusColor} />
        </Animated.View>
        <Text style={[styles.compactStatus, { color: statusColor }]}>
          {escrow.status.toUpperCase()}
        </Text>
        <Text style={styles.compactAmount}>{formatCurrency(escrow.amount)}</Text>
      </View>
      
      {escrow.status === 'held' && escrow.expectedReleaseAt && (
        <Text style={styles.compactTimeRemaining}>{getTimeRemaining()}</Text>
      )}
    </View>
  );

  const renderFullView = () => (
    <View style={[styles.card, { borderLeftColor: statusColor }]}>
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={styles.packageTitle} numberOfLines={1}>{packageTitle}</Text>
          <Text style={styles.escrowId}>Escrow #{escrow.id.slice(-6)}</Text>
        </View>
        
        <View style={styles.statusSection}>
          <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
            <Icon name={getStatusIcon(escrow.status)} size={24} color={statusColor} />
          </Animated.View>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {escrow.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.statusMessage}>{getStatusMessage(escrow.status)}</Text>

      <View style={styles.amountBreakdown}>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Total Amount:</Text>
          <Text style={styles.amountValue}>{formatCurrency(escrow.amount)}</Text>
        </View>
        
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Platform Fee:</Text>
          <Text style={styles.amountValue}>-{formatCurrency(escrow.platformFee)}</Text>
        </View>
        
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Courier Earnings:</Text>
          <Text style={[styles.amountValue, styles.courierEarnings]}>
            {formatCurrency(escrow.courierEarnings)}
          </Text>
        </View>
      </View>

      {escrow.status === 'held' && escrow.expectedReleaseAt && (
        <View style={styles.releaseInfo}>
          <Icon name="schedule" size={16} color={colors.warning} />
          <Text style={styles.releaseText}>
            Auto-release: {getTimeRemaining()}
          </Text>
        </View>
      )}

      {escrow.status === 'disputed' && escrow.disputeReason && (
        <View style={styles.disputeInfo}>
          <Icon name="warning" size={16} color={colors.error} />
          <Text style={styles.disputeText}>{escrow.disputeReason}</Text>
        </View>
      )}

      {showTimeline && (
        <View style={styles.verificationStatus}>
          <View style={styles.verificationItem}>
            <Icon 
              name={escrow.qrCodeVerified ? "check-circle" : "radio-button-unchecked"} 
              size={16} 
              color={escrow.qrCodeVerified ? colors.success : colors.text.secondary} 
            />
            <Text style={[
              styles.verificationText,
              { color: escrow.qrCodeVerified ? colors.success : colors.text.secondary }
            ]}>
              QR Code Verified
            </Text>
          </View>
          
          <View style={styles.verificationItem}>
            <Icon 
              name={escrow.deliveryConfirmed ? "check-circle" : "radio-button-unchecked"} 
              size={16} 
              color={escrow.deliveryConfirmed ? colors.success : colors.text.secondary} 
            />
            <Text style={[
              styles.verificationText,
              { color: escrow.deliveryConfirmed ? colors.success : colors.text.secondary }
            ]}>
              Delivery Confirmed
            </Text>
          </View>
        </View>
      )}

      <View style={styles.timestamps}>
        <Text style={styles.timestamp}>Created: {formatDate(escrow.createdAt)}</Text>
        {escrow.actualReleaseAt && (
          <Text style={styles.timestamp}>Released: {formatDate(escrow.actualReleaseAt)}</Text>
        )}
      </View>
    </View>
  );

  const content = compact ? renderCompactView() : renderFullView();

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    marginVertical: 8,
    marginHorizontal: 16,
    padding: 16,
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
  compactCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    marginVertical: 4,
    marginHorizontal: 16,
    padding: 12,
    borderLeftWidth: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleSection: {
    flex: 1,
    marginRight: 12,
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 2,
  },
  escrowId: {
    fontSize: 12,
    color: colors.text.secondary,
    fontFamily: 'monospace',
  },
  statusSection: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  statusMessage: {
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 16,
    lineHeight: 20,
  },
  amountBreakdown: {
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  amountLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  amountValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  courierEarnings: {
    color: colors.success,
    fontWeight: 'bold',
  },
  releaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  releaseText: {
    fontSize: 12,
    color: colors.warning,
    marginLeft: 6,
    fontWeight: '500',
  },
  disputeInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.error + '20',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  disputeText: {
    fontSize: 12,
    color: colors.error,
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
  verificationStatus: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  timestamps: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: 8,
  },
  timestamp: {
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactStatus: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
  },
  compactAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  compactTimeRemaining: {
    fontSize: 10,
    color: colors.warning,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default EscrowStatusDisplay;