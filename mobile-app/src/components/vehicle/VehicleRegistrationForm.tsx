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
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchCamera, launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import { colors } from '../../theme';
import { CreateVehicleData } from '../../services/api/vehicleApi';

interface VehicleRegistrationFormProps {
  onVehicleRegister: (vehicleData: CreateVehicleData, photos: string[]) => Promise<void>;
  isLoading?: boolean;
  onSkip?: () => void;
}

const MAX_PHOTOS = 5;

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
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

  const handlePhotoResponse = (response: ImagePickerResponse) => {
    if (response.didCancel || response.errorCode) return;
    const asset = response.assets?.[0];
    if (asset?.uri) {
      setPhotos(prev => [...prev, asset.uri!]);
    }
  };

  const handleAddPhoto = () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }

    Alert.alert('Add Vehicle Photo', 'Choose a source', [
      {
        text: 'Camera',
        onPress: () => {
          launchCamera(
            { mediaType: 'photo', quality: 0.8, maxWidth: 1200, maxHeight: 1200 },
            handlePhotoResponse
          );
        },
      },
      {
        text: 'Gallery',
        onPress: () => {
          launchImageLibrary(
            { mediaType: 'photo', quality: 0.8, maxWidth: 1200, maxHeight: 1200 },
            handlePhotoResponse
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await onVehicleRegister(formData, photos);
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
                onPress={() => updateFormData('type', type.value as CreateVehicleData['type'])}
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

        {/* Vehicle Photos */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Vehicle Photos</Text>
          <Text style={styles.photoHint}>
            Add up to {MAX_PHOTOS} photos of your vehicle. Clear photos help passengers recognise your car.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoRow}
          >
            {photos.map((uri, index) => (
              <View key={index} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photoThumb} />
                <TouchableOpacity
                  style={styles.photoRemoveBtn}
                  onPress={() => handleRemovePhoto(index)}
                >
                  <Icon name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <TouchableOpacity
                style={styles.addPhotoBtn}
                onPress={handleAddPhoto}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Icon name="add-a-photo" size={28} color={colors.primary} />
                    <Text style={styles.addPhotoText}>Add Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
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
  photoHint: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  photoRow: {
    gap: 10,
    paddingVertical: 4,
  },
  photoWrap: {
    position: 'relative',
  },
  photoThumb: {
    width: 100,
    height: 75,
    borderRadius: 10,
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBtn: {
    width: 100,
    height: 75,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary + '08',
  },
  addPhotoText: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default VehicleRegistrationForm;