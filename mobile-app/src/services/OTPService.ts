/**
 * @fileoverview OTP verification service with Twilio SMS and SendGrid email integration
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiClient } from './ApiClient';
import { AuthService } from './AuthService';
import logger from './LoggingService';

const log = logger.createLogger('OTPService');

export interface OTPRequest {
  type: 'sms' | 'email';
  recipient: string; // phone number or email
  purpose: 'registration' | 'login' | 'password_reset' | 'phone_verification' | 'email_verification';
  templateId?: string;
}

export interface OTPVerification {
  type: 'sms' | 'email';
  recipient: string;
  code: string;
  purpose: 'registration' | 'login' | 'password_reset' | 'phone_verification' | 'email_verification';
}

export interface OTPResponse {
  success: boolean;
  message: string;
  data?: {
    requestId?: string;
    expiresAt?: string;
    cooldownUntil?: string;
  };
  error?: string;
}

export interface OTPVerificationResponse {
  success: boolean;
  message: string;
  data?: {
    verified: boolean;
    token?: string; // JWT token for successful verification
    user?: {
      id: string;
      email?: string;
      phone?: string;
      verified: boolean;
    }; // User data if applicable
  };
  error?: string;
}

export interface OTPSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  maxAttempts: number;
  cooldownPeriod: number; // in seconds
  codeLength: number;
  expiryTime: number; // in minutes
}

class OTPService {
  private apiClient: ApiClient;
  private authService: AuthService;
  private readonly STORAGE_PREFIX = 'otp_';
  private readonly DEFAULT_SETTINGS: OTPSettings = {
    smsEnabled: true,
    emailEnabled: true,
    maxAttempts: 3,
    cooldownPeriod: 60, // 1 minute
    codeLength: 6,
    expiryTime: 10, // 10 minutes
  };

  constructor() {
    this.apiClient = new ApiClient();
    this.authService = new AuthService();
  }

  /**
   * Send OTP via SMS using Twilio
   */
  async sendSMSOTP(request: OTPRequest): Promise<OTPResponse> {
    try {
      // Validate phone number format
      if (!this.isValidPhoneNumber(request.recipient)) {
        return {
          success: false,
          message: 'Invalid phone number format',
          error: 'INVALID_PHONE_NUMBER',
        };
      }

      // Check cooldown period
      const cooldownCheck = await this.checkCooldown(request.recipient, 'sms');
      if (!cooldownCheck.allowed) {
        return {
          success: false,
          message: `Please wait ${cooldownCheck.remainingTime} seconds before requesting another code`,
          error: 'COOLDOWN_ACTIVE',
          data: {
            cooldownUntil: cooldownCheck.cooldownUntil,
          },
        };
      }

      // Check if we're in development mode
      if (__DEV__) {
        return this.sendMockSMSOTP(request);
      }

      // Send SMS via Twilio API
      const response = await this.apiClient.post('/otp/sms/send', {
        to: request.recipient,
        purpose: request.purpose,
        templateId: request.templateId,
      });

      if (response.success) {
        // Store cooldown information
        await this.setCooldown(request.recipient, 'sms');
        
        return {
          success: true,
          message: 'SMS verification code sent successfully',
          data: {
            requestId: response.data?.requestId,
            expiresAt: response.data?.expiresAt,
          },
        };
      }

      return {
        success: false,
        message: response.error || 'Failed to send SMS verification code',
        error: 'SMS_SEND_FAILED',
      };
    } catch (error) {
      log.error('SMS OTP send error', error);
      return {
        success: false,
        message: 'Failed to send verification code',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Send OTP via Email using SendGrid
   */
  async sendEmailOTP(request: OTPRequest): Promise<OTPResponse> {
    try {
      // Validate email format
      if (!this.isValidEmail(request.recipient)) {
        return {
          success: false,
          message: 'Invalid email address format',
          error: 'INVALID_EMAIL',
        };
      }

      // Check cooldown period
      const cooldownCheck = await this.checkCooldown(request.recipient, 'email');
      if (!cooldownCheck.allowed) {
        return {
          success: false,
          message: `Please wait ${cooldownCheck.remainingTime} seconds before requesting another code`,
          error: 'COOLDOWN_ACTIVE',
          data: {
            cooldownUntil: cooldownCheck.cooldownUntil,
          },
        };
      }

      // Check if we're in development mode
      if (__DEV__) {
        return this.sendMockEmailOTP(request);
      }

      // Send Email via SendGrid API
      const response = await this.apiClient.post('/otp/email/send', {
        to: request.recipient,
        purpose: request.purpose,
        templateId: request.templateId,
      });

      if (response.success) {
        // Store cooldown information
        await this.setCooldown(request.recipient, 'email');
        
        return {
          success: true,
          message: 'Email verification code sent successfully',
          data: {
            requestId: response.data?.requestId,
            expiresAt: response.data?.expiresAt,
          },
        };
      }

      return {
        success: false,
        message: response.error || 'Failed to send email verification code',
        error: 'EMAIL_SEND_FAILED',
      };
    } catch (error) {
      log.error('Email OTP send error', error);
      return {
        success: false,
        message: 'Failed to send verification code',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(verification: OTPVerification): Promise<OTPVerificationResponse> {
    try {
      // Validate code format
      if (!this.isValidOTPCode(verification.code)) {
        return {
          success: false,
          message: 'Invalid verification code format',
          error: 'INVALID_CODE_FORMAT',
        };
      }

      // Check attempt count
      const attempts = await this.getAttemptCount(verification.recipient, verification.type);
      if (attempts >= this.DEFAULT_SETTINGS.maxAttempts) {
        return {
          success: false,
          message: 'Maximum verification attempts exceeded. Please request a new code.',
          error: 'MAX_ATTEMPTS_EXCEEDED',
        };
      }

      // Increment attempt count
      await this.incrementAttemptCount(verification.recipient, verification.type);

      // Check if we're in development mode
      if (__DEV__) {
        return this.verifyMockOTP(verification);
      }

      // Verify with backend
      const response = await this.apiClient.post('/otp/verify', {
        type: verification.type,
        recipient: verification.recipient,
        code: verification.code,
        purpose: verification.purpose,
      });

      if (response.success) {
        // Clear attempt count on successful verification
        await this.clearAttemptCount(verification.recipient, verification.type);
        
        return {
          success: true,
          message: 'Verification successful',
          data: {
            verified: true,
            token: response.data?.token,
            user: response.data?.user,
          },
        };
      }

      return {
        success: false,
        message: response.error || 'Invalid verification code',
        error: 'VERIFICATION_FAILED',
      };
    } catch (error) {
      log.error('OTP verification error', error);
      return {
        success: false,
        message: 'Verification failed',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Get OTP settings
   */
  async getSettings(): Promise<OTPSettings> {
    try {
      const response = await this.apiClient.get('/otp/settings');
      return response.success ? response.data : this.DEFAULT_SETTINGS;
    } catch (error) {
      log.error('Failed to get OTP settings:', error);
      return this.DEFAULT_SETTINGS;
    }
  }

  /**
   * Check if recipient can receive OTP (cooldown check)
   */
  private async checkCooldown(recipient: string, type: 'sms' | 'email'): Promise<{
    allowed: boolean;
    remainingTime: number;
    cooldownUntil?: string;
  }> {
    try {
      const key = `${this.STORAGE_PREFIX}cooldown_${type}_${recipient}`;
      const cooldownData = await AsyncStorage.getItem(key);
      
      if (!cooldownData) {
        return { allowed: true, remainingTime: 0 };
      }

      const { timestamp } = JSON.parse(cooldownData);
      const now = Date.now();
      const elapsed = now - timestamp;
      const remainingTime = Math.max(0, (this.DEFAULT_SETTINGS.cooldownPeriod * 1000) - elapsed);

      if (remainingTime > 0) {
        return {
          allowed: false,
          remainingTime: Math.ceil(remainingTime / 1000),
          cooldownUntil: new Date(now + remainingTime).toISOString(),
        };
      }

      // Cooldown expired, remove it
      await AsyncStorage.removeItem(key);
      return { allowed: true, remainingTime: 0 };
    } catch (error) {
      log.error('Cooldown check error:', error);
      return { allowed: true, remainingTime: 0 };
    }
  }

  /**
   * Set cooldown period
   */
  private async setCooldown(recipient: string, type: 'sms' | 'email'): Promise<void> {
    try {
      const key = `${this.STORAGE_PREFIX}cooldown_${type}_${recipient}`;
      const data = {
        timestamp: Date.now(),
        recipient,
        type,
      };
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      log.error('Set cooldown error:', error);
    }
  }

  /**
   * Get attempt count for recipient
   */
  private async getAttemptCount(recipient: string, type: 'sms' | 'email'): Promise<number> {
    try {
      const key = `${this.STORAGE_PREFIX}attempts_${type}_${recipient}`;
      const data = await AsyncStorage.getItem(key);
      if (!data) return 0;
      
      const { count, timestamp } = JSON.parse(data);
      const now = Date.now();
      const elapsed = now - timestamp;
      
      // Reset attempts after 1 hour
      if (elapsed > 3600000) {
        await AsyncStorage.removeItem(key);
        return 0;
      }
      
      return count || 0;
    } catch (error) {
      log.error('Get attempt count error:', error);
      return 0;
    }
  }

  /**
   * Increment attempt count
   */
  private async incrementAttemptCount(recipient: string, type: 'sms' | 'email'): Promise<void> {
    try {
      const currentCount = await this.getAttemptCount(recipient, type);
      const key = `${this.STORAGE_PREFIX}attempts_${type}_${recipient}`;
      const data = {
        count: currentCount + 1,
        timestamp: Date.now(),
        recipient,
        type,
      };
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      log.error('Increment attempt count error:', error);
    }
  }

  /**
   * Clear attempt count
   */
  private async clearAttemptCount(recipient: string, type: 'sms' | 'email'): Promise<void> {
    try {
      const key = `${this.STORAGE_PREFIX}attempts_${type}_${recipient}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      log.error('Clear attempt count error:', error);
    }
  }

  /**
   * Validate phone number format
   */
  private isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format
    return phoneRegex.test(phone);
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate OTP code format
   */
  private isValidOTPCode(code: string): boolean {
    const codeRegex = new RegExp(`^\\d{${this.DEFAULT_SETTINGS.codeLength}}$`);
    return codeRegex.test(code);
  }

  /**
   * Mock SMS OTP for development
   */
  private async sendMockSMSOTP(request: OTPRequest): Promise<OTPResponse> {
    log.info('🔐 Mock SMS OTP sent to:', request.recipient);
    log.info('📱 Development OTP Code: 123456');
    
    // Store cooldown for mock
    await this.setCooldown(request.recipient, 'sms');
    
    return {
      success: true,
      message: 'Mock SMS verification code sent (Check console for code: 123456)',
      data: {
        requestId: `mock_sms_${Date.now()}`,
        expiresAt: new Date(Date.now() + this.DEFAULT_SETTINGS.expiryTime * 60000).toISOString(),
      },
    };
  }

  /**
   * Mock Email OTP for development
   */
  private async sendMockEmailOTP(request: OTPRequest): Promise<OTPResponse> {
    log.info('🔐 Mock Email OTP sent to:', request.recipient);
    log.info('📧 Development OTP Code: 123456');
    
    // Store cooldown for mock
    await this.setCooldown(request.recipient, 'email');
    
    return {
      success: true,
      message: 'Mock email verification code sent (Check console for code: 123456)',
      data: {
        requestId: `mock_email_${Date.now()}`,
        expiresAt: new Date(Date.now() + this.DEFAULT_SETTINGS.expiryTime * 60000).toISOString(),
      },
    };
  }

  /**
   * Mock OTP verification for development
   */
  private async verifyMockOTP(verification: OTPVerification): Promise<OTPVerificationResponse> {
    // Accept any 6-digit code in development, but prefer 123456
    if (verification.code === '123456' || this.isValidOTPCode(verification.code)) {
      await this.clearAttemptCount(verification.recipient, verification.type);
      
      return {
        success: true,
        message: 'Mock verification successful',
        data: {
          verified: true,
          token: `mock_token_${Date.now()}`,
          user: {
            id: 'mock_user_123',
            [verification.type === 'email' ? 'email' : 'phone']: verification.recipient,
            verified: true,
          },
        },
      };
    }

    return {
      success: false,
      message: 'Invalid verification code (Use 123456 for mock success)',
      error: 'MOCK_VERIFICATION_FAILED',
    };
  }

  /**
   * Clear all OTP data for a recipient
   */
  async clearOTPData(recipient: string): Promise<void> {
    try {
      const keys = [
        `${this.STORAGE_PREFIX}cooldown_sms_${recipient}`,
        `${this.STORAGE_PREFIX}cooldown_email_${recipient}`,
        `${this.STORAGE_PREFIX}attempts_sms_${recipient}`,
        `${this.STORAGE_PREFIX}attempts_email_${recipient}`,
      ];
      await Promise.all(keys.map(key => AsyncStorage.removeItem(key)));
    } catch (error) {
      log.error('Clear OTP data error:', error);
    }
  }

  /**
   * Get OTP status for recipient
   */
  async getOTPStatus(recipient: string, type: 'sms' | 'email'): Promise<{
    canSend: boolean;
    cooldownRemaining: number;
    attemptsRemaining: number;
  }> {
    try {
      const cooldownCheck = await this.checkCooldown(recipient, type);
      const attempts = await this.getAttemptCount(recipient, type);
      
      return {
        canSend: cooldownCheck.allowed,
        cooldownRemaining: cooldownCheck.remainingTime,
        attemptsRemaining: Math.max(0, this.DEFAULT_SETTINGS.maxAttempts - attempts),
      };
    } catch (error) {
      log.error('Get OTP status error:', error);
      return {
        canSend: true,
        cooldownRemaining: 0,
        attemptsRemaining: this.DEFAULT_SETTINGS.maxAttempts,
      };
    }
  }
}

export { OTPService };
export default new OTPService();