/**
 * @fileoverview Vehicle registration form component
 * @author Oabona-Majoko
 * @created 2025-10-27
 * @lastModified 2025-10-27
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import { CreateVehicleData } from '../../services/api/vehicleApi';

interface VehicleRegistrationFormProps {
  onVehicleRegister: (vehicleData: CreateVehicleData) => Promise<void>;
  isLoading?: boolean;
  onSkip?: () => void;
}

export const VehicleRegistrationForm: React.FC<VehicleRegistrationFormProps> = ({
  onVehicleRegister,
  isLoading = false,
  onSkip,
}) => {
  const [formData, setFormData] = useState<CreateVehicleData>({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    licensePlate: '',
    type: 'sedan',
    capacity: 4,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const vehicleTypes = [
    { value: 'sedan', label: 'Sedan', icon: 'drive-eta' },
    { value: 'suv', label: 'SUV', icon: 'local-shipping' },
    { value: 'hatchback', label: 'Hatchback', icon: 'drive-eta' },
    { value: 'coupe', label: 'Coupe', icon: 'drive-eta' },
    { value: 'truck', label: 'Truck', icon: 'local-shipping' },
    { value: 'van', label: 'Van', icon: 'airport-shuttle' },
    { value: 'motorcycle', label: 'Motorcycle', icon: 'motorcycle' },
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.make.trim()) {
      newErrors.make = 'Vehicle make is required';
    }

    if (!formData.model.trim()) {
      newErrors.model = 'Vehicle model is required';
    }

    if (formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
      newErrors.year = 'Invalid year';
    }

    if (!formData.color.trim()) {
      newErrors.color = 'Vehicle color is required';
    }

    if (!formData.licensePlate.trim()) {
      newErrors.licensePlate = 'License plate is required';
    }

    if (formData.capacity < 1 || formData.capacity > 15) {
      newErrors.capacity = 'Capacity must be between 1 and 15';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await onVehicleRegister(formData);
    } catch (error) {
      Alert.alert(
        'Registration Failed',
        error instanceof Error ? error.message : 'Failed to register vehicle'
      );
    }
  };

  const updateFormData = <K extends keyof CreateVehicleData>(field: K, value: CreateVehicleData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Register Your Vehicle</Text>
        <Text style={styles.subtitle}>
          Add your vehicle details to start offering rides
        </Text>
      </View>

      <View style={styles.form}>
        {/* Make */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Make *</Text>
          <TextInput
            style={[styles.input, !!errors.make && styles.inputError]}
            value={formData.make}
            onChangeText={(value) => updateFormData('make', value)}
            placeholder="e.g., Toyota, Honda, Ford"
            placeholderTextColor={colors.text.secondary}
          />
          {errors.make && <Text style={styles.errorText}>{errors.make}</Text>}
        </View>

        {/* Model */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Model *</Text>
          <TextInput
            style={[styles.input, !!errors.model && styles.inputError]}
            value={formData.model}
            onChangeText={(value) => updateFormData('model', value)}
            placeholder="e.g., Camry, Civic, Focus"
            placeholderTextColor={colors.text.secondary}
          />
          {errors.model && <Text style={styles.errorText}>{errors.model}</Text>}
        </View>

        {/* Year and Color Row */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Year *</Text>
            <TextInput
              style={[styles.input, !!errors.year && styles.inputError]}
              value={formData.year.toString()}
              onChangeText={(value) => {
                const yearValue = parseInt(value);
                updateFormData('year', isNaN(yearValue) ? new Date().getFullYear() : yearValue);
              }}
              placeholder="2020"
              placeholderTextColor={colors.text.secondary}
              keyboardType="numeric"
            />
            {errors.year && <Text style={styles.errorText}>{errors.year}</Text>}
          </View>

          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Color *</Text>
            <TextInput
              style={[styles.input, !!errors.color && styles.inputError]}
              value={formData.color}
              onChangeText={(value) => updateFormData('color', value)}
              placeholder="e.g., Blue, Red"
              placeholderTextColor={colors.text.secondary}
            />
            {errors.color && <Text style={styles.errorText}>{errors.color}</Text>}
          </View>
        </View>

        {/* License Plate */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>License Plate *</Text>
          <TextInput
            style={[styles.input, !!errors.licensePlate && styles.inputError]}
            value={formData.licensePlate}
            onChangeText={(value) => updateFormData('licensePlate', value.toUpperCase())}
            placeholder="ABC-123"
            placeholderTextColor={colors.text.secondary}
            autoCapitalize="characters"
          />
          {errors.licensePlate && <Text style={styles.errorText}>{errors.licensePlate}</Text>}
        </View>

        {/* Vehicle Type */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Vehicle Type *</Text>
          <View style={styles.typeSelector}>
            {vehicleTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeOption,
                  formData.type === type.value && styles.selectedType,
                ]}
                onPress={() => updateFormData('type', type.value as any)}
              >
                <Icon
                  name={type.icon}
                  size={24}
                  color={formData.type === type.value ? colors.primary : colors.text.secondary}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    formData.type === type.value && styles.selectedTypeLabel,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Capacity */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Passenger Capacity *</Text>
          <View style={styles.capacitySelector}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((capacity) => (
              <TouchableOpacity
                key={capacity}
                style={[
                  styles.capacityOption,
                  formData.capacity === capacity && styles.selectedCapacity,
                ]}
                onPress={() => updateFormData('capacity', capacity)}
              >
                <Text
                  style={[
                    styles.capacityText,
                    formData.capacity === capacity && styles.selectedCapacityText,
                  ]}
                >
                  {capacity}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.capacity && <Text style={styles.errorText}>{errors.capacity}</Text>}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.registerButton, isLoading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          <Text style={styles.registerButtonText}>
            {isLoading ? 'Registering...' : 'Register Vehicle'}
          </Text>
        </TouchableOpacity>

        {onSkip && (
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>Skip for Now</Text>
          </TouchableOpacity>
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
  header: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    paddingHorizontal: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.background.secondary,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  typeOption: {
    alignItems: 'center',
    padding: 12,
    margin: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.secondary,
    minWidth: 80,
  },
  selectedType: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  typeLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  selectedTypeLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  capacitySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  capacityOption: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.secondary,
  },
  selectedCapacity: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  capacityText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  selectedCapacityText: {
    color: colors.text.inverse,
  },
  footer: {
    padding: 24,
  },
  registerButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
});

export default VehicleRegistrationForm;