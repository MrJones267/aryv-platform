/**
 * @fileoverview Package creation screen with multi-step form
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import PackageService, { PackageCreationData, PricingSuggestion } from '../../services/PackageService';
import LoadingScreen from '../../components/common/LoadingScreen';
import ImagePicker from '../../components/common/ImagePicker';
import DeliveryTierSelector from '../../components/courier/DeliveryTierSelector';
import LocationService from '../../services/LocationService';
import EscrowPaymentService from '../../services/EscrowPaymentService';
import { useAppDispatch } from '../../store/hooks';
import { createPackage as createPackageAction } from '../../store/slices/packageSlice';
import logger from '../../services/LoggingService';

const log = logger.createLogger('CreatePackageScreen');

interface PackageFormData {
  title: string;
  description: string;
  pickupAddress: string;
  dropoffAddress: string;
  senderPriceOffer: number;
  deliveryTierId?: string;
  requestedDeliveryTime?: Date;
  urgencyLevel?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  packageSize?: string;
  fragile?: boolean;
  valuable?: boolean;
  specialInstructions?: string;
  pickupContactName?: string;
  pickupContactPhone?: string;
  dropoffContactName?: string;
  dropoffContactPhone?: string;
  dimensionsLength?: number;
  dimensionsWidth?: number;
  dimensionsHeight?: number;
  weight?: number;
  images?: string[];
}

const CreatePackageScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedTierSuggestion, setSelectedTierSuggestion] = useState<PricingSuggestion | null>(null);
  const [formData, setFormData] = useState<PackageFormData>({
    title: '',
    description: '',
    packageSize: 'medium',
    fragile: false,
    valuable: false,
    specialInstructions: '',
    pickupAddress: '',
    pickupContactName: '',
    pickupContactPhone: '',
    dropoffAddress: '',
    dropoffContactName: '',
    dropoffContactPhone: '',
    senderPriceOffer: 0,
    dimensionsLength: undefined,
    dimensionsWidth: undefined,
    dimensionsHeight: undefined,
    weight: undefined,
  });

  const totalSteps = 5; // Added pricing step

  const updateFormData = (field: string, value: string | number | boolean | string[] | Date | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTierSelect = (tierId: string, suggestion: PricingSuggestion) => {
    setSelectedTierSuggestion(suggestion);
    setFormData(prev => ({
      ...prev,
      deliveryTierId: tierId,
      senderPriceOffer: suggestion.finalPrice,
    }));
  };

  const handlePriceChange = (price: number) => {
    setFormData(prev => ({
      ...prev,
      senderPriceOffer: price,
    }));
  };

  const getStepTitle = (step: number): string => {
    switch (step) {
      case 1: return 'Package Details';
      case 2: return 'Pickup & Delivery';
      case 3: return 'Additional Details';
      case 4: return 'Pricing & Delivery Speed';
      case 5: return 'Review & Submit';
      default: return 'Package Creation';
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.title && formData.description);
      case 2:
        return !!(formData.pickupAddress && formData.dropoffAddress);
      case 3:
        return true; // Optional details
      case 4:
        return !!(formData.senderPriceOffer); // Pricing step
      case 5:
        return true; // Review step
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      Alert.alert('Required Fields', 'Please fill in all required fields before continuing.');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      Alert.alert('Error', 'Please complete all required fields.');
      return;
    }

    setLoading(true);
    try {
      // Get real coordinates from geocoding service
      const [pickupCoordinates, dropoffCoordinates] = await Promise.all([
        LocationService.geocodeAddress(formData.pickupAddress),
        LocationService.geocodeAddress(formData.dropoffAddress),
      ]);
      
      if (!pickupCoordinates || !dropoffCoordinates) {
        throw new Error('Unable to find coordinates for provided addresses');
      }

      const packageData: PackageCreationData = {
        title: formData.title,
        description: formData.description || undefined,
        dimensionsLength: formData.dimensionsLength,
        dimensionsWidth: formData.dimensionsWidth,
        dimensionsHeight: formData.dimensionsHeight,
        weight: formData.weight,
        packageSize: formData.packageSize as PackageCreationData['packageSize'],
        fragile: formData.fragile || false,
        valuable: formData.valuable || false,
        specialInstructions: formData.specialInstructions || undefined,
        pickupAddress: formData.pickupAddress,
        pickupCoordinates,
        pickupContactName: formData.pickupContactName || undefined,
        pickupContactPhone: formData.pickupContactPhone || undefined,
        dropoffAddress: formData.dropoffAddress,
        dropoffCoordinates,
        dropoffContactName: formData.dropoffContactName || undefined,
        dropoffContactPhone: formData.dropoffContactPhone || undefined,
        senderPriceOffer: formData.senderPriceOffer,
        deliveryTierId: formData.deliveryTierId,
        requestedDeliveryTime: formData.requestedDeliveryTime?.toISOString(),
        urgencyLevel: formData.urgencyLevel,
      };

      // Create package through Redux action
      const response = await (dispatch(createPackageAction(packageData)) as unknown as Promise<{ type?: string; payload?: { id?: string }; error?: string }>);
      
      if (response.type?.endsWith('/fulfilled')) {
        // Create escrow transaction for the package
        if (response.payload?.id) {
          const escrowResult = await EscrowPaymentService.createEscrowTransaction({
            rideId: response.payload.id, // Use package ID as ride ID
            bookingId: `package_${response.payload.id}`,
            payeeId: '', // Will be set when courier accepts
            amount: formData.senderPriceOffer,
            paymentMethod: 'card', // Default payment method
            metadata: {
              rideDetails: { type: 'package_delivery', packageId: response.payload.id },
              autoReleaseHours: 24,
              requiresBothConfirmation: true,
            },
          });
          
          if (!escrowResult.success) {
            log.warn('Failed to create escrow transaction:', escrowResult.error);
          }
        }
        
        Alert.alert(
          'Success!',
          'Your package has been created and is now available for couriers.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to create package');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {Array.from({ length: totalSteps }, (_, index) => (
        <View key={index} style={styles.stepIndicatorContainer}>
          <View style={[
            styles.stepCircle,
            index + 1 <= currentStep && styles.activeStepCircle
          ]}>
            <Text style={[
              styles.stepNumber,
              index + 1 <= currentStep && styles.activeStepNumber
            ]}>
              {index + 1}
            </Text>
          </View>
          {index < totalSteps - 1 && (
            <View style={[
              styles.stepLine,
              index + 1 < currentStep && styles.activeStepLine
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Package Details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Package Title *</Text>
        <TextInput
          style={styles.input}
          value={formData.title}
          onChangeText={(value) => updateFormData('title', value)}
          placeholder="e.g., Documents, Electronics, Gift"
          placeholderTextColor={colors.text.secondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(value) => updateFormData('description', value)}
          placeholder="Describe your package contents..."
          placeholderTextColor={colors.text.secondary}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Package Size</Text>
        <View style={styles.sizeButtons}>
          {['small', 'medium', 'large', 'custom'].map((size) => (
            <TouchableOpacity
              key={size}
              style={[
                styles.sizeButton,
                formData.packageSize === size && styles.activeSizeButton
              ]}
              onPress={() => updateFormData('packageSize', size)}
            >
              <Text style={[
                styles.sizeButtonText,
                formData.packageSize === size && styles.activeSizeButtonText
              ]}>
                {size.charAt(0).toUpperCase() + size.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Offered Price *</Text>
        <View style={styles.priceInput}>
          <Text style={styles.currencySymbol}>P</Text>
          <TextInput
            style={styles.priceField}
            value={formData.senderPriceOffer.toString()}
            onChangeText={(value) => updateFormData('senderPriceOffer', parseFloat(value) || 0)}
            placeholder="0.00"
            placeholderTextColor={colors.text.secondary}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Pickup & Delivery</Text>
      
      <View style={styles.addressSection}>
        <View style={styles.addressHeader}>
          <Icon name="place" size={20} color={colors.primary} />
          <Text style={styles.addressTitle}>Pickup Location</Text>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address *</Text>
          <TextInput
            style={styles.input}
            value={formData.pickupAddress}
            onChangeText={(value) => updateFormData('pickupAddress', value)}
            placeholder="Enter pickup address..."
            placeholderTextColor={colors.text.secondary}
            multiline
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Contact Name</Text>
            <TextInput
              style={styles.input}
              value={formData.pickupContactName}
              onChangeText={(value) => updateFormData('pickupContactName', value)}
              placeholder="Contact person"
              placeholderTextColor={colors.text.secondary}
            />
          </View>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={formData.pickupContactPhone}
              onChangeText={(value) => updateFormData('pickupContactPhone', value)}
              placeholder="Phone number"
              placeholderTextColor={colors.text.secondary}
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </View>

      <View style={styles.addressSection}>
        <View style={styles.addressHeader}>
          <Icon name="flag" size={20} color={colors.success} />
          <Text style={styles.addressTitle}>Delivery Location</Text>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address *</Text>
          <TextInput
            style={styles.input}
            value={formData.dropoffAddress}
            onChangeText={(value) => updateFormData('dropoffAddress', value)}
            placeholder="Enter delivery address..."
            placeholderTextColor={colors.text.secondary}
            multiline
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Contact Name</Text>
            <TextInput
              style={styles.input}
              value={formData.dropoffContactName}
              onChangeText={(value) => updateFormData('dropoffContactName', value)}
              placeholder="Contact person"
              placeholderTextColor={colors.text.secondary}
            />
          </View>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={formData.dropoffContactPhone}
              onChangeText={(value) => updateFormData('dropoffContactPhone', value)}
              placeholder="Phone number"
              placeholderTextColor={colors.text.secondary}
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Additional Details</Text>
      
      <View style={styles.dimensionsSection}>
        <Text style={styles.sectionTitle}>Dimensions (cm)</Text>
        <View style={styles.dimensionsRow}>
          <View style={styles.dimensionInput}>
            <Text style={styles.dimensionLabel}>Length</Text>
            <TextInput
              style={styles.input}
              value={formData.dimensionsLength?.toString() || ''}
              onChangeText={(value) => updateFormData('dimensionsLength', value ? parseFloat(value) : undefined)}
              placeholder="0"
              placeholderTextColor={colors.text.secondary}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.dimensionInput}>
            <Text style={styles.dimensionLabel}>Width</Text>
            <TextInput
              style={styles.input}
              value={formData.dimensionsWidth?.toString() || ''}
              onChangeText={(value) => updateFormData('dimensionsWidth', value ? parseFloat(value) : undefined)}
              placeholder="0"
              placeholderTextColor={colors.text.secondary}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.dimensionInput}>
            <Text style={styles.dimensionLabel}>Height</Text>
            <TextInput
              style={styles.input}
              value={formData.dimensionsHeight?.toString() || ''}
              onChangeText={(value) => updateFormData('dimensionsHeight', value ? parseFloat(value) : undefined)}
              placeholder="0"
              placeholderTextColor={colors.text.secondary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Weight (kg)</Text>
        <TextInput
          style={styles.input}
          value={formData.weight?.toString() || ''}
          onChangeText={(value) => updateFormData('weight', value ? parseFloat(value) : undefined)}
          placeholder="0.0"
          placeholderTextColor={colors.text.secondary}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.switchGroup}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Fragile Item</Text>
            <Text style={styles.switchDescription}>Requires careful handling</Text>
          </View>
          <Switch
            value={formData.fragile}
            onValueChange={(value) => updateFormData('fragile', value)}
            trackColor={{ false: colors.border.light, true: colors.warning }}
            thumbColor={formData.fragile ? colors.text.inverse : colors.text.secondary}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Valuable Item</Text>
            <Text style={styles.switchDescription}>High-value package</Text>
          </View>
          <Switch
            value={formData.valuable}
            onValueChange={(value) => updateFormData('valuable', value)}
            trackColor={{ false: colors.border.light, true: colors.primary }}
            thumbColor={formData.valuable ? colors.text.inverse : colors.text.secondary}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Special Instructions</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.specialInstructions}
          onChangeText={(value) => updateFormData('specialInstructions', value)}
          placeholder="Any special handling instructions..."
          placeholderTextColor={colors.text.secondary}
          multiline
          numberOfLines={3}
        />
      </View>

      <ImagePicker
        onImagesSelected={(images) => updateFormData('images', images)}
        maxImages={5}
        existingImages={formData.images || []}
        placeholder="Add photos to help couriers identify your package"
      />
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Pricing & Delivery Speed</Text>
      <Text style={styles.stepSubtitle}>
        Choose your delivery speed and pricing. You can select a tier or set your own price.
      </Text>

      <DeliveryTierSelector
        pickupCoordinates={undefined}
        dropoffCoordinates={undefined}
        packageSize={formData.packageSize as 'small' | 'medium' | 'large' | 'custom'}
        fragile={formData.fragile}
        valuable={formData.valuable}
        requestedDeliveryTime={formData.requestedDeliveryTime}
        selectedTierId={formData.deliveryTierId}
        selectedPrice={formData.senderPriceOffer}
        onTierSelect={handleTierSelect}
        onPriceChange={handlePriceChange}
      />

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Your Price Offer *</Text>
        <TextInput
          style={styles.input}
          value={formData.senderPriceOffer.toString()}
          onChangeText={(value) => updateFormData('senderPriceOffer', parseFloat(value) || 0)}
          placeholder="0.00"
          placeholderTextColor={colors.text.secondary}
          keyboardType="decimal-pad"
        />
        <Text style={styles.label}>
          You can modify the suggested price or set your own amount
        </Text>
      </View>

      {selectedTierSuggestion && (
        <View style={styles.tierSummary}>
          <Text style={styles.tierSummaryTitle}>Selected: {selectedTierSuggestion.tierType}</Text>
          <View style={styles.tierSummaryRow}>
            <Text style={styles.tierSummaryLabel}>Estimated delivery:</Text>
            <Text style={styles.tierSummaryValue}>{selectedTierSuggestion.estimatedDeliveryTime}</Text>
          </View>
          <View style={styles.tierSummaryRow}>
            <Text style={styles.tierSummaryLabel}>Demand level:</Text>
            <Text style={[
              styles.tierSummaryValue,
              { color: selectedTierSuggestion.demandLevel === 'HIGH' || selectedTierSuggestion.demandLevel === 'SURGE' 
                ? colors.warning : colors.text.primary }
            ]}>
              {selectedTierSuggestion.demandLevel}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Review & Submit</Text>
      <Text style={styles.stepSubtitle}>
        Please review your package details before submitting.
      </Text>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Package Information</Text>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Title:</Text>
          <Text style={styles.reviewValue}>{formData.title}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Description:</Text>
          <Text style={styles.reviewValue}>{formData.description}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Size:</Text>
          <Text style={styles.reviewValue}>{formData.packageSize}</Text>
        </View>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Pickup & Delivery</Text>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>From:</Text>
          <Text style={styles.reviewValue}>{formData.pickupAddress}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>To:</Text>
          <Text style={styles.reviewValue}>{formData.dropoffAddress}</Text>
        </View>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Pricing</Text>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Your Offer:</Text>
          <Text style={[styles.reviewValue, styles.priceValue]}>
            P{formData.senderPriceOffer}
          </Text>
        </View>
        {selectedTierSuggestion && (
          <View style={styles.reviewItem}>
            <Text style={styles.reviewLabel}>Delivery Tier:</Text>
            <Text style={styles.reviewValue}>
              {selectedTierSuggestion.tierType} ({selectedTierSuggestion.estimatedDeliveryTime})
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep5(); // Fixed: Step 4 should be Pricing
      case 5:
        return renderStep6(); // Fixed: Step 5 should be Review
      default:
        return null;
    }
  };

  if (loading) {
    return <LoadingScreen message="Creating your package..." />;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Package</Text>
        <View style={{ width: 24 }} />
      </View>

      {renderStepIndicator()}

      <ScrollView ref={scrollViewRef} style={styles.content}>
        {renderStepContent()}
      </ScrollView>

      <View style={styles.footer}>
        {currentStep > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={prevStep}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.nextButton, currentStep === 1 && { flex: 1 }]}
          onPress={currentStep === totalSteps ? handleSubmit : nextStep}
        >
          <Text style={styles.nextButtonText}>
            {currentStep === totalSteps ? 'Create Package' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: colors.background.secondary,
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeStepCircle: {
    backgroundColor: colors.primary,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text.secondary,
  },
  activeStepNumber: {
    color: colors.text.inverse,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border.light,
    marginHorizontal: 8,
  },
  activeStepLine: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stepContainer: {
    paddingVertical: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.background.secondary,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  sizeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sizeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  activeSizeButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  sizeButtonText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  activeSizeButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    paddingLeft: 12,
  },
  priceField: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  addressSection: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginLeft: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    flex: 0.48,
  },
  dimensionsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  dimensionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dimensionInput: {
    flex: 0.3,
  },
  dimensionLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  switchGroup: {
    marginVertical: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    marginBottom: 8,
  },
  switchInfo: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  switchDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  reviewSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
  },
  reviewSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 12,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
  },
  reviewValue: {
    fontSize: 14,
    color: colors.text.primary,
    flex: 2,
    textAlign: 'right',
  },
  reviewTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  reviewTagText: {
    fontSize: 12,
    color: colors.warning,
    marginLeft: 4,
  },
  reviewImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  reviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  moreImagesIndicator: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  moreImagesText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.secondary,
  },
  backButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  nextButton: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  stepSubtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: 16,
    lineHeight: 22,
  },
  tierSummary: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  tierSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  tierSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tierSummaryLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  tierSummaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
  },
});

export default CreatePackageScreen;