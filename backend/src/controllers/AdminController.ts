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
import { AuthService } from '../services/AuthService';
import User from '../models/User';
import Ride from '../models/Ride';
import Package from '../models/Package';
import { DeliveryAgreement, DeliveryStatus } from '../models/DeliveryAgreement';
import { DeliveryDispute } from '../models/DeliveryDispute';
import { PLATFORM_DEFAULT_CURRENCY } from '../services/CurrencyService';
import { getRevenueByCurrency } from '../services/RevenueReportService';
import { ADMIN_SESSION_HOURS, getAdminSessionHours } from '../services/PlatformSettingsService';
import { recordAdminAction } from '../services/AuditService';
import { adminTwoFactorService } from '../services/AdminTwoFactorService';

/**
 * How long an admin session lasts.
 *
 * "Remember me" used to mint a **seven day** bearer token for full platform
 * administration — user records, ride history, commission settings, manual
 * payment release — held in localStorage where any script on the origin can
 * read it. That became a fixed day, and is now a setting a super admin
 * chooses between ADMIN_SESSION_HOURS.MIN and MAX (1 to 24 hours), starting
 * at 1. "Remember me" no longer changes it.
 *
 * This constant is the ceiling: a revoked token has to stay on the
 * revocation list for as long as any admin token can live.
 */
export const ADMIN_TOKEN_TTL_SECONDS = ADMIN_SESSION_HOURS.MAX * 60 * 60;
import { UserStatus, RideStatus } from '../types';

// Configuration constants — fail fast if secrets are missing
if (!process.env['JWT_SECRET']) throw new Error('JWT_SECRET environment variable is required');
if (!process.env['JWT_REFRESH_SECRET']) throw new Error('JWT_REFRESH_SECRET environment variable is required');
if (!process.env['ADMIN_JWT_SECRET']) throw new Error('ADMIN_JWT_SECRET environment variable is required');

/**
 * Admin tokens are signed with their own secret.
 *
 * Startup already refused to run without `ADMIN_JWT_SECRET`, which read as if
 * admin sessions were cryptographically separate from user sessions. They were
 * not — this signed with `JWT_SECRET`, the same key as every passenger's
 * token, and `ADMIN_JWT_SECRET` was never referenced anywhere. Cross-use was
 * blocked by other means (the `type: 'admin'` claim, and user verification
 * requiring an issuer and audience that admin tokens do not set), so it was
 * not exploitable — but the required variable promised a separation that did
 * not exist, and the next person to touch this would have believed it.
 *
 * Real separation is worth having: admin sessions can now be revoked wholesale
 * by rotating this one secret, without signing every passenger out.
 */
const ADMIN_JWT_SECRET = process.env['ADMIN_JWT_SECRET'] as string;
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] as string;

