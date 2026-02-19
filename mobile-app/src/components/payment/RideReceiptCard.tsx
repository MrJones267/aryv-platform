/**
 * @fileoverview Digital receipt card component for displaying ride receipts
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import ReceiptService, { RideReceipt } from '../../services/ReceiptService';

interface RideReceiptCardProps {
  receipt: RideReceipt;
  onShare?: () => void;
}

const RideReceiptCard: React.FC<RideReceiptCardProps> = ({ receipt, onShare }) => {
  const receiptService = ReceiptService.getInstance();
  const date = new Date(receipt.date);
  const dateStr = date.toLocaleDateString('en-BW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-BW', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleShare = async () => {
    if (onShare) {
      onShare();
    } else {
      await receiptService.shareReceipt(receipt);
    }
  };

  return (
    <View style={styles.container}>
      {/* Receipt header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Icon name="receipt-long" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.brandName}>ARYV</Text>
            <Text style={styles.receiptNum}>#{receipt.receiptNumber}</Text>
          </View>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{receipt.status === 'paid' ? 'Paid' : 'Pending'}</Text>
        </View>
      </View>

      {/* Date and route */}
      <View style={styles.routeSection}>
        <Text style={styles.dateText}>{dateStr} at {timeStr}</Text>
        <View style={styles.routeRow}>
          <View style={styles.routeDots}>
            <View style={styles.dotGreen} />
            <View style={styles.routeLine} />
            <View style={styles.dotRed} />
          </View>
          <View style={styles.routeLabels}>
            <Text style={styles.routeAddress} numberOfLines={1}>{receipt.origin}</Text>
            <Text style={styles.routeAddress} numberOfLines={1}>{receipt.destination}</Text>
          </View>
        </View>
        {(receipt.distance || receipt.duration) && (
          <View style={styles.statsRow}>
            {receipt.distance && (
              <View style={styles.stat}>
                <Icon name="straighten" size={14} color={colors.text.secondary} />
                <Text style={styles.statText}>{receipt.distance}</Text>
              </View>
            )}
            {receipt.duration && (
              <View style={styles.stat}>
                <Icon name="schedule" size={14} color={colors.text.secondary} />
                <Text style={styles.statText}>{receipt.duration}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Driver info */}
      <View style={styles.driverRow}>
        <Icon name="person" size={16} color={colors.text.secondary} />
        <Text style={styles.driverText}>{receipt.driverName}</Text>
        {receipt.vehicleInfo ? (
          <Text style={styles.vehicleText}>{receipt.vehicleInfo}</Text>
        ) : null}
      </View>

      {/* Divider */}
      <View style={styles.dashedDivider}>
        {Array.from({ length: 25 }).map((_, i) => (
          <View key={i} style={styles.dash} />
        ))}
      </View>

      {/* Line items */}
      <View style={styles.lineItems}>
        {receipt.lineItems.map((item, index) => (
          <View key={index} style={styles.lineItem}>
            <Text
              style={[
                styles.lineItemLabel,
                item.type === 'discount' && styles.discountLabel,
                item.type === 'tip' && styles.tipLabel,
              ]}
            >
              {item.type === 'discount' && (
                <Icon name="local-offer" size={12} color="#10B981" />
              )}
              {item.type === 'tip' && (
                <Icon name="favorite" size={12} color="#F59E0B" />
              )}
              {' '}{item.label}
            </Text>
            <Text
              style={[
                styles.lineItemAmount,
                item.type === 'discount' && styles.discountAmount,
                item.type === 'tip' && styles.tipAmount,
              ]}
            >
              {item.amount < 0 ? '-' : ''}{receipt.currency} {Math.abs(item.amount).toFixed(0)}
            </Text>
          </View>
        ))}
      </View>

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>
          {receipt.currency} {receipt.totalAmount.toFixed(0)}
        </Text>
      </View>

      {/* Payment method */}
      <View style={styles.paymentRow}>
        <Icon name="account-balance-wallet" size={14} color={colors.text.secondary} />
        <Text style={styles.paymentText}>Paid via {receipt.paymentMethod}</Text>
      </View>

      {/* Share button */}
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.7}>
        <Icon name="share" size={16} color={colors.primary} />
        <Text style={styles.shareBtnText}>Share Receipt</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: 1,
  },
  receiptNum: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  statusBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  routeSection: {
    marginBottom: 14,
  },
  dateText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 10,
  },
  routeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  routeDots: {
    alignItems: 'center',
    paddingTop: 4,
  },
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  routeLine: {
    width: 1.5,
    height: 16,
    backgroundColor: colors.border.medium,
  },
  dotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  routeLabels: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 8,
  },
  routeAddress: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingLeft: 20,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  driverText: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
  },
  vehicleText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: 'auto',
  },
  dashedDivider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dash: {
    width: 8,
    height: 1.5,
    backgroundColor: colors.border.medium,
  },
  lineItems: {
    gap: 8,
    marginBottom: 12,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineItemLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  discountLabel: {
    color: '#10B981',
  },
  tipLabel: {
    color: '#F59E0B',
  },
  lineItemAmount: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
  },
  discountAmount: {
    color: '#10B981',
  },
  tipAmount: {
    color: '#F59E0B',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  paymentText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: colors.primary + '08',
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default RideReceiptCard;
