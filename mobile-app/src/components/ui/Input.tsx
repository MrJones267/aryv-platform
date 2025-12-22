/**
 * @fileoverview Reusable Input component with validation and various types
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useState, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export type InputVariant = 'default' | 'filled' | 'outlined';
export type InputSize = 'small' | 'medium' | 'large';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  variant?: InputVariant;
  size?: InputSize;
  error?: string;
  helperText?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  password?: boolean;
  disabled?: boolean;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  testID?: string;
}

export const Input = forwardRef<TextInput, InputProps>(({
  label,
  placeholder,
  value,
  onChangeText,
  variant = 'default',
  size = 'medium',
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  password = false,
  disabled = false,
  required = false,
  containerStyle,
  inputStyle,
  labelStyle,
  testID,
  ...textInputProps
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const hasError = Boolean(error);
  const hasValue = Boolean(value);

  const containerStyles = [
    styles.container,
    containerStyle,
  ];

  const inputContainerStyles = [
    styles.inputContainer,
    styles[variant],
    styles[size],
    isFocused && styles.focused,
    hasError && styles.error,
    disabled && styles.disabled,
  ];

  const textInputStyles = [
    styles.input,
    styles[`${size}Input`],
    disabled && styles.disabledInput,
    inputStyle,
  ];

  const labelStyles = [
    styles.label,
    hasError && styles.errorLabel,
    required && styles.requiredLabel,
    labelStyle,
  ];

  const iconSize = size === 'small' ? 16 : size === 'large' ? 24 : 20;
  const iconColor = hasError ? '#F44336' : isFocused ? '#2196F3' : '#666666';

  const handleRightIconPress = () => {
    if (password) {
      setShowPassword(!showPassword);
    } else if (onRightIconPress) {
      onRightIconPress();
    }
  };

  const getRightIcon = () => {
    if (password) {
      return showPassword ? 'visibility' : 'visibility-off';
    }
    return rightIcon;
  };

  const renderLabel = () => {
    if (!label) return null;

    return (
      <Text style={labelStyles}>
        {label}
        {required && <Text style={styles.asterisk}> *</Text>}
      </Text>
    );
  };

  const renderHelperText = () => {
    const text = error || helperText;
    if (!text) return null;

    return (
      <Text style={[
        styles.helperText,
        hasError && styles.errorText,
      ]}>
        {text}
      </Text>
    );
  };

  return (
    <View style={containerStyles}>
      {renderLabel()}
      
      <View style={inputContainerStyles}>
        {leftIcon && (
          <Icon
            name={leftIcon}
            size={iconSize}
            color={iconColor}
            style={styles.leftIcon}
          />
        )}
        
        <TextInput
          ref={ref}
          style={textInputStyles}
          placeholder={placeholder}
          placeholderTextColor="#999999"
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={password && !showPassword}
          editable={!disabled}
          testID={testID}
          {...textInputProps}
        />
        
        {(rightIcon || password) && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={handleRightIconPress}
            disabled={!password && !onRightIconPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name={getRightIcon() || 'help'}
              size={iconSize}
              color={iconColor}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {renderHelperText()}
    </View>
  );
});

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  requiredLabel: {
    // Additional styling for required fields
  },
  asterisk: {
    color: '#F44336',
  },
  errorLabel: {
    color: '#F44336',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  focused: {
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  error: {
    borderColor: '#F44336',
  },
  disabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.6,
  },
  
  // Variants
  default: {
    backgroundColor: '#FFFFFF',
  },
  filled: {
    backgroundColor: '#F5F5F5',
    borderWidth: 0,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  
  // Sizes
  small: {
    minHeight: 32,
    paddingHorizontal: 12,
  },
  medium: {
    minHeight: 44,
    paddingHorizontal: 16,
  },
  large: {
    minHeight: 52,
    paddingHorizontal: 20,
  },
  
  input: {
    flex: 1,
    color: '#333333',
    paddingVertical: 0, // Remove default padding
  },
  disabledInput: {
    color: '#999999',
  },
  
  // Input sizes
  smallInput: {
    fontSize: 14,
  },
  mediumInput: {
    fontSize: 16,
  },
  largeInput: {
    fontSize: 18,
  },
  
  // Icons
  leftIcon: {
    marginRight: 12,
  },
  rightIconContainer: {
    marginLeft: 8,
    padding: 4,
  },
  
  // Helper text
  helperText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    marginLeft: 4,
  },
  errorText: {
    color: '#F44336',
  },
});

export default Input;