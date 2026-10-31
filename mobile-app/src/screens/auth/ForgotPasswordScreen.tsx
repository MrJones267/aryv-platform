/**
 * @fileoverview Forgot password: reset with a code sent by SMS or email
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2026-10-31
 *
 * This sent a reset link by email. Nothing could open it: the link pointed at
 * a /reset-password page that exists neither on the website nor in the app,
 * and production has no mail server, so the email was never sent anyway. The
 * screen said "Email sent" regardless.
 *
 * A code is sent instead (by SMS, which works today, or email once a mail
 * server is set up) and redeemed here with the new password through
 * POST /auth/password-reset/otp. The code is bound to password reset, so a
 * verification code from elsewhere cannot be spent here.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { authApi } from '../../services/api';
import { useI18n } from '../../i18n/I18nContext';

interface ForgotPasswordScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

type Method = 'sms' | 'email';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The server normalises the number (Botswana by default); this only stops
// obviously incomplete input.
const PHONE_PATTERN = /^\+?[\d\s-]{7,}$/;
// The server's rules, so the person hears about them before sending.
const strongEnough = (p: string): boolean =>
  p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const { t } = useI18n();
  const [method, setMethod] = useState<Method>('sms');
  const [recipient, setRecipient] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const cleanRecipient = method === 'email' ? recipient.toLowerCase().trim() : recipient.trim();
  const recipientValid = method === 'email' ? EMAIL_PATTERN.test(cleanRecipient) : PHONE_PATTERN.test(cleanRecipient);

  const errorText = (error: unknown, fallback: string): string =>
    (error instanceof Error && error.message) || fallback;

  const handleSendCode = async (): Promise<void> => {
    if (!recipientValid) {
      Alert.alert(t('common.error'), method === 'email' ? t('forgot.enterValidEmail') : t('rst.invalidPhone'));
      return;
    }
    setIsLoading(true);
    try {
      const response = method === 'sms'
        ? await authApi.sendSMSOTP({ phone: cleanRecipient, purpose: 'password_reset' })
        : await authApi.sendEmailOTP({ email: cleanRecipient, purpose: 'password_reset' });
      if (response.success) {
        setCodeSent(true);
        setCode('');
      } else {
        Alert.alert(t('common.error'), response.error || t('forgot.sendFailed'));
      }
    } catch (error: unknown) {
      Alert.alert(t('common.error'), errorText(error, t('forgot.networkError')));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert(t('common.error'), t('rst.enterCode'));
      return;
    }
    if (!strongEnough(password)) {
      Alert.alert(t('common.error'), t('rst.passwordRules'));
      return;
    }
    if (password !== confirm) {
      Alert.alert(t('common.error'), t('rst.passwordsDiffer'));
      return;
    }
    setIsLoading(true);
    try {
      const response = await authApi.resetPasswordWithOTP({
        type: method,
        recipient: cleanRecipient,
        code: code.trim(),
        newPassword: password,
      });
      if (response.success) {
        Alert.alert(t('rst.doneTitle'), t('rst.doneBody'), [
          { text: t('common.ok'), onPress: () => navigation.navigate('Login') },
        ]);
      } else {
        Alert.alert(t('common.error'), response.error || t('forgot.sendFailed'));
      }
    } catch (error: unknown) {
      Alert.alert(t('common.error'), errorText(error, t('forgot.networkError')));
    } finally {
      setIsLoading(false);
    }
  };

  const chooseMethod = (next: Method): void => {
    if (next === method) return;
    setMethod(next);
    setRecipient('');
  };

  const canReset = code.trim().length === 6 && password.length > 0 && confirm.length > 0 && !isLoading;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Icon name="arrow-back" size={24} color="#333333" />
            </TouchableOpacity>
            <Text style={styles.title}>{t('auth.forgotPassword')}</Text>
            <Text style={styles.subtitle}>
              {codeSent ? t('rst.codeSentTo', { recipient: cleanRecipient }) : t('rst.introCode')}
            </Text>
          </View>

          <View style={styles.illustrationContainer}>
            <View style={styles.illustration}>
              <Icon name="lock-reset" size={60} color="#2196F3" />
            </View>
          </View>

          {!codeSent ? (
            <View style={styles.form}>
              <View style={styles.methodTabs}>
                {(['sms', 'email'] as Method[]).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodTab, method === m && styles.methodTabActive]}
                    onPress={() => chooseMethod(m)}
                  >
                    <Icon name={m === 'sms' ? 'phone' : 'email'} size={18} color={method === m ? '#FFFFFF' : '#2196F3'} />
                    <Text style={[styles.methodTabText, method === m && styles.methodTabTextActive]}>
                      {m === 'sms' ? t('rst.byPhone') : t('rst.byEmail')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{method === 'sms' ? t('rst.phoneLabel') : t('login.emailLabel')}</Text>
                <View style={styles.inputWrapper}>
                  <Icon name={method === 'sms' ? 'phone' : 'email'} size={20} color="#666666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder={method === 'sms' ? t('rst.phonePlaceholder') : t('forgot.emailPlaceholder')}
                    placeholderTextColor="#999999"
                    value={recipient}
                    onChangeText={setRecipient}
                    keyboardType={method === 'sms' ? 'phone-pad' : 'email-address'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSendCode}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.sendButton, (!recipientValid || isLoading) && styles.sendButtonDisabled]}
                onPress={handleSendCode}
                disabled={!recipientValid || isLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.sendButtonText}>{isLoading ? t('forgot.sending') : t('rst.sendCode')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('rst.codeLabel')}</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="pin" size={20} color="#666666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="123456"
                    placeholderTextColor="#999999"
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    maxLength={6}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('rst.newPassword')}</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="lock" size={20} color="#666666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    testID="reset-new-password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                  />
                </View>
                <Text style={styles.helperText}>{t('rst.passwordRules')}</Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('rst.confirmPassword')}</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="lock" size={20} color="#666666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    testID="reset-confirm-password"
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleReset}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.sendButton, !canReset && styles.sendButtonDisabled]}
                onPress={handleReset}
                disabled={!canReset}
                activeOpacity={0.8}
              >
                <Text style={styles.sendButtonText}>{isLoading ? t('rst.resetting') : t('rst.resetButton')}</Text>
              </TouchableOpacity>

              <View style={styles.alternativeActions}>
                <TouchableOpacity onPress={handleSendCode} disabled={isLoading}>
                  <Text style={styles.alternativeLink}>{t('rst.resend')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCodeSent(false)} disabled={isLoading}>
                  <Text style={styles.alternativeLink}>{t('rst.changeRecipient')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.alternativeActions}>
            <Text style={styles.alternativeText}>{t('forgot.remember')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.alternativeLink}>{t('forgot.backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  illustrationContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    gap: 24,
    paddingTop: 20,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    paddingVertical: 0,
  },
  sendButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
    elevation: 0,
    shadowOpacity: 0,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  alternativeActions: {
    alignItems: 'center',
    paddingTop: 32,
    gap: 8,
  },
  alternativeText: {
    fontSize: 14,
    color: '#666666',
  },
  alternativeLink: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 18,
  },
  methodTabs: {
    flexDirection: 'row',
    gap: 12,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 12,
  },
  methodTabActive: {
    backgroundColor: '#2196F3',
  },
  methodTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2196F3',
  },
  methodTabTextActive: {
    color: '#FFFFFF',
  },
});

export default ForgotPasswordScreen;