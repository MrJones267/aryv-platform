/**
 * @fileoverview Security settings: change password, sign out everywhere
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2026-10-30
 *
 * Every control here used to do nothing: "Change password" said an email
 * was on its way and sent none, and two-factor sign-in, fingerprint login,
 * login alerts and "active devices" were switches with nothing behind
 * them. What is left is real; the rest is gone until it exists.
 */

import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../components/ui';
import { authApi } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logoutUser } from '../../store/slices/authSlice';
import { colors } from '../../theme';
import { useI18n } from '../../i18n/I18nContext';

// Constants
const CONSTANTS = {
  MIN_PASSWORD: 8,
};

interface SecuritySettingsScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

const SecuritySettingsScreen: React.FC<SecuritySettingsScreenProps> = ({ navigation }) => {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const email = useAppSelector(state => state.user.profile?.email ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changePassword = async () => {
    setError(null);
    if (!current || !next) {
      setError(t('sec.fillAll'));
      return;
    }
    if (next.length < CONSTANTS.MIN_PASSWORD) {
      setError(t('register.passwordShort'));
      return;
    }
    if (next !== confirm) {
      setError(t('register.mismatch'));
      return;
    }
    setSaving(true);
    try {
      const res = await authApi.changePassword(current, next);
      if (!res.success) {
        setError(/INVALID_CURRENT_PASSWORD|incorrect/i.test(String(res.error)) ? t('sec.wrongCurrent') : res.error || t('sec.changeFailed'));
        return;
      }
      // Changing the password ends every session, this one included.
      Alert.alert(t('sec.changedTitle'), t('sec.changedBody'), [
        { text: t('common.ok'), onPress: () => dispatch(logoutUser()) },
      ]);
    } catch {
      setError(t('sec.changeFailed'));
    } finally {
      setSaving(false);
    }
  };

  const sendResetEmail = () => {
    if (!email) {
      Alert.alert(t('common.error'), t('forgot.sendFailed'));
      return;
    }
    Alert.alert(t('sec.resetTitle'), t('sec.resetBody', { email }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('forgot.sendLink'),
        onPress: async () => {
          const res = await authApi.forgotPassword(email);
          Alert.alert(res.success ? t('forgot.sentTitle') : t('common.error'), res.success ? t('forgot.sentBody') : res.error || t('forgot.sendFailed'));
        },
      },
    ]);
  };

  const signOutEverywhere = () => {
    Alert.alert(t('sec.everywhereTitle'), t('sec.everywhereBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sec.everywhereConfirm'),
        style: 'destructive',
        onPress: async () => {
          const res = await authApi.logoutAll();
          if (!res.success) {
            Alert.alert(t('common.error'), res.error || t('sec.everywhereFailed'));
            return;
          }
          dispatch(logoutUser());
        },
      },
    ]);
  };

  const field = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.text.secondary}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('common.back')}>
          <Icon name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('nav.security')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{t('st.changePassword')}</Text>
        {field(current, setCurrent, t('sec.currentPassword'))}
        {field(next, setNext, t('sec.newPassword'))}
        {field(confirm, setConfirm, t('register.confirmPlaceholder'))}
        {error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.hint}>{t('sec.changeHint')}</Text>
        <Button title={t('st.changePassword')} onPress={changePassword} loading={saving} disabled={saving} fullWidth />
        <TouchableOpacity onPress={sendResetEmail} style={styles.link}>
          <Text style={styles.linkText}>{t('sec.forgotCurrent')}</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, styles.spaced]}>{t('st.loginActivity')}</Text>
        <TouchableOpacity style={styles.row} onPress={signOutEverywhere}>
          <Icon name="logout" size={22} color={colors.error} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.error }]}>{t('st.logOutAllDevices')}</Text>
            <Text style={styles.rowDesc}>{t('sec.everywhereDesc')}</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: 8 },
  spaced: { marginTop: 32 },
  input: { borderWidth: 1, borderColor: colors.border.light, borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 15, color: colors.text.primary },
  error: { color: colors.error, fontSize: 14, marginBottom: 8 },
  hint: { color: colors.text.secondary, fontSize: 13, marginBottom: 14, lineHeight: 18 },
  link: { alignSelf: 'center', marginTop: 14 },
  linkText: { color: colors.primary, fontSize: 14, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowText: { flex: 1, marginLeft: 14 },
  rowTitle: { fontSize: 16, fontWeight: '500' },
  rowDesc: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
});

export default SecuritySettingsScreen;
