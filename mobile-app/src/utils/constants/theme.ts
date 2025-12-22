/**
 * @fileoverview React Native Paper theme configuration
 * @author Oabona-Majoko
 * @created 2025-01-27
 */

import { MD3LightTheme } from 'react-native-paper';
import { COLORS } from './colors';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    primaryContainer: COLORS.primary + '20',
    secondary: COLORS.secondary,
    secondaryContainer: COLORS.secondary + '20',
    tertiary: COLORS.accent,
    error: COLORS.error,
    errorContainer: COLORS.error + '20',
    background: COLORS.background.primary,
    surface: COLORS.background.card,
    surfaceVariant: COLORS.background.secondary,
    onPrimary: COLORS.text.inverse,
    onSecondary: COLORS.text.inverse,
    onBackground: COLORS.text.primary,
    onSurface: COLORS.text.primary,
    outline: COLORS.border.medium,
  },
};