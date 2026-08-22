/**
 * @fileoverview Privacy Settings screen component
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import logger from '../../services/LoggingService';
import { useAppDispatch } from '../../store/hooks';
import { deleteAccount } from '../../store/slices/userSlice';
import { logoutUser } from '../../store/slices/authSlice';

const log = logger.createLogger('PrivacySettingsScreen');

interface PrivacySettingsScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

interface PrivacySetting {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  icon: string;
}

const PrivacySettingsScreen: React.FC<PrivacySettingsScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PrivacySetting[]>([
    {
      id: 'location_sharing',
      title: 'Location Sharing',
      description: 'Share your location with other users during rides',
      enabled: true,
      icon: 'location-on',
    },
    {
      id: 'profile_visibility',
      title: 'Profile Visibility',
      description: 'Allow other users to see your profile information',
      enabled: true,
      icon: 'visibility',
    },
    {
      id: 'ride_history',
      title: 'Ride History Sharing',
      description: 'Show completed rides to potential riders',
      enabled: false,
      icon: 'history',
    },
    {
      id: 'contact_sync',
      title: 'Contact Synchronization',
      description: 'Sync contacts to find friends on ARYV',
      enabled: false,
      icon: 'contacts',
    },
    {
      id: 'analytics',
      title: 'Usage Analytics',
      description: 'Help improve the app by sharing usage data',
      enabled: true,
      icon: 'analytics',
    },
  ]);

  const handleToggleSetting = (id: string): void => {
    if (id === 'location_sharing') {
      Alert.alert(
        'Location Sharing',
        'Disabling location sharing may affect the core functionality of the app. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => toggleSetting(id),
          },
        ]
      );
    } else {
      toggleSetting(id);
    }
  };

  const toggleSetting = (id: string): void => {
    setSettings(prevSettings =>
      prevSettings.map(setting =>
        setting.id === id ? { ...setting, enabled: !setting.enabled } : setting
      )
    );
  };

  const handleDataManagement = (action: string): void => {
    switch (action) {
      case 'download':
        Alert.alert(
          'Download Data',
          'Your data will be prepared and sent to your registered email address within 48 hours.',
          [{ text: 'OK' }]
        );
        break;
      case 'delete':
        setDeleteError(null);
        setDeletePassword('');
        setDeleteModalVisible(true);
        break;
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deletePassword) {
      setDeleteError('Enter your password to confirm.');
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const result = await dispatch(deleteAccount({ password: deletePassword }));

      if (deleteAccount.rejected.match(result)) {
        setDeleteError(
          (result.payload as string) || 'We could not delete your account. Try again.'
        );
        return;
      }

      setDeleteModalVisible(false);
      // Clear the local session so the app cannot keep using a token that no
      // longer maps to a real account.
      await dispatch(logoutUser());
      Alert.alert('Account deleted', 'Your account and personal data have been deleted.');
    } catch (error) {
      log.error('Account deletion failed', error);
      setDeleteError('We could not delete your account. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  const renderDeleteModal = (): React.ReactNode => (
    <Modal
      visible={deleteModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => !deleting && setDeleteModalVisible(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Delete your account</Text>
          <Text style={styles.modalBody}>
            This permanently deletes your profile and personal data. Completed
            rides stay on record in anonymised form for tax and dispute
            purposes. This cannot be undone.
          </Text>

          <TextInput
            style={styles.modalInput}
            placeholder="Confirm your password"
            placeholderTextColor={colors.text.secondary}
            secureTextEntry
            autoCapitalize="none"
            value={deletePassword}
            onChangeText={setDeletePassword}
            editable={!deleting}
            accessibilityLabel="Confirm your password"
          />

          {deleteError ? <Text style={styles.modalError}>{deleteError}</Text> : null}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setDeleteModalVisible(false)}
              disabled={deleting}
              accessibilityRole="button"
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalConfirm, deleting && styles.modalConfirmDisabled]}
              onPress={handleConfirmDelete}
              disabled={deleting}
              accessibilityRole="button"
            >
              {deleting ? (
                <ActivityIndicator color={colors.text.inverse} size="small" />
              ) : (
                <Text style={styles.modalConfirmText}>Delete permanently</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderHeader = (): React.ReactNode => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Privacy Settings</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  const renderPrivacySetting = (setting: PrivacySetting): React.ReactNode => (
    <View key={setting.id} style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <Icon name={setting.icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{setting.title}</Text>
        <Text style={styles.settingDescription}>{setting.description}</Text>
      </View>
      <Switch
        value={setting.enabled}
        onValueChange={() => handleToggleSetting(setting.id)}
        trackColor={{ false: colors.border.light, true: colors.primary + '40' }}
        thumbColor={setting.enabled ? colors.primary : colors.text.secondary}
      />
    </View>
  );

  const renderDataManagement = (): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Data Management</Text>
      
      <TouchableOpacity
        style={styles.actionItem}
        onPress={() => handleDataManagement('download')}
      >
        <View style={styles.actionIcon}>
          <Icon name="download" size={24} color={colors.primary} />
        </View>
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>Download My Data</Text>
          <Text style={styles.actionDescription}>
            Get a copy of all your data stored in ARYV
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color={colors.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionItem}
        onPress={() => handleDataManagement('delete')}
      >
        <View style={[styles.actionIcon, styles.dangerIcon]}>
          <Icon name="delete-forever" size={24} color={colors.error} />
        </View>
        <View style={styles.actionContent}>
          <Text style={[styles.actionTitle, styles.dangerText]}>Delete My Account</Text>
          <Text style={styles.actionDescription}>
            Permanently delete your account and all data
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color={colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Controls</Text>
          <Text style={styles.sectionDescription}>
            Control how your information is shared and used within the ARYV platform.
          </Text>
          {settings.map(renderPrivacySetting)}
        </View>
        
        {renderDataManagement()}
        
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Icon name="shield" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              Your privacy is important to us. Read our Privacy Policy to learn more about how we protect your data.
            </Text>
          </View>
        </View>
      </ScrollView>
      {renderDeleteModal()}
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
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dangerIcon: {
    backgroundColor: colors.error + '20',
  },
  actionContent: {
    flex: 1,
    marginRight: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  dangerText: {
    color: colors.error,
  },
  actionDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text.primary,
  },
  modalError: {
    marginTop: 10,
    fontSize: 13,
    color: colors.error,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 24,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  modalConfirm: {
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 160,
    alignItems: 'center',
  },
  modalConfirmDisabled: {
    opacity: 0.6,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
});

export default PrivacySettingsScreen;