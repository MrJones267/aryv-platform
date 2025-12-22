/**
 * @fileoverview Country Selection Screen for user profile setup
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { colors } from '../../theme';
import { Button } from '../../components/ui';
import { Country, CountryService } from '../../services/CountryService';
import { CurrencyService } from '../../services/CurrencyService';
import CountrySelector from '../../components/country/CountrySelector';

const CountrySelectionScreen: React.FC = () => {
  const navigation = useNavigation();
  
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [currentCountry, setCurrentCountry] = useState<Country | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoDetectedCountry, setAutoDetectedCountry] = useState<Country | null>(null);

  useEffect(() => {
    loadCurrentCountry();
    detectUserCountry();
  }, []);

  const loadCurrentCountry = async () => {
    try {
      const userCountry = await CountryService.getUserCountry();
      if (userCountry && userCountry.country) {
        setCurrentCountry(userCountry.country);
        setSelectedCountry(userCountry.country);
      }
    } catch (error) {
      console.error('Error loading user country:', error);
    } finally {
      setLoading(false);
    }
  };

  const detectUserCountry = async () => {
    try {
      const detection = CountryService.detectUserCountry();
      
      if (detection.countryCode) {
        const country = await CountryService.getCountryByCode(detection.countryCode);
        if (country) {
          setAutoDetectedCountry(country);
          
          // Auto-select if user has no country set
          if (!currentCountry) {
            setSelectedCountry(country);
          }
        }
      }
    } catch (error) {
      console.error('Error detecting user country:', error);
    }
  };

  const handleSaveCountry = async () => {
    if (!selectedCountry) {
      Alert.alert('Error', 'Please select your country of operation');
      return;
    }

    if (selectedCountry.code === currentCountry?.code) {
      navigation.goBack();
      return;
    }

    setSaving(true);

    try {
      const result = await CountryService.setUserCountry(selectedCountry.code, true);
      
      if (result) {
        Alert.alert(
          'Country Updated',
          `Your country of operation has been set to ${selectedCountry.name}.${
            result.suggestedCurrency 
              ? ` We've also recommended ${result.suggestedCurrency} as your primary currency.`
              : ''
          }`,
          [
            {
              text: 'View Currency Settings',
              onPress: () => {
                (navigation as any).navigate('CurrencySettings');
              }
            },
            {
              text: 'Continue',
              onPress: () => {
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to update your country. Please try again.');
      }
    } catch (error) {
      console.error('Error saving country:', error);
      Alert.alert('Error', 'Failed to update your country. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUseDetectedCountry = () => {
    if (autoDetectedCountry) {
      setSelectedCountry(autoDetectedCountry);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your location settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Country of Operation</Text>
          <Text style={styles.subtitle}>
            Select the country where you primarily use our ride-sharing services. 
            This helps us provide relevant currency options and local features.
          </Text>
        </View>

        {/* Auto-detected Country */}
        {autoDetectedCountry && !currentCountry && (
          <View style={styles.detectedCountryCard}>
            <View style={styles.detectedHeader}>
              <Text style={styles.detectedTitle}>📍 Detected Location</Text>
              <Text style={styles.detectedSubtitle}>
                Based on your device settings
              </Text>
            </View>
            
            <View style={styles.detectedCountryInfo}>
              <Text style={styles.detectedFlag}>{autoDetectedCountry.flag || '🌍'}</Text>
              <View style={styles.detectedDetails}>
                <Text style={styles.detectedName}>{autoDetectedCountry.name}</Text>
                <Text style={styles.detectedMeta}>
                  {autoDetectedCountry.code} • {autoDetectedCountry.region}
                </Text>
              </View>
              <Button
                title="Use This"
                onPress={handleUseDetectedCountry}
                style={styles.useButton}
                variant="outline"
                size="small"
              />
            </View>
          </View>
        )}

        {/* Current Country */}
        {currentCountry && (
          <View style={styles.currentCountryCard}>
            <Text style={styles.currentCountryLabel}>Current Country:</Text>
            <View style={styles.currentCountryInfo}>
              <Text style={styles.currentFlag}>{currentCountry.flag || '🌍'}</Text>
              <View style={styles.currentDetails}>
                <Text style={styles.currentName}>{currentCountry.name}</Text>
                <Text style={styles.currentMeta}>
                  {currentCountry.code} • {currentCountry.region}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Country Selector */}
        <View style={styles.selectorSection}>
          <CountrySelector
            selectedCountry={selectedCountry}
            onCountrySelect={setSelectedCountry}
            showPopularOnly={false}
            disabled={saving}
            label="Select New Country"
            placeholder="Choose your country of operation"
            showSuggestedCurrency={true}
          />
        </View>

        {/* Selected Country Details */}
        {selectedCountry && (
          <View style={styles.selectedCountryCard}>
            <Text style={styles.selectedCountryLabel}>Selected Country Details:</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Name:</Text>
              <Text style={styles.detailValue}>{selectedCountry.name}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Region:</Text>
              <Text style={styles.detailValue}>{selectedCountry.region}</Text>
            </View>
            
            {selectedCountry.capital && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Capital:</Text>
                <Text style={styles.detailValue}>{selectedCountry.capital}</Text>
              </View>
            )}
            
            {selectedCountry.phonePrefix && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone Prefix:</Text>
                <Text style={styles.detailValue}>{selectedCountry.phonePrefix}</Text>
              </View>
            )}
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Primary Timezone:</Text>
              <Text style={styles.detailValue}>
                {selectedCountry.timezones[0]?.replace('_', ' ') || 'UTC'}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Languages:</Text>
              <Text style={styles.detailValue}>
                {selectedCountry.languages.join(', ').toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* Benefits */}
        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>Benefits of Setting Your Country:</Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>💰</Text>
              <Text style={styles.benefitText}>
                Automatic currency recommendations based on your location
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>🕐</Text>
              <Text style={styles.benefitText}>
                Localized time formats and scheduling features
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>🏪</Text>
              <Text style={styles.benefitText}>
                Region-specific promotions and features
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>📞</Text>
              <Text style={styles.benefitText}>
                Local customer support and contact options
              </Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <Button
          title={saving ? 'Saving...' : currentCountry ? 'Update Country' : 'Set Country'}
          onPress={handleSaveCountry}
          disabled={!selectedCountry || saving}
          style={styles.saveButton}
          icon={saving ? undefined : 'save'}
        />

        {/* Skip Option */}
        {!currentCountry && (
          <Button
            title="Skip for Now"
            onPress={() => navigation.goBack()}
            variant="ghost"
            style={styles.skipButton}
          />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  detectedCountryCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  detectedHeader: {
    marginBottom: 12,
  },
  detectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  detectedSubtitle: {
    fontSize: 12,
    color: colors.text.primary,
  },
  detectedCountryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detectedFlag: {
    fontSize: 28,
    marginRight: 12,
  },
  detectedDetails: {
    flex: 1,
  },
  detectedName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  detectedMeta: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  useButton: {
    minWidth: 80,
  },
  currentCountryCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  currentCountryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  currentCountryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  currentDetails: {
    flex: 1,
  },
  currentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  currentMeta: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectorSection: {
    marginBottom: 24,
  },
  selectedCountryCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  selectedCountryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    width: 120,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    flex: 1,
  },
  benefitsSection: {
    marginBottom: 32,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  benefitIcon: {
    fontSize: 16,
    marginRight: 12,
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  saveButton: {
    marginBottom: 16,
  },
  skipButton: {
    marginBottom: 20,
  },
});

export default CountrySelectionScreen;