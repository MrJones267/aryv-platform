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
import { Op } from 'sequelize';
import { AuthService } from '../services/AuthService';
import { redisClient } from '../config/redis';
import User from '../models/User';
import { AuthenticatedRequest, AppError } from '../types';
import logger from '../utils/logger';
import { toE164 } from '../utils/phone';
import { eraseAccount } from '../services/AccountClosureService';
import { validatePasswordStrength } from '../utils/password';
import otpService, {
  OTP_PURPOSES,
  isOtpPurpose,
  type OtpPurpose,
  type OtpFailureReason,
  type OtpVerifyResult,
} from '../services/OtpService';
import { NOTIFICATION_PREFERENCE_KEYS, notificationPreferencesOf } from '../utils/notificationPreferences';
import accountExportService from '../services/AccountExportService';

// Verifies Google ID tokens against Google's rotating public keys. Constructed
// once at module load: the client caches those keys between requests.
const googleOAuthClient = new OAuth2Client();

const PW_RESET_PREFIX = 'pw_reset:';
const PW_RESET_TTL = 3600; // 1 hour

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The one line of explanation that goes into a verification email, chosen from
 * a fixed set. `purpose` used to be taken from the request and interpolated
 * straight into the message body, so anyone could put arbitrary text into mail
 * sent from our domain to an address of their choosing.
 */
const EMAIL_PURPOSE_TEXT: Record<OtpPurpose, string> = {
  login: 'Use it to sign in to your ARYV account.',
  registration: 'Use it to finish creating your ARYV account.',
  password_reset: 'Use it to set a new password on your ARYV account.',
  phone_verification: 'Use it to confirm your phone number.',
  email_verification: 'Use it to confirm your email address.',
};

/**
 * Deliberately uniform. A caller must not be able to tell an unknown recipient
 * from a wrong code from an expired one — that distinction only helps someone
 * working out which addresses and numbers have accounts.
 */
