/**
 * @fileoverview UI Component Library Index - Design System Exports
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

// Core UI Components
export { Button } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';

export { Input } from './Input';
export type { InputVariant, InputSize } from './Input';

export { Card } from './Card';
export type { CardVariant, CardPadding } from './Card';

export { Avatar } from './Avatar';
export type { AvatarSize } from './Avatar';

export { Badge, DotBadge } from './Badge';
export type { BadgeVariant, BadgeSize } from './Badge';

// Design System Constants
export const colors = {
  // Primary Colors
  primary: '#2196F3',
  primaryLight: '#E3F2FD',
  primaryDark: '#1976D2',
  
  // Status Colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  // Neutral Colors
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#E0E0E0',
  gray300: '#CCCCCC',
  gray400: '#999999',
  gray500: '#666666',
  gray600: '#333333',
  gray700: '#212121',
  
  // Text Colors
  textPrimary: '#333333',
  textSecondary: '#666666',
  textDisabled: '#CCCCCC',
  textInverse: '#FFFFFF',
  
  // Background Colors
  background: '#FFFFFF',
  backgroundSecondary: '#FAFAFA',
  backgroundDisabled: '#F5F5F5',
  
  // Border Colors
  border: '#E0E0E0',
  borderFocused: '#2196F3',
  borderError: '#F44336',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const typography = {
  // Font Sizes
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  xxxxl: 28,
  
  // Font Weights
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  
  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

export const shadows = {
  sm: {
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  md: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  lg: {
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  xl: {
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
} as const;

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
} as const;

// Animation/Transition Constants
export const animations = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
  easing: {
    linear: 'linear' as const,
    easeIn: 'ease-in' as const,
    easeOut: 'ease-out' as const,
    easeInOut: 'ease-in-out' as const,
  },
} as const;

// Common Style Helpers
export const commonStyles = {
  // Flex
  flex1: { flex: 1 },
  flexRow: { flexDirection: 'row' as const },
  flexColumn: { flexDirection: 'column' as const },
  justifyCenter: { justifyContent: 'center' as const },
  alignCenter: { alignItems: 'center' as const },
  spaceBetween: { justifyContent: 'space-between' as const },
  spaceAround: { justifyContent: 'space-around' as const },
  
  // Position
  absolute: { position: 'absolute' as const },
  relative: { position: 'relative' as const },
  
  // Size
  fullWidth: { width: '100%' },
  fullHeight: { height: '100%' },
  
  // Text
  textCenter: { textAlign: 'center' as const },
  textLeft: { textAlign: 'left' as const },
  textRight: { textAlign: 'right' as const },
  
  // Borders
  rounded: { borderRadius: borderRadius.md },
  roundedLg: { borderRadius: borderRadius.lg },
  roundedFull: { borderRadius: borderRadius.full },
} as const;