/**
 * @fileoverview Admin authentication and management controller
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { logInfo, logError, logWarn } from '../utils/logger';
import { AdminUser } from '../models/AdminUser';
import User from '../models/User';
import Ride from '../models/Ride';
import Booking from '../models/Booking';
import Package from '../models/Package';
import { DeliveryAgreement, DeliveryStatus } from '../models/DeliveryAgreement';
import { DeliveryDispute } from '../models/DeliveryDispute';
import { UserStatus, RideStatus, BookingStatus } from '../types';

// Configuration constants — fail fast if secrets are missing
if (!process.env['JWT_SECRET']) throw new Error('JWT_SECRET environment variable is required');
if (!process.env['JWT_REFRESH_SECRET']) throw new Error('JWT_REFRESH_SECRET environment variable is required');
const JWT_SECRET = process.env['JWT_SECRET'] as string;
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] as string;

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
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      // User stats
      const [totalUsers, activeUsers, suspendedUsers, newUsersThisMonth, newUsersLastMonth] = await Promise.all([
        User.count(),
        User.count({ where: { status: UserStatus.ACTIVE } }),
        User.count({ where: { status: UserStatus.SUSPENDED } }),
        User.count({ where: { createdAt: { [Op.gte]: startOfMonth } } }),
        User.count({ where: { createdAt: { [Op.between]: [startOfLastMonth, endOfLastMonth] } } }),
      ]);
      const userGrowthRate = newUsersLastMonth > 0
        ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 1000) / 10
        : 0;

      // Ride stats
      const [totalRides, activeRides, completedRides, cancelledRides, newRidesThisMonth] = await Promise.all([
        Ride.count(),
        Ride.count({ where: { status: { [Op.in]: [RideStatus.PENDING, RideStatus.CONFIRMED, RideStatus.IN_PROGRESS] } } }),
        Ride.count({ where: { status: RideStatus.COMPLETED } }),
        Ride.count({ where: { status: RideStatus.CANCELLED } }),
        Ride.count({ where: { createdAt: { [Op.gte]: startOfMonth } } }),
      ]);
      const rideCompletionRate = totalRides > 0
        ? Math.round((completedRides / totalRides) * 1000) / 10
        : 0;

      // Courier stats
      const [totalPackages, activeDeliveries, completedDeliveries, disputedDeliveries, newPackagesThisMonth] = await Promise.all([
        Package.count(),
        DeliveryAgreement.count({ where: { status: DeliveryStatus.IN_TRANSIT } }),
        DeliveryAgreement.count({ where: { status: DeliveryStatus.COMPLETED } }),
        DeliveryDispute.count(),
        Package.count({ where: { createdAt: { [Op.gte]: startOfMonth } } }),
      ]);
      const totalDeliveries = completedDeliveries + disputedDeliveries;
      const courierSuccessRate = totalDeliveries > 0
        ? Math.round((completedDeliveries / totalDeliveries) * 1000) / 10
        : 0;

      // Revenue from completed bookings
      const [revenueAll, revenueThisMonth, revenueLastMonth] = await Promise.all([
        Booking.sum('totalAmount', { where: { status: BookingStatus.COMPLETED } }) as Promise<number | null>,
        Booking.sum('totalAmount', { where: { status: BookingStatus.COMPLETED, createdAt: { [Op.gte]: startOfMonth } } }) as Promise<number | null>,
        Booking.sum('totalAmount', { where: { status: BookingStatus.COMPLETED, createdAt: { [Op.between]: [startOfLastMonth, endOfLastMonth] } } }) as Promise<number | null>,
      ]);
      const totalRevenue = revenueAll ?? 0;
      const monthRevenue = revenueThisMonth ?? 0;
      const lastMonthRevenue = revenueLastMonth ?? 0;
      const revenueGrowth = lastMonthRevenue > 0
        ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10
        : 0;

      // Open disputes
      const [openDisputes, resolvedDisputes] = await Promise.all([
        DeliveryDispute.count({ where: { status: { [Op.in]: ['open', 'investigating'] } } }),
        DeliveryDispute.count({ where: { status: 'resolved' } }),
      ]);

      const stats = {
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          newThisMonth: newUsersThisMonth,
          growthRate: userGrowthRate,
        },
        rides: {
          total: totalRides,
          active: activeRides,
          completed: completedRides,
          cancelled: cancelledRides,
          newThisMonth: newRidesThisMonth,
          completionRate: rideCompletionRate,
        },
        courier: {
          totalPackages,
          activeDeliveries,
          completed: completedDeliveries,
          disputed: disputedDeliveries,
          newThisMonth: newPackagesThisMonth,
          successRate: courierSuccessRate,
        },
        revenue: {
          total: Math.round(totalRevenue * 100) / 100,
          thisMonth: Math.round(monthRevenue * 100) / 100,
          lastMonth: Math.round(lastMonthRevenue * 100) / 100,
          growthRate: revenueGrowth,
        },
        disputes: {
          total: openDisputes + resolvedDisputes,
          open: openDisputes,
          resolved: resolvedDisputes,
        },
      };

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
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
