/**
 * @fileoverview Security Settings screen component
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
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
import logger from '../../services/LoggingService';

const log = logger.createLogger('SecuritySettingsScreen');

interface SecuritySettingsScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

interface SecurityOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled?: boolean;
  type: 'toggle' | 'action';
}

const SecuritySettingsScreen: React.FC<SecuritySettingsScreenProps> = ({ navigation }) => {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true);

  const handleChangePassword = (): void => {
    Alert.alert(
      'Change Password',
      'You will receive an email with instructions to change your password.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Email', onPress: () => log.info('Password reset email sent') },
      ]
    );
  };

  const handleSetupTwoFactor = (): void => {
    if (twoFactorEnabled) {
      Alert.alert(
        'Disable Two-Factor Authentication',
        'This will make your account less secure. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => setTwoFactorEnabled(false),
          },
        ]
      );
    } else {
      Alert.alert(
        'Enable Two-Factor Authentication',
        'We will send a verification code to your registered phone number.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: () => setTwoFactorEnabled(true) },
        ]
      );
    }
  };

  const handleViewDevices = (): void => {
    Alert.alert(
      'Active Devices',
      'This device (Current)\n\nNo other active sessions found.',
      [{ text: 'OK' }]
    );
  };

  const handleLogoutAll = (): void => {
    Alert.alert(
      'Log Out All Devices',
      'This will log you out from all devices except this one.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out All', style: 'destructive', onPress: () => log.info('Logged out all devices') },
      ]
    );
  };

  const renderHeader = (): React.ReactNode => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Security</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  const renderToggleItem = (
    title: string,
    description: string,
    icon: string,
    value: boolean,
    onToggle: () => void
  ): React.ReactNode => (
    <View style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <Icon name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border.light, true: colors.primary + '40' }}
        thumbColor={value ? colors.primary : colors.text.secondary}
      />
    </View>
  );

  const renderActionItem = (
    title: string,
    description: string,
    icon: string,
    onPress: () => void,
    danger?: boolean
  ): React.ReactNode => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={[styles.settingIcon, danger && styles.dangerIcon]}>
        <Icon name={icon} size={24} color={danger ? colors.error : colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.dangerText]}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Icon name="chevron-right" size={24} color={colors.text.secondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authentication</Text>

          {renderActionItem(
            'Change Password',
            'Update your account password',
            'lock',
            handleChangePassword
          )}

          {renderToggleItem(
            'Biometric Login',
            'Use fingerprint or face recognition to log in',
            'fingerprint',
            biometricEnabled,
            () => setBiometricEnabled(!biometricEnabled)
          )}

          {renderToggleItem(
            'Two-Factor Authentication',
            'Add an extra layer of security',
            'security',
            twoFactorEnabled,
            handleSetupTwoFactor
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Login Activity</Text>

          {renderToggleItem(
            'Login Alerts',
            'Get notified when someone logs into your account',
            'notifications',
            loginAlertsEnabled,
            () => setLoginAlertsEnabled(!loginAlertsEnabled)
          )}

          {renderActionItem(
            'Active Devices',
            'View devices logged into your account',
            'devices',
            handleViewDevices
          )}

          {renderActionItem(
            'Log Out All Devices',
            'Sign out from all other devices',
            'logout',
            handleLogoutAll,
            true
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Icon name="info" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              Keep your account secure by using a strong password and enabling two-factor authentication.
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
    marginBottom: 16,
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
  dangerIcon: {
    backgroundColor: colors.error + '20',
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
  dangerText: {
    color: colors.error,
  },
  settingDescription: {
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

export default SecuritySettingsScreen;
