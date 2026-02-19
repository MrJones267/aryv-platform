/**
 * @fileoverview Phone Input component with country code selector
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';

interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

const defaultCountries: Country[] = [
  { code: 'BW', name: 'Botswana', dialCode: '+267', flag: '🇧🇼' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦' },
  { code: 'NA', name: 'Namibia', dialCode: '+264', flag: '🇳🇦' },
  { code: 'ZM', name: 'Zambia', dialCode: '+260', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', dialCode: '+263', flag: '🇿🇼' },
  { code: 'MZ', name: 'Mozambique', dialCode: '+258', flag: '🇲🇿' },
  { code: 'MW', name: 'Malawi', dialCode: '+265', flag: '🇲🇼' },
  { code: 'SZ', name: 'Eswatini', dialCode: '+268', flag: '🇸🇿' },
  { code: 'LS', name: 'Lesotho', dialCode: '+266', flag: '🇱🇸' },
  { code: 'AO', name: 'Angola', dialCode: '+244', flag: '🇦🇴' },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', flag: '🇹🇿' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
];

interface PhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onChangeCountry?: (country: Country) => void;
  onCountryChange?: (country: Country) => void;
  selectedCountry?: Country;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  label?: string;
  countries?: Country[];
  defaultCountry?: string;
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChangeText,
  onChangeCountry,
  onCountryChange,
  selectedCountry,
  placeholder = 'Phone number',
  error,
  disabled = false,
  label,
  countries = defaultCountries,
  defaultCountry = 'BW',
}) => {
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const defaultSelected = selectedCountry
    || countries.find(c => c.code === defaultCountry)
    || countries[0];
  const [currentCountry, setCurrentCountry] = useState<Country>(defaultSelected);

  const handleSelectCountry = (country: Country) => {
    setCurrentCountry(country);
    onChangeCountry?.(country);
    onCountryChange?.(country);
    setShowCountryPicker(false);
  };

  const formatPhoneNumber = (text: string): string => {
    // Remove non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    return cleaned;
  };

  const handleChangeText = (text: string) => {
    const formatted = formatPhoneNumber(text);
    onChangeText(formatted);
  };

  const renderCountryItem = ({ item }: { item: Country }) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => handleSelectCountry(item)}
    >
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <Text style={styles.countryName}>{item.name}</Text>
      <Text style={styles.countryDialCode}>{item.dialCode}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[
        styles.inputContainer,
        error ? styles.inputContainerError : undefined,
        disabled ? styles.inputContainerDisabled : undefined,
      ]}>
        <TouchableOpacity
          style={styles.countrySelector}
          onPress={() => !disabled && setShowCountryPicker(true)}
          disabled={disabled}
        >
          <Text style={styles.flag}>{currentCountry.flag}</Text>
          <Text style={styles.dialCode}>{currentCountry.dialCode}</Text>
          <Icon name="arrow-drop-down" size={20} color={colors.text.secondary} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.disabled}
          keyboardType="phone-pad"
          editable={!disabled}
          maxLength={15}
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Icon name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={countries}
              renderItem={renderCountryItem}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 12,
    backgroundColor: colors.background.primary,
    overflow: 'hidden',
  },
  inputContainerError: {
    borderColor: colors.error,
  },
  inputContainerDisabled: {
    backgroundColor: colors.background.secondary,
    opacity: 0.7,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  flag: {
    fontSize: 20,
    marginRight: 6,
  },
  dialCode: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border.light,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
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
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  countryDialCode: {
    fontSize: 14,
    color: colors.text.secondary,
  },
});

export default PhoneInput;
