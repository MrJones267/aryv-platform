/**
 * Google Sign-In Button Component
 * Reusable Google authentication button for React Native
 */

import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { googleAuthService, AuthUser } from '../../services/googleAuthService';
import logger from '../../services/LoggingService';

const log = logger.createLogger('GoogleSignInButton');

interface GoogleSignInButtonProps {
  onSuccess?: (user: AuthUser, tokens: { accessToken: string; refreshToken: string; expiresIn: number }) => void;
  onError?: (error: string) => void;
  style?: object;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'contained' | 'outlined';
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  style,
  disabled = false,
  size = 'medium',
  variant = 'contained',
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    
    try {
      log.info('Starting Google Sign-In...');
      
      const result = await googleAuthService.signIn();
      
      if (result.success && result.user && result.tokens) {
        log.info('Google Sign-In completed successfully');
        
        // Call success callback
        if (onSuccess) {
          onSuccess(result.user, result.tokens);
        }
        
        // Show success message
        Alert.alert(
          'Success',
          `Welcome, ${result.user.firstName}!`,
          [{ text: 'OK' }]
        );
      } else {
        log.error('❌ Google Sign-In failed:', result.error);
        
        // Call error callback
        if (onError) {
          onError(result.error || 'Sign in failed');
        }
        
        // Show error message
        Alert.alert(
          'Sign In Failed',
          result.error || 'Unable to sign in with Google. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      log.error('❌ Unexpected Google Sign-In error:', error);
      
      const errorMessage = 'An unexpected error occurred. Please try again.';
      
      if (onError) {
        onError(errorMessage);
      }
      
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const buttonStyles = [
    styles.button,
    styles[size],
    variant === 'outlined' ? styles.outlined : styles.contained,
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${size}Text`],
    variant === 'outlined' ? styles.outlinedText : styles.containedText,
    disabled && styles.disabledText,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={handleGoogleSignIn}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator 
            size="small" 
            color={variant === 'outlined' ? '#4285F4' : '#ffffff'} 
            style={styles.loader}
          />
        ) : (
          <Image
            source={{
              uri: 'https://developers.google.com/identity/images/g-logo.png'
            }}
            style={[styles.icon, styles[`${size}Icon`]]}
          />
        )}
        
        <Text style={textStyles}>
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  
  // Size variants
  small: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  large: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  },
  
  // Style variants
  contained: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  outlined: {
    backgroundColor: '#ffffff',
    borderColor: '#dadce0',
  },
  
  // Disabled state
  disabled: {
    opacity: 0.6,
  },
  
  // Content container
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Icon styles
  icon: {
    marginRight: 8,
  },
  smallIcon: {
    width: 16,
    height: 16,
  },
  mediumIcon: {
    width: 20,
    height: 20,
  },
  largeIcon: {
    width: 24,
    height: 24,
  },
  
  // Text styles
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  
  // Text color variants
  containedText: {
    color: '#ffffff',
  },
  outlinedText: {
    color: '#3c4043',
  },
  disabledText: {
    opacity: 0.6,
  },
  
  // Loader
  loader: {
    marginRight: 8,
  },
});

export default GoogleSignInButton;