/**
 * @fileoverview Payment management screen
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import {
  PaymentStatusCard,
  EscrowStatusDisplay,
  PaymentMethodSelector,
  TransactionHistory,
  PaymentStatus,
  EscrowData,
  PaymentMethod,
  Transaction,
} from '../../components/payment';
import EscrowPaymentService, { EscrowTransaction } from '../../services/EscrowPaymentService';
import CashPaymentService from '../../services/CashPaymentService';
import { paymentApi } from '../../services/api/paymentApi';

const PaymentScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'escrow' | 'history'>('overview');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>();

  const [recentPayments, setRecentPayments] = useState<PaymentStatus[]>([]);
  const [activeEscrows, setActiveEscrows] = useState<EscrowData[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    loadPaymentData();
  }, []);

  const loadPaymentData = async () => {
    setLoading(true);
    try {
      const [methodsRes, txRes] = await Promise.all([
        paymentApi.getPaymentMethods(),
        paymentApi.getTransactions({ limit: 20 }),
      ]);

      if (methodsRes.success && methodsRes.data) {
        const mapped: PaymentMethod[] = (methodsRes.data as any[]).map((m: any) => ({
          id: m.id,
          type: m.type,
          title: m.nickname || m.type,
          subtitle: m.isDefault ? 'Default' : '',
          icon: m.type === 'card' ? 'credit-card' : 'account-balance-wallet',
          isDefault: m.isDefault,
          isAvailable: true,
          lastFour: m.lastFour,
          expiryDate: m.expiryDate,
          balance: m.balance,
          estimatedTime: 'Instant',
        }));
        setPaymentMethods(mapped);
      }

      if (txRes.success && txRes.data) {
        const txList = (txRes.data as any).transactions || txRes.data;
        const mappedTx: Transaction[] = (txList as any[]).map((t: any) => ({
          id: t.id,
          amount: t.amount,
          status: t.status,
          method: t.paymentMethod || 'card',
          transactionId: t.id,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
          description: t.description || t.type,
          fee: t.fee,
          type: t.type || 'ride',
          category: t.amount > 0 ? 'expense' : 'income',
        }));
        setTransactions(mappedTx);
        setRecentPayments(mappedTx.slice(0, 5) as any);
      }

      // Load active escrow data
      try {
        const escrowData = await EscrowPaymentService.getEscrowHistory(10, 0, 'held');
        if (escrowData) setActiveEscrows(escrowData as any);
      } catch {
        // Escrow data is non-critical
      }
    } catch {
      Alert.alert('Error', 'Failed to load payment data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadPaymentData();
  };

  const handlePaymentMethodSelect = (method: string) => {
    setSelectedPaymentMethod(method);
    Alert.alert('Payment Method Selected', `${method} has been selected as your payment method.`);
  };

  const handleTransactionPress = (transaction: Transaction) => {
    Alert.alert(
      'Transaction Details',
      `Transaction ID: ${transaction.id}\nAmount: P${transaction.amount}\nStatus: ${transaction.status}`
    );
  };

  const handleEscrowPress = (escrow: EscrowData) => {
    Alert.alert(
      'Escrow Details',
      `Escrow ID: ${escrow.id}\nAmount: P${escrow.amount}\nStatus: ${escrow.status}`
    );
  };

  const getWalletBalance = () => {
    const wallet = paymentMethods.find(m => m.type === 'wallet');
    return wallet?.balance || 0;
  };

  const getTotalEscrowAmount = () => {
    return activeEscrows.reduce((total, escrow) => total + escrow.amount, 0);
  };

  const renderOverviewTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* Wallet Balance */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Icon name="account-balance-wallet" size={24} color={colors.primary} />
          <Text style={styles.balanceTitle}>Wallet Balance</Text>
        </View>
        <Text style={styles.balanceAmount}>P{getWalletBalance().toFixed(2)}</Text>
        <TouchableOpacity style={styles.topUpButton}>
          <Text style={styles.topUpButtonText}>Top Up Wallet</Text>
        </TouchableOpacity>
      </View>

      {/* Active Escrows Summary */}
      {activeEscrows.length > 0 && (
        <View style={styles.escrowSummary}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Escrows</Text>
            <Text style={styles.escrowTotal}>P{getTotalEscrowAmount().toFixed(2)}</Text>
          </View>
          <Text style={styles.escrowSubtitle}>
            {activeEscrows.length} package{activeEscrows.length > 1 ? 's' : ''} pending delivery
          </Text>
        </View>
      )}

      {/* Payment Method Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Default Payment Method</Text>
        <PaymentMethodSelector
          selectedMethod={null}
          onMethodSelect={handlePaymentMethodSelect}
          amount={25} // Example amount
        />
      </View>

      {/* Recent Payments */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          <TouchableOpacity onPress={() => setActiveTab('history')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        {recentPayments.slice(0, 3).map(payment => (
          <PaymentStatusCard
            key={payment.id}
            payment={payment}
            onPress={() => handleTransactionPress(payment as Transaction)}
            showDetails={false}
          />
        ))}
      </View>
    </ScrollView>
  );

  const renderEscrowTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.section}>
        <Text style={styles.sectionDescription}>
          Escrow protects both senders and couriers by holding payments until delivery is confirmed.
        </Text>
        
        {activeEscrows.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="security" size={64} color={colors.text.secondary} />
            <Text style={styles.emptyTitle}>No Active Escrows</Text>
            <Text style={styles.emptySubtitle}>
              Create a package delivery to see escrow status here
            </Text>
          </View>
        ) : (
          activeEscrows.map(escrow => (
            <EscrowStatusDisplay
              key={escrow.id}
              escrow={escrow}
              packageTitle={`Package #${escrow.packageId.slice(-3)}`}
              onPress={() => handleEscrowPress(escrow)}
              showTimeline={true}
            />
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderHistoryTab = () => (
    <TransactionHistory
      transactions={transactions}
      onTransactionPress={handleTransactionPress}
      onRefresh={handleRefresh}
      showSearch={true}
      showFilters={true}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payments</Text>
        <TouchableOpacity>
          <Icon name="more-vert" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'escrow' && styles.activeTab]}
          onPress={() => setActiveTab('escrow')}
        >
          <Text style={[styles.tabText, activeTab === 'escrow' && styles.activeTabText]}>
            Escrow
          </Text>
          {activeEscrows.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeEscrows.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'escrow' && renderEscrowTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.secondary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  badgeText: {
    fontSize: 10,
    color: colors.text.inverse,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: colors.background.secondary,
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: 16,
  },
  topUpButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  topUpButtonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  escrowSummary: {
    backgroundColor: colors.warning + '20',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  escrowTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.warning,
  },
  escrowSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    paddingHorizontal: 16,
    marginBottom: 16,
    lineHeight: 20,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default PaymentScreen;