/**
 * @fileoverview Notification Settings screen component
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';

interface NotificationSettingsScreenProps {
  navigation: any;
}

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  icon: string;
}

const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({ navigation }) => {
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'push',
      title: 'Push Notifications',
      description: 'Receive push notifications on your device',
      enabled: true,
      icon: 'notifications',
    },
    {
      id: 'ride_updates',
      title: 'Ride Updates',
      description: 'Get notified about ride status changes',
      enabled: true,
      icon: 'directions-car',
    },
    {
      id: 'messages',
      title: 'New Messages',
      description: 'Notifications for new chat messages',
      enabled: true,
      icon: 'message',
    },
    {
      id: 'promotions',
      title: 'Promotions & Offers',
      description: 'Special deals and discount notifications',
      enabled: false,
      icon: 'local-offer',
    },
    {
      id: 'payment',
      title: 'Payment Notifications',
      description: 'Payment confirmations and receipts',
      enabled: true,
      icon: 'payment',
    },
    {
      id: 'security',
      title: 'Security Alerts',
      description: 'Important security and account updates',
      enabled: true,
      icon: 'security',
    },
  ]);

  const handleToggleSetting = (id: string): void => {
    setSettings(prevSettings =>
      prevSettings.map(setting =>
        setting.id === id ? { ...setting, enabled: !setting.enabled } : setting
      )
    );
  };

  const renderHeader = (): React.ReactNode => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Notification Settings</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  const renderNotificationSetting = (setting: NotificationSetting): React.ReactNode => (
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

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionDescription}>
            Customize your notification preferences to stay informed about what matters most to you.
          </Text>
          {settings.map(renderNotificationSetting)}
        </View>
        
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Icon name="info" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              You can also manage notification settings in your device's system settings.
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
});

export default NotificationSettingsScreen;