/**
 * @fileoverview Privacy Settings screen component
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2026-10-30
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Share,
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
import { authApi } from '../../services/api';
import { useI18n } from '../../i18n/I18nContext';

const log = logger.createLogger('PrivacySettingsScreen');

interface PrivacySettingsScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

const PrivacySettingsScreen: React.FC<PrivacySettingsScreenProps> = ({ navigation }) => {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // A copy of the person's data, handed to the share sheet so they can
  // save or send it. This used to promise an email within 48 hours and do
  // nothing.
  const downloadData = async (): Promise<void> => {
    setExporting(true);
    try {
      const res = await authApi.exportMyData();
      if (!res.success || !res.data) {
        Alert.alert(t('common.error'), res.error || t('pv.exportFailed'));
        return;
      }
      await Share.share({ title: t('st.downloadMyData'), message: JSON.stringify(res.data, null, 2) });
    } catch (error) {
      log.warn('Data export failed', error);
      Alert.alert(t('common.error'), t('pv.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleDataManagement = (action: string): void => {
    switch (action) {
      case 'download':
        downloadData();
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
      setDeleteError(t('st.enterYourPasswordToConfirm'));
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const result = await dispatch(deleteAccount({ password: deletePassword }));

      if (deleteAccount.rejected.match(result)) {
        setDeleteError(
          (result.payload as string) || t('st.weCouldNotDeleteYour')
        );
        return;
      }

      setDeleteModalVisible(false);
      // Clear the local session so the app cannot keep using a token that no
      // longer maps to a real account.
      await dispatch(logoutUser());
      Alert.alert(t('st.accountDeleted'), t('st.yourAccountAndPersonalData'));
    } catch (error) {
      log.error('Account deletion failed', error);
      setDeleteError(t('st.weCouldNotDeleteYour'));
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
          <Text style={styles.modalTitle}>{t('st.deleteYourAccount')}</Text>
          <Text style={styles.modalBody}>
            This permanently deletes your profile and personal data. Completed
            rides stay on record in anonymised form for tax and dispute
            purposes. This cannot be undone.
          </Text>

          <TextInput
            style={styles.modalInput}
            placeholder={t('st.confirmYourPassword')}
            placeholderTextColor={colors.text.secondary}
            secureTextEntry
            autoCapitalize="none"
            value={deletePassword}
            onChangeText={setDeletePassword}
            editable={!deleting}
            accessibilityLabel={t('st.confirmYourPassword')}
          />

          {deleteError ? <Text style={styles.modalError}>{deleteError}</Text> : null}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setDeleteModalVisible(false)}
              disabled={deleting}
              accessibilityRole="button"
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
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
                <Text style={styles.modalConfirmText}>{t('st.deletePermanently')}</Text>
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
      <Text style={styles.headerTitle}>{t('st.privacySettings')}</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  const renderDataManagement = (): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('st.dataManagement')}</Text>
      
      <TouchableOpacity
        style={styles.actionItem}
        onPress={() => handleDataManagement('download')}
        disabled={exporting}
      >
        <View style={styles.actionIcon}>
          <Icon name="download" size={24} color={colors.primary} />
        </View>
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>{exporting ? t('pv.preparing') : t('st.downloadMyData')}</Text>
          <Text style={styles.actionDescription}>
            {t('st.getACopyOfAll')}
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
          <Text style={[styles.actionTitle, styles.dangerText]}>{t('st.deleteMyAccount')}</Text>
          <Text style={styles.actionDescription}>
            {t('st.permanentlyDeleteYourAccountAnd')}
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
          <Text style={styles.sectionTitle}>{t('pv.whatIsShared')}</Text>
          {/* Statements of what the app does, not switches: the switches
              that were here saved nothing and changed nothing. */}
          {(['pv.location', 'pv.profile', 'pv.contacts'] as const).map(key => (
            <View key={key} style={styles.factRow}>
              <Icon name={key === 'pv.location' ? 'location-on' : key === 'pv.profile' ? 'person' : 'contacts'} size={20} color={colors.primary} />
              <Text style={styles.factText}>{t(key)}</Text>
            </View>
          ))}
        </View>
        
        {renderDataManagement()}
        
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Icon name="shield" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              {t('st.yourPrivacyIsImportantTo')}
            </Text>
          </View>
        </View>
      </ScrollView>
      {renderDeleteModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  factText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
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