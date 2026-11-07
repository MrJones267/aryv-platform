/**
 * @fileoverview The delivery's handover code, shown to the sender
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * The code reached the recipient by SMS only. When the text never arrived,
 * the courier could not complete the delivery at all. The sender now sees
 * the code here, can pass it on, and can have a new one sent when it has
 * expired or been locked by wrong guesses.
 *
 * Renders nothing for anyone the server will not give the code to (the
 * courier, or anyone else), so it is safe on a screen both parties use.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import PackageService from '../../services/PackageService';
import { useI18n } from '../../i18n/I18nContext';

interface Props {
  agreementId: string;
}

type Loaded =
  | { state: 'loading' }
  | { state: 'hidden' }
  | { state: 'expired' }
  | { state: 'shown'; code: string; expiresAt: string };

const HandoverCodeCard: React.FC<Props> = ({ agreementId }) => {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const result = await PackageService.getHandoverCode(agreementId);
    if (result.success && result.data?.code) {
      setLoaded({ state: 'shown', code: result.data.code, expiresAt: result.data.expiresAt });
    } else if (result.code === 'NO_ACTIVE_CODE') {
      setLoaded({ state: 'expired' });
    } else {
      // Not the sender, not in transit, or unreachable: nothing to show.
      setLoaded({ state: 'hidden' });
    }
  }, [agreementId]);

  useEffect(() => {
    load();
  }, [load]);

  const sendNew = async (): Promise<void> => {
    setSending(true);
    try {
      const result = await PackageService.resendHandoverCode(agreementId);
      if (result.success && result.data?.code) {
        setLoaded({ state: 'shown', code: result.data.code, expiresAt: result.data.expiresAt });
        Alert.alert(t('handover.newCodeSentTitle'), t('handover.newCodeSentBody'));
      } else {
        Alert.alert(t('common.error'), result.error || t('handover.couldNotSend'));
      }
    } finally {
      setSending(false);
    }
  };

  const share = (code: string): void => {
    Share.share({ message: t('handover.shareMessage', { code }) }).catch(() => undefined);
  };

  if (loaded.state === 'loading' || loaded.state === 'hidden') {
    return null;
  }

  const expiry = loaded.state === 'shown'
    ? new Date(loaded.expiresAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon name="vpn-key" size={20} color={colors.primary} />
        <Text style={styles.title}>{t('handover.title')}</Text>
      </View>

      {loaded.state === 'shown' ? (
        <>
          <Text style={styles.code} selectable accessibilityLabel={loaded.code.split('').join(' ')}>
            {loaded.code}
          </Text>
          <Text style={styles.hint}>{t('handover.hint')}</Text>
          {expiry && <Text style={styles.expiry}>{t('handover.validUntil', { time: expiry })}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondary} onPress={() => share(loaded.code)}>
              <Icon name="share" size={18} color={colors.primary} />
              <Text style={styles.secondaryText}>{t('handover.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={sendNew} disabled={sending}>
              {sending
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Icon name="refresh" size={18} color={colors.primary} />}
              <Text style={styles.secondaryText}>{t('handover.sendNew')}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.hint}>{t('handover.expired')}</Text>
          <TouchableOpacity style={styles.primary} onPress={sendNew} disabled={sending}>
            {sending
              ? <ActivityIndicator size="small" color={colors.text.inverse} />
              : <Text style={styles.primaryText}>{t('handover.sendNew')}</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { marginLeft: 8, fontSize: 16, fontWeight: '600', color: colors.text.primary },
  code: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.text.primary,
    marginVertical: 8,
  },
  hint: { fontSize: 14, color: colors.text.secondary, marginBottom: 6 },
  expiry: { fontSize: 13, color: colors.text.secondary, marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryText: { marginLeft: 6, color: colors.primary, fontWeight: '600' },
  primary: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  primaryText: { color: colors.text.inverse, fontWeight: '600' },
});

export default HandoverCodeCard;
