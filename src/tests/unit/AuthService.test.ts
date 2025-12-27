/**
 * @fileoverview Unit tests for AuthService
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-20
 */

import { AuthService } from '../../services/AuthService';
import { User } from '../../models';
import { UserRole, AppError } from '../../types';

describe('AuthService', () => {
  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const payload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: UserRole.PASSENGER,
      };

      const token = AuthService.generateAccessToken(payload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include correct payload in token', () => {
      const payload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: UserRole.PASSENGER,
      };

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
      const payload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: UserRole.PASSENGER,
      };

      const token = AuthService.generateAccessToken(payload);
      const decoded = AuthService.verifyToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        AuthService.verifyToken('invalid-token');
      }).toThrow(AppError);
    });

    it('should throw error for malformed token', () => {
      expect(() => {
        AuthService.verifyToken('not.a.valid.jwt.token');
      }).toThrow(AppError);
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
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(userData.email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.expiresIn).toBe('number');
    });

    it('should hash password during registration', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        phone: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.PASSENGER,
      };

      await AuthService.register(userData);

      const user = await User.findOne({ where: { email: userData.email } });
      expect(user?.password).not.toBe(userData.password);
      expect(user?.password).toContain('$'); // bcrypt hash contains $
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        phone: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.PASSENGER,
      };

      // Register first user
      await AuthService.register(userData);

      // Attempt to register with same email
      await expect(
        AuthService.register({ ...userData, phone: '+9876543210' })
      ).rejects.toThrow(AppError);
    });

    it('should throw error for duplicate phone', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        phone: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.PASSENGER,
      };

      // Register first user
      await AuthService.register(userData);

      // Attempt to register with same phone
      await expect(
        AuthService.register({ ...userData, email: 'different@example.com' })
      ).rejects.toThrow(AppError);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create a test user
      await User.create({
        email: 'test@example.com',
        password: 'Password123!',
        phone: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.PASSENGER,
        status: 'active',
      });
    });

    it('should login user with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const result = await AuthService.login(credentials);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(credentials.email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw error for invalid email', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      await expect(AuthService.login(credentials)).rejects.toThrow(AppError);
    });

    it('should throw error for invalid password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      await expect(AuthService.login(credentials)).rejects.toThrow(AppError);
    });

    it('should throw error for suspended account', async () => {
      // Update user status to suspended
      await User.update(
        { status: 'suspended' },
        { where: { email: 'test@example.com' } }
      );

      const credentials = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      await expect(AuthService.login(credentials)).rejects.toThrow(AppError);
    });
  });

  describe('refreshToken', () => {
    let user: any;
    let refreshToken: string;

    beforeEach(async () => {
      refreshToken = AuthService.generateRefreshToken();
      user = await User.create({
        email: 'test@example.com',
        password: 'Password123!',
        phone: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.PASSENGER,
        status: 'active',
        refreshToken,
      });
    });

    it('should refresh token with valid refresh token', async () => {
      const result = await AuthService.refreshToken(refreshToken);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(refreshToken); // Should be new token
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(
        AuthService.refreshToken('invalid-refresh-token')
      ).rejects.toThrow(AppError);
    });

    it('should throw error for empty refresh token', async () => {
      await expect(AuthService.refreshToken('')).rejects.toThrow(AppError);
    });
  });

  describe('logout', () => {
    let user: any;

    beforeEach(async () => {
      user = await User.create({
        email: 'test@example.com',
        password: 'Password123!',
        phone: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.PASSENGER,
        refreshToken: 'some-refresh-token',
      });
    });

    it('should clear refresh token on logout', async () => {
      await AuthService.logout(user.id);

      const updatedUser = await User.findByPk(user.id);
      expect(updatedUser?.refreshToken).toBeNull();
    });
  });

  describe('getUserById', () => {
    let user: any;

    beforeEach(async () => {
      user = await User.create({
        email: 'test@example.com',
        password: 'Password123!',
        phone: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.PASSENGER,
      });
    });

    it('should return user by ID', async () => {
      const result = await AuthService.getUserById(user.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
      expect(result.password).toBeUndefined(); // Should not include password
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        AuthService.getUserById('non-existent-id')
      ).rejects.toThrow(AppError);
    });
  });
});