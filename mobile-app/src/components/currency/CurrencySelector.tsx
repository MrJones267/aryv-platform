/**
 * @fileoverview Currency Selector Component
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import { Currency, CurrencyService } from '../../services/CurrencyService';
import logger from '../../services/LoggingService';

const log = logger.createLogger('CurrencySelector');

interface CurrencySelectorProps {
  selectedCurrency: Currency | null;
  onCurrencySelect: (currency: Currency) => void;
  showPopularOnly?: boolean;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  selectedCurrency,
  onCurrencySelect,
  showPopularOnly = false,
  disabled = false,
  label = 'Currency',
  placeholder = 'Select currency',
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [filteredCurrencies, setFilteredCurrencies] = useState<Currency[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCurrencies();
  }, [showPopularOnly]);

  useEffect(() => {
    filterCurrencies();
  }, [searchQuery, currencies]);

  const loadCurrencies = async () => {
    setLoading(true);
    try {
      let currencyList: Currency[];
      
      if (showPopularOnly) {
        const region = CurrencyService.getUserRegion();
        currencyList = await CurrencyService.getPopularCurrencies(region);
      } else {
        currencyList = await CurrencyService.getCachedCurrencies();
      }
      
      setCurrencies(currencyList);
      setFilteredCurrencies(currencyList);
    } catch (error) {
      log.error('Error loading currencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCurrencies = () => {
    if (!searchQuery.trim()) {
      setFilteredCurrencies(currencies);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = currencies.filter(currency => 
      currency.code.toLowerCase().includes(query) ||
      currency.name.toLowerCase().includes(query)
    );
    
    setFilteredCurrencies(filtered);
  };

  const handleCurrencySelect = (currency: Currency) => {
    onCurrencySelect(currency);
    setIsModalVisible(false);
    setSearchQuery('');
  };

  const renderCurrencyItem = ({ item }: { item: Currency }) => (
    <TouchableOpacity
      style={[
        styles.currencyItem,
        selectedCurrency?.code === item.code && styles.selectedCurrencyItem
      ]}
      onPress={() => handleCurrencySelect(item)}
    >
      <View style={styles.currencyInfo}>
        <Text style={styles.currencyFlag}>
          {CurrencyService.getCurrencyFlag(item.countryCode)}
        </Text>
        <View style={styles.currencyDetails}>
          <Text style={styles.currencyCode}>{item.code}</Text>
          <Text style={styles.currencyName}>{item.name}</Text>
        </View>
        <Text style={styles.currencySymbol}>{item.symbol}</Text>
      </View>
      {selectedCurrency?.code === item.code && (
        <Icon name="check" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity
        style={[
          styles.selector,
          disabled && styles.disabledSelector
        ]}
        onPress={() => !disabled && setIsModalVisible(true)}
        disabled={disabled}
      >
        <View style={styles.selectorContent}>
          {selectedCurrency ? (
            <>
              <Text style={styles.flag}>
                {CurrencyService.getCurrencyFlag(selectedCurrency.countryCode)}
              </Text>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedCode}>{selectedCurrency.code}</Text>
                <Text style={styles.selectedName}>{selectedCurrency.name}</Text>
              </View>
              <Text style={styles.selectedSymbol}>{selectedCurrency.symbol}</Text>
            </>
          ) : (
            <Text style={styles.placeholder}>{placeholder}</Text>
          )}
        </View>
        
        <Icon 
          name="keyboard-arrow-down" 
          size={24} 
          color={disabled ? colors.text.secondary : colors.text.primary} 
        />
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Icon name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color={colors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search currencies..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="clear" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading currencies...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredCurrencies}
              renderItem={renderCurrencyItem}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="search-off" size={48} color={colors.text.secondary} />
                  <Text style={styles.emptyText}>No currencies found</Text>
                  <Text style={styles.emptySubtext}>
                    Try adjusting your search terms
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  disabledSelector: {
    opacity: 0.6,
    backgroundColor: colors.background.primary,
  },
  selectorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedCode: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  selectedName: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  selectedSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
  placeholder: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: 12,
    marginRight: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 12,
  },
  listContainer: {
    paddingBottom: 20,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  selectedCurrencyItem: {
    backgroundColor: colors.primaryLight,
  },
  currencyInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyFlag: {
    fontSize: 24,
    marginRight: 16,
  },
  currencyDetails: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  currencyName: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default CurrencySelector;