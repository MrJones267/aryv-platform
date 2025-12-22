/**
 * @fileoverview Email/Phone verification screen
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { VerificationScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import OTPService from '../../services/OTPService';

const VerificationScreen: React.FC<VerificationScreenProps> = ({ navigation, route }) => {
  const { email, type, purpose = 'email_verification' } = route.params as any;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isCodeComplete, setIsCodeComplete] = useState(false);
  const [otpStatus, setOtpStatus] = useState({
    canSend: true,
    cooldownRemaining: 0,
    attemptsRemaining: 3,
  });

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Start countdown for resend
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    // Check if code is complete
    const completeCode = code.join('');
    setIsCodeComplete(completeCode.length === 6 && /^\d{6}$/.test(completeCode));
  }, [code]);

  useEffect(() => {
    // Auto-verify when code is complete
    if (isCodeComplete && !isLoading) {
      handleVerifyCode();
    }
  }, [isCodeComplete, isLoading]);

  useEffect(() => {
    // Load initial OTP status
    loadOTPStatus();
  }, [email, type]);

  const loadOTPStatus = async (): Promise<void> => {
    try {
      const status = await OTPService.getOTPStatus(email, type === 'phone' ? 'sms' : type);
      setOtpStatus(status);
      setCountdown(status.cooldownRemaining);
    } catch (error) {
      console.error('Failed to load OTP status:', error);
    }
  };

  const handleCodeChange = (value: string, index: number): void => {
    // Only allow single digit
    if (value.length > 1) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number): void => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async (): Promise<void> => {
    const verificationCode = code.join('');
    if (verificationCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter all 6 digits');
      return;
    }

    setIsLoading(true);

    try {
      // Use new OTPService for verification
      const response = await OTPService.verifyOTP({
        type: type === 'phone' ? 'sms' : type,
        recipient: email,
        code: verificationCode,
        purpose: purpose,
      });

      if (response.success) {
        Alert.alert(
          'Verification Successful!',
          `Your ${type} has been verified successfully.`,
          [
            {
              text: 'Continue',
              onPress: () => {
                if (purpose === 'login') {
                  // Handle login flow
                  navigation.navigate('Main' as never);
                } else {
                  navigation.navigate('Login' as never);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Verification Failed', response.message || 'Invalid verification code');
        // Clear the code and update status
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        await loadOTPStatus();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Verification failed');
      // Clear the code
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async (): Promise<void> => {
    if (!otpStatus.canSend || isResending) return;

    setIsResending(true);

    try {
      // Use new OTPService for resending
      const response = type === 'email'
        ? await OTPService.sendEmailOTP({
            type: 'email',
            recipient: email,
            purpose: purpose,
          })
        : await OTPService.sendSMSOTP({
            type: 'sms',
            recipient: email,
            purpose: purpose,
          });

      if (response.success) {
        Alert.alert(
          'Code Resent',
          response.message || `A new verification code has been sent to your ${type}.`
        );
        
        // Update OTP status and countdown
        await loadOTPStatus();
        setCode(['', '', '', '', '', '']); // Clear current code
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert('Error', response.message || 'Failed to resend code');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoBack = (): void => {
    navigation.goBack();
  };

  const handleSkipVerification = (): void => {
    Alert.alert(
      'Skip Verification?',
      'You can verify your account later in your profile settings. Continue without verification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => navigation.navigate('Login' as never),
        },
      ]
    );
  };

  const formatContactInfo = (contact: string): string => {
    if (type === 'email') {
      const [username, domain] = contact.split('@');
      const maskedUsername = username.slice(0, 2) + '*'.repeat(username.length - 2);
      return `${maskedUsername}@${domain}`;
    }
    // Phone number
    return contact.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Icon name="arrow-back" size={24} color="#333333" />
            </TouchableOpacity>
            
            <View style={styles.iconContainer}>
              <Icon
                name={type === 'email' ? 'email' : 'phone'}
                size={40}
                color="#2196F3"
              />
            </View>
            
            <Text style={styles.title}>Verify Your {type === 'email' ? 'Email' : 'Phone'}</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit verification code to{'\n'}
              <Text style={styles.contactInfo}>{formatContactInfo(email)}</Text>
            </Text>
          </View>

          {/* Code Input */}
          <View style={styles.codeContainer}>
            <View style={styles.codeInputs}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[
                    styles.codeInput,
                    digit ? styles.codeInputFilled : null,
                    isLoading ? styles.codeInputDisabled : null,
                  ]}
                  value={digit}
                  onChangeText={(value) => handleCodeChange(value, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  editable={!isLoading}
                  autoFocus={index === 0}
                />
              ))}
            </View>
          </View>

          {/* Loading State */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Verifying code...</Text>
            </View>
          )}

          {/* Resend Section */}
          <View style={styles.resendSection}>
            <Text style={styles.resendText}>
              Didn't receive the code?
              {otpStatus.attemptsRemaining < 3 && (
                <Text style={styles.attemptsText}>
                  {'\n'}{otpStatus.attemptsRemaining} attempts remaining
                </Text>
              )}
            </Text>
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendCode}
              disabled={!otpStatus.canSend || isResending || otpStatus.attemptsRemaining === 0}
            >
              <Text
                style={[
                  styles.resendButtonText,
                  (!otpStatus.canSend || isResending || otpStatus.attemptsRemaining === 0) && styles.resendButtonTextDisabled,
                ]}
              >
                {isResending
                  ? 'Sending...'
                  : !otpStatus.canSend && otpStatus.cooldownRemaining > 0
                  ? `Resend in ${otpStatus.cooldownRemaining}s`
                  : otpStatus.attemptsRemaining === 0
                  ? 'No attempts remaining'
                  : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Manual Verify Button */}
          {!isCodeComplete && (
            <TouchableOpacity
              style={[
                styles.verifyButton,
                code.join('').length !== 6 && styles.verifyButtonDisabled,
              ]}
              onPress={handleVerifyCode}
              disabled={code.join('').length !== 6 || isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.verifyButtonText}>Verify Code</Text>
            </TouchableOpacity>
          )}

          {/* Skip Button */}
          <TouchableOpacity style={styles.skipButton} onPress={handleSkipVerification}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 0,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  contactInfo: {
    fontWeight: '600',
    color: '#333333',
  },
  codeContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  codeInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
  },
  codeInputFilled: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  codeInputDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  resendSection: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  resendText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  attemptsText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  resendButtonTextDisabled: {
    color: '#CCCCCC',
  },
  verifyButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    elevation: 2,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  verifyButtonDisabled: {
    backgroundColor: '#CCCCCC',
    elevation: 0,
    shadowOpacity: 0,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#999999',
    textDecorationLine: 'underline',
  },
});

export default VerificationScreen;