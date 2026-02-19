/**
 * @fileoverview Theme context providing dark/light mode across the app
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@aryv_theme_preference';

// ─── Color Palettes ──────────────────────────────────────────────────

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  error: string;
  warning: string;
  success: string;
  text: {
    primary: string;
    secondary: string;
    light: string;
    inverse: string;
    disabled: string;
  };
  background: {
    primary: string;
    secondary: string;
    card: string;
    modal: string;
    disabled: string;
  };
  border: {
    light: string;
    medium: string;
    dark: string;
  };
}

const lightColors: ThemeColors = {
  primary: '#3B82F6',
  secondary: '#10B981',
  accent: '#F59E0B',
  error: '#EF4444',
  warning: '#F97316',
  success: '#10B981',
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    light: '#9CA3AF',
    inverse: '#FFFFFF',
    disabled: '#9CA3AF',
  },
  background: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    card: '#FFFFFF',
    modal: 'rgba(0,0,0,0.5)',
    disabled: '#F3F4F6',
  },
  border: {
    light: '#E5E7EB',
    medium: '#D1D5DB',
    dark: '#9CA3AF',
  },
};

const darkColors: ThemeColors = {
  primary: '#60A5FA',
  secondary: '#34D399',
  accent: '#FBBF24',
  error: '#F87171',
  warning: '#FB923C',
  success: '#34D399',
  text: {
    primary: '#F9FAFB',
    secondary: '#D1D5DB',
    light: '#9CA3AF',
    inverse: '#1F2937',
    disabled: '#6B7280',
  },
  background: {
    primary: '#111827',
    secondary: '#1F2937',
    card: '#1F2937',
    modal: 'rgba(0,0,0,0.7)',
    disabled: '#374151',
  },
  border: {
    light: '#374151',
    medium: '#4B5563',
    dark: '#6B7280',
  },
};

// ─── Theme Context ───────────────────────────────────────────────────

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  isDark: boolean;
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  mode: 'system',
  colors: lightColors,
  setMode: () => {},
  toggleTheme: () => {},
});

export const useAppTheme = () => useContext(ThemeContext);

// ─── Theme Provider ──────────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [initialized, setInitialized] = useState(false);

  // Load saved preference
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
      setInitialized(true);
    });
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    const newMode = isDark ? 'light' : 'dark';
    setMode(newMode);
  }, [mode, systemColorScheme]);

  const isDark = mode === 'system'
    ? systemColorScheme === 'dark'
    : mode === 'dark';

  const themeColors = isDark ? darkColors : lightColors;

  const contextValue: ThemeContextType = {
    isDark,
    mode,
    colors: themeColors,
    setMode,
    toggleTheme,
  };

  // Don't render until we've loaded the preference
  if (!initialized) return null;

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export { lightColors, darkColors };
