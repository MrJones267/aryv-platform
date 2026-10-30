/**
 * @fileoverview Which notifications reach the phone
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2026-10-30
 *
 * These switches used to change the screen and save nothing. They are now
 * stored on the server, which checks them before every push. Safety alerts
 * and calls are always sent, so they are not offered as switches.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { authApi } from '../../services/api';
import type { NotificationPreferences } from '../../services/api/authApi';
import type { TranslationKey } from '../../i18n/translations';
import { colors } from '../../theme';
import { useI18n } from '../../i18n/I18nContext';

interface NotificationSettingsScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

const ROWS: Array<{ key: keyof NotificationPreferences; icon: string; title: TranslationKey; desc: TranslationKey }> = [
  { key: 'pushNotifications', icon: 'notifications', title: 'profile.pushNotifications', desc: 'st.receivePushNotificationsOnYour' },
  { key: 'rideUpdates', icon: 'directions-car', title: 'st.rideUpdates', desc: 'st.getNotifiedAboutRideStatus' },
  { key: 'messages', icon: 'message', title: 'st.newMessages', desc: 'st.notificationsForNewChatMessages' },
  { key: 'payments', icon: 'payment', title: 'st.paymentNotifications', desc: 'st.paymentConfirmationsAndReceipts' },
  { key: 'promotions', icon: 'local-offer', title: 'st.promotionsOffers', desc: 'st.specialDealsAndDiscountNotifications' },
];

const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({ navigation }) => {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    authApi.getNotificationPreferences()
      .then(res => (res.success && res.data ? setPrefs(res.data) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  const toggle = async (key: keyof NotificationPreferences) => {
    if (!prefs) {return;}
    const before = prefs;
    const after = { ...prefs, [key]: !prefs[key] };
    setPrefs(after);
    try {
      const res = await authApi.updateNotificationPreferences({ [key]: after[key] });
      if (!res.success) {throw new Error(res.error);}
      if (res.data) {setPrefs(res.data);}
    } catch {
      setPrefs(before);
      Alert.alert(t('common.error'), t('ns.saveFailed'));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('common.back')}>
          <Icon name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('st.notificationSettings')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('st.customizeYourNotificationPreferencesTo')}</Text>
        {failed && <Text style={styles.error}>{t('ns.loadFailed')}</Text>}
        {!prefs && !failed && <ActivityIndicator color={colors.primary} />}
        {prefs && ROWS.map(row => {
          const disabled = row.key !== 'pushNotifications' && !prefs.pushNotifications;
          return (
            <View key={row.key} style={[styles.row, disabled && styles.disabled]}>
              <Icon name={row.icon} size={22} color={colors.primary} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t(row.title)}</Text>
                <Text style={styles.rowDesc}>{t(row.desc)}</Text>
              </View>
              <Switch
                value={prefs[row.key] && !disabled}
                onValueChange={() => toggle(row.key)}
                disabled={disabled}
                trackColor={{ false: colors.border.light, true: colors.primary }}
              />
            </View>
          );
        })}
        <View style={styles.note}>
          <Icon name="security" size={20} color={colors.text.secondary} />
          <Text style={styles.noteText}>{t('ns.alwaysOn')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },
  content: { padding: 20, paddingBottom: 40 },
  intro: { fontSize: 14, color: colors.text.secondary, marginBottom: 16, lineHeight: 20 },
  error: { color: colors.error, fontSize: 14, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  disabled: { opacity: 0.5 },
  rowText: { flex: 1, marginHorizontal: 14 },
  rowTitle: { fontSize: 16, fontWeight: '500', color: colors.text.primary },
  rowDesc: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  note: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 20 },
  noteText: { flex: 1, marginLeft: 10, fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
});

export default NotificationSettingsScreen;
