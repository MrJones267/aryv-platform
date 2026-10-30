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
import { useI18n } from '../../i18n/I18nContext';

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
  const { t } = useI18n();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true);

  const handleChangePassword = (): void => {
    Alert.alert(
      t('st.changePassword'),
      t('st.youWillReceiveAnEmail'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Send Email', onPress: () => log.info('Password reset email sent') },
      ]
    );
  };

  const handleSetupTwoFactor = (): void => {
    if (twoFactorEnabled) {
      Alert.alert(
        t('st.disableTwoFactorAuthentication'),
        t('st.thisWillMakeYourAccount'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('st.disable'),
            style: 'destructive',
            onPress: () => setTwoFactorEnabled(false),
          },
        ]
      );
    } else {
      Alert.alert(
        t('st.enableTwoFactorAuthentication'),
        t('st.weWillSendAVerification'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('st.enable'), onPress: () => setTwoFactorEnabled(true) },
        ]
      );
    }
  };

  const handleViewDevices = (): void => {
    Alert.alert(
      t('st.activeDevices'),
      t('st.thisDeviceCurrentNNno'),
      [{ text: 'OK' }]
    );
  };

  const handleLogoutAll = (): void => {
    Alert.alert(
      t('st.logOutAllDevices'),
      t('st.thisWillLogYouOut'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Log Out All', style: 'destructive', onPress: () => log.info('Logged out all devices') },
      ]
    );
  };

  const renderHeader = (): React.ReactNode => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t('nav.security')}</Text>
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
          <Text style={styles.sectionTitle}>{t('st.authentication')}</Text>

          {renderActionItem(
            t('st.changePassword'),
            t('st.updateYourAccountPassword'),
            'lock',
            handleChangePassword
          )}

          {renderToggleItem(
            t('st.biometricLogin'),
            t('st.useFingerprintOrFaceRecognition'),
            'fingerprint',
            biometricEnabled,
            () => setBiometricEnabled(!biometricEnabled)
          )}

          {renderToggleItem(
            t('st.twoFactorAuthentication'),
            t('st.addAnExtraLayerOf'),
            'security',
            twoFactorEnabled,
            handleSetupTwoFactor
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('st.loginActivity')}</Text>

          {renderToggleItem(
            t('st.loginAlerts'),
            t('st.getNotifiedWhenSomeoneLogs'),
            'notifications',
            loginAlertsEnabled,
            () => setLoginAlertsEnabled(!loginAlertsEnabled)
          )}

          {renderActionItem(
            t('st.activeDevices'),
            t('st.viewDevicesLoggedIntoYour'),
            'devices',
            handleViewDevices
          )}

          {renderActionItem(
            t('st.logOutAllDevices'),
            t('st.signOutFromAllOther'),
            'logout',
            handleLogoutAll,
            true
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Icon name="info" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              {t('st.keepYourAccountSecureBy')}
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
