/**
 * @fileoverview Data Usage Settings screen component
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import logger from '../../services/LoggingService';

const log = logger.createLogger('DataUsageSettingsScreen');

interface DataUsageSettingsScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

interface DataSetting {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
}

const DataUsageSettingsScreen: React.FC<DataUsageSettingsScreenProps> = ({ navigation }) => {
  const [settings, setSettings] = useState<DataSetting[]>([
    {
      id: 'wifi_only_maps',
      title: 'Download Maps on Wi-Fi Only',
      description: 'Only download map data when connected to Wi-Fi',
      icon: 'map',
      enabled: true,
    },
    {
      id: 'compress_images',
      title: 'Compress Images',
      description: 'Reduce image quality to save data',
      icon: 'image',
      enabled: false,
    },
    {
      id: 'auto_play_videos',
      title: 'Auto-play Videos',
      description: 'Automatically play videos in the feed',
      icon: 'play-circle',
      enabled: false,
    },
    {
      id: 'background_data',
      title: 'Background Data',
      description: 'Allow app to use data in the background',
      icon: 'sync',
      enabled: true,
    },
    {
      id: 'data_saver',
      title: 'Data Saver Mode',
      description: 'Reduce overall data usage across the app',
      icon: 'data-saver-on',
      enabled: false,
    },
  ]);

  const [cacheSize] = useState('45.2 MB');

  const handleToggleSetting = (id: string): void => {
    setSettings(prevSettings =>
      prevSettings.map(setting =>
        setting.id === id ? { ...setting, enabled: !setting.enabled } : setting
      )
    );
  };

  const handleClearCache = (): void => {
    log.info('Cache cleared');
  };

  const renderHeader = (): React.ReactNode => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Data Usage</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  const renderDataSetting = (setting: DataSetting): React.ReactNode => (
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

  const renderCacheSection = (): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Storage</Text>

      <View style={styles.cacheCard}>
        <View style={styles.cacheInfo}>
          <Icon name="folder" size={32} color={colors.primary} />
          <View style={styles.cacheDetails}>
            <Text style={styles.cacheLabel}>Cached Data</Text>
            <Text style={styles.cacheSize}>{cacheSize}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.clearButton} onPress={handleClearCache}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Settings</Text>
          <Text style={styles.sectionDescription}>
            Control how the app uses your mobile data.
          </Text>
          {settings.map(renderDataSetting)}
        </View>

        {renderCacheSection()}

        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Icon name="info" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              Enabling data saver mode may affect app performance and real-time features like live tracking.
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
  cacheCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 12,
  },
  cacheInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cacheDetails: {
    marginLeft: 12,
  },
  cacheLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  cacheSize: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  clearButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.inverse,
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

export default DataUsageSettingsScreen;
