/**
 * @fileoverview Registration screen component
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React, { useState, useEffect } from 'react';
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
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { registerUser, clearAuthError, googleLogin } from '../../store/slices/authSlice';
import { RegisterScreenProps } from '../../navigation/types';
import { colors } from '../../theme';
import PhoneInput from '../../components/ui/PhoneInput';
import { Country as CountryServiceCountry } from '../../services/CountryService';
import { CurrencyService } from '../../services/CurrencyService';

/** Lightweight country shape matching what PhoneInput emits */
interface PhoneCountry {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { googleAuthService } from '../../services/googleAuthService';
import logger from '../../services/LoggingService';
import { useI18n } from '../../i18n/I18nContext';

const log = logger.createLogger('RegisterScreen');

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'passenger' as 'passenger' | 'driver',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isFormValid, setIsFormValid] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry | null>(null);
  const [suggestedCurrency, setSuggestedCurrency] = useState<string | null>(null);

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  useEffect(() => {
    validateForm();
  }, [formData, agreeToTerms]);

  useEffect(() => {
    if (error) {
      Alert.alert(t('register.failed'), error, [
        { text: t('common.ok'), onPress: () => dispatch(clearAuthError()) },
      ]);
    }
  }, [error, dispatch]);

  const validateForm = (): void => {
    const errors: Record<string, string> = {};

    // First name validation
    if (!formData.firstName.trim()) {
      errors.firstName = t('register.firstNameRequired');
    } else if (formData.firstName.length < 2) {
      errors.firstName = t('register.firstNameShort');
    }

    // Last name validation
    if (!formData.lastName.trim()) {
      errors.lastName = t('register.lastNameRequired');
    } else if (formData.lastName.length < 2) {
      errors.lastName = t('register.lastNameShort');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      errors.email = t('register.emailRequired');
    } else if (!emailRegex.test(formData.email)) {
      errors.email = t('forgot.enterValidEmail');
    }

    // Phone validation (simplified since PhoneInput handles country code)
    if (!formData.phone) {
      errors.phone = t('register.phoneRequired');
    } else if (formData.phone.replace(/\s/g, '').length < 6) {
      errors.phone = t('register.phoneShort');
    } else if (!/^\d+$/.test(formData.phone.replace(/[\s\-]/g, ''))) {
      errors.phone = t('register.phoneDigits');
    }

    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!formData.password) {
      errors.password = t('register.passwordRequired');
    } else if (!passwordRegex.test(formData.password)) {
      errors.password = t('register.passwordMix');
    } else if (formData.password.length < 8) {
      errors.password = t('register.passwordShort');
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = t('register.confirmRequired');
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = t('register.mismatch');
    }

    // Terms validation
    if (!agreeToTerms) {
      errors.terms = t('register.mustAgree');
    }

    setValidationErrors(errors);
    setIsFormValid(Object.keys(errors).length === 0);
  };

  const handleInputChange = (field: keyof typeof formData, value: string): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCountryChange = async (country: PhoneCountry): Promise<void> => {
    setSelectedCountry(country);

    // Automatically suggest currency based on country
    try {
      const currencies = await CurrencyService.getCurrenciesByCountry(country.code);
      if (currencies && currencies.length > 0) {
        const primaryCurrency = currencies[0];
        setSuggestedCurrency(primaryCurrency.code);
        
        // Show currency suggestion to user
        Alert.alert(
          t('register.currencyTitle'),
          t('register.currencyBody', { country: country.name, currency: primaryCurrency.name, code: primaryCurrency.code }),
          [
            { text: t('common.ok'), style: 'default' }
          ]
        );

        // Automatically set the user's currency preference
        try {
          await CurrencyService.setUserCurrency(primaryCurrency.code);
        } catch (error) {
          log.error('Error setting user currency:', error);
        }
      }
    } catch (error) {
      log.error('Error getting currency suggestion:', error);
      // Set fallback currency based on common country mappings
      const fallbackCurrencies: Record<string, string> = {
        'BW': 'BWP',
        'ZA': 'ZAR',
        'NA': 'NAD',
        'ZM': 'ZMW',
        'MZ': 'MZN',
        'MW': 'MWK',
        'SZ': 'SZL',
        'LS': 'LSL',
        'ZW': 'ZWL',
        'AO': 'AOA',
        'TZ': 'TZS',
        'KE': 'KES',
        'NG': 'NGN',
        'GH': 'GHS',
        'UG': 'UGX',
        'US': 'USD',
        'GB': 'GBP',
        'CA': 'CAD',
        'AU': 'AUD',
      };

      const fallbackCurrency = fallbackCurrencies[country.code] || 'BWP';
      setSuggestedCurrency(fallbackCurrency);
    }
  };

  const handleRegister = async (): Promise<void> => {
    if (!isFormValid) return;

    try {
      // Construct full phone number with country code
      const fullPhoneNumber = selectedCountry?.dialCode
        ? `${selectedCountry.dialCode}${formData.phone.replace(/\s/g, '')}`
        : formData.phone.replace(/\s/g, '');

      await dispatch(registerUser({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.toLowerCase().trim(),
        phone: fullPhoneNumber,
        password: formData.password,
        role: formData.role,
        country: selectedCountry?.code,
        currency: suggestedCurrency || undefined,
      })).unwrap();

      // Navigate to verification screen
      navigation.navigate('Verification', {
        email: formData.email,
        type: 'email',
      });
    } catch (err) {
      // Error handled by useEffect
      log.info('Registration error handled by useEffect');
    }
  };

  // Google first, then keep the session it returns, as the Login screen's
  // button does. This handed googleLogin empty tokens and relied on it
  // signing in by itself, which it no longer does.
  const handleGoogleSignUp = async (): Promise<void> => {
    try {
      const result = await googleAuthService.signIn();
      if (result.cancelled) return;
      if (!result.success || !result.user || !result.tokens) {
        Alert.alert(t('login.googleFailed'), result.error || t('ui.unableToSignInWith'));
        return;
      }
      await dispatch(googleLogin({ user: result.user, tokens: result.tokens })).unwrap();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      Alert.alert(t('login.googleFailed'), errMsg || t('ui.unableToSignInWith'));
    }
  };

  const handleLogin = (): void => {
    navigation.navigate('Login');
  };

  const handleGoBack = (): void => {
    navigation.goBack();
  };

  const renderError = (field: string): React.ReactNode => {
    if (validationErrors[field]) {
      return (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={16} color="#F44336" />
          <Text style={styles.errorText}>{validationErrors[field]}</Text>
        </View>
      );
    }
    return null;
  };

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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Icon name="arrow-back" size={24} color="#333333" />
            </TouchableOpacity>
            <Text style={styles.title}>{t('auth.createAccount')}</Text>
            <Text style={styles.subtitle}>{t('register.subtitle')}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name Row */}
            <View style={styles.nameRow}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>{t('register.firstName')}</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('register.firstNamePlaceholder')}
                    placeholderTextColor="#999999"
                    value={formData.firstName}
                    onChangeText={(text) => handleInputChange('firstName', text)}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
                {renderError('firstName')}
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>{t('register.lastName')}</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('register.lastNamePlaceholder')}
                    placeholderTextColor="#999999"
                    value={formData.lastName}
                    onChangeText={(text) => handleInputChange('lastName', text)}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
                {renderError('lastName')}
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('login.emailLabel')}</Text>
              <View style={styles.inputWrapper}>
                <Icon name="email" size={20} color="#666666" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={t('login.emailPlaceholder')}
                  placeholderTextColor="#999999"
                  value={formData.email}
                  onChangeText={(text) => handleInputChange('email', text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
              {renderError('email')}
            </View>

            {/* Phone Input with Country Code */}
            <PhoneInput
              value={formData.phone}
              onChangeText={(text) => handleInputChange('phone', text)}
              onCountryChange={handleCountryChange}
              error={validationErrors.phone}
              defaultCountry="BW"
            />

            {/* Role Selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('register.iWantTo')}</Text>
              <View style={styles.roleContainer}>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    formData.role === 'passenger' && styles.roleOptionSelected,
                  ]}
                  onPress={() => handleInputChange('role', 'passenger')}
                >
                  <Icon
                    name="person"
                    size={20}
                    color={formData.role === 'passenger' ? '#2196F3' : '#666666'}
                  />
                  <Text
                    style={[
                      styles.roleText,
                      formData.role === 'passenger' && styles.roleTextSelected,
                    ]}
                  >
                    {t('register.findRides')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    formData.role === 'driver' && styles.roleOptionSelected,
                  ]}
                  onPress={() => handleInputChange('role', 'driver')}
                >
                  <Icon
                    name="directions-car"
                    size={20}
                    color={formData.role === 'driver' ? '#2196F3' : '#666666'}
                  />
                  <Text
                    style={[
                      styles.roleText,
                      formData.role === 'driver' && styles.roleTextSelected,
                    ]}
                  >
                    {t('register.offerRides')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('auth.password')}</Text>
              <View style={styles.inputWrapper}>
                <Icon name="lock" size={20} color="#666666" style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { paddingRight: 48 }]}
                  placeholder={t('register.createPassword')}
                  placeholderTextColor="#999999"
                  value={formData.password}
                  onChangeText={(text) => handleInputChange('password', text)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Icon
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color="#666666"
                  />
                </TouchableOpacity>
              </View>
              {renderError('password')}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('register.confirmPassword')}</Text>
              <View style={styles.inputWrapper}>
                <Icon name="lock" size={20} color="#666666" style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { paddingRight: 48 }]}
                  placeholder={t('register.confirmPlaceholder')}
                  placeholderTextColor="#999999"
                  value={formData.confirmPassword}
                  onChangeText={(text) => handleInputChange('confirmPassword', text)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Icon
                    name={showConfirmPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color="#666666"
                  />
                </TouchableOpacity>
              </View>
              {renderError('confirmPassword')}
            </View>

            {/* Terms and Conditions */}
            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => setAgreeToTerms(!agreeToTerms)}
            >
              <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
                {agreeToTerms && <Icon name="check" size={16} color="#FFFFFF" />}
              </View>
              <Text style={styles.termsText}>
                {t('register.iAgree')}{' '}
                <Text style={styles.linkText}>{t('welcome.terms')}</Text>
                {' '}{t('welcome.and')}{' '}
                <Text style={styles.linkText}>{t('welcome.privacy')}</Text>
              </Text>
            </TouchableOpacity>
            {renderError('terms')}

            {/* Register Button */}
            <TouchableOpacity
              style={[
                styles.registerButton,
                (!isFormValid || isLoading) && styles.registerButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={!isFormValid || isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.registerButtonText}>
                {isLoading ? t('register.creating') : t('auth.createAccount')}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('register.orUpper')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign Up */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignUp}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Icon name="login" size={20} color={colors.text.primary} />
              <Text style={styles.googleButtonText}>{t('register.continueGoogle')}</Text>
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginSection}>
              <Text style={styles.loginText}>{t('register.haveAccount')}</Text>
              <TouchableOpacity onPress={handleLogin}>
                <Text style={styles.loginLink}>{t('login.signIn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
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
    color: colors.text.primary,
    marginBottom: 8,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  form: {
    gap: 20,
  },
  nameRow: {
    flexDirection: 'row',
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
  passwordToggle: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    gap: 8,
  },
  roleOptionSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  roleTextSelected: {
    color: '#2196F3',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  linkText: {
    color: '#2196F3',
    textDecorationLine: 'underline',
  },
  registerButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    elevation: 2,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  registerButtonDisabled: {
    backgroundColor: '#CCCCCC',
    elevation: 0,
    shadowOpacity: 0,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
  },
  loginText: {
    fontSize: 14,
    color: '#666666',
  },
  loginLink: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
  },
});

export default RegisterScreen;