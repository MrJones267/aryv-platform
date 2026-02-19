/**
 * @fileoverview Internationalization context and hook for multi-language support
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, TranslationKey, supportedLanguages } from './translations';

const LANGUAGE_KEY = '@aryv_language';

interface I18nContextType {
  language: string;
  setLanguage: (code: string) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  supportedLanguages: typeof supportedLanguages;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: (key) => key,
  supportedLanguages,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState('en');

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
      if (saved && translations[saved]) {
        setLanguageState(saved);
      }
    });
  }, []);

  const setLanguage = useCallback(async (code: string) => {
    if (translations[code]) {
      setLanguageState(code);
      await AsyncStorage.setItem(LANGUAGE_KEY, code);
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[language] || translations.en;
      let value = dict[key] || translations.en[key] || key;

      if (params) {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
          value = value.replace(`{{${paramKey}}}`, String(paramValue));
        });
      }

      return value;
    },
    [language],
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, supportedLanguages }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n() {
  return useContext(I18nContext);
}

export default I18nContext;
