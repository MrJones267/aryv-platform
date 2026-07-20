/**
 * @fileoverview Authentication controller with comprehensive error handling
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-20
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import nodemailer from 'nodemailer';
import { AuthService } from '../services/AuthService';
import { redisClient } from '../config/redis';
import User from '../models/User';
import { AuthenticatedRequest, AppError } from '../types';
import logger from '../utils/logger';

// Verifies Google ID tokens against Google's rotating public keys. Constructed
// once at module load: the client caches those keys between requests.
const googleOAuthClient = new OAuth2Client();

const PW_RESET_PREFIX = 'pw_reset:';
const PW_RESET_TTL = 3600; // 1 hour

export class AuthController {
  /**
   * Register new user
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.register(req.body);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Registration error', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.login(req.body);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Login error', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        email: req.body.email,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken || typeof refreshToken !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Refresh token is required',
          code: 'REFRESH_TOKEN_REQUIRED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await AuthService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Token refresh error', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Logout user
   */
  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const accessToken = req.headers.authorization?.split(' ')[1];
      await AuthService.logout(req.user.id, accessToken);

      res.status(200).json({
        success: true,
        message: 'Logout successful',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Logout error', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = await AuthService.getUserById(req.user.id);

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: user,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Get profile error', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Change password for authenticated user
   */
  static async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

      if (!currentPassword || !newPassword) {
        res.status(400).json({ success: false, error: 'currentPassword and newPassword are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({ success: false, error: 'New password must be at least 8 characters', code: 'PASSWORD_TOO_SHORT', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const isValid = await user.comparePassword(currentPassword);
      if (!isValid) {
        res.status(400).json({ success: false, error: 'Current password is incorrect', code: 'INVALID_CURRENT_PASSWORD', timestamp: new Date().toISOString() });
        return;
      }

      await user.update({ password: newPassword });

      logger.info('Password changed', { userId: req.user.id });

      res.status(200).json({ success: true, message: 'Password changed successfully', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Change password error', { error: (error as Error).message, userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Delete (deactivate) authenticated user's account
   */
  static async deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const { password } = req.body as { password: string };
      if (!password) {
        res.status(400).json({ success: false, error: 'Password is required to delete account', code: 'PASSWORD_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const isValid = await user.comparePassword(password);
      if (!isValid) {
        res.status(400).json({ success: false, error: 'Password is incorrect', code: 'INVALID_PASSWORD', timestamp: new Date().toISOString() });
        return;
      }

      await user.update({ status: 'deactivated' as any, deactivatedAt: new Date(), refreshToken: null });

      // Revoke current access token if possible
      const accessToken = req.headers.authorization?.split(' ')[1];
      if (accessToken) {
        await redisClient.set(`bl:${accessToken}`, '1', 86400);
      }

      logger.info('Account deleted', { userId: req.user.id });

      res.status(200).json({ success: true, message: 'Account deactivated successfully', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Delete account error', { error: (error as Error).message, userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Update authenticated user's profile (PATCH)
   */
  static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const allowed = ['firstName', 'lastName', 'phone', 'dateOfBirth'];
      const updates: Record<string, any> = {};
      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ success: false, error: 'No updatable fields provided', code: 'NO_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      await user.update(updates);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user.toSafeObject(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Update profile error', { error: (error as Error).message, userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Upload profile picture for authenticated user
   */
  static async uploadProfilePicture(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ success: false, error: 'No file uploaded', code: 'NO_FILE', timestamp: new Date().toISOString() });
        return;
      }

      const baseUrl = process.env['API_BASE_URL'] || `http://localhost:${process.env['PORT'] || 3001}`;
      const profilePictureUrl = `${baseUrl}/uploads/avatars/${file.filename}`;

      const user = await User.findByPk(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      await user.update({ profilePicture: profilePictureUrl });

      res.status(200).json({
        success: true,
        message: 'Profile picture uploaded successfully',
        data: { profilePictureUrl },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Upload profile picture error', { error: (error as Error).message, userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      // Lazy imports to avoid circular deps
      const { default: Ride } = await import('../models/Ride');
      const { default: Booking } = await import('../models/Booking');
      const { RideStatus } = await import('../types');

      const [ridesOffered, ridesCompleted, ridesAsPassenger] = await Promise.all([
        Ride.count({ where: { driverId: req.user.id } }),
        Ride.count({ where: { driverId: req.user.id, status: RideStatus.COMPLETED } }),
        Booking.count({ where: { passengerId: req.user.id } }),
      ]);

      // Sum completed ride distances
      const { fn, col, literal } = await import('sequelize');
      const distanceResult = await Ride.findAll({
        where: { driverId: req.user.id, status: RideStatus.COMPLETED },
        attributes: [[fn('COALESCE', fn('SUM', col('distance')), literal('0')), 'totalDistance']],
        raw: true,
      }) as any[];
      const totalDistance = parseFloat(distanceResult[0]?.totalDistance ?? '0') || 0;

      res.status(200).json({
        success: true,
        data: {
          ridesCompleted,
          ridesOffered,
          ridesAsPassenger,
          totalDistance: Math.round(totalDistance * 10) / 10,
          rating: user.rating || 0,
          joinDate: user.createdAt.toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Get user stats error', { error: (error as Error).message, userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Get notification preferences
   */
  static async getNotificationPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const prefs = (user.preferences as Record<string, any>) || {};
      const notifPrefs = prefs['notifications'] || {
        pushNotifications: true,
        rideUpdates: true,
        messages: true,
        promotions: false,
      };

      res.status(200).json({ success: true, data: notifPrefs, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Get notification preferences error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Update notification preferences
   */
  static async updateNotificationPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const currentPrefs = (user.preferences as Record<string, any>) || {};
      const currentNotifPrefs = currentPrefs['notifications'] || {};

      const updatedNotifPrefs = { ...currentNotifPrefs, ...req.body };

      await user.update({
        preferences: { ...currentPrefs, notifications: updatedNotifPrefs },
      });

      res.status(200).json({ success: true, data: updatedNotifPrefs, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Update notification preferences error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Send email verification OTP
   */
  static async sendEmailVerification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      if (user.isEmailVerified) {
        res.status(400).json({ success: false, error: 'Email is already verified', code: 'ALREADY_VERIFIED', timestamp: new Date().toISOString() });
        return;
      }

      const otp = (100000 + crypto.randomInt(0, 900000)).toString();
      await redisClient.set(`email_otp:${user.email}`, otp, 600);

      if (process.env['SMTP_HOST']) {
        const transporter = nodemailer.createTransport({
          host: process.env['SMTP_HOST'],
          port: parseInt(process.env['SMTP_PORT'] || '587', 10),
          secure: process.env['SMTP_SECURE'] === 'true',
          auth: { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] },
        });
        await transporter.sendMail({
          from: process.env['SMTP_FROM'] || 'noreply@hitch.app',
          to: user.email,
          subject: 'Verify your email',
          text: `Your verification code is: ${otp}. Valid for 10 minutes.`,
        });
      } else {
        logger.info('Email OTP (dev mode)', { email: user.email, otp });
      }

      res.status(200).json({ success: true, message: 'Verification code sent', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Send email verification error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Verify email with OTP token
   */
  static async verifyEmailToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const { token } = req.body as { token: string };
      if (!token) {
        res.status(400).json({ success: false, error: 'Verification code is required', code: 'CODE_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const storedOtp = await redisClient.get(`email_otp:${user.email}`);
      if (!storedOtp || storedOtp !== token) {
        res.status(400).json({ success: false, error: 'Invalid or expired verification code', code: 'INVALID_OTP', timestamp: new Date().toISOString() });
        return;
      }

      await redisClient.del(`email_otp:${user.email}`);
      await user.update({ isEmailVerified: true });

      res.status(200).json({ success: true, message: 'Email verified successfully', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Verify email error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Send phone verification OTP
   */
  static async sendPhoneVerification(req: AuthenticatedRequest | Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      const { phone } = req.body as { phone: string };

      if (!phone) {
        res.status(400).json({ success: false, error: 'Phone number is required', code: 'PHONE_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const { smsService } = await import('../services/SMSService');
      const { sent } = await smsService.sendVerificationCode(phone);

      logger.info('Phone verification OTP sent', { phone, sent, userId });

      res.status(200).json({ success: true, message: 'Verification code sent', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Send phone verification error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Verify phone with OTP
   */
  static async verifyPhone(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const { phone, code } = req.body as { phone: string; code: string };
      if (!phone || !code) {
        res.status(400).json({ success: false, error: 'Phone and code are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const { smsService } = await import('../services/SMSService');
      const isValid = await smsService.verifyCode(phone, code);

      if (!isValid) {
        res.status(400).json({ success: false, error: 'Invalid or expired verification code', code: 'INVALID_OTP', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(req.user.id);
      if (user) {
        await user.update({ isPhoneVerified: true, phone });
      }

      res.status(200).json({ success: true, message: 'Phone verified successfully', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Verify phone error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /* ────────────── OTP endpoints ────────────── */

  /** Send SMS OTP */
  static async sendSMSOTP(req: Request, res: Response): Promise<void> {
    try {
      const { phone, purpose } = req.body as { phone: string; purpose: string };
      if (!phone) {
        res.status(400).json({ success: false, error: 'phone is required', code: 'PHONE_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const { smsService } = await import('../services/SMSService');
      const { sent } = await smsService.sendVerificationCode(phone);

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      res.status(200).json({
        success: true,
        data: { message: sent ? 'OTP sent via SMS' : 'OTP generated (SMS not configured)', expiresAt, purpose },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('sendSMSOTP error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** Send Email OTP */
  static async sendEmailOTP(req: Request, res: Response): Promise<void> {
    try {
      const { email, purpose } = req.body as { email: string; purpose: string };
      if (!email) {
        res.status(400).json({ success: false, error: 'email is required', code: 'EMAIL_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const otp = (100000 + crypto.randomInt(0, 900000)).toString();
      await redisClient.set(`email_otp:${email.toLowerCase()}`, otp, 600);

      if (process.env['SMTP_HOST']) {
        const transporter = nodemailer.createTransport({
          host: process.env['SMTP_HOST'],
          port: parseInt(process.env['SMTP_PORT'] || '587', 10),
          secure: process.env['SMTP_SECURE'] === 'true',
          auth: { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] },
        });
        await transporter.sendMail({
          from: process.env['SMTP_FROM'] || 'noreply@hitch.app',
          to: email,
          subject: 'Your verification code',
          text: `Your Hitch code is: ${otp}. Valid for 10 minutes. Purpose: ${purpose}.`,
        });
      } else {
        logger.info('Email OTP (dev mode)', { email, otp, purpose });
      }

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      res.status(200).json({
        success: true,
        data: { message: 'OTP sent via email', expiresAt, purpose },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('sendEmailOTP error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** Verify OTP (SMS or email) */
  static async verifyOTP(req: Request, res: Response): Promise<void> {
    try {
      const { type, recipient, code, purpose } = req.body as {
        type: 'sms' | 'email';
        recipient: string;
        code: string;
        purpose: string;
      };

      if (!type || !recipient || !code) {
        res.status(400).json({ success: false, error: 'type, recipient, and code are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      let verified = false;

      if (type === 'sms') {
        const { smsService } = await import('../services/SMSService');
        verified = await smsService.verifyCode(recipient, code);
      } else {
        const stored = await redisClient.get(`email_otp:${recipient.toLowerCase()}`);
        if (stored && stored === code) {
          await redisClient.del(`email_otp:${recipient.toLowerCase()}`);
          verified = true;
        }
      }

      if (!verified) {
        res.status(400).json({ success: false, data: { verified: false, message: 'Invalid or expired OTP' }, timestamp: new Date().toISOString() });
        return;
      }

      res.status(200).json({
        success: true,
        data: { verified: true, message: 'OTP verified successfully', purpose },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('verifyOTP error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** Get OTP status (can send? cooldown?) */
  static async getOTPStatus(req: Request, res: Response): Promise<void> {
    try {
      const { recipient, type } = req.query as { recipient: string; type: string };
      if (!recipient || !type) {
        res.status(400).json({ success: false, error: 'recipient and type are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const key = type === 'sms' ? `otp:${recipient}` : `email_otp:${recipient.toLowerCase()}`;
      const exists = await redisClient.get(key);

      res.status(200).json({
        success: true,
        data: {
          canSend: !exists,
          cooldownRemaining: exists ? 60 : 0, // simplified — can't read TTL without extending Redis client
          attemptsRemaining: 3,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('getOTPStatus error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** Passwordless login with OTP */
  static async loginWithOTP(req: Request, res: Response): Promise<void> {
    try {
      const { type, recipient, code } = req.body as { type: 'sms' | 'email'; recipient: string; code: string };

      if (!type || !recipient || !code) {
        res.status(400).json({ success: false, error: 'type, recipient, and code are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      let verified = false;
      if (type === 'sms') {
        const { smsService } = await import('../services/SMSService');
        verified = await smsService.verifyCode(recipient, code);
      } else {
        const stored = await redisClient.get(`email_otp:${recipient.toLowerCase()}`);
        if (stored && stored === code) {
          await redisClient.del(`email_otp:${recipient.toLowerCase()}`);
          verified = true;
        }
      }

      if (!verified) {
        res.status(401).json({ success: false, error: 'Invalid or expired OTP', code: 'INVALID_OTP', timestamp: new Date().toISOString() });
        return;
      }

      // Find user
      const whereClause = type === 'sms'
        ? { phone: recipient }
        : { email: recipient.toLowerCase() };
      const user = await User.findOne({ where: whereClause as any });

      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      if (user.status === 'suspended' || user.status === 'deactivated') {
        res.status(403).json({ success: false, error: 'Account is suspended or deactivated', code: 'ACCOUNT_SUSPENDED', timestamp: new Date().toISOString() });
        return;
      }

      const accessToken = AuthService.generateAccessToken({ userId: user.id, email: user.email, role: user.role });
      const refreshToken = AuthService.generateRefreshToken();

      await user.update({ refreshToken, lastLoginAt: new Date() });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: user.toSafeObject(),
          accessToken,
          refreshToken,
          expiresIn: 86400,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('loginWithOTP error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** Register and immediately verify OTP as part of sign-up */
  static async registerWithOTP(req: Request, res: Response): Promise<void> {
    try {
      const { otpCode, otpType, ...userData } = req.body as {
        otpCode: string;
        otpType: 'sms' | 'email';
        email: string;
        phone: string;
        password: string;
        firstName: string;
        lastName: string;
        role?: string;
      };

      if (!otpCode || !otpType) {
        res.status(400).json({ success: false, error: 'otpCode and otpType are required', code: 'MISSING_OTP', timestamp: new Date().toISOString() });
        return;
      }

      const recipient = otpType === 'sms' ? userData.phone : userData.email;
      let verified = false;

      if (otpType === 'sms') {
        const { smsService } = await import('../services/SMSService');
        verified = await smsService.verifyCode(recipient, otpCode);
      } else {
        const stored = await redisClient.get(`email_otp:${recipient.toLowerCase()}`);
        if (stored && stored === otpCode) {
          await redisClient.del(`email_otp:${recipient.toLowerCase()}`);
          verified = true;
        }
      }

      if (!verified) {
        res.status(400).json({ success: false, error: 'Invalid or expired OTP', code: 'INVALID_OTP', timestamp: new Date().toISOString() });
        return;
      }

      const result = await AuthService.register(userData as any);

      // Mark the relevant field as verified
      const newUser = await User.findOne({ where: { email: userData.email } });
      if (newUser) {
        if (otpType === 'email') {
          await newUser.update({ isEmailVerified: true });
        } else {
          await newUser.update({ isPhoneVerified: true });
        }
      }

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code, timestamp: new Date().toISOString() });
        return;
      }
      logger.error('registerWithOTP error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** Reset password via OTP (no prior auth needed) */
  static async resetPasswordWithOTP(req: Request, res: Response): Promise<void> {
    try {
      const { type, recipient, code, newPassword } = req.body as {
        type: 'sms' | 'email';
        recipient: string;
        code: string;
        newPassword: string;
      };

      if (!type || !recipient || !code || !newPassword) {
        res.status(400).json({ success: false, error: 'type, recipient, code, and newPassword are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({ success: false, error: 'Password must be at least 8 characters', code: 'PASSWORD_TOO_SHORT', timestamp: new Date().toISOString() });
        return;
      }

      let verified = false;
      if (type === 'sms') {
        const { smsService } = await import('../services/SMSService');
        verified = await smsService.verifyCode(recipient, code);
      } else {
        const stored = await redisClient.get(`email_otp:${recipient.toLowerCase()}`);
        if (stored && stored === code) {
          await redisClient.del(`email_otp:${recipient.toLowerCase()}`);
          verified = true;
        }
      }

      if (!verified) {
        res.status(400).json({ success: false, error: 'Invalid or expired OTP', code: 'INVALID_OTP', timestamp: new Date().toISOString() });
        return;
      }

      const whereClause = type === 'sms'
        ? { phone: recipient }
        : { email: recipient.toLowerCase() };
      const user = await User.findOne({ where: whereClause as any });

      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      await user.update({ password: newPassword });

      res.status(200).json({ success: true, message: 'Password reset successfully', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('resetPasswordWithOTP error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Request password reset — sends reset link to email
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    // Always return 200 to avoid leaking email existence
    const successResponse = () =>
      res.status(200).json({
        success: true,
        message: 'If that email is registered, a reset link has been sent',
        timestamp: new Date().toISOString(),
      });

    try {
      const { email } = req.body as { email: string };
      if (!email) {
        res.status(400).json({ success: false, error: 'Email is required', code: 'EMAIL_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
      if (!user) {
        // Don't reveal that the email doesn't exist
        successResponse();
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      await redisClient.set(`${PW_RESET_PREFIX}${token}`, (user as any).id, PW_RESET_TTL);

      const resetUrl = `${process.env['FRONTEND_URL'] || 'http://localhost:3000'}/reset-password?token=${token}`;

      if (process.env['SMTP_HOST']) {
        const transporter = nodemailer.createTransport({
          host: process.env['SMTP_HOST'],
          port: parseInt(process.env['SMTP_PORT'] || '587', 10),
          secure: process.env['SMTP_SECURE'] === 'true',
          auth: {
            user: process.env['SMTP_USER'],
            pass: process.env['SMTP_PASS'],
          },
        });

        await transporter.sendMail({
          from: process.env['SMTP_FROM'] || 'noreply@hitch.app',
          to: email,
          subject: 'Password Reset Request',
          text: `Click the link below to reset your password. This link expires in 1 hour.\n\n${resetUrl}`,
          html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
        });
      } else {
        // Dev mode: log the link instead of sending
        logger.info('Password reset link (dev mode — SMTP not configured)', { email, resetUrl });
      }

      successResponse();
    } catch (error) {
      logger.error('Forgot password error', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      // Still return 200 to avoid leaking info
      successResponse();
    }
  }

  /**
   * Reset password using token from email link
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };

      if (!token || !newPassword) {
        res.status(400).json({ success: false, error: 'Token and newPassword are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({ success: false, error: 'Password must be at least 8 characters', code: 'PASSWORD_TOO_SHORT', timestamp: new Date().toISOString() });
        return;
      }

      const redisKey = `${PW_RESET_PREFIX}${token}`;
      const userId = await redisClient.get(redisKey);

      if (!userId) {
        res.status(400).json({ success: false, error: 'Invalid or expired reset token', code: 'INVALID_RESET_TOKEN', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId);
      if (!user) {
        res.status(400).json({ success: false, error: 'Invalid or expired reset token', code: 'INVALID_RESET_TOKEN', timestamp: new Date().toISOString() });
        return;
      }

      // Sequelize beforeUpdate hook hashes the password automatically
      await user.update({ password: newPassword });

      // Invalidate the token so it can't be reused
      await redisClient.del(redisKey);

      logger.info('Password reset successfully', { userId });

      res.status(200).json({
        success: true,
        message: 'Password reset successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Reset password error', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Verify token endpoint (for testing)
   */
  static async verifyToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Token is valid',
        data: {
          user: req.user,
          tokenValid: true,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Token verification error', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Verify a Google ID token and issue ARYV session tokens.
   *
   * The mobile client obtains an ID token via @react-native-google-signin and
   * POSTs it here; we verify it against Google's public keys rather than
   * trusting anything the client tells us about the user.
   *
   * Account linking is deliberately gated on Google's `email_verified` claim:
   * linking an unverified address to an existing password account would let
   * anyone who can create a Google account with that address take it over.
   */
  static async verifyGoogleToken(req: Request, res: Response): Promise<void> {
    try {
      const { idToken } = req.body as { idToken?: string };

      if (!idToken || typeof idToken !== 'string') {
        res.status(400).json({
          success: false,
          error: 'idToken is required',
          code: 'IDTOKEN_REQUIRED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Every client ID that may legitimately mint tokens for this app. Google
      // issues the ID token with the *web* client ID as audience even on
      // native, so that one is required; the native IDs are accepted when set.
      const audiences = [
        process.env['GOOGLE_WEB_CLIENT_ID'],
        process.env['GOOGLE_IOS_CLIENT_ID'],
        process.env['GOOGLE_ANDROID_CLIENT_ID'],
      ].filter((id): id is string => Boolean(id));

      if (audiences.length === 0) {
        logger.error('Google sign-in attempted but no GOOGLE_*_CLIENT_ID configured');
        res.status(503).json({
          success: false,
          error: 'Google sign-in is not configured on this server',
          code: 'GOOGLE_NOT_CONFIGURED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      let payload: TokenPayload | undefined;
      try {
        const ticket = await googleOAuthClient.verifyIdToken({ idToken, audience: audiences });
        payload = ticket.getPayload();
      } catch (verifyError) {
        logger.warn('Google ID token verification failed', {
          error: (verifyError as Error).message,
        });
        res.status(401).json({
          success: false,
          error: 'Invalid Google token',
          code: 'INVALID_GOOGLE_TOKEN',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!payload?.email) {
        res.status(401).json({
          success: false,
          error: 'Google token did not contain an email address',
          code: 'GOOGLE_EMAIL_MISSING',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const email = payload.email.toLowerCase();
      const emailVerified = payload.email_verified === true;

      let user = await User.findOne({ where: { email } });

      if (user) {
        // Existing account: only hand over a session when Google vouches for
        // the address, otherwise this is a takeover vector.
        if (!emailVerified) {
          logger.warn('Google sign-in refused: unverified email matched an existing account', { email });
          res.status(403).json({
            success: false,
            error: 'This email is already registered. Please sign in with your password.',
            code: 'GOOGLE_EMAIL_UNVERIFIED',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        if (user.status === 'suspended' || user.status === 'deactivated') {
          res.status(403).json({
            success: false,
            error: 'Account is suspended or deactivated',
            code: 'ACCOUNT_SUSPENDED',
            timestamp: new Date().toISOString(),
          });
          return;
        }
      } else {
        if (!emailVerified) {
          res.status(403).json({
            success: false,
            error: 'Your Google email address is not verified',
            code: 'GOOGLE_EMAIL_UNVERIFIED',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // No password exists for a Google-provisioned account. The column is
        // NOT NULL, so store an unguessable random value: bcrypt of 64 random
        // bytes can never be matched by a supplied password, which makes
        // password login inert until the user sets one via forgot-password.
        const unusablePassword = crypto.randomBytes(64).toString('hex').slice(0, 128);

        user = await User.create({
          email,
          password: unusablePassword,
          firstName: payload.given_name || payload.name?.split(' ')[0] || 'User',
          lastName: payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '',
          role: 'passenger',
          isEmailVerified: true,
          profilePicture: payload.picture ?? null,
        } as any);

        logger.info('Created user from Google sign-in', { userId: user.id, email });
      }

      const accessToken = AuthService.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      const refreshToken = AuthService.generateRefreshToken();

      await user.update({ refreshToken, lastLoginAt: new Date() });

      res.status(200).json({
        success: true,
        message: 'Google sign-in successful',
        data: {
          user: user.toSafeObject(),
          accessToken,
          refreshToken,
          expiresIn: 86400,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('verifyGoogleToken error', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