export class AdminController {
  /**
   * Admin login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Find admin user by email
      const admin = await AdminUser.findByEmail(email);
      if (!admin || !admin.isActive) {
        logWarn('Admin login attempt with invalid email', { email, ip: req.ip });
        // A disabled account is still an admin to attribute the attempt to.
        if (admin) {
          await recordAdminAction(req, { adminUserId: admin.id, action: 'admin.sign_in', resourceType: 'admin_user', resourceId: admin.id, details: { outcome: 'refused', reason: 'account_disabled' } });
        }
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
        await recordAdminAction(req, { adminUserId: admin.id, action: 'admin.sign_in', resourceType: 'admin_user', resourceId: admin.id, details: { outcome: 'refused', reason: 'account_locked' } });
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
        await recordAdminAction(req, { adminUserId: admin.id, action: 'admin.sign_in', resourceType: 'admin_user', resourceId: admin.id, details: { outcome: 'refused', reason: 'wrong_password', failedAttempts: admin.failedLoginAttempts } });

        res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
        return;
      }

      // The second step, for accounts that have two-factor sign-in on. The
      // password is already right, so a missing code is a prompt, not a
      // failure; a wrong or reused one counts towards the lockout.
      if (admin.twoFactorEnabled) {
        const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\s+/g, '') : '';
        if (!code) {
          res.status(401).json({
            success: false,
            error: 'Enter the 6-digit code from your authenticator app',
            code: 'TWO_FACTOR_REQUIRED',
          });
          return;
        }
        const check = await adminTwoFactorService.verifySignInCode(admin, code);
        if (!check.ok) {
          if (check.error === 'NOT_CONFIGURED') {
            logError('Admin with two-factor on cannot sign in: TOTP_ENCRYPTION_KEY is not set', new Error('2FA key missing'), { adminId: admin.id });
            res.status(503).json({ success: false, error: 'Two-factor sign-in is unavailable on the server', code: 'TWO_FACTOR_UNAVAILABLE' });
            return;
          }
          admin.incrementFailedAttempts();
          await admin.save();
          await recordAdminAction(req, { adminUserId: admin.id, action: 'admin.sign_in', resourceType: 'admin_user', resourceId: admin.id, details: { outcome: 'refused', reason: check.error === 'CODE_REUSED' ? 'two_factor_code_reused' : 'wrong_two_factor_code', failedAttempts: admin.failedLoginAttempts } });
          res.status(401).json({
            success: false,
            error: check.error === 'CODE_REUSED' ? 'That code has already been used; wait for the next one' : 'That code is not right',
            code: 'TWO_FACTOR_INVALID',
          });
          return;
        }
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

      const sessionHours = await getAdminSessionHours();
      await recordAdminAction(req, { adminUserId: admin.id, action: 'admin.sign_in', resourceType: 'admin_user', resourceId: admin.id, details: { outcome: 'succeeded', sessionHours } });
      const accessToken = jwt.sign(
        tokenPayload,
        ADMIN_JWT_SECRET,
        { expiresIn: sessionHours * 60 * 60 },
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
            expiresIn: `${sessionHours}h`,
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
      const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;

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
      // Actually invalidate the token. This previously only logged, with a
      // comment saying blacklisting was what production would need — so an
      // admin session stayed usable for its full 24-hour (or 7-day) life after
      // the admin signed out.
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        // Through AuthService so the revocation also lands in this process's
        // local mirror. Writing the Redis key directly meant a logout during a
        // Redis outage revoked nothing at all, silently.
        //
        // Held for the longest admin token lifetime, after which expiry takes
        // over and the entry is dead weight.
        await AuthService.revokeToken(token, ADMIN_TOKEN_TTL_SECONDS);
      }

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

      // Revenue from completed bookings and deliveries, kept per currency.
      // This summed total_amount across every currency into one figure, so a
      // pula fare and a rand fare were added together as if they were the
      // same money.
      const growthRate = (thisMonth: number, lastMonth: number): number => (lastMonth > 0
        ? Math.round(((thisMonth - lastMonth) / lastMonth) * 1000) / 10
        : 0);
      const revenueByCurrency = (await getRevenueByCurrency(now)).map((r) => ({
        ...r,
        growthRate: growthRate(r.thisMonth, r.lastMonth),
      }));
      const platformRevenue = revenueByCurrency.find((r) => r.currency === PLATFORM_DEFAULT_CURRENCY)
        ?? { currency: PLATFORM_DEFAULT_CURRENCY, total: 0, thisMonth: 0, lastMonth: 0, growthRate: 0 };

      // Open disputes
      const [openDisputes, resolvedDisputes] = await Promise.all([
        // 'investigating' is not a dispute status; under_review is.
        DeliveryDispute.count({ where: { status: { [Op.in]: ['open', 'under_review'] } } }),
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
        // `revenue` is the platform currency only; `revenueByCurrency` has
        // every currency that has earned anything.
        revenue: platformRevenue,
        revenueByCurrency,
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
