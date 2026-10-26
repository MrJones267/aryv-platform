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
import MemoryTtlCache from '../utils/memoryTtlCache';

const BLACKLIST_PREFIX = 'bl:';
const USED_REFRESH_PREFIX = 'ur:';
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * This process's own record of the tokens it has revoked, so a logout handled
 * here still holds if Redis becomes unreachable a moment later. Per-process
 * and lost on restart — a supplement to Redis, never a substitute.
 */
const localBlacklist = new MemoryTtlCache();

/**
 * Refuse requests outright when the revocation list cannot be reached, rather
 * than falling back to this instance's own view. Trades availability for
 * certainty; off by default because a Redis blip would otherwise take the
 * whole API down.
 */
const FAIL_CLOSED = process.env['REDIS_FAIL_CLOSED'] === 'true';

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
   * Mint a session for a user: an access token, a rotated refresh token, and
   * the stored hash of that refresh token.
   *
   * Every sign-in path must go through here. Two of them did not — Google
   * sign-in and OTP login each wrote `refreshToken` to the user row *raw*,
   * while login, register and refresh all wrote `hashRefreshToken(...)`. That
   * had two consequences: a database read handed over a directly replayable
   * refresh token for those users, defeating the point of hashing it; and
   * because the refresh lookup searches by hash, their tokens never matched,
   * so those sessions could not be refreshed at all and died after 24 hours.
   */
  static async issueSession(user: {
    id: string;
    email: string;
    role: UserRole;
    update: (values: Record<string, unknown>) => Promise<unknown>;
  }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
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

    return { accessToken, refreshToken, expiresIn: this.getTokenExpiryTime() };
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

      // Self-registration may only create passenger or driver accounts.
      // Privileged roles (admin, courier) can never be obtained via the public
      // registration endpoint — defense in depth alongside the request schema.
      const allowedSelfRoles: UserRole[] = [UserRole.PASSENGER, UserRole.DRIVER];
      const requestedRole = userData.role as UserRole | undefined;
      const safeRole = requestedRole && allowedSelfRoles.includes(requestedRole)
        ? requestedRole
        : UserRole.PASSENGER;

      // Create new user
      const user = await User.create({
        email: userData.email,
        password: userData.password,
        phone: userData.phone,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: safeRole,
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

      // Blacklist the access token so it can't be reused before it expires.
      // Written to both Redis and this process's own mirror: `redisClient.set`
      // swallows its own errors, so without the mirror a logout during a Redis
      // blip revoked nothing at all and said so nowhere.
      if (accessToken) {
        try {
          const decoded = jwt.decode(accessToken) as { exp?: number } | null;
          const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400;
          await this.revokeToken(accessToken, ttl);
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
   * Revoke a single token until it would have expired anyway.
   *
   * The one place a revocation is recorded, so every caller gets the local
   * mirror as well as the Redis entry. The admin logout used to write the
   * Redis key itself and so missed the mirror entirely — during a Redis blip
   * an admin could sign out and keep a working session, which is the failure
   * mode the mirror exists to prevent.
   */
  static async revokeToken(token: string, ttlSeconds: number): Promise<void> {
    if (!token || ttlSeconds <= 0) return;
    const key = `${BLACKLIST_PREFIX}${token}`;
    localBlacklist.set(key, ttlSeconds);
    await redisClient.set(key, '1', ttlSeconds);
  }

  /**
   * Check if an access token has been blacklisted (post-logout).
   *
   * `redisClient.get` answers `null` both for "not blacklisted" and for "Redis
   * is unreachable", and this used to treat the two identically — so a Redis
   * outage silently re-enabled every token anyone had logged out. Nothing in
   * the logs distinguished the two states either.
   *
   * The three-way behaviour now:
   *
   *   Redis up          authoritative answer.
   *   Redis down        fall back to this process's own record of what it
   *                     revoked. A revocation made on another instance can be
   *                     missed for the duration of the outage, which is the
   *                     residual risk, but a logout handled here still holds.
   *   REDIS_FAIL_CLOSED an operator who would rather refuse traffic than take
   *                     that residual risk sets this, and an unreachable Redis
   *                     rejects the token instead.
   *
   * The compromise case — a password reset — does not depend on any of this:
   * `passwordChangedAt` is enforced from the database in authenticateToken.
   */
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `${BLACKLIST_PREFIX}${token}`;

    if (redisClient.isConnected()) {
      const result = await redisClient.get(key);
      if (result !== null) return true;
      // Redis may have been up for the read but missed the write during an
      // earlier blip, so the local mirror is still consulted.
      return localBlacklist.has(key);
    }

    if (localBlacklist.has(key)) return true;

    if (FAIL_CLOSED) {
      logger.error('Refusing a token because the revocation list is unreachable', {
        reason: 'REDIS_UNAVAILABLE',
      });
      return true;
    }

    logger.warn('Token revocation list unreachable — falling back to this instance only', {
      locallyTracked: localBlacklist.size,
    });
    return false;
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
  static getTokenExpiryTime(): number {
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
