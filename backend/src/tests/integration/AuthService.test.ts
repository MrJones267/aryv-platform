/**
 * @fileoverview Unit tests for AuthService
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2026-04-17
 */

import crypto from 'crypto';
import { AuthService } from '../../services/AuthService';
import { User } from '../../models';
import { UserRole, UserStatus, AppError } from '../../types';

// Mock Redis so unit tests don't need a live Redis instance
jest.mock('../../config/redis', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    increment: jest.fn().mockResolvedValue(1),
    isConnected: jest.fn().mockReturnValue(false),
    connect: jest.fn().mockResolvedValue(undefined),
  },
}));

const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

describe('AuthService', () => {
  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const payload = { userId: 'test-user-id', email: 'test@example.com', role: UserRole.PASSENGER };
      const token = AuthService.generateAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct payload in token', () => {
      const payload = { userId: 'test-user-id', email: 'test@example.com', role: UserRole.PASSENGER };
      const token = AuthService.generateAccessToken(payload);
      const decoded = AuthService.verifyToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a refresh token', () => {
      const refreshToken = AuthService.generateRefreshToken();
      expect(typeof refreshToken).toBe('string');
      expect(refreshToken.length).toBeGreaterThan(20);
    });

    it('should generate unique refresh tokens', () => {
      const token1 = AuthService.generateRefreshToken();
      const token2 = AuthService.generateRefreshToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const payload = { userId: 'test-user-id', email: 'test@example.com', role: UserRole.PASSENGER };
      const token = AuthService.generateAccessToken(payload);
      const decoded = AuthService.verifyToken(token);
      expect(decoded.userId).toBe(payload.userId);
    });

    it('should throw AppError for invalid token', () => {
      expect(() => AuthService.verifyToken('invalid-token')).toThrow(AppError);
    });

    it('should throw AppError for malformed token', () => {
      expect(() => AuthService.verifyToken('not.a.valid.jwt.token')).toThrow(AppError);
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        phone: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.PASSENGER,
      };

      const result = await AuthService.register(userData);

      expect(result.success).toBe(true);
      expect(result.user?.email).toBe(userData.email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should store refresh token as SHA-256 hash, not plaintext', async () => {
      const userData = {
        email: 'hash-test@example.com',
        password: 'Password123!',
        phone: '+1111111111',
        firstName: 'Hash',
        lastName: 'Test',
        role: UserRole.PASSENGER,
      };

      const result = await AuthService.register(userData);
      const rawToken = result.refreshToken!;

      const user = await User.findOne({ where: { email: userData.email } });
      expect(user?.refreshToken).not.toBe(rawToken);
      expect(user?.refreshToken).toBe(hashToken(rawToken));
    });

    it('should hash password during registration', async () => {
      const userData = {
        email: 'pw-test@example.com',
        password: 'Password123!',
        phone: '+2222222222',
        firstName: 'Pw',
        lastName: 'Test',
        role: UserRole.PASSENGER,
      };

      await AuthService.register(userData);

      const user = await User.findOne({ where: { email: userData.email } });
      expect(user?.password).not.toBe(userData.password);
      expect(user?.password).toContain('$');
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'dupe@example.com',
        password: 'Password123!',
        phone: '+3333333333',
        firstName: 'Dupe',
        lastName: 'User',
        role: UserRole.PASSENGER,
      };

      await AuthService.register(userData);
      await expect(
        AuthService.register({ ...userData, phone: '+4444444444' })
      ).rejects.toThrow(AppError);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await AuthService.register({
        email: 'login@example.com',
        password: 'Password123!',
        phone: '+5555555555',
        firstName: 'Login',
        lastName: 'User',
        role: UserRole.PASSENGER,
      });
    });

    it('should login with valid credentials', async () => {
      const result = await AuthService.login({ email: 'login@example.com', password: 'Password123!' });
      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should store hashed refresh token after login', async () => {
      const result = await AuthService.login({ email: 'login@example.com', password: 'Password123!' });
      const rawToken = result.refreshToken!;

      const user = await User.findOne({ where: { email: 'login@example.com' } });
      expect(user?.refreshToken).toBe(hashToken(rawToken));
      expect(user?.refreshToken).not.toBe(rawToken);
    });

    it('should throw error for wrong password', async () => {
      await expect(
        AuthService.login({ email: 'login@example.com', password: 'WrongPassword!' })
      ).rejects.toThrow(AppError);
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        AuthService.login({ email: 'nobody@example.com', password: 'Password123!' })
      ).rejects.toThrow(AppError);
    });

    it('should throw error for suspended account', async () => {
      await User.update({ status: UserStatus.SUSPENDED }, { where: { email: 'login@example.com' } });
      await expect(
        AuthService.login({ email: 'login@example.com', password: 'Password123!' })
      ).rejects.toThrow(AppError);
    });
  });

  describe('refreshToken', () => {
    let rawRefreshToken: string;

    beforeEach(async () => {
      // Obtain a real token via login so DB contains correct hash
      const reg = await AuthService.register({
        email: 'refresh@example.com',
        password: 'Password123!',
        phone: '+6666666666',
        firstName: 'Refresh',
        lastName: 'User',
        role: UserRole.PASSENGER,
      });
      rawRefreshToken = reg.refreshToken!;
    });

    it('should exchange a valid refresh token for new tokens', async () => {
      const result = await AuthService.refreshToken(rawRefreshToken);
      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(rawRefreshToken);
    });

    it('should store new hashed refresh token after rotation', async () => {
      const result = await AuthService.refreshToken(rawRefreshToken);
      const newRaw = result.refreshToken!;

      const user = await User.findOne({ where: { email: 'refresh@example.com' } });
      expect(user?.refreshToken).toBe(hashToken(newRaw));
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(AuthService.refreshToken('invalid-token')).rejects.toThrow(AppError);
    });

    it('should throw error for empty refresh token', async () => {
      await expect(AuthService.refreshToken('')).rejects.toThrow(AppError);
    });
  });

  describe('logout', () => {
    it('should clear refresh token on logout', async () => {
      await AuthService.register({
        email: 'logout@example.com',
        password: 'Password123!',
        phone: '+7777777777',
        firstName: 'Logout',
        lastName: 'User',
        role: UserRole.PASSENGER,
      });

      const user = await User.findOne({ where: { email: 'logout@example.com' } });
      expect(user?.refreshToken).not.toBeNull();

      await AuthService.logout(user!.id);

      const updated = await User.findByPk(user!.id);
      expect(updated?.refreshToken).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('should return user without password field', async () => {
      await AuthService.register({
        email: 'getuser@example.com',
        password: 'Password123!',
        phone: '+8888888888',
        firstName: 'Get',
        lastName: 'User',
        role: UserRole.PASSENGER,
      });

      const user = await User.findOne({ where: { email: 'getuser@example.com' } });
      const result = await AuthService.getUserById(user!.id);

      expect(result.id).toBe(user!.id);
      expect((result as any).password).toBeUndefined();
    });

    it('should throw error for non-existent user', async () => {
      await expect(AuthService.getUserById('00000000-0000-0000-0000-000000000000')).rejects.toThrow(AppError);
    });
  });
});
