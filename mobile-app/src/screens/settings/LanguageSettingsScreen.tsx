/**
 * @fileoverview Language Settings screen component
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import { useI18n } from '../../i18n/I18nContext';
import { supportedLanguages } from '../../i18n/translations';

interface LanguageSettingsScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

// Supported languages that have translations + display-only languages
const allLanguages = [
  ...supportedLanguages,
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa' },
  { code: 'st', name: 'Sotho', nativeName: 'Sesotho' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
];

const supportedCodes: string[] = supportedLanguages.map((l) => l.code);

const LanguageSettingsScreen: React.FC<LanguageSettingsScreenProps> = ({ navigation }) => {
  const { language: selectedLanguage, setLanguage } = useI18n();

  const handleSelectLanguage = (code: string): void => {
    setLanguage(code);
  };

  const renderHeader = (): React.ReactNode => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Language</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  const renderLanguageItem = (language: { code: string; name: string; nativeName: string }): React.ReactNode => {
    const isSelected = selectedLanguage === language.code;
    const isSupported = supportedCodes.includes(language.code);

    return (
      <TouchableOpacity
        key={language.code}
        style={[styles.languageItem, !isSupported && styles.languageItemDisabled]}
        onPress={() => isSupported && handleSelectLanguage(language.code)}
        disabled={!isSupported}
      >
        <View style={styles.languageContent}>
          <Text style={[styles.languageName, !isSupported && styles.languageNameDisabled]}>
            {language.name}
          </Text>
          <Text style={styles.languageNative}>
            {language.nativeName}
            {!isSupported ? ' (coming soon)' : ''}
          </Text>
        </View>
        {isSelected && (
          <Icon name="check" size={24} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Language</Text>
          <Text style={styles.sectionDescription}>
            Select your preferred language for the app interface.
          </Text>

          <View style={styles.languageList}>
            {allLanguages.map(renderLanguageItem)}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Icon name="translate" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              Language changes apply immediately. More languages will be added in future updates.
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
  languageList: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  languageItemDisabled: {
    opacity: 0.5,
  },
  languageContent: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  languageNameDisabled: {
    color: colors.text.secondary,
  },
  languageNative: {
    fontSize: 14,
    color: colors.text.secondary,
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

export default LanguageSettingsScreen;
