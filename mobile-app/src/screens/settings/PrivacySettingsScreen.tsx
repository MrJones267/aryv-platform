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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';

interface PrivacySettingsScreenProps {
  navigation: any;
}

interface PrivacySetting {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  icon: string;
}

const PrivacySettingsScreen: React.FC<PrivacySettingsScreenProps> = ({ navigation }) => {
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
      description: 'Sync contacts to find friends on Hitch',
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
        Alert.alert(
          'Delete Account',
          'This action cannot be undone. All your data will be permanently deleted.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => console.log('Account deletion requested'),
            },
          ]
        );
        break;
    }
  };

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
            Get a copy of all your data stored in Hitch
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
            Control how your information is shared and used within the Hitch platform.
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
});

export default PrivacySettingsScreen;