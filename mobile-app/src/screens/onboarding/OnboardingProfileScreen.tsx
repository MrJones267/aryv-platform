/**
 * @fileoverview Onboarding profile setup screen
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { Button, Input, Card, Avatar } from '../../components/ui';
import PhoneInput from '../../components/ui/PhoneInput';
import { updateUserProfile } from '../../store/slices/userSlice';
import { updateOnboardingProgress, completeOnboardingStep } from '../../store/slices/appSlice';
/** Lightweight country shape matching what PhoneInput emits */
interface PhoneCountry {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

interface OnboardingProfileScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  phone: string;
  bio: string;
  interests: string[];
  vehicleInfo?: {
    make: string;
    model: string;
    year: string;
    color: string;
    licensePlate: string;
  };
  driverLicense?: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
}

const OnboardingProfileScreen: React.FC<OnboardingProfileScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { profile: user } = useAppSelector((state) => state.user);
  const { onboardingProgress } = useAppSelector((state) => state.app);
  const selectedRole = onboardingProgress.userRole || 'passenger';
  
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    bio: '',
    interests: [],
    emergencyContact: {
      name: '',
      phone: '',
      relationship: '',
    },
  });
  
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry | null>(null);

  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);

  const availableInterests = [
    'Music', 'Sports', 'Travel', 'Technology', 'Food', 'Movies',
    'Books', 'Fitness', 'Art', 'Photography', 'Gaming', 'Outdoor Activities'
  ];

  useEffect(() => {
    validateForm();
  }, [formData]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    // Phone validation (simplified since PhoneInput handles country code)
    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (formData.phone.replace(/\s/g, '').length < 6) {
      newErrors.phone = 'Phone number must be at least 6 digits';
    } else if (!/^\d+$/.test(formData.phone.replace(/[\s\-]/g, ''))) {
      newErrors.phone = 'Phone number can only contain digits, spaces, and dashes';
    }

    if (formData.bio.length > 500) {
      newErrors.bio = 'Bio must be less than 500 characters';
    }

    if (showVehicleForm && formData.vehicleInfo) {
      if (!formData.vehicleInfo.make.trim()) {
        newErrors.vehicleMake = 'Vehicle make is required';
      }
      if (!formData.vehicleInfo.model.trim()) {
        newErrors.vehicleModel = 'Vehicle model is required';
      }
      if (!formData.vehicleInfo.year.trim()) {
        newErrors.vehicleYear = 'Vehicle year is required';
      } else if (!/^\d{4}$/.test(formData.vehicleInfo.year)) {
        newErrors.vehicleYear = 'Invalid year format';
      }
      if (!formData.vehicleInfo.color.trim()) {
        newErrors.vehicleColor = 'Vehicle color is required';
      }
      if (!formData.vehicleInfo.licensePlate.trim()) {
        newErrors.licensePlate = 'License plate is required';
      }
    }

    setErrors(newErrors);
  };

  const isFormValid = () => {
    return Object.keys(errors).length === 0 && 
           formData.firstName.trim() && 
           formData.lastName.trim() && 
           formData.phone.trim();
  };

  const handleInputChange = (field: keyof ProfileFormData, value: string | number | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVehicleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      vehicleInfo: {
        ...prev.vehicleInfo!,
        [field]: value,
      },
    }));
  };

  const handleEmergencyContactChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      emergencyContact: {
        ...prev.emergencyContact,
        [field]: value,
      },
    }));
  };

  const handleInterestToggle = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const handleAddVehicle = () => {
    if (!showVehicleForm) {
      setFormData(prev => ({
        ...prev,
        vehicleInfo: {
          make: '',
          model: '',
          year: '',
          color: '',
          licensePlate: '',
        },
      }));
    }
    setShowVehicleForm(!showVehicleForm);
  };

  const handleCountryChange = (country: PhoneCountry) => {
    setSelectedCountry(country);
    // Clear phone field when country changes to allow fresh input
    setFormData(prev => ({ ...prev, phone: '' }));
  };

  const handleCompleteProfile = async () => {
    if (!isFormValid()) {
      Alert.alert('Form Error', 'Please fix all errors before continuing');
      return;
    }

    setIsUpdating(true);
    try {
      await dispatch(updateUserProfile({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        bio: formData.bio.trim(),
      } as import('../../types/user').UpdateProfileData)).unwrap();

      // Update onboarding progress
      dispatch(updateOnboardingProgress({
        profileCompleted: true,
        currentStep: 'feature_tutorial',
      }));
      dispatch(completeOnboardingStep('profile_setup'));

      // Navigate to feature tutorial after profile completion
      navigation.navigate('FeatureTutorial', {
        userRole: selectedRole,
        skipToFeatures: false,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errMsg || 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Profile Setup?',
      'You can complete your profile later in the settings. Some features may be limited without a complete profile.',
      [
        { text: 'Go Back', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => {
            dispatch(updateOnboardingProgress({
              profileCompleted: false,
              currentStep: 'feature_tutorial',
            }));
            dispatch(completeOnboardingStep('profile_skipped'));
            
            navigation.navigate('FeatureTutorial', {
              userRole: selectedRole,
              skipToFeatures: true,
            });
          }
        },
      ]
    );
  };

  const renderBasicInfoSection = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Basic Information</Text>
      
      <View style={styles.avatarSection}>
        <Avatar
          size="large"
          name={`${formData.firstName} ${formData.lastName}`}
          backgroundColor="#2196F3"
        />
        <TouchableOpacity style={styles.changePhotoButton}>
          <Icon name="camera-alt" size={16} color="#2196F3" />
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.nameRow}>
        <Input
          label="First Name"
          placeholder="John"
          value={formData.firstName}
          onChangeText={(text) => handleInputChange('firstName', text)}
          error={errors.firstName}
          containerStyle={styles.nameInput}
          required
        />
        <Input
          label="Last Name"
          placeholder="Doe"
          value={formData.lastName}
          onChangeText={(text) => handleInputChange('lastName', text)}
          error={errors.lastName}
          containerStyle={styles.nameInput}
          required
        />
      </View>

      <PhoneInput
        value={formData.phone}
        onChangeText={(text) => handleInputChange('phone', text)}
        onCountryChange={handleCountryChange}
        label="Phone Number"
        placeholder="Enter phone number"
        error={errors.phone}
        defaultCountry="BW"
      />

      <Input
        label="Bio (Optional)"
        placeholder="Tell others about yourself..."
        value={formData.bio}
        onChangeText={(text) => handleInputChange('bio', text)}
        multiline
        numberOfLines={3}
        maxLength={500}
        error={errors.bio}
      />
      <Text style={styles.characterCount}>{formData.bio.length}/500</Text>
    </Card>
  );

  const renderInterestsSection = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Interests (Optional)</Text>
      <Text style={styles.sectionSubtitle}>
        Select your interests to connect with like-minded people
      </Text>
      
      <View style={styles.interestsGrid}>
        {availableInterests.map((interest) => (
          <TouchableOpacity
            key={interest}
            style={[
              styles.interestChip,
              formData.interests.includes(interest) && styles.interestChipSelected,
            ]}
            onPress={() => handleInterestToggle(interest)}
          >
            <Text style={[
              styles.interestText,
              formData.interests.includes(interest) && styles.interestTextSelected,
            ]}>
              {interest}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );

  const renderVehicleSection = () => (
    <Card style={styles.section}>
      <View style={styles.vehicleHeader}>
        <Text style={styles.sectionTitle}>Vehicle Information</Text>
        <Text style={styles.sectionSubtitle}>
          Add your vehicle to offer rides to others
        </Text>
      </View>

      <Button
        title={showVehicleForm ? 'Remove Vehicle' : 'Add Vehicle'}
        onPress={handleAddVehicle}
        variant={showVehicleForm ? 'outline' : 'primary'}
        size="medium"
        icon={showVehicleForm ? 'remove' : 'directions-car'}
        style={styles.addVehicleButton}
      />

      {showVehicleForm && formData.vehicleInfo && (
        <View style={styles.vehicleForm}>
          <View style={styles.vehicleRow}>
            <Input
              label="Make"
              placeholder="Toyota"
              value={formData.vehicleInfo.make}
              onChangeText={(text) => handleVehicleInputChange('make', text)}
              error={errors.vehicleMake}
              containerStyle={styles.vehicleInput}
            />
            <Input
              label="Model"
              placeholder="Camry"
              value={formData.vehicleInfo.model}
              onChangeText={(text) => handleVehicleInputChange('model', text)}
              error={errors.vehicleModel}
              containerStyle={styles.vehicleInput}
            />
          </View>

          <View style={styles.vehicleRow}>
            <Input
              label="Year"
              placeholder="2020"
              value={formData.vehicleInfo.year}
              onChangeText={(text) => handleVehicleInputChange('year', text)}
              keyboardType="numeric"
              maxLength={4}
              error={errors.vehicleYear}
              containerStyle={styles.vehicleInput}
            />
            <Input
              label="Color"
              placeholder="Silver"
              value={formData.vehicleInfo.color}
              onChangeText={(text) => handleVehicleInputChange('color', text)}
              error={errors.vehicleColor}
              containerStyle={styles.vehicleInput}
            />
          </View>

          <Input
            label="License Plate"
            placeholder="ABC123"
            value={formData.vehicleInfo.licensePlate}
            onChangeText={(text) => handleVehicleInputChange('licensePlate', text.toUpperCase())}
            autoCapitalize="characters"
            error={errors.licensePlate}
          />
        </View>
      )}
    </Card>
  );

  const renderEmergencyContactSection = () => (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Emergency Contact (Optional)</Text>
      <Text style={styles.sectionSubtitle}>
        For your safety, we recommend adding an emergency contact
      </Text>

      <Input
        label="Contact Name"
        placeholder="Jane Doe"
        value={formData.emergencyContact.name}
        onChangeText={(text) => handleEmergencyContactChange('name', text)}
        leftIcon="person"
      />

      <Input
        label="Phone Number"
        placeholder="+1 (555) 987-6543"
        value={formData.emergencyContact.phone}
        onChangeText={(text) => handleEmergencyContactChange('phone', text)}
        keyboardType="phone-pad"
        leftIcon="phone"
      />

      <Input
        label="Relationship"
        placeholder="Sister, Friend, etc."
        value={formData.emergencyContact.relationship}
        onChangeText={(text) => handleEmergencyContactChange('relationship', text)}
        leftIcon="family-restroom"
      />
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Help others get to know you better and build trust in the community
            </Text>
          </View>

          {renderBasicInfoSection()}
          {renderInterestsSection()}
          {renderVehicleSection()}
          {renderEmergencyContactSection()}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={isUpdating ? 'Completing...' : 'Complete Profile'}
          onPress={handleCompleteProfile}
          disabled={!isFormValid() || isUpdating}
          loading={isUpdating}
          variant="primary"
          size="large"
          icon="check-circle"
          fullWidth
          style={styles.completeButton}
        />
        
        <Button
          title="Skip for now"
          onPress={handleSkip}
          variant="ghost"
          size="medium"
          style={styles.skipButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    lineHeight: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  changePhotoText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  nameInput: {
    flex: 1,
    marginBottom: 0,
  },
  characterCount: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'right',
    marginTop: 4,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  interestChipSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  interestText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  interestTextSelected: {
    color: '#FFFFFF',
  },
  vehicleHeader: {
    marginBottom: 16,
  },
  addVehicleButton: {
    marginBottom: 16,
  },
  vehicleForm: {
    gap: 16,
  },
  vehicleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleInput: {
    flex: 1,
    marginBottom: 0,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 8,
  },
  completeButton: {
    marginBottom: 8,
  },
  skipButton: {
    alignSelf: 'center',
  },
});

export default OnboardingProfileScreen;