/**
 * @fileoverview Country Selector Component for user location preferences
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
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import { Country, CountryService } from '../../services/CountryService';
import logger from '../../services/LoggingService';

const log = logger.createLogger('CountrySelector');

type SectionItem =
  | { type: 'header'; continent: string; countries: Country[]; key: string }
  | ({ type: 'country'; key: string } & Country);

interface CountrySelectorProps {
  selectedCountry: Country | null;
  onCountrySelect: (country: Country) => void;
  showPopularOnly?: boolean;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  showSuggestedCurrency?: boolean;
}

const CountrySelector: React.FC<CountrySelectorProps> = ({
  selectedCountry,
  onCountrySelect,
  showPopularOnly = false,
  disabled = false,
  label = 'Country',
  placeholder = 'Select your country',
  showSuggestedCurrency = false,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCountries();
  }, [showPopularOnly]);

  useEffect(() => {
    filterCountries();
  }, [searchQuery, countries]);

  const loadCountries = async () => {
    setLoading(true);
    try {
      let countryList: Country[];
      
      if (showPopularOnly) {
        countryList = await CountryService.getPopularCountries();
      } else {
        countryList = await CountryService.getAllCountries();
      }
      
      setCountries(countryList);
      setFilteredCountries(countryList);
    } catch (error) {
      log.error('Error loading countries:', error);
      Alert.alert('Error', 'Failed to load countries. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filterCountries = () => {
    if (!searchQuery.trim()) {
      setFilteredCountries(countries);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = countries.filter(country => 
      country.name.toLowerCase().includes(query) ||
      country.code.toLowerCase().includes(query) ||
      country.nameOfficial?.toLowerCase().includes(query) ||
      country.capital?.toLowerCase().includes(query)
    );
    
    setFilteredCountries(filtered);
  };

  const handleCountrySelect = async (country: Country) => {
    onCountrySelect(country);
    setIsModalVisible(false);
    setSearchQuery('');

    if (showSuggestedCurrency) {
      // Show currency suggestion if enabled
      try {
        const suggestedCurrency = await CountryService.getSuggestedCurrency(country.code);
        if (suggestedCurrency) {
          Alert.alert(
            'Currency Suggestion',
            `Based on your country selection (${country.name}), we recommend using ${suggestedCurrency.name} (${suggestedCurrency.code}) as your primary currency. Would you like to update your currency preferences?`,
            [
              { text: 'Not Now', style: 'cancel' },
              { 
                text: 'Update Currency', 
                onPress: () => {
                  // Navigate to currency settings or call currency update
                  // This would typically be handled by the parent component
                }
              }
            ]
          );
        }
      } catch (error) {
        log.error('Error getting currency suggestion:', error);
      }
    }
  };

  const renderCountryItem = ({ item }: { item: Country }) => (
    <TouchableOpacity
      style={[
        styles.countryItem,
        selectedCountry?.code === item.code && styles.selectedCountryItem
      ]}
      onPress={() => handleCountrySelect(item)}
    >
      <View style={styles.countryInfo}>
        <Text style={styles.countryFlag}>{item.flag || '🌍'}</Text>
        <View style={styles.countryDetails}>
          <Text style={styles.countryName}>{item.name}</Text>
          <Text style={styles.countryCode}>
            {item.code} • {item.region}
          </Text>
          {item.capital && (
            <Text style={styles.countryCapital}>Capital: {item.capital}</Text>
          )}
        </View>
        <View style={styles.countryMeta}>
          {item.phonePrefix && (
            <Text style={styles.phonePrefix}>{item.phonePrefix}</Text>
          )}
          <Text style={styles.timezone}>
            {item.timezones[0]?.replace('_', ' ').split('/')[1] || 'UTC'}
          </Text>
        </View>
      </View>
      {selectedCountry?.code === item.code && (
        <Icon name="check" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  const renderSectionHeader = (continent: string, countriesInContinent: Country[]) => {
    if (countriesInContinent.length === 0) return null;
    
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{continent}</Text>
        <Text style={styles.sectionCount}>
          {countriesInContinent.length} {countriesInContinent.length === 1 ? 'country' : 'countries'}
        </Text>
      </View>
    );
  };

  const groupCountriesByContinent = () => {
    const grouped: Record<string, Country[]> = {};
    
    filteredCountries.forEach(country => {
      if (!grouped[country.continent]) {
        grouped[country.continent] = [];
      }
      grouped[country.continent].push(country);
    });

    // Sort continents and countries within each continent
    Object.keys(grouped).forEach(continent => {
      grouped[continent].sort((a, b) => a.name.localeCompare(b.name));
    });

    return grouped;
  };

  const renderGroupedList = () => {
    const grouped = groupCountriesByContinent();
    const sections: SectionItem[] = [];

    Object.keys(grouped).sort().forEach(continent => {
      sections.push({
        type: 'header',
        continent,
        countries: grouped[continent],
        key: `header-${continent}`,
      });

      grouped[continent].forEach(country => {
        sections.push({
          type: 'country',
          ...country,
          key: `country-${country.code}`,
        });
      });
    });

    return sections;
  };

  const renderItem = ({ item }: { item: SectionItem }) => {
    if (item.type === 'header') {
      return renderSectionHeader(item.continent, item.countries);
    }
    return renderCountryItem({ item });
  };

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
          {selectedCountry ? (
            <>
              <Text style={styles.flag}>{selectedCountry.flag || '🌍'}</Text>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedName}>{selectedCountry.name}</Text>
                <Text style={styles.selectedMeta}>
                  {selectedCountry.code} • {selectedCountry.region}
                </Text>
              </View>
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
            <Text style={styles.modalTitle}>
              Select Country {showPopularOnly && '(Popular)'}
            </Text>
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
              placeholder="Search countries..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
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
              <Text style={styles.loadingText}>Loading countries...</Text>
            </View>
          ) : (
            <FlatList
              data={renderGroupedList()}
              renderItem={renderItem}
              keyExtractor={(item) => item.key}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="public" size={48} color={colors.text.secondary} />
                  <Text style={styles.emptyText}>No countries found</Text>
                  <Text style={styles.emptySubtext}>
                    Try adjusting your search terms
                  </Text>
                </View>
              }
            />
          )}

          <View style={styles.modalFooter}>
            <Text style={styles.footerText}>
              Can't find your country? Contact support for assistance.
            </Text>
          </View>
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
    fontSize: 28,
    marginRight: 12,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  selectedMeta: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  sectionCount: {
    fontSize: 12,
    color: colors.primary,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.surface,
  },
  selectedCountryItem: {
    backgroundColor: colors.primaryLight,
  },
  countryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryFlag: {
    fontSize: 28,
    marginRight: 16,
  },
  countryDetails: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  countryCode: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  countryCapital: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  countryMeta: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  phonePrefix: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  timezone: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.surface,
  },
  footerText: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
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

export default CountrySelector;