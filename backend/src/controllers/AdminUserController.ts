/**
 * @fileoverview Admin user management controller
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import User from '../models/User';
import { UserRole, UserStatus } from '../types';
import { logInfo, logError } from '../utils/logger';

export class AdminUserController {
  /**
   * Get all users with filtering and pagination for admin panel
   */
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        role,
        verified,
        startDate,
        endDate,
        search,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);
      const whereClause: any = {};

      // Filter by active status
      if (status && status !== 'all') {
        if (status === 'active') {
          whereClause[Op.and] = whereClause[Op.and] || [];
          whereClause[Op.and].push(sequelize.where(sequelize.col('is_active'), '=', true));
        } else if (status === 'inactive') {
          whereClause[Op.and] = whereClause[Op.and] || [];
          whereClause[Op.and].push(sequelize.where(sequelize.col('is_active'), '=', false));
        }
      }

      // Filter by role
      if (role && role !== 'all') {
        whereClause.role = role;
      }

      // Filter by verification status (using is_verified from database)
      if (verified === 'true') {
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push(sequelize.where(sequelize.col('is_verified'), '=', true));
      } else if (verified === 'false') {
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push(sequelize.where(sequelize.col('is_verified'), '=', false));
      }

      // Filter by date range
      if (startDate && endDate) {
        whereClause.createdAt = {
          [Op.between]: [new Date(startDate as string), new Date(endDate as string)],
        };
      }

      // Search functionality (using actual database column names)
      if (search) {
        whereClause[Op.or] = [
          sequelize.where(sequelize.col('first_name'), Op.iLike, `%${search}%`),
          sequelize.where(sequelize.col('last_name'), Op.iLike, `%${search}%`),
          { email: { [Op.iLike]: `%${search}%` } },
          sequelize.where(sequelize.col('phone_number'), Op.iLike, `%${search}%`),
        ];
      }

      const { rows: users, count: total } = await User.findAndCountAll({
        where: whereClause,
        attributes: {
          exclude: ['password'],
        },
        order: [[sortBy as string, sortOrder as string]],
        limit: Number(limit),
        offset,
      });

      // For now, return users without stats to test basic functionality
      const usersWithStats = users.map(user => ({
        ...user.toJSON(),
        stats: {
          rides: { total: 0, completed: 0, cancelled: 0, pending: 0 },
          bookings: { total: 0, completed: 0, cancelled: 0, pending: 0 },
          vehicles: 0,
        },
      }));

      res.status(200).json({
        success: true,
        data: {
          users: usersWithStats,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logError('Admin getAllUsers error', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve users',
        code: 'GET_USERS_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get detailed user information by ID for admin
   */
  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id, {
        attributes: {
          exclude: ['password'],
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // For now, return simplified user data without complex associations
      const stats = {
        totalRides: 0,
        completedRides: 0,
        rideCompletionRate: 0,
        totalBookings: 0,
        completedBookings: 0,
        bookingCompletionRate: 0,
        totalVehicles: 0,
        accountAge: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      };

      res.status(200).json({
        success: true,
        data: {
          user: user.toJSON(),
          rides: [],
          bookings: [],
          vehicles: [],
          stats,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logError('Admin getUserById error', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user details',
        code: 'GET_USER_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Update user information
   */
  static async updateUser(req: Request, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const updateData = req.body;
      const adminUser = (req as any).user;

      const user = await User.findByPk(id, { transaction });

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Remove sensitive fields that shouldn't be updated via this endpoint
      delete updateData.password;
      delete updateData.id;

      // Validate role changes
      if (updateData.role && !Object.values(UserRole).includes(updateData.role)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user role',
          code: 'INVALID_ROLE',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Validate status changes
      if (updateData.status && !Object.values(UserStatus).includes(updateData.status)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user status',
          code: 'INVALID_STATUS',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      const oldData = { ...user.toJSON() };
      await user.update(updateData, { transaction });
      await transaction.commit();

      // Log admin action
      logInfo('Admin updated user', {
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        userId: id,
        changes: updateData,
        oldData: {
          status: oldData.status,
          role: oldData.role,
          isVerified: oldData.isEmailVerified,
        },
      });

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: {
          user: {
            ...user.toJSON(),
            password: undefined,
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      await transaction.rollback();
      logError('Admin updateUser error', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user',
        code: 'UPDATE_USER_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Block a user account
   */
  static async blockUser(req: Request, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminUser = (req as any).user;

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Block reason is required',
          code: 'REASON_REQUIRED',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      const user = await User.findByPk(id, { transaction });

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      if (!user.isPhoneVerified) {
        res.status(400).json({
          success: false,
          error: 'User is already blocked',
          code: 'USER_ALREADY_BLOCKED',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      const oldStatus = user.isPhoneVerified;
      await user.update({
        isPhoneVerified: false,
      }, { transaction });

      // For now, skip ride/booking cancellation (requires proper model associations)
      // TODO: Implement ride/booking cancellation when associations are set up

      await transaction.commit();

      // Log admin action
      logInfo('Admin blocked user', {
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        userId: id,
        userEmail: user.email,
        reason,
        oldStatus,
      });

      res.status(200).json({
        success: true,
        message: 'User blocked successfully',
        data: {
          userId: id,
          newStatus: 'blocked',
          reason,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      await transaction.rollback();
      logError('Admin blockUser error', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to block user',
        code: 'BLOCK_USER_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Unblock a user account
   */
  static async unblockUser(req: Request, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminUser = (req as any).user;

      const user = await User.findByPk(id, { transaction });

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      if (user.isPhoneVerified) {
        res.status(400).json({
          success: false,
          error: 'User is not blocked',
          code: 'USER_NOT_BLOCKED',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      await user.update({
        isPhoneVerified: true,
      }, { transaction });

      await transaction.commit();

      // Log admin action
      logInfo('Admin unblocked user', {
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        userId: id,
        userEmail: user.email,
        reason: reason || 'No reason provided',
      });

      res.status(200).json({
        success: true,
        message: 'User unblocked successfully',
        data: {
          userId: id,
          newStatus: 'active',
          reason: reason || 'No reason provided',
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      await transaction.rollback();
      logError('Admin unblockUser error', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to unblock user',
        code: 'UNBLOCK_USER_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Verify user identity (manual verification)
   */
  static async verifyUser(req: Request, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { verificationType, documents, notes } = req.body;
      const adminUser = (req as any).user;

      const user = await User.findByPk(id, { transaction });

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      const updateData: any = {};

      if (verificationType === 'email' || verificationType === 'both') {
        updateData.isEmailVerified = true;
      }

      if (verificationType === 'phone' || verificationType === 'both') {
        updateData.isPhoneVerified = true;
      }

      if (verificationType === 'identity') {
        // For identity verification, we could add additional fields
        updateData.isEmailVerified = true;
        updateData.isPhoneVerified = true;
      }

      await user.update(updateData, { transaction });
      await transaction.commit();

      // Log admin action
      logInfo('Admin verified user', {
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        userId: id,
        userEmail: user.email,
        verificationType,
        documents: documents || [],
        notes: notes || 'No notes provided',
      });

      res.status(200).json({
        success: true,
        message: 'User verification updated successfully',
        data: {
          userId: id,
          verificationType,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      await transaction.rollback();
      logError('Admin verifyUser error', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify user',
        code: 'VERIFY_USER_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get user analytics and statistics
   */
  static async getUserAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        groupBy = 'day', // day, week, month
      } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      // Overall user statistics
      const totalUsers = await User.count({
        where: {
          createdAt: { [Op.between]: [start, end] },
        },
      });

      const usersByStatus = await User.findAll({
        where: {
          createdAt: { [Op.between]: [start, end] },
        },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: ['status'],
        raw: true,
      });

      const usersByRole = await User.findAll({
        where: {
          createdAt: { [Op.between]: [start, end] },
        },
        attributes: [
          'role',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: ['role'],
        raw: true,
      });

      // Verification statistics
      const verificationStats = await sequelize.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_email_verified = true THEN 1 END) as email_verified,
          COUNT(CASE WHEN is_phone_verified = true THEN 1 END) as phone_verified,
          COUNT(CASE WHEN is_email_verified = true AND is_phone_verified = true THEN 1 END) as fully_verified,
          AVG(CASE WHEN last_login_at IS NOT NULL THEN 1 ELSE 0 END) * 100 as active_user_rate
        FROM users
        WHERE created_at BETWEEN :start AND :end
      `, {
        replacements: { start, end },
        type: (sequelize as any).QueryTypes.SELECT,
      });

      // Growth trend data
      const trendData = await sequelize.query(`
        SELECT 
          DATE_TRUNC('${groupBy}', created_at) as period,
          COUNT(*) as new_users,
          COUNT(CASE WHEN role = 'driver' THEN 1 END) as new_drivers,
          COUNT(CASE WHEN role = 'passenger' THEN 1 END) as new_passengers
        FROM users
        WHERE created_at BETWEEN :start AND :end
        GROUP BY DATE_TRUNC('${groupBy}', created_at)
        ORDER BY period
      `, {
        replacements: { start, end },
        type: (sequelize as any).QueryTypes.SELECT,
      });

      // Top drivers by activity
      const topDrivers = await sequelize.query(`
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          COUNT(r.id) as total_rides,
          COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_rides,
          AVG(CASE WHEN r.status = 'completed' THEN r.price_per_seat END) as avg_price
        FROM users u
        LEFT JOIN rides r ON u.id = r.driver_id
        WHERE u.role = 'driver' 
          AND u.created_at BETWEEN :start AND :end
        GROUP BY u.id, u.first_name, u.last_name, u.email
        HAVING COUNT(r.id) > 0
        ORDER BY total_rides DESC
        LIMIT 10
      `, {
        replacements: { start, end },
        type: (sequelize as any).QueryTypes.SELECT,
      });

      res.status(200).json({
        success: true,
        data: {
          summary: {
            totalUsers,
            usersByStatus: usersByStatus.reduce((acc: any, curr: any) => {
              acc[curr.status] = Number(curr.count);
              return acc;
            }, {}),
            usersByRole: usersByRole.reduce((acc: any, curr: any) => {
              acc[curr.role] = Number(curr.count);
              return acc;
            }, {}),
            verification: verificationStats[0] || {},
            period: { start, end },
          },
          trendData,
          topDrivers,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logError('Admin getUserAnalytics error', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user analytics',
        code: 'GET_USER_ANALYTICS_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export default AdminUserController;
