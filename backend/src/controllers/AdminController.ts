/**
 * @fileoverview Admin authentication and management controller
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { logInfo, logError, logWarn } from '../utils/logger';
import { AdminUser } from '../models/AdminUser';

// Configuration constants
const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] || 'your-refresh-secret';

export class AdminController {
  /**
   * Admin login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, rememberMe } = req.body;

      // Find admin user by email
      const admin = await AdminUser.findByEmail(email);
      if (!admin || !admin.isActive) {
        logWarn('Admin login attempt with invalid email', { email, ip: req.ip });
        res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
        return;
      }

      // Check if account is locked
      if (admin.isAccountLocked()) {
        logWarn('Admin login attempt on locked account', { email, ip: req.ip });
        res.status(423).json({
          success: false,
          error: 'Account is temporarily locked due to multiple failed login attempts',
          code: 'ACCOUNT_LOCKED',
        });
        return;
      }

      // Verify password
      const isValidPassword = await admin.validatePassword(password);
      if (!isValidPassword) {
        // Increment failed attempts
        admin.incrementFailedAttempts();
        await admin.save();

        logWarn('Admin login attempt with invalid password', {
          email,
          ip: req.ip,
          failedAttempts: admin.failedLoginAttempts,
        });

        res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
        return;
      }

      // Reset failed attempts on successful login
      admin.resetFailedAttempts();
      admin.updateLastLogin();
      await admin.save();

      // Generate JWT token
      const tokenPayload = {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        type: 'admin',
      };

      const accessToken = jwt.sign(
        tokenPayload,
        JWT_SECRET,
        { expiresIn: rememberMe ? '7d' : '24h' },
      );

      const refreshToken = jwt.sign(
        { id: admin.id, type: 'admin' },
        JWT_REFRESH_SECRET,
        { expiresIn: '30d' },
      );

      logInfo('Admin login successful', {
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
        ip: req.ip,
      });

      const safeUserData = admin.toSafeObject();
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: safeUserData,
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: rememberMe ? '7d' : '24h',
          },
        },
      });
    } catch (error) {
      logError('Admin login error', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Verify admin token
   */
  static async verify(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'No token provided',
          code: 'NO_TOKEN',
        });
        return;
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      if (decoded.type !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required',
          code: 'ADMIN_ACCESS_REQUIRED',
        });
        return;
      }

      // Find admin user by ID
      const admin = await AdminUser.findByPk(decoded.id);
      if (!admin || !admin.isActive) {
        res.status(401).json({
          success: false,
          error: 'Admin not found or inactive',
          code: 'ADMIN_NOT_FOUND',
        });
        return;
      }

      const safeUserData = admin.toSafeObject();
      res.status(200).json({
        success: true,
        data: {
          user: safeUserData,
        },
      });
    } catch (error) {
      logError('Admin token verification error', error as Error);
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
    }
  }

  /**
   * Admin logout
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      // In production, you would blacklist the token or handle token invalidation
      logInfo('Admin logout', { adminId: req.user?.id, ip: req.ip });

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      logError('Admin logout error', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Update admin profile
   */
  static async updateProfile(req: any, res: Response): Promise<void> {
    try {
      const { firstName, lastName } = req.body;
      const adminId = req.user?.id;

      // Find admin user
      const admin = await AdminUser.findByPk(adminId);
      if (!admin) {
        res.status(404).json({
          success: false,
          error: 'Admin not found',
          code: 'ADMIN_NOT_FOUND',
        });
        return;
      }

      // Update profile
      if (firstName) admin.firstName = firstName;
      if (lastName) admin.lastName = lastName;
      await admin.save();

      logInfo('Admin profile updated', { adminId, changes: { firstName, lastName } });

      const safeUserData = admin.toSafeObject();
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: safeUserData,
        },
      });
    } catch (error) {
      logError('Admin profile update error', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Get dashboard statistics
   */
  static async getDashboardStats(_req: Request, res: Response): Promise<void> {
    try {
      // Mock dashboard statistics - In production, this would query the database
      const stats = {
        users: {
          total: 45230,
          active: 38500,
          verified: 42100,
          blocked: 150,
          newThisMonth: 2340,
          growthRate: 12.5,
        },
        rides: {
          total: 8450,
          active: 245,
          completed: 7890,
          cancelled: 315,
          newThisMonth: 890,
          completionRate: 94.2,
        },
        courier: {
          totalPackages: 3120,
          activeDeliveries: 85,
          completed: 2890,
          disputed: 12,
          newThisMonth: 420,
          successRate: 96.8,
        },
        revenue: {
          total: 45500,
          thisMonth: 12300,
          lastMonth: 10800,
          growthRate: 18.7,
          ridesRevenue: 32500,
          courierRevenue: 13000,
        },
        disputes: {
          total: 12,
          open: 3,
          investigating: 5,
          resolved: 4,
          avgResolutionTime: 2.4, // days
        },
      };

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logError('Dashboard stats error', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}
