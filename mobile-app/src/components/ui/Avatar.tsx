/**
 * @fileoverview Reusable Avatar component for user profiles
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  ImageSourcePropType,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export type AvatarSize = 'small' | 'medium' | 'large' | 'xlarge';

interface AvatarProps {
  size?: AvatarSize;
  source?: ImageSourcePropType;
  name?: string;
  backgroundColor?: string;
  onPress?: () => void;
  showOnlineIndicator?: boolean;
  isOnline?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  size = 'medium',
  source,
  name,
  backgroundColor = '#2196F3',
  onPress,
  showOnlineIndicator = false,
  isOnline = false,
  disabled = false,
  style,
  testID,
}) => {
  const avatarStyles = [
    styles.avatar,
    styles[size],
    !source && { backgroundColor },
    disabled && styles.disabled,
    style,
  ];

  const getInitials = (name?: string): string => {
    if (!name) return '';
    
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const getTextSize = (size: AvatarSize): number => {
    switch (size) {
      case 'small': return 12;
      case 'medium': return 16;
      case 'large': return 20;
      case 'xlarge': return 24;
      default: return 16;
    }
  };

  const renderContent = () => {
    if (source) {
      return (
        <Image
          source={source}
          style={[styles.image, styles[size]]}
          resizeMode="cover"
        />
      );
    }

    const initials = getInitials(name);
    if (initials) {
      return (
        <Text style={[styles.text, { fontSize: getTextSize(size) }]}>
          {initials}
        </Text>
      );
    }

    return (
      <Icon
        name="person"
        size={getTextSize(size) + 4}
        color="#FFFFFF"
      />
    );
  };

  const renderOnlineIndicator = () => {
    if (!showOnlineIndicator) return null;

    return (
      <View style={[
        styles.onlineIndicator,
        styles[`${size}Indicator`],
        isOnline ? styles.online : styles.offline,
      ]} />
    );
  };

  const renderAvatar = () => (
    <View style={styles.container}>
      <View style={avatarStyles}>
        {renderContent()}
      </View>
      {renderOnlineIndicator()}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={disabled ? 1 : 0.8}
        testID={testID}
      >
        {renderAvatar()}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID}>
      {renderAvatar()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatar: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.6,
  },
  
  // Sizes
  small: {
    width: 32,
    height: 32,
  },
  medium: {
    width: 48,
    height: 48,
  },
  large: {
    width: 64,
    height: 64,
  },
  xlarge: {
    width: 80,
    height: 80,
  },
  
  // Image styles
  image: {
    borderRadius: 50,
  },
  
  // Text styles
  text: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  // Online indicator
  onlineIndicator: {
    position: 'absolute',
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  online: {
    backgroundColor: '#4CAF50',
  },
  offline: {
    backgroundColor: '#CCCCCC',
  },
  
  // Indicator sizes
  smallIndicator: {
    width: 10,
    height: 10,
    top: 0,
    right: 0,
  },
  mediumIndicator: {
    width: 14,
    height: 14,
    top: -2,
    right: -2,
  },
  largeIndicator: {
    width: 18,
    height: 18,
    top: -2,
    right: -2,
  },
  xlargeIndicator: {
    width: 20,
    height: 20,
    top: -2,
    right: -2,
  },
});

export default Avatar;