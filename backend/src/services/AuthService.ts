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
import { redisClient } from '../config/redis';
import logger from '../utils/logger';

const BLACKLIST_PREFIX = 'bl:';
const USED_REFRESH_PREFIX = 'ur:';
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

// Constants
if (!process.env['JWT_SECRET']) throw new Error('JWT_SECRET environment variable is required');
const JWT_SECRET = process.env['JWT_SECRET'] as string;
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
      logger.error('Error generating access token', {
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
      logger.error('Error generating refresh token', {
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
        logger.error('Token verification error', {
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

      await user.update({
        refreshToken: hashRefreshToken(refreshToken),
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

      logger.error('Registration error', {
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

      // Store hashed refresh token (raw token is returned to client only)
      await user.update({
        refreshToken: hashRefreshToken(refreshToken),
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

      logger.error('Login error', {
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

      const tokenHash = hashRefreshToken(refreshToken);

      // Detect reuse of a previously rotated token (possible token theft)
      const wasUsed = await redisClient.get(`${USED_REFRESH_PREFIX}${tokenHash}`);
      if (wasUsed) {
        // Token already rotated — possible replay attack; invalidate the session immediately
        await User.update({ refreshToken: null }, { where: { id: wasUsed } });
        throw new AppError('Refresh token already used — possible token theft. Please log in again.', 401, 'REFRESH_TOKEN_REUSE');
      }

      // Find user with this refresh token (DB stores hashed value)
      const user = await User.findOne({
        where: { refreshToken: tokenHash },
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

      // Mark old token hash as used (with TTL matching max token lifetime)
      await redisClient.set(`${USED_REFRESH_PREFIX}${tokenHash}`, user.id, REFRESH_TOKEN_TTL);

      // Update refresh token (rotation) — store only the hash
      await user.update({ refreshToken: hashRefreshToken(newRefreshToken) });

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

      logger.error('Token refresh error', {
        error: (error as Error).message,
      });

      throw new AppError('Token refresh failed', 500, 'TOKEN_REFRESH_ERROR');
    }
  }

  /**
   * Logout user — clears refresh token and blacklists the access token in Redis
   */
  static async logout(userId: string, accessToken?: string): Promise<void> {
    try {
      await User.update(
        { refreshToken: null },
        { where: { id: userId } },
      );

      // Blacklist the access token so it can't be reused before it expires
      if (accessToken) {
        try {
          const decoded = jwt.decode(accessToken) as { exp?: number } | null;
          const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400;
          if (ttl > 0) {
            await redisClient.set(`${BLACKLIST_PREFIX}${accessToken}`, '1', ttl);
          }
        } catch {
          // Decode failure is non-fatal — token may already be invalid
        }
      }
    } catch (error) {
      logger.error('Logout error', {
        error: (error as Error).message,
        userId,
      });
      throw new AppError('Logout failed', 500, 'LOGOUT_ERROR');
    }
  }

  /**
   * Check if an access token has been blacklisted (post-logout)
   */
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await redisClient.get(`${BLACKLIST_PREFIX}${token}`);
    return result !== null;
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

      logger.error('Get user error', {
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
