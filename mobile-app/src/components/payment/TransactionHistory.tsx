/**
 * @fileoverview Transaction history component with filtering and search
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import PaymentStatusCard, { PaymentStatus } from './PaymentStatusCard';

export interface Transaction extends PaymentStatus {
  type: 'ride' | 'delivery' | 'refund' | 'fee' | 'earning';
  category: 'income' | 'expense';
  relatedId?: string;
  location?: string;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  onTransactionPress?: (transaction: Transaction) => void;
  onRefresh?: () => Promise<void>;
  showSearch?: boolean;
  showFilters?: boolean;
  compact?: boolean;
}

interface FilterOptions {
  status: string[];
  type: string[];
  category: string[];
  dateRange: {
    start?: Date;
    end?: Date;
  };
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  onTransactionPress,
  onRefresh,
  showSearch = true,
  showFilters = true,
  compact = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: [],
    type: [],
    category: [],
    dateRange: {},
  });

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(transaction =>
        transaction.description.toLowerCase().includes(query) ||
        transaction.transactionId?.toLowerCase().includes(query) ||
        transaction.type.toLowerCase().includes(query) ||
        transaction.location?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(transaction =>
        filters.status.includes(transaction.status)
      );
    }

    // Type filter
    if (filters.type.length > 0) {
      filtered = filtered.filter(transaction =>
        filters.type.includes(transaction.type)
      );
    }

    // Category filter
    if (filters.category.length > 0) {
      filtered = filtered.filter(transaction =>
        filters.category.includes(transaction.category)
      );
    }

    // Date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      filtered = filtered.filter(transaction => {
        const transactionDate = new Date(transaction.createdAt);
        const isAfterStart = !filters.dateRange.start || 
          transactionDate >= filters.dateRange.start;
        const isBeforeEnd = !filters.dateRange.end || 
          transactionDate <= filters.dateRange.end;
        return isAfterStart && isBeforeEnd;
      });
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [transactions, searchQuery, filters]);

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
  };

  const getTransactionTypeIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'ride': return 'directions-car';
      case 'delivery': return 'local-shipping';
      case 'refund': return 'undo';
      case 'fee': return 'receipt';
      case 'earning': return 'attach-money';
      default: return 'payment';
    }
  };

  const getCategoryColor = (category: Transaction['category']) => {
    return category === 'income' ? colors.success : colors.error;
  };

  const formatCurrency = (amount: number, category: Transaction['category']) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Math.abs(amount));
    
    return category === 'income' ? `+${formatted}` : `-${formatted}`;
  };

  const getTotalBalance = () => {
    return filteredTransactions.reduce((total, transaction) => {
      const amount = transaction.category === 'income' 
        ? transaction.amount 
        : -transaction.amount;
      return total + amount;
    }, 0);
  };

  const getFilterCount = () => {
    return filters.status.length + filters.type.length + filters.category.length +
           (filters.dateRange.start || filters.dateRange.end ? 1 : 0);
  };

  const clearFilters = () => {
    setFilters({
      status: [],
      type: [],
      category: [],
      dateRange: {},
    });
  };

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const enhancedDescription = `${item.description}${item.location ? ` • ${item.location}` : ''}`;
    
    const enhancedTransaction: PaymentStatus = {
      ...item,
      description: enhancedDescription,
    };

    return (
      <View style={styles.transactionItem}>
        {!compact && (
          <View style={styles.transactionHeader}>
            <View style={styles.typeInfo}>
              <Icon 
                name={getTransactionTypeIcon(item.type)} 
                size={16} 
                color={colors.text.secondary} 
              />
              <Text style={styles.typeText}>
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
              </Text>
            </View>
            
            <Text style={[
              styles.amountText,
              { color: getCategoryColor(item.category) }
            ]}>
              {formatCurrency(item.amount, item.category)}
            </Text>
          </View>
        )}
        
        <PaymentStatusCard
          payment={enhancedTransaction}
          onPress={() => onTransactionPress?.(item)}
          showDetails={!compact}
          animated={false}
        />
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="receipt-long" size={64} color={colors.text.secondary} />
      <Text style={styles.emptyTitle}>No Transactions Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || getFilterCount() > 0
          ? "Try adjusting your search or filters"
          : "Your transaction history will appear here"}
      </Text>
      {(searchQuery || getFilterCount() > 0) && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => {
            setSearchQuery('');
            clearFilters();
          }}
        >
          <Text style={styles.clearButtonText}>Clear Search & Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      {!compact && (
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>Net Balance</Text>
          <Text style={[
            styles.balanceAmount,
            { color: getTotalBalance() >= 0 ? colors.success : colors.error }
          ]}>
            {formatCurrency(getTotalBalance(), getTotalBalance() >= 0 ? 'income' : 'expense')}
          </Text>
        </View>
      )}

      {showSearch && (
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={colors.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.text.secondary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="clear" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {showFilters && (
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              getFilterCount() > 0 && styles.activeFilterButton
            ]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Icon name="filter-list" size={20} color={colors.text.secondary} />
            <Text style={styles.filterButtonText}>
              Filter{getFilterCount() > 0 ? ` (${getFilterCount()})` : ''}
            </Text>
          </TouchableOpacity>

          {getFilterCount() > 0 && (
            <TouchableOpacity style={styles.clearFilterButton} onPress={clearFilters}>
              <Text style={styles.clearFilterText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransactionItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />

      {/* Filter Modal would be implemented here */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
              <Icon name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filter Transactions</Text>
            <TouchableOpacity onPress={clearFilters}>
              <Text style={styles.modalClearText}>Clear All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <Text style={styles.filterSectionTitle}>Coming Soon</Text>
            <Text style={styles.filterSectionSubtitle}>
              Advanced filtering options will be available in the next update.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  listContent: {
    flexGrow: 1,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  balanceSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: 8,
    marginRight: 8,
  },
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
  },
  activeFilterButton: {
    backgroundColor: colors.primary + '20',
  },
  filterButtonText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 6,
  },
  clearFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearFilterText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  transactionItem: {
    marginBottom: 8,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  typeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  amountText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
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
    marginBottom: 16,
  },
  clearButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  clearButtonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  modalClearText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  filterSectionSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

export default TransactionHistory;