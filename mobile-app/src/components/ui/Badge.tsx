/**
 * @fileoverview Reusable Badge component for status indicators and labels
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';
export type BadgeSize = 'small' | 'medium' | 'large';

interface BadgeProps {
  text?: string;
  count?: number;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: string;
  maxCount?: number;
  showZero?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  text,
  count,
  variant = 'neutral',
  size = 'medium',
  icon,
  maxCount = 99,
  showZero = false,
  style,
  textStyle,
  testID,
}) => {
  // Don't render if count is 0 and showZero is false, or if no text/count/icon
  if (
    (count !== undefined && count === 0 && !showZero) ||
    (text === undefined && count === undefined && icon === undefined)
  ) {
    return null;
  }

  const badgeStyles = [
    styles.badge,
    styles[variant],
    styles[size],
    style,
  ];

  const badgeTextStyles = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    textStyle,
  ];

  const getDisplayText = (): string => {
    if (text !== undefined) return text;
    if (count !== undefined) {
      return count > maxCount ? `${maxCount}+` : count.toString();
    }
    return '';
  };

  const getIconSize = (): number => {
    switch (size) {
      case 'small': return 12;
      case 'medium': return 14;
      case 'large': return 16;
      default: return 14;
    }
  };

  const getIconColor = (): string => {
    switch (variant) {
      case 'success': return '#FFFFFF';
      case 'warning': return '#000000';
      case 'error': return '#FFFFFF';
      case 'info': return '#FFFFFF';
      case 'neutral': return '#FFFFFF';
      default: return '#FFFFFF';
    }
  };

  return (
    <View style={badgeStyles} testID={testID}>
      {icon && (
        <Icon
          name={icon}
          size={getIconSize()}
          color={getIconColor()}
          style={getDisplayText() ? styles.iconWithText : undefined}
        />
      )}
      {getDisplayText() && (
        <Text style={badgeTextStyles}>
          {getDisplayText()}
        </Text>
      )}
    </View>
  );
};

// Badge with dot indicator (for notifications)
interface DotBadgeProps {
  visible?: boolean;
  variant?: BadgeVariant;
  size?: 'small' | 'medium';
  style?: ViewStyle;
  testID?: string;
}

export const DotBadge: React.FC<DotBadgeProps> = ({
  visible = true,
  variant = 'error',
  size = 'medium',
  style,
  testID,
}) => {
  if (!visible) return null;

  const dotStyles = [
    styles.dot,
    styles[variant],
    size === 'small' ? styles.dotSmall : styles.dotMedium,
    style,
  ];

  return <View style={dotStyles} testID={testID} />;
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    minHeight: 20,
  },
  
  // Variants
  success: {
    backgroundColor: '#4CAF50',
  },
  warning: {
    backgroundColor: '#FF9800',
  },
  error: {
    backgroundColor: '#F44336',
  },
  info: {
    backgroundColor: '#2196F3',
  },
  neutral: {
    backgroundColor: '#666666',
  },
  
  // Sizes
  small: {
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    minHeight: 16,
  },
  medium: {
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    minHeight: 20,
  },
  large: {
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    minHeight: 24,
  },
  
  // Text styles
  text: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  successText: {
    color: '#FFFFFF',
  },
  warningText: {
    color: '#000000',
  },
  errorText: {
    color: '#FFFFFF',
  },
  infoText: {
    color: '#FFFFFF',
  },
  neutralText: {
    color: '#FFFFFF',
  },
  
  // Text sizes
  smallText: {
    fontSize: 10,
  },
  mediumText: {
    fontSize: 12,
  },
  largeText: {
    fontSize: 14,
  },
  
  // Icon styles
  iconWithText: {
    marginRight: 4,
  },
  
  // Dot badge styles
  dot: {
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dotSmall: {
    width: 8,
    height: 8,
  },
  dotMedium: {
    width: 12,
    height: 12,
  },
});

export default Badge;