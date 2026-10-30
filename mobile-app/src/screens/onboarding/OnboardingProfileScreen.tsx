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
import type { TranslationKey } from '../../i18n/translations';
import { useI18n } from '../../i18n/I18nContext';
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

// Interests are saved in English; only what is shown is translated.
const INTEREST_LABELS: Record<string, TranslationKey> = {
  'Music': 'interest.music',
  'Sports': 'interest.sports',
  'Travel': 'interest.travel',
  'Technology': 'interest.technology',
  'Food': 'interest.food',
  'Movies': 'interest.movies',
  'Books': 'interest.books',
  'Fitness': 'interest.fitness',
  'Art': 'interest.art',
  'Photography': 'interest.photography',
  'Gaming': 'interest.gaming',
  'Outdoor Activities': 'interest.outdoorActivities',
};

const OnboardingProfileScreen: React.FC<OnboardingProfileScreenProps> = ({ navigation }) => {
  const { t } = useI18n();
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
      newErrors.firstName = t('register.firstNameRequired');
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = t('register.lastNameRequired');
    }

    // Phone validation (simplified since PhoneInput handles country code)
    if (!formData.phone) {
      newErrors.phone = t('register.phoneRequired');
    } else if (formData.phone.replace(/\s/g, '').length < 6) {
      newErrors.phone = t('register.phoneShort');
    } else if (!/^\d+$/.test(formData.phone.replace(/[\s\-]/g, ''))) {
      newErrors.phone = t('register.phoneDigits');
    }

    if (formData.bio.length > 500) {
      newErrors.bio = t('rf.bioMustBeLessThan');
    }

    if (showVehicleForm && formData.vehicleInfo) {
      if (!formData.vehicleInfo.make.trim()) {
        newErrors.vehicleMake = t('rf.vehicleMakeIsRequired');
      }
      if (!formData.vehicleInfo.model.trim()) {
        newErrors.vehicleModel = t('rf.vehicleModelIsRequired');
      }
      if (!formData.vehicleInfo.year.trim()) {
        newErrors.vehicleYear = t('rf.vehicleYearIsRequired');
      } else if (!/^\d{4}$/.test(formData.vehicleInfo.year)) {
        newErrors.vehicleYear = t('rf.invalidYearFormat');
      }
      if (!formData.vehicleInfo.color.trim()) {
        newErrors.vehicleColor = t('rf.vehicleColorIsRequired');
      }
      if (!formData.vehicleInfo.licensePlate.trim()) {
        newErrors.licensePlate = t('rf.licensePlateIsRequired');
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
      Alert.alert(t('rf.formError'), t('rf.pleaseFixAllErrorsBefore2'));
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
      Alert.alert(t('common.error'), errMsg || t('rf.failedToUpdateProfile'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      t('rf.skipProfileSetup'),
      t('rf.youCanCompleteYourProfile'),
      [
        { text: t('rideDetails.goBack'), style: 'cancel' },
        { 
          text: t('common.skip'), 
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
      <Text style={styles.sectionTitle}>{t('rf.basicInformation')}</Text>
      
      <View style={styles.avatarSection}>
        <Avatar
          size="large"
          name={`${formData.firstName} ${formData.lastName}`}
          backgroundColor="#2196F3"
        />
        <TouchableOpacity style={styles.changePhotoButton}>
          <Icon name="camera-alt" size={16} color="#2196F3" />
          <Text style={styles.changePhotoText}>{t('rf.changePhoto')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.nameRow}>
        <Input
          label={t('register.firstName')}
          placeholder={t('rf.john')}
          value={formData.firstName}
          onChangeText={(text) => handleInputChange('firstName', text)}
          error={errors.firstName}
          containerStyle={styles.nameInput}
          required
        />
        <Input
          label={t('register.lastName')}
          placeholder={t('rf.doe')}
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
        label={t('rf.phoneNumber')}
        placeholder={t('rf.enterPhoneNumber')}
        error={errors.phone}
        defaultCountry="BW"
      />

      <Input
        label={t('rf.bioOptional')}
        placeholder={t('rf.tellOthersAboutYourself')}
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
      <Text style={styles.sectionTitle}>{t('rf.interestsOptional')}</Text>
      <Text style={styles.sectionSubtitle}>
        {t('rf.selectYourInterestsToConnect')}
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
              {INTEREST_LABELS[interest] ? t(INTEREST_LABELS[interest]!) : interest}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );

  const renderVehicleSection = () => (
    <Card style={styles.section}>
      <View style={styles.vehicleHeader}>
        <Text style={styles.sectionTitle}>{t('rf.vehicleInformation')}</Text>
        <Text style={styles.sectionSubtitle}>
          {t('rf.addYourVehicleToOffer')}
        </Text>
      </View>

      <Button
        title={showVehicleForm ? t('rf.removeVehicle') : t('profile.addVehicle')}
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
              label={t('rf.make')}
              placeholder={t('rf.toyota')}
              value={formData.vehicleInfo.make}
              onChangeText={(text) => handleVehicleInputChange('make', text)}
              error={errors.vehicleMake}
              containerStyle={styles.vehicleInput}
            />
            <Input
              label={t('rf.model')}
              placeholder={t('rf.camry')}
              value={formData.vehicleInfo.model}
              onChangeText={(text) => handleVehicleInputChange('model', text)}
              error={errors.vehicleModel}
              containerStyle={styles.vehicleInput}
            />
          </View>

          <View style={styles.vehicleRow}>
            <Input
              label={t('rf.year')}
              placeholder="2020"
              value={formData.vehicleInfo.year}
              onChangeText={(text) => handleVehicleInputChange('year', text)}
              keyboardType="numeric"
              maxLength={4}
              error={errors.vehicleYear}
              containerStyle={styles.vehicleInput}
            />
            <Input
              label={t('rf.color')}
              placeholder={t('rf.silver')}
              value={formData.vehicleInfo.color}
              onChangeText={(text) => handleVehicleInputChange('color', text)}
              error={errors.vehicleColor}
              containerStyle={styles.vehicleInput}
            />
          </View>

          <Input
            label={t('rf.licensePlate')}
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
      <Text style={styles.sectionTitle}>{t('rf.emergencyContactOptional')}</Text>
      <Text style={styles.sectionSubtitle}>
        {t('rf.forYourSafetyWeRecommend')}
      </Text>

      <Input
        label={t('cf.contactName')}
        placeholder={t('rf.janeDoe')}
        value={formData.emergencyContact.name}
        onChangeText={(text) => handleEmergencyContactChange('name', text)}
        leftIcon="person"
      />

      <Input
        label={t('rf.phoneNumber')}
        placeholder="+1 (555) 987-6543"
        value={formData.emergencyContact.phone}
        onChangeText={(text) => handleEmergencyContactChange('phone', text)}
        keyboardType="phone-pad"
        leftIcon="phone"
      />

      <Input
        label={t('rf.relationship')}
        placeholder={t('rf.sisterFriendEtc')}
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
            <Text style={styles.title}>{t('rf.completeYourProfile')}</Text>
            <Text style={styles.subtitle}>
              {t('rf.helpOthersGetToKnow')}
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
          title={isUpdating ? 'Completing...' : t('rf.completeProfile')}
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
          title={t('verify.skipForNow')}
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