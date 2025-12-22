/**
 * @fileoverview Authentication API service
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import BaseApiService, { ApiResponse } from './baseApi';

// Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  role?: 'passenger' | 'driver';
  dateOfBirth?: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'passenger' | 'driver' | 'admin' | 'courier';
  status: 'active' | 'suspended' | 'pending_verification' | 'deactivated';
  profilePicture?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface VerifyTokenResponse {
  user: AuthUser;
  tokenValid: boolean;
}

class AuthApiService extends BaseApiService {
  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
    return this.post<AuthResponse>('/auth/login', credentials);
  }

  /**
   * Register new user
   */
  async register(userData: RegisterData): Promise<ApiResponse<AuthResponse>> {
    return this.post<AuthResponse>('/auth/register', userData);
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<ApiResponse<RefreshTokenResponse>> {
    return this.post<RefreshTokenResponse>('/auth/refresh', { refreshToken });
  }

  /**
   * Logout user
   */
  async logout(): Promise<ApiResponse<void>> {
    return this.post<void>('/auth/logout');
  }

  /**
   * Verify token validity
   */
  async verifyToken(): Promise<ApiResponse<VerifyTokenResponse>> {
    return this.get<VerifyTokenResponse>('/auth/verify');
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<ApiResponse<AuthUser>> {
    return this.get<AuthUser>('/auth/profile');
  }

  /**
   * Send password reset email
   */
  async forgotPassword(email: string): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>('/auth/forgot-password', { email });
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string, 
    newPassword: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>('/auth/reset-password', { 
      token, 
      newPassword 
    });
  }

  /**
   * Send email verification (legacy - uses OTPService internally)
   */
  async sendEmailVerification(): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>('/auth/send-email-verification');
  }

  /**
   * Verify email with token (legacy - uses OTPService internally)
   */
  async verifyEmail(token: string): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>('/auth/verify-email', { token });
  }

  /**
   * Send phone verification code (legacy - uses OTPService internally)
   */
  async sendPhoneVerification(phone: string): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>('/auth/send-phone-verification', { phone });
  }

  /**
   * Verify phone with code (legacy - uses OTPService internally)
   */
  async verifyPhone(
    phone: string, 
    code: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>('/auth/verify-phone', { phone, code });
  }

  /**
   * Send OTP via SMS using Twilio
   */
  async sendSMSOTP(request: {
    phone: string;
    purpose: 'registration' | 'login' | 'password_reset' | 'phone_verification';
    templateId?: string;
  }): Promise<ApiResponse<{
    requestId?: string;
    expiresAt?: string;
    message: string;
  }>> {
    return this.post('/auth/otp/sms/send', request);
  }

  /**
   * Send OTP via Email using SendGrid
   */
  async sendEmailOTP(request: {
    email: string;
    purpose: 'registration' | 'login' | 'password_reset' | 'email_verification';
    templateId?: string;
  }): Promise<ApiResponse<{
    requestId?: string;
    expiresAt?: string;
    message: string;
  }>> {
    return this.post('/auth/otp/email/send', request);
  }

  /**
   * Verify OTP code (SMS or Email)
   */
  async verifyOTP(request: {
    type: 'sms' | 'email';
    recipient: string; // phone or email
    code: string;
    purpose: 'registration' | 'login' | 'password_reset' | 'phone_verification' | 'email_verification';
  }): Promise<ApiResponse<{
    verified: boolean;
    token?: string;
    user?: AuthUser;
    message: string;
  }>> {
    return this.post('/auth/otp/verify', request);
  }

  /**
   * Get OTP status for recipient
   */
  async getOTPStatus(recipient: string, type: 'sms' | 'email'): Promise<ApiResponse<{
    canSend: boolean;
    cooldownRemaining: number;
    attemptsRemaining: number;
  }>> {
    return this.get(`/auth/otp/status?recipient=${encodeURIComponent(recipient)}&type=${type}`);
  }

  /**
   * Login with OTP (passwordless)
   */
  async loginWithOTP(request: {
    type: 'sms' | 'email';
    recipient: string;
    code: string;
  }): Promise<ApiResponse<AuthResponse>> {
    return this.post<AuthResponse>('/auth/login/otp', request);
  }

  /**
   * Register with OTP verification
   */
  async registerWithOTP(userData: RegisterData & {
    otpCode: string;
    otpType: 'sms' | 'email';
  }): Promise<ApiResponse<AuthResponse>> {
    return this.post<AuthResponse>('/auth/register/otp', userData);
  }

  /**
   * Reset password with OTP
   */
  async resetPasswordWithOTP(request: {
    type: 'sms' | 'email';
    recipient: string;
    code: string;
    newPassword: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>('/auth/password-reset/otp', request);
  }

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string, 
    newPassword: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  }

  /**
   * Delete account
   */
  async deleteAccount(password: string): Promise<ApiResponse<{ message: string }>> {
    return this.delete<{ message: string }>('/auth/account', {
      data: { password },
    });
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<AuthUser>): Promise<ApiResponse<AuthUser>> {
    return this.patch<AuthUser>('/auth/profile', updates);
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(imageUri: string): Promise<ApiResponse<{ profilePictureUrl: string }>> {
    const formData = new FormData();
    formData.append('profilePicture', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'profile.jpg',
    } as any);

    return this.upload<{ profilePictureUrl: string }>('/auth/upload-profile-picture', formData);
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<ApiResponse<{
    ridesCompleted: number;
    ridesOffered: number;
    totalDistance: number;
    rating: number;
    joinDate: string;
  }>> {
    return this.get('/auth/stats');
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(preferences: {
    pushNotifications: boolean;
    rideUpdates: boolean;
    messages: boolean;
    promotions: boolean;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.patch('/auth/notification-preferences', preferences);
  }

  /**
   * Get user's notification preferences
   */
  async getNotificationPreferences(): Promise<ApiResponse<{
    pushNotifications: boolean;
    rideUpdates: boolean;
    messages: boolean;
    promotions: boolean;
  }>> {
    return this.get('/auth/notification-preferences');
  }
}

// Export singleton instance
export const authApi = new AuthApiService();
export default authApi;