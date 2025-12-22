/**
 * @fileoverview Authentication service with JWT token management
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-20
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { User } from '../models';
import {
  JwtPayload,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  AppError,
  UserRole,
} from '../types';

// Constants
const JWT_SECRET = process.env['JWT_SECRET'] || 'fallback-secret-key';
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] || '24h';
// JWT_REFRESH_EXPIRES_IN removed as it was unused

export class AuthService {
  /**
   * Generate JWT access token
   */
  static generateAccessToken(payload: JwtPayload): string {
    try {
      const signOptions: SignOptions = {
        expiresIn: JWT_EXPIRES_IN as any,
        issuer: 'hitch-api',
        audience: 'hitch-app',
      };
      return jwt.sign(payload, JWT_SECRET, signOptions);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error generating access token:`, {
        error: (error as Error).message,
        userId: payload.userId,
      });
      throw new AppError('Token generation failed', 500, 'TOKEN_GENERATION_ERROR');
    }
  }

  /**
   * Generate JWT refresh token
   */
  static generateRefreshToken(): string {
    try {
      return crypto.randomBytes(40).toString('hex');
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error generating refresh token:`, {
        error: (error as Error).message,
      });
      throw new AppError('Refresh token generation failed', 500, 'REFRESH_TOKEN_ERROR');
    }
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'hitch-api',
        audience: 'hitch-app',
      }) as JwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
      } else {
        console.error(`[${new Date().toISOString()}] Token verification error:`, {
          error: (error as Error).message,
        });
        throw new AppError('Token verification failed', 401, 'TOKEN_VERIFICATION_ERROR');
      }
    }
  }

  /**
   * Register new user
   */
  static async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { email: userData.email },
            { phone: userData.phone },
          ],
        },
      });

      if (existingUser) {
        throw new AppError(
          'User with this email or phone already exists',
          409,
          'USER_ALREADY_EXISTS',
        );
      }

      // Create new user
      const user = await User.create({
        email: userData.email,
        password: userData.password,
        phone: userData.phone,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || UserRole.PASSENGER,
        dateOfBirth: userData.dateOfBirth,
      });

      // Generate tokens
      const accessToken = this.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = this.generateRefreshToken();

      // Store refresh token
      await user.update({ refreshToken });

      // Update last login
      await user.update({ lastLoginAt: new Date() });

      return {
        success: true,
        user: user.toSafeObject(),
        accessToken,
        refreshToken,
        expiresIn: this.getTokenExpiryTime(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error(`[${new Date().toISOString()}] Registration error:`, {
        error: (error as Error).message,
        email: userData.email,
      });

      throw new AppError('Registration failed', 500, 'REGISTRATION_ERROR');
    }
  }

  /**
   * Login user
   */
  static async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      // Find user by email
      const user = await User.findOne({
        where: { email: credentials.email },
      });

      if (!user) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Check if account is active
      if (user.status === 'suspended' || user.status === 'deactivated') {
        throw new AppError(
          'Account is suspended or deactivated',
          403,
          'ACCOUNT_SUSPENDED',
        );
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(credentials.password);
      if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Generate tokens
      const accessToken = this.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = this.generateRefreshToken();

      // Store refresh token and update last login
      await user.update({
        refreshToken,
        lastLoginAt: new Date(),
      });

      return {
        success: true,
        user: user.toSafeObject(),
        accessToken,
        refreshToken,
        expiresIn: this.getTokenExpiryTime(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error(`[${new Date().toISOString()}] Login error:`, {
        error: (error as Error).message,
        email: credentials.email,
      });

      throw new AppError('Login failed', 500, 'LOGIN_ERROR');
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      if (!refreshToken) {
        throw new AppError('Refresh token is required', 400, 'REFRESH_TOKEN_REQUIRED');
      }

      // Find user with this refresh token
      const user = await User.findOne({
        where: { refreshToken },
      });

      if (!user) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      // Check if account is still active
      if (user.status === 'suspended' || user.status === 'deactivated') {
        throw new AppError(
          'Account is suspended or deactivated',
          403,
          'ACCOUNT_SUSPENDED',
        );
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      const newRefreshToken = this.generateRefreshToken();

      // Update refresh token
      await user.update({ refreshToken: newRefreshToken });

      return {
        success: true,
        user: user.toSafeObject(),
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.getTokenExpiryTime(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error(`[${new Date().toISOString()}] Token refresh error:`, {
        error: (error as Error).message,
      });

      throw new AppError('Token refresh failed', 500, 'TOKEN_REFRESH_ERROR');
    }
  }

  /**
   * Logout user
   */
  static async logout(userId: string): Promise<void> {
    try {
      await User.update(
        { refreshToken: null },
        { where: { id: userId } },
      );
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Logout error:`, {
        error: (error as Error).message,
        userId,
      });
      throw new AppError('Logout failed', 500, 'LOGOUT_ERROR');
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<any> {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      return user.toSafeObject();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error(`[${new Date().toISOString()}] Get user error:`, {
        error: (error as Error).message,
        userId,
      });

      throw new AppError('Failed to retrieve user', 500, 'USER_RETRIEVAL_ERROR');
    }
  }

  /**
   * Get token expiry time in seconds
   */
  private static getTokenExpiryTime(): number {
    const expiresIn = JWT_EXPIRES_IN;

    if (expiresIn.endsWith('h')) {
      return parseInt(expiresIn) * 3600; // Convert hours to seconds
    } else if (expiresIn.endsWith('d')) {
      return parseInt(expiresIn) * 86400; // Convert days to seconds
    } else if (expiresIn.endsWith('m')) {
      return parseInt(expiresIn) * 60; // Convert minutes to seconds
    } else {
      return parseInt(expiresIn); // Assume seconds
    }
  }
}