const OTP_FAILURE_MESSAGE: Record<OtpFailureReason, string> = {
  not_found: 'That code is not valid or has expired. Request a new one.',
  mismatch: 'That code is not valid or has expired. Request a new one.',
  unavailable: 'That code is not valid or has expired. Request a new one.',
  too_many_attempts: 'Too many incorrect attempts. Request a new code.',
};

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

      // Ends every other session. Without this, changing a password left any
      // stolen access token working for its full life and the refresh token
      // working indefinitely — at the exact moment that matters most.
      await user.update({
        password: newPassword,
        passwordChangedAt: new Date(),
        refreshToken: null,
      });

      logger.info('Password changed', { userId: req.user.id });

      res.status(200).json({ success: true, message: 'Password changed successfully', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Change password error', { error: (error as Error).message, userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * POST /auth/logout-all — sign the account out on every device, this one
   * included. Setting passwordChangedAt refuses every access token issued
   * before now, and clearing the refresh token stops any being renewed.
   */
  static async logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      await user.update({ passwordChangedAt: new Date(), refreshToken: null });
      logger.info('Signed out of all devices', { userId: user.id });
      res.status(200).json({ success: true, message: 'Signed out of all devices', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Logout all error', { error: (error as Error).message, userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * GET /auth/export — a copy of what ARYV holds about the signed-in person.
   * Their own records only, and never secrets (password hash, tokens) or the
   * identity document images themselves, only that they were submitted.
   */
  static async exportMyData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }
      const data = await accountExportService.build(req.user.id);
      if (!data) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }
      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Export data error', { error: (error as Error).message, userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Permanently delete the authenticated user's account.
   *
   * Re-authentication is required, and is accepted in either of the two forms
   * an account can have: the current password, or a fresh Google ID token for
   * accounts provisioned through Google sign-in. Those accounts are created
   * with an unusable random password, so demanding a password locked them out
   * of deletion entirely — which Play's account-deletion policy does not allow.
   *
   * Personal data is erased rather than merely flagged. Ride, booking and
   * financial records are retained in anonymised form: they are another
   * party's transaction history and are needed for tax and dispute purposes,
   * which is a disclosed retention basis rather than a loophole.
   */
  static async deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const { password, googleIdToken } = req.body as {
        password?: string;
        googleIdToken?: string;
      };

      if (!password && !googleIdToken) {
        res.status(400).json({ success: false, error: 'Re-authentication is required to delete your account', code: 'REAUTH_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      if (password) {
        const isValid = await user.comparePassword(password);
        if (!isValid) {
          res.status(400).json({ success: false, error: 'Password is incorrect', code: 'INVALID_PASSWORD', timestamp: new Date().toISOString() });
          return;
        }
      } else {
        const audiences = [
          process.env['GOOGLE_WEB_CLIENT_ID'],
          process.env['GOOGLE_IOS_CLIENT_ID'],
          process.env['GOOGLE_ANDROID_CLIENT_ID'],
        ].filter((id): id is string => Boolean(id));

        if (audiences.length === 0) {
          res.status(503).json({ success: false, error: 'Google sign-in is not configured on this server', code: 'GOOGLE_NOT_CONFIGURED', timestamp: new Date().toISOString() });
          return;
        }

        let payload: TokenPayload | undefined;
        try {
          const ticket = await googleOAuthClient.verifyIdToken({
            idToken: googleIdToken as string,
            audience: audiences,
          });
          payload = ticket.getPayload();
        } catch (verifyError) {
          logger.warn('Account deletion Google re-auth failed', { error: (verifyError as Error).message });
          res.status(401).json({ success: false, error: 'Invalid Google token', code: 'INVALID_GOOGLE_TOKEN', timestamp: new Date().toISOString() });
          return;
        }

        // The token must belong to the account being deleted, or a valid token
        // for any Google account would delete whichever account it was sent with.
        const tokenEmail = payload?.email?.toLowerCase();
        if (!tokenEmail || !payload?.email_verified || tokenEmail !== user.email.toLowerCase()) {
          logger.warn('Account deletion Google re-auth identity mismatch', { userId: user.id });
          res.status(403).json({ success: false, error: 'This Google account does not match the account being deleted', code: 'REAUTH_IDENTITY_MISMATCH', timestamp: new Date().toISOString() });
          return;
        }
      }

      // Erase personal data and sign out every device; the row stays as an
      // anonymous tombstone. Shared with an admin's closure of an account.
      await eraseAccount(user.id, 'account_deleted_by_user');

      // Revoke current access token if possible
      const accessToken = req.headers.authorization?.split(' ')[1];
      if (accessToken) {
        await redisClient.set(`bl:${accessToken}`, '1', 86400);
      }

      logger.info('Account deleted', { userId: req.user.id });

      res.status(200).json({ success: true, message: 'Your account and personal data have been deleted', timestamp: new Date().toISOString() });
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
      res.status(200).json({ success: true, data: notificationPreferencesOf(prefs['notifications']), timestamp: new Date().toISOString() });
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

      // Only the known switches, and only true or false. This used to merge
      // whatever the request body held into the user's preferences.
      const body = (req.body ?? {}) as Record<string, unknown>;
      const unknown = Object.keys(body).filter(k => !(NOTIFICATION_PREFERENCE_KEYS as readonly string[]).includes(k) || typeof body[k] !== 'boolean');
      if (unknown.length > 0) {
        res.status(400).json({ success: false, error: `Unknown or invalid notification settings: ${unknown.join(', ')}`, code: 'INVALID_PREFERENCES', timestamp: new Date().toISOString() });
        return;
      }

      const currentPrefs = (user.preferences as Record<string, any>) || {};
      const updatedNotifPrefs = notificationPreferencesOf({ ...notificationPreferencesOf(currentPrefs['notifications']), ...body });

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

      // Through OtpService like every other code, so wrong guesses are counted
      // and the code is destroyed after five. The hand-rolled key here had no
      // limit at all: a million guesses in ten minutes would always land.
      if (!process.env['SMTP_HOST'] && process.env['NODE_ENV'] === 'production') {
        res.status(503).json({ success: false, error: 'Email is not available right now', code: 'EMAIL_UNAVAILABLE', timestamp: new Date().toISOString() });
        return;
      }

      const issued = await otpService.issue('email', user.email.toLowerCase(), 'email_verification');
      if (issued.throttled) {
        res.status(429).json({ success: false, error: 'Too many codes requested. Please wait before trying again.', code: 'OTP_REQUEST_THROTTLED', timestamp: new Date().toISOString() });
        return;
      }
      if (!issued.ok || !issued.code) {
        res.status(503).json({ success: false, error: 'Verification codes are temporarily unavailable', code: 'OTP_UNAVAILABLE', timestamp: new Date().toISOString() });
        return;
      }
      const otp = issued.code;

      if (process.env['SMTP_HOST']) {
        const transporter = nodemailer.createTransport({
          host: process.env['SMTP_HOST'],
          port: parseInt(process.env['SMTP_PORT'] || '587', 10),
          secure: process.env['SMTP_SECURE'] === 'true',
          auth: { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] },
        });
        await transporter.sendMail({
          from: process.env['SMTP_FROM'] || 'noreply@aryv-app.com',
          to: user.email,
          subject: 'Verify your email',
          text: `Your verification code is: ${otp}. Valid for 10 minutes.`,
        });
      } else {
        // Development only: production refused above rather than log a code.
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

      const result = await otpService.verify('email', user.email.toLowerCase(), 'email_verification', token);
      if (!result.ok) {
        res.status(result.reason === 'too_many_attempts' ? 429 : 400).json({
          success: false,
          error: OTP_FAILURE_MESSAGE[result.reason ?? 'not_found'],
          code: result.reason === 'too_many_attempts' ? 'OTP_ATTEMPTS_EXCEEDED' : 'INVALID_OTP',
          timestamp: new Date().toISOString(),
        });
        return;
      }

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
      const { sent, throttled } = await smsService.sendVerificationCode(phone, 'phone_verification');

      if (throttled) {
        res.status(429).json({ success: false, error: 'Too many codes requested for this number. Please wait before trying again.', code: 'OTP_REQUEST_THROTTLED', timestamp: new Date().toISOString() });
        return;
      }

      logger.info('Phone verification OTP sent', { sent, userId });

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
      const result = await smsService.verifyCode(phone, code, 'phone_verification');

      // verifyCode returns { ok, reason }. This tested the object itself,
      // which is always truthy, so any code verified any number.
      if (!result.ok) {
        res.status(result.reason === 'too_many_attempts' ? 429 : 400).json({
          success: false,
          error: OTP_FAILURE_MESSAGE[result.reason ?? 'not_found'],
          code: result.reason === 'too_many_attempts' ? 'OTP_ATTEMPTS_EXCEEDED' : 'INVALID_OTP',
          timestamp: new Date().toISOString(),
        });
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
  /*
   * Every endpoint below names the purpose its code is for, and OtpService
   * binds the code to it. A code minted to verify an email address is not
   * accepted at password reset — which it was, and that made
   * POST /api/auth/password-reset/otp an account-takeover endpoint for anyone
   * who could get a verification code issued.
   *
   * Wrong guesses are counted and the code is destroyed after five, so a
   * six-digit secret is no longer brute-forceable within its ten-minute life.
   *
   * Failures are also deliberately uniform: a caller cannot tell "no such
   * account" from "wrong code" from "code expired", because that difference is
   * only useful for enumerating accounts.
   */

  /** Resolve and validate the purpose a caller asked for. */
  private static resolvePurpose(
    value: unknown,
    allowed: OtpPurpose[],
    fallback: OtpPurpose,
  ): OtpPurpose | null {
    if (value === undefined || value === null || value === '') return fallback;
    if (!isOtpPurpose(value) || !allowed.includes(value)) return null;
    return value;
  }

  /** Send SMS OTP */
  static async sendSMSOTP(req: Request, res: Response): Promise<void> {
    try {
      const { phone } = req.body as { phone: string };
      if (!phone) {
        res.status(400).json({ success: false, error: 'phone is required', code: 'PHONE_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const purpose = AuthController.resolvePurpose(
        req.body.purpose,
        ['login', 'registration', 'password_reset', 'phone_verification'],
        'phone_verification',
      );
      if (!purpose) {
        res.status(400).json({ success: false, error: 'Unrecognised purpose', code: 'INVALID_PURPOSE', timestamp: new Date().toISOString() });
        return;
      }

      const { smsService } = await import('../services/SMSService');
      const result = await smsService.sendVerificationCode(phone, purpose);

      if (result.throttled) {
        res.status(429).json({
          success: false,
          error: 'Too many codes requested for this number. Please wait before trying again.',
          code: 'OTP_REQUEST_THROTTLED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          message: result.sent ? 'OTP sent via SMS' : 'OTP generated (SMS not configured)',
          expiresAt: result.expiresAt?.toISOString(),
          purpose,
          ...(result.code ? { devCode: result.code } : {}),
        },
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
      const { email } = req.body as { email: string };
      if (!email || typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
        res.status(400).json({ success: false, error: 'A valid email address is required', code: 'EMAIL_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const purpose = AuthController.resolvePurpose(
        req.body.purpose,
        ['login', 'registration', 'password_reset', 'email_verification'],
        'email_verification',
      );
      if (!purpose) {
        res.status(400).json({ success: false, error: 'Unrecognised purpose', code: 'INVALID_PURPOSE', timestamp: new Date().toISOString() });
        return;
      }

      // Without a mail server nothing reaches the person, and production used
      // to answer "OTP sent via email" anyway. Say so instead, before a code
      // is issued and counted against them.
      if (!process.env['SMTP_HOST'] && process.env['NODE_ENV'] === 'production') {
        res.status(503).json({ success: false, error: 'Email codes are not available right now. Use your phone number instead.', code: 'EMAIL_UNAVAILABLE', timestamp: new Date().toISOString() });
        return;
      }

      const recipient = email.trim().toLowerCase();
      const issued = await otpService.issue('email', recipient, purpose);

      if (issued.throttled) {
        res.status(429).json({
          success: false,
          error: 'Too many codes requested for this address. Please wait before trying again.',
          code: 'OTP_REQUEST_THROTTLED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!issued.ok || !issued.code) {
        res.status(503).json({ success: false, error: 'Verification codes are temporarily unavailable', code: 'OTP_UNAVAILABLE', timestamp: new Date().toISOString() });
        return;
      }

      if (process.env['SMTP_HOST']) {
        const transporter = nodemailer.createTransport({
          host: process.env['SMTP_HOST'],
          port: parseInt(process.env['SMTP_PORT'] || '587', 10),
          secure: process.env['SMTP_SECURE'] === 'true',
          auth: { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] },
        });
        await transporter.sendMail({
          from: process.env['SMTP_FROM'] || 'noreply@aryv-app.com',
          to: recipient,
          subject: 'Your ARYV verification code',
          // The body is built only from our own strings and the generated code.
          // `purpose` used to be interpolated here straight from the request,
          // which let anyone put arbitrary text into an email sent from our
          // domain, to an address of their choosing.
          text: `Your ARYV code is: ${issued.code}. It is valid for 10 minutes and can be used once.\n\n${EMAIL_PURPOSE_TEXT[purpose]}\n\nIf you did not request this, you can ignore this email.`,
        });
      } else {
        logger.info('Email OTP generated (SMTP not configured)', { purpose });
      }

      res.status(200).json({
        success: true,
        data: {
          message: 'OTP sent via email',
          expiresAt: issued.expiresAt?.toISOString(),
          purpose,
          // Development convenience only, so the flow is completable without
          // an SMTP server. Never returned from a production build.
          ...(process.env['NODE_ENV'] !== 'production' ? { devCode: issued.code } : {}),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('sendEmailOTP error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Redeem a code for one of the verification purposes.
   *
   * Login, registration and password reset each have their own endpoint and
   * their own purpose; this one deliberately cannot be used to reach them.
   */
  static async verifyOTP(req: Request, res: Response): Promise<void> {
    try {
      const { type, recipient, code } = req.body as {
        type: 'sms' | 'email'; recipient: string; code: string;
      };

      if (!type || !recipient || !code) {
        res.status(400).json({ success: false, error: 'type, recipient, and code are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const purpose = AuthController.resolvePurpose(
        req.body.purpose,
        type === 'sms' ? ['phone_verification'] : ['email_verification'],
        type === 'sms' ? 'phone_verification' : 'email_verification',
      );
      if (!purpose) {
        res.status(400).json({ success: false, error: 'Unrecognised purpose', code: 'INVALID_PURPOSE', timestamp: new Date().toISOString() });
        return;
      }

      const result = await AuthController.redeemOTP(type, recipient, purpose, code);

      if (!result.ok) {
        res.status(result.reason === 'too_many_attempts' ? 429 : 400).json({
          success: false,
          data: { verified: false, message: OTP_FAILURE_MESSAGE[result.reason ?? 'not_found'] },
          code: result.reason === 'too_many_attempts' ? 'OTP_ATTEMPTS_EXCEEDED' : 'INVALID_OTP',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Proving control of the address or number is what verifying it means,
      // so record it on the account it belongs to. This only answered
      // "verified" and changed nothing.
      const owner = await AuthController.findUserByRecipient(type, recipient);
      if (owner) {
        await owner.update(type === 'email' ? { isEmailVerified: true } : { isPhoneVerified: true });
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

  /** Shared redemption path so every caller gets the same limits. */
  private static async redeemOTP(
    type: 'sms' | 'email',
    recipient: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<OtpVerifyResult> {
    if (type === 'sms') {
      const { smsService } = await import('../services/SMSService');
      return smsService.verifyCode(recipient, code, purpose);
    }
    return otpService.verify('email', recipient.trim().toLowerCase(), purpose, code);
  }

  /** How many attempts are left on a live code. */
  static async getOTPStatus(req: Request, res: Response): Promise<void> {
    try {
      const type = req.query['type'] === 'sms' ? 'sms' : 'email';
      const recipient = String(req.query['recipient'] ?? '');

      if (!recipient) {
        res.status(400).json({ success: false, error: 'recipient is required', code: 'RECIPIENT_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const purpose = AuthController.resolvePurpose(
        req.query['purpose'],
        [...OTP_PURPOSES],
        type === 'sms' ? 'phone_verification' : 'email_verification',
      );
      if (!purpose) {
        res.status(400).json({ success: false, error: 'Unrecognised purpose', code: 'INVALID_PURPOSE', timestamp: new Date().toISOString() });
        return;
      }

      const identifier = type === 'sms'
        ? toE164(recipient) ?? recipient
        : recipient.trim().toLowerCase();

      const attemptsRemaining = await otpService.attemptsRemaining(type, identifier, purpose);

      res.status(200).json({
        success: true,
        data: {
          hasActiveCode: attemptsRemaining !== null,
          attemptsRemaining: attemptsRemaining ?? 0,
          purpose,
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

      const result = await AuthController.redeemOTP(type, recipient, 'login', code);

      if (!result.ok) {
        res.status(result.reason === 'too_many_attempts' ? 429 : 401).json({
          success: false,
          error: OTP_FAILURE_MESSAGE[result.reason ?? 'not_found'],
          code: result.reason === 'too_many_attempts' ? 'OTP_ATTEMPTS_EXCEEDED' : 'INVALID_OTP',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = await AuthController.findUserByRecipient(type, recipient);

      // Same answer as a bad code. Telling the caller the code was right but
      // no account exists confirms which numbers and addresses are registered.
      if (!user) {
        res.status(401).json({ success: false, error: OTP_FAILURE_MESSAGE.not_found, code: 'INVALID_OTP', timestamp: new Date().toISOString() });
        return;
      }

      if (user.status === 'suspended' || user.status === 'deactivated') {
        res.status(403).json({ success: false, error: 'Account is suspended or deactivated', code: 'ACCOUNT_SUSPENDED', timestamp: new Date().toISOString() });
        return;
      }

      const session = await AuthService.issueSession(user);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: { user: user.toSafeObject(), ...session },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('loginWithOTP error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** Look up the account an OTP recipient belongs to. */
  private static async findUserByRecipient(type: 'sms' | 'email', recipient: string) {
    if (type === 'email') {
      return User.findOne({ where: { email: recipient.trim().toLowerCase() } });
    }
    // Match on the normalised number, falling back to the raw value so
    // accounts stored before normalisation are still reachable.
    const normalised = toE164(recipient);
    return User.findOne({
      where: normalised
        ? ({ [Op.or]: [{ phone: normalised }, { phone: recipient }] } as any)
        : ({ phone: recipient } as any),
    });
  }

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
      if (!recipient) {
        res.status(400).json({ success: false, error: 'A phone or email matching the code is required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const result = await AuthController.redeemOTP(otpType, recipient, 'registration', otpCode);

      if (!result.ok) {
        res.status(result.reason === 'too_many_attempts' ? 429 : 400).json({
          success: false,
          error: OTP_FAILURE_MESSAGE[result.reason ?? 'not_found'],
          code: result.reason === 'too_many_attempts' ? 'OTP_ATTEMPTS_EXCEEDED' : 'INVALID_OTP',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const registration = await AuthService.register(userData as any);

      // Mark the channel the code proved as verified — and only that channel.
      const newUser = await User.findOne({ where: { email: userData.email } });
      if (newUser) {
        await newUser.update(
          otpType === 'email' ? { isEmailVerified: true } : { isPhoneVerified: true },
        );
      }

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: registration,
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

      const strength = validatePasswordStrength(newPassword);
      if (!strength.ok) {
        res.status(400).json({ success: false, error: strength.message, code: 'WEAK_PASSWORD', timestamp: new Date().toISOString() });
        return;
      }

      // Bound to 'password_reset' specifically. A code issued for email or
      // phone verification is rejected here, which is the whole point: this
      // endpoint sets a password with no other proof of identity.
      const result = await AuthController.redeemOTP(type, recipient, 'password_reset', code);

      if (!result.ok) {
        res.status(result.reason === 'too_many_attempts' ? 429 : 400).json({
          success: false,
          error: OTP_FAILURE_MESSAGE[result.reason ?? 'not_found'],
          code: result.reason === 'too_many_attempts' ? 'OTP_ATTEMPTS_EXCEEDED' : 'INVALID_OTP',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = await AuthController.findUserByRecipient(type, recipient);

      if (!user) {
        // Uniform with a bad code, for the same reason as login.
        res.status(400).json({ success: false, error: OTP_FAILURE_MESSAGE.not_found, code: 'INVALID_OTP', timestamp: new Date().toISOString() });
        return;
      }

      await user.update({
        password: newPassword,
        passwordChangedAt: new Date(),
        refreshToken: null,
      });

      logger.info('Password reset via OTP', { userId: user.id, channel: type });

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
          from: process.env['SMTP_FROM'] || 'noreply@aryv-app.com',
          to: email,
          subject: 'Password Reset Request',
          text: `Click the link below to reset your password. This link expires in 1 hour.\n\n${resetUrl}`,
          html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
        });
      } else if (process.env['NODE_ENV'] !== 'production') {
        // Development only. In production this wrote the link, token and all,
        // into the logs, so anyone who could read them could reset any account.
        logger.info('Password reset link (dev mode — SMTP not configured)', { email, resetUrl });
      } else {
        logger.warn('Password reset requested but SMTP is not configured; nothing was sent');
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

      // The same rules as registration and the code-based reset; this only
      // checked the length.
      const strength = validatePasswordStrength(newPassword);
      if (!strength.ok) {
        res.status(400).json({ success: false, error: strength.message, code: 'WEAK_PASSWORD', timestamp: new Date().toISOString() });
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

      // Sequelize beforeUpdate hook hashes the password automatically.
      // Clearing the refresh token and stamping the change ends any session an
      // attacker still holds — which is the point of resetting.
      await user.update({
        password: newPassword,
        passwordChangedAt: new Date(),
        refreshToken: null,
      });

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

      // Through the shared path, so the refresh token is stored hashed like
      // every other sign-in. This wrote the raw token, which both exposed a
      // directly replayable credential in the database and — because refresh
      // looks the token up by hash — meant Google users could never refresh a
      // session and were signed out after 24 hours.
      const session = await AuthService.issueSession(user);

      res.status(200).json({
        success: true,
        message: 'Google sign-in successful',
        data: {
          user: user.toSafeObject(),
          ...session,
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
