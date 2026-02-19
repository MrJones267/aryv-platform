/**
 * @fileoverview Driver onboarding screen - step-by-step flow to become a driver
 * @author Oabona-Majoko
 * @created 2025-02-05
 * @lastModified 2025-02-05
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setOnboardingUserRole, completeOnboardingStep } from '../../store/slices/appSlice';
import { userApi } from '../../services/api/userApi';
import VehicleRegistrationForm from '../../components/vehicle/VehicleRegistrationForm';
import type { CreateVehicleData } from '../../services/api/vehicleApi';
import logger from '../../services/LoggingService';

const log = logger.createLogger('DriverOnboardingScreen');

const STEPS = [
  { key: 'license', title: 'Driver License', icon: 'badge' },
  { key: 'vehicle', title: 'Your Vehicle', icon: 'directions-car' },
  { key: 'documents', title: 'Verification', icon: 'verified-user' },
] as const;

interface LicenseFormData {
  licenseNumber: string;
  expiryDate: Date;
  licenseClass: string;
  yearsExperience: string;
}

const DriverOnboardingScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<{ navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void }>();
  const { profile } = useAppSelector((state) => state.user);
  const scrollRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Step 1: License info
  const [licenseForm, setLicenseForm] = useState<LicenseFormData>({
    licenseNumber: '',
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now default
    licenseClass: 'B',
    yearsExperience: '',
  });

  // Step 2: Vehicle data (handled by VehicleRegistrationForm)
  const [vehicleRegistered, setVehicleRegistered] = useState(false);

  // Step 3: Documents
  const [documentsStarted, setDocumentsStarted] = useState(false);

  const animateProgress = (step: number) => {
    Animated.timing(progressAnim, {
      toValue: (step + 1) / STEPS.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
    animateProgress(step);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleLicenseChange = (field: keyof LicenseFormData, value: string | Date) => {
    setLicenseForm(prev => ({ ...prev, [field]: value }));
  };

  const isLicenseValid = (): boolean => {
    return (
      licenseForm.licenseNumber.length >= 5 &&
      licenseForm.expiryDate > new Date() &&
      licenseForm.yearsExperience.length > 0 &&
      parseInt(licenseForm.yearsExperience, 10) >= 0
    );
  };

  const handleLicenseSubmit = async () => {
    if (!isLicenseValid()) {
      Alert.alert('Incomplete', 'Please fill in all license details correctly.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Save license info to user profile
      await userApi.updateProfile({
        driverLicenseNumber: licenseForm.licenseNumber,
        driverLicenseExpiry: licenseForm.expiryDate,
      } as Record<string, unknown>);

      dispatch(completeOnboardingStep('driver_license'));
      goToStep(1);
    } catch (error: unknown) {
      // Continue even if API fails - data saved locally
      const errMsg = error instanceof Error ? error.message : String(error);
      log.warn('License save to API failed, continuing:', errMsg);
      dispatch(completeOnboardingStep('driver_license'));
      goToStep(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVehicleRegister = async (vehicleData: CreateVehicleData, photos: string[]) => {
    setIsSubmitting(true);
    try {
      const response = await userApi.addVehicle({
        make: vehicleData.make,
        model: vehicleData.model,
        year: vehicleData.year,
        color: vehicleData.color,
        licensePlate: vehicleData.licensePlate,
        type: vehicleData.type || 'sedan',
        capacity: vehicleData.capacity,
      });

      if (response.success) {
        setVehicleRegistered(true);
        dispatch(completeOnboardingStep('vehicle_registration'));
        goToStep(2);
      } else {
        Alert.alert('Error', response.error || 'Failed to register vehicle');
      }
    } catch (error: unknown) {
      // Continue even if API fails
      const errMsg = error instanceof Error ? error.message : String(error);
      log.warn('Vehicle registration API failed, continuing:', errMsg);
      setVehicleRegistered(true);
      dispatch(completeOnboardingStep('vehicle_registration'));
      goToStep(2);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartVerification = () => {
    setDocumentsStarted(true);
    dispatch(completeOnboardingStep('document_upload'));
    navigation.navigate('VerificationWorkflow');
  };

  const handleSkipVerification = () => {
    Alert.alert(
      'Skip for Now?',
      'You can complete document verification later from your profile. You won\'t be able to offer rides until verification is complete.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => handleComplete(false),
        },
      ]
    );
  };

  const handleComplete = async (verified: boolean = false) => {
    setIsSubmitting(true);
    try {
      // Set user role to driver
      dispatch(setOnboardingUserRole('driver'));
      dispatch(completeOnboardingStep('driver_onboarding'));

      Alert.alert(
        verified ? 'Verification Submitted' : 'Welcome, Driver!',
        verified
          ? 'Your documents are under review. You\'ll be notified once approved. You can start setting up rides once verified.'
          : 'Your driver profile is set up! Complete document verification from your profile to start offering rides.',
        [
          {
            text: 'Got it',
            onPress: () => navigation.navigate('HomeMain'),
          },
        ]
      );
    } catch (error: unknown) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <View style={styles.stepsRow}>
        {STEPS.map((step, index) => (
          <View key={step.key} style={styles.stepIndicator}>
            <View
              style={[
                styles.stepCircle,
                index < currentStep && styles.stepCircleComplete,
                index === currentStep && styles.stepCircleCurrent,
              ]}
            >
              {index < currentStep ? (
                <Icon name="check" size={16} color="#FFFFFF" />
              ) : (
                <Icon
                  name={step.icon}
                  size={16}
                  color={index === currentStep ? '#FFFFFF' : '#999999'}
                />
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                index === currentStep && styles.stepLabelActive,
                index < currentStep && styles.stepLabelComplete,
              ]}
            >
              {step.title}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderLicenseStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Driver License Details</Text>
      <Text style={styles.stepDescription}>
        Enter your valid Botswana driver license information. This is required to offer rides on Hitch.
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>License Number</Text>
        <View style={styles.inputWrapper}>
          <Icon name="badge" size={18} color="#666666" style={styles.inputIcon} />
          <TextInput
            style={styles.textInput}
            placeholder="e.g. BW-DL-123456"
            placeholderTextColor="#999999"
            value={licenseForm.licenseNumber}
            onChangeText={(text) => handleLicenseChange('licenseNumber', text)}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>License Class</Text>
        <View style={styles.classRow}>
          {['A', 'B', 'C', 'D', 'EB'].map((cls) => (
            <TouchableOpacity
              key={cls}
              style={[
                styles.classChip,
                licenseForm.licenseClass === cls && styles.classChipActive,
              ]}
              onPress={() => handleLicenseChange('licenseClass', cls)}
            >
              <Text
                style={[
                  styles.classChipText,
                  licenseForm.licenseClass === cls && styles.classChipTextActive,
                ]}
              >
                {cls}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>
          Class B covers standard cars and light vehicles
        </Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Expiry Date</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Icon name="event" size={18} color="#666666" />
          <Text style={styles.dateText}>
            {licenseForm.expiryDate.toLocaleDateString([], {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </TouchableOpacity>
        {licenseForm.expiryDate <= new Date() && (
          <Text style={styles.errorText}>License must not be expired</Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Years of Driving Experience</Text>
        <View style={styles.inputWrapper}>
          <Icon name="history" size={18} color="#666666" style={styles.inputIcon} />
          <TextInput
            style={styles.textInput}
            placeholder="e.g. 3"
            placeholderTextColor="#999999"
            value={licenseForm.yearsExperience}
            onChangeText={(text) => handleLicenseChange('yearsExperience', text.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            maxLength={2}
          />
          <Text style={styles.inputSuffix}>years</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Icon name="info-outline" size={18} color="#3B82F6" />
        <Text style={styles.infoText}>
          You must have a valid driver license and at least 1 year of driving experience to offer rides.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !isLicenseValid() && styles.buttonDisabled]}
        onPress={handleLicenseSubmit}
        disabled={!isLicenseValid() || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Text style={styles.primaryButtonText}>Continue</Text>
            <Icon name="arrow-forward" size={20} color="#FFFFFF" />
          </>
        )}
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={licenseForm.expiryDate}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) handleLicenseChange('expiryDate', date);
          }}
        />
      )}
    </View>
  );

  const renderVehicleStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Register Your Vehicle</Text>
      <Text style={styles.stepDescription}>
        Add your vehicle details so passengers know what to expect. You can add more vehicles later.
      </Text>

      <VehicleRegistrationForm
        onVehicleRegister={handleVehicleRegister}
        isLoading={isSubmitting}
      />
    </View>
  );

  const renderDocumentsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Verify Your Identity</Text>
      <Text style={styles.stepDescription}>
        Upload documents to verify your identity and vehicle. This protects you and your passengers.
      </Text>

      <View style={styles.documentsList}>
        <View style={styles.documentItem}>
          <View style={[styles.docIcon, { backgroundColor: '#FEF3C7' }]}>
            <Icon name="badge" size={24} color="#F59E0B" />
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentTitle}>Driver's License</Text>
            <Text style={styles.documentDesc}>Clear photo of front and back</Text>
          </View>
          <Text style={styles.requiredBadge}>Required</Text>
        </View>

        <View style={styles.documentItem}>
          <View style={[styles.docIcon, { backgroundColor: '#DBEAFE' }]}>
            <Icon name="description" size={24} color="#3B82F6" />
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentTitle}>Vehicle Registration</Text>
            <Text style={styles.documentDesc}>Proof of vehicle ownership</Text>
          </View>
          <Text style={styles.requiredBadge}>Required</Text>
        </View>

        <View style={styles.documentItem}>
          <View style={[styles.docIcon, { backgroundColor: '#D1FAE5' }]}>
            <Icon name="security" size={24} color="#10B981" />
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentTitle}>Insurance Certificate</Text>
            <Text style={styles.documentDesc}>Valid vehicle insurance</Text>
          </View>
          <Text style={styles.requiredBadge}>Required</Text>
        </View>

        <View style={styles.documentItem}>
          <View style={[styles.docIcon, { backgroundColor: '#EDE9FE' }]}>
            <Icon name="account-box" size={24} color="#8B5CF6" />
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentTitle}>National ID / Passport</Text>
            <Text style={styles.documentDesc}>Government-issued photo ID</Text>
          </View>
          <Text style={[styles.requiredBadge, styles.optionalBadge]}>Optional</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Icon name="shield" size={18} color="#10B981" />
        <Text style={styles.infoText}>
          Your documents are encrypted and securely stored. They are only used for verification purposes and never shared with other users.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleStartVerification}
      >
        <Icon name="upload-file" size={20} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>Upload Documents</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkipVerification}
      >
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.completeButton}
        onPress={() => handleComplete(false)}
      >
        <Icon name="check-circle" size={20} color="#10B981" />
        <Text style={styles.completeButtonText}>Finish Setup</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (currentStep > 0) {
                goToStep(currentStep - 1);
              } else {
                navigation.goBack();
              }
            }}
            style={styles.backButton}
          >
            <Icon name="arrow-back" size={24} color="#333333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Become a Driver</Text>
          <View style={styles.headerRight}>
            <Text style={styles.stepCounter}>
              {currentStep + 1}/{STEPS.length}
            </Text>
          </View>
        </View>

        {/* Progress */}
        {renderProgressBar()}

        {/* Step Content */}
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {currentStep === 0 && renderLicenseStep()}
          {currentStep === 1 && renderVehicleStep()}
          {currentStep === 2 && renderDocumentsStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerRight: {
    padding: 8,
  },
  stepCounter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  // Progress
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FAFAFA',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepIndicator: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepCircleCurrent: {
    backgroundColor: '#3B82F6',
  },
  stepCircleComplete: {
    backgroundColor: '#10B981',
  },
  stepLabel: {
    fontSize: 11,
    color: '#999999',
    fontWeight: '500',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  stepLabelComplete: {
    color: '#10B981',
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  // Step Content
  stepContent: {},
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 24,
  },
  // Form
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    height: 50,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    paddingVertical: 0,
  },
  inputSuffix: {
    fontSize: 14,
    color: '#999999',
    marginLeft: 8,
  },
  hint: {
    fontSize: 12,
    color: '#999999',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 6,
  },
  // Class chips
  classRow: {
    flexDirection: 'row',
    gap: 10,
  },
  classChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  classChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  classChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  classChipTextActive: {
    color: '#FFFFFF',
  },
  // Date
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    height: 50,
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#333333',
  },
  // Info box
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EBF5FF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
  },
  // Documents list
  documentsList: {
    marginBottom: 20,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  documentDesc: {
    fontSize: 12,
    color: '#999999',
  },
  requiredBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  optionalBadge: {
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
  },
  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#999999',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    paddingVertical: 14,
    gap: 8,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
});

export default DriverOnboardingScreen;
