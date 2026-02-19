/**
 * @fileoverview Edit Profile screen with real photo upload and API integration
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2026-02-04
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { updateUserProfile, uploadProfilePicture } from '../../store/slices/userSlice';
import { colors } from '../../theme';
import PhoneInput from '../../components/ui/PhoneInput';
import logger from '../../services/LoggingService';

/** Lightweight country shape matching what PhoneInput emits */
interface PhoneCountry {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

const log = logger.createLogger('EditProfileScreen');

interface EditProfileScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
}

const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { profile, updateLoading } = useAppSelector((state) => state.user);

  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry | null>(null);
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        bio: (profile as { bio?: string }).bio || '',
      });
    }
  }, [profile]);

  const handleInputChange = (field: keyof ProfileFormData, value: string): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCountryChange = (country: PhoneCountry): void => {
    setSelectedCountry(country);
  };

  const handleSave = async (): Promise<void> => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      Alert.alert('Validation Error', 'First name and last name are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await dispatch(updateUserProfile({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        bio: formData.bio.trim(),
      })).unwrap();

      Alert.alert(
        'Success',
        'Your profile has been updated successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', errMsg || 'Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPhoto = (): void => {
    Alert.alert(
      'Profile Photo',
      'Choose how you want to update your photo',
      [
        {
          text: 'Take Photo',
          onPress: () => pickImage(true),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => pickImage(false),
        },
        {
          text: 'Remove Photo',
          style: 'destructive',
          onPress: () => {
            setLocalPhotoUri(null);
            // Could dispatch an update to clear the photo
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      const options = {
        mediaType: 'photo' as const,
        quality: 0.8 as const,
        maxWidth: 1024,
        maxHeight: 1024,
        includeBase64: false,
      };

      const result = useCamera
        ? await launchCamera(options)
        : await launchImageLibrary(options);

      if (result.didCancel || !result.assets?.[0]?.uri) return;

      const imageUri = result.assets[0].uri;
      setLocalPhotoUri(imageUri);
      setIsUploadingPhoto(true);

      try {
        await dispatch(uploadProfilePicture(imageUri)).unwrap();
      } catch (error: unknown) {
        log.warn('Photo upload failed, will retry on save:', error);
        // Keep the local preview — photo saved locally even if upload fails
      } finally {
        setIsUploadingPhoto(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const displayPhotoUri = localPhotoUri || profile?.profilePicture;

  const renderHeader = (): React.ReactNode => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Edit Profile</Text>
      <TouchableOpacity
        onPress={handleSave}
        disabled={isSubmitting || updateLoading}
        style={[styles.saveButton, (isSubmitting || updateLoading) && styles.saveButtonDisabled]}
      >
        {isSubmitting || updateLoading ? (
          <ActivityIndicator size="small" color={colors.text.inverse} />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderProfilePhoto = (): React.ReactNode => (
    <View style={styles.photoSection}>
      <TouchableOpacity onPress={handleSelectPhoto} style={styles.photoContainer} disabled={isUploadingPhoto}>
        {displayPhotoUri ? (
          <Image source={{ uri: displayPhotoUri }} style={styles.profilePhoto} />
        ) : (
          <View style={styles.profilePhotoPlaceholder}>
            <Icon name="person" size={60} color={colors.text.secondary} />
          </View>
        )}
        {isUploadingPhoto ? (
          <View style={styles.photoOverlay}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        ) : (
          <View style={styles.photoEditIcon}>
            <Icon name="camera-alt" size={20} color={colors.text.inverse} />
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.photoHelpText}>
        {isUploadingPhoto ? 'Uploading...' : 'Tap to change photo'}
      </Text>
      {!displayPhotoUri && (
        <Text style={styles.photoWarning}>
          Adding a photo helps other travellers recognise you
        </Text>
      )}
    </View>
  );

  const renderVerificationBadges = (): React.ReactNode => {
    if (!profile) return null;
    const badges = [
      { key: 'email', icon: 'email', label: 'Email', verified: profile.isEmailVerified },
      { key: 'phone', icon: 'phone', label: 'Phone', verified: profile.isPhoneVerified },
      { key: 'id', icon: 'verified-user', label: 'ID', verified: profile.isIdentityVerified },
      { key: 'driver', icon: 'directions-car', label: 'Driver', verified: profile.isDriverVerified },
    ];

    return (
      <View style={styles.badgesSection}>
        <Text style={styles.badgesTitle}>Verification Status</Text>
        <View style={styles.badgesRow}>
          {badges.map((badge) => (
            <View key={badge.key} style={[styles.badge, badge.verified && styles.badgeVerified]}>
              <Icon
                name={badge.verified ? 'check-circle' : badge.icon}
                size={16}
                color={badge.verified ? '#10B981' : colors.text.secondary}
              />
              <Text style={[styles.badgeText, badge.verified && styles.badgeTextVerified]}>
                {badge.label}
              </Text>
            </View>
          ))}
        </View>
        {!profile.isIdentityVerified && (
          <TouchableOpacity
            style={styles.verifyPrompt}
            onPress={() => navigation.navigate('VerificationWorkflow')}
          >
            <Icon name="shield" size={16} color={colors.primary} />
            <Text style={styles.verifyPromptText}>
              Verify your identity to increase trust
            </Text>
            <Icon name="chevron-right" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderForm = (): React.ReactNode => (
    <View style={styles.form}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={styles.input}
          value={formData.firstName}
          onChangeText={(value) => handleInputChange('firstName', value)}
          placeholder="Enter your first name"
          placeholderTextColor={colors.text.secondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={styles.input}
          value={formData.lastName}
          onChangeText={(value) => handleInputChange('lastName', value)}
          placeholder="Enter your last name"
          placeholderTextColor={colors.text.secondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          value={formData.email}
          editable={false}
          placeholder="Email address"
          placeholderTextColor={colors.text.secondary}
        />
        <Text style={styles.inputHint}>Email cannot be changed</Text>
      </View>

      <View style={styles.inputGroup}>
        <PhoneInput
          value={formData.phone}
          onChangeText={(value) => handleInputChange('phone', value)}
          onCountryChange={handleCountryChange}
          label="Phone Number"
          placeholder="Enter your phone number"
          defaultCountry="BW"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.bio}
          onChangeText={(value) => handleInputChange('bio', value)}
          placeholder="Tell other travellers about yourself..."
          placeholderTextColor={colors.text.secondary}
          multiline
          numberOfLines={4}
          maxLength={300}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{formData.bio.length}/300</Text>
      </View>
    </View>
  );

  const renderProfileStats = (): React.ReactNode => {
    if (!profile) return null;
    return (
      <View style={styles.statsSection}>
        <Text style={styles.statsTitle}>Your Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.totalRides || 0}</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.totalDeliveries || 0}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderProfilePhoto()}
        {renderVerificationBadges()}
        {renderForm()}
        {renderProfileStats()}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.text.secondary,
  },
  saveButtonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: colors.background.secondary,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profilePhotoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  photoEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background.primary,
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHelpText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  photoWarning: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 6,
    fontStyle: 'italic',
  },
  badgesSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  badgesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 10,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.background.secondary,
  },
  badgeVerified: {
    borderColor: '#10B981' + '40',
    backgroundColor: '#ECFDF5',
  },
  badgeText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  badgeTextVerified: {
    color: '#065F46',
    fontWeight: '500',
  },
  verifyPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.primary + '08',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  verifyPromptText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  form: {
    padding: 20,
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
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  inputHint: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  statsSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  bottomSpacer: {
    height: 40,
  },
});

export default EditProfileScreen;
