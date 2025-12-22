/**
 * @fileoverview Theme configuration for Hitch mobile app
 * @author Oabona-Majoko
 * @created 2025-01-25
 */

import { DefaultTheme } from 'react-native-paper';
import { COLORS } from './utils/constants/colors';

// Export individual theme components
// Extended colors with missing properties
export const colors = {
  ...COLORS,
  info: COLORS.primary,
  textSecondary: COLORS.text.secondary,
  surface: COLORS.background.card,
  surfaceSecondary: COLORS.background.secondary,
  primaryLight: COLORS.primary + '20', // 20% opacity
  white: '#FFFFFF',
  shadow: 'rgba(0, 0, 0, 0.1)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    title: 24,
    heading: 28,
    body: 14,
    caption: 12,
    h3: 20,
    h4: 18,
  },
  fontWeight: {
    light: '300' as const,
    regular: 'normal' as const,
    medium: '500' as const,
    bold: 'bold' as const,
  },
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    accent: COLORS.secondary,
    background: COLORS.background.primary,
    surface: COLORS.background.card,
    text: COLORS.text.primary,
    placeholder: COLORS.text.secondary,
    error: COLORS.error,
    success: COLORS.success,
    warning: COLORS.warning,
    info: COLORS.primary,
  },
  fonts: {
    ...DefaultTheme.fonts,
    regular: {
      fontFamily: 'System',
      fontWeight: 'normal' as const,
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500' as const,
    },
    light: {
      fontFamily: 'System',
      fontWeight: '300' as const,
    },
    thin: {
      fontFamily: 'System',
      fontWeight: '100' as const,
    },
  },
  roundness: 8,
};