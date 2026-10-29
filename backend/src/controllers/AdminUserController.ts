/**
 * @fileoverview Admin user management controller
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import User from '../models/User';
import Ride from '../models/Ride';
import Booking from '../models/Booking';
import Vehicle from '../models/Vehicle';
import { UserRole, UserStatus, RideStatus, BookingStatus, AdminAuthenticatedRequest } from '../types';
import { logInfo, logError } from '../utils/logger';
import { toE164 } from '../utils/phone';

// Constants
/**
 * The user fields admin responses carry. Responses spread user.toJSON(),
 * which drops only the password, so they also carried the refresh-token hash
 * and every other column. Listing them keeps that from happening again.
 */
const ADMIN_USER_FIELDS = [
  'id', 'email', 'phone', 'firstName', 'lastName', 'role', 'status', 'profilePicture',
  'isEmailVerified', 'isPhoneVerified', 'countryCode', 'driverVerificationStatus', 'driverVerifiedAt',
  'rating', 'totalRides', 'passengerRating', 'lastLoginAt', 'deactivatedAt', 'deactivationReason',
  'createdAt', 'updatedAt',
] as const;

const SORTABLE = ['createdAt', 'updatedAt', 'lastLoginAt', 'firstName', 'lastName', 'email', 'rating'] as const;

export class AdminUserController {
  /**
   * Get all users with filtering and pagination for admin panel
   */
  static async getAllUsers(req: AdminAuthenticatedRequest, res: Response): Promise<void> {
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

      // Filter by account status. This filtered on an is_active column that
      // does not exist, so choosing a status failed the whole list.
      if (status === 'active') {
        whereClause.status = UserStatus.ACTIVE;
      } else if (status === 'blocked') {
        whereClause.status = UserStatus.SUSPENDED;
      } else if (status === 'inactive') {
        whereClause.status = { [Op.in]: [UserStatus.DEACTIVATED, UserStatus.PENDING_VERIFICATION] };
      } else if (status === 'unverified') {
        whereClause.isEmailVerified = false;
      }

      // Filter by role
      if (role && role !== 'all') {
        whereClause.role = role;
      }

      // Filter by email verification (stored in is_verified)
      if (verified === 'true') {
        whereClause.isEmailVerified = true;
      } else if (verified === 'false') {
        whereClause.isEmailVerified = false;
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

      const order = (SORTABLE as readonly string[]).includes(String(sortBy)) ? String(sortBy) : 'createdAt';
      const direction = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const { rows: users, count: total } = await User.findAndCountAll({
        where: whereClause,
        attributes: [...ADMIN_USER_FIELDS],
        order: [[order, direction]],
        limit: Number(limit),
        offset,
      });

      const userIds = users.map(u => u.id);

      // Batch-load stats for all returned users in parallel
      const [rideCounts, bookingCounts, vehicleCounts] = await Promise.all([
        Ride.findAll({
          where: { driverId: { [Op.in]: userIds } },
          attributes: ['driverId', 'status', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']],
          group: ['driverId', 'status'],
          raw: true,
        }) as unknown as Array<{ driverId: string; status: string; cnt: string }>,
        Booking.findAll({
          where: { passengerId: { [Op.in]: userIds } },
          attributes: ['passengerId', 'status', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']],
          group: ['passengerId', 'status'],
          raw: true,
        }) as unknown as Array<{ passengerId: string; status: string; cnt: string }>,
        Vehicle.findAll({
          where: { driverId: { [Op.in]: userIds } },
          attributes: ['driverId', [sequelize.fn('COUNT', sequelize.col('id')), 'cnt']],
          group: ['driverId'],
          raw: true,
        }) as unknown as Array<{ userId: string; cnt: string }>,
      ]);

      // Index stats by userId
      const ridesByUser: Record<string, Record<string, number>> = {};
      for (const r of rideCounts) {
        if (!ridesByUser[r.driverId]) ridesByUser[r.driverId] = {};
        ridesByUser[r.driverId][r.status] = parseInt(r.cnt, 10);
      }
      const bookingsByUser: Record<string, Record<string, number>> = {};
      for (const b of bookingCounts) {
        if (!bookingsByUser[b.passengerId]) bookingsByUser[b.passengerId] = {};
        bookingsByUser[b.passengerId][b.status] = parseInt(b.cnt, 10);
      }
      const vehiclesByUser: Record<string, number> = {};
      for (const v of vehicleCounts) {
        vehiclesByUser[(v as any).driverId] = parseInt(v.cnt, 10);
      }

      const usersWithStats = users.map(user => {
        const rides = ridesByUser[user.id] ?? {};
        const bookings = bookingsByUser[user.id] ?? {};
        return {
          ...user.toJSON(),
          stats: {
            rides: {
              total: Object.values(rides).reduce((s, n) => s + n, 0),
              completed: rides[RideStatus.COMPLETED] ?? 0,
              cancelled: rides[RideStatus.CANCELLED] ?? 0,
              pending: rides[RideStatus.PENDING] ?? 0,
            },
            bookings: {
              total: Object.values(bookings).reduce((s, n) => s + n, 0),
              completed: bookings[BookingStatus.COMPLETED] ?? 0,
              cancelled: bookings[BookingStatus.CANCELLED] ?? 0,
              pending: bookings[BookingStatus.PENDING] ?? 0,
            },
            vehicles: vehiclesByUser[user.id] ?? 0,
          },
        };
      });

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
  static async getUserById(req: AdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id, {
        attributes: [...ADMIN_USER_FIELDS],
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

      const [rides, bookings, vehicles] = await Promise.all([
        Ride.findAll({
          where: { driverId: id },
          order: [['createdAt', 'DESC']],
          limit: 10,
          attributes: ['id', 'originAddress', 'destinationAddress', 'status', 'pricePerSeat', 'availableSeats', 'departureTime', 'createdAt'],
        }),
        Booking.findAll({
          where: { passengerId: id },
          order: [['createdAt', 'DESC']],
          limit: 10,
          attributes: ['id', 'rideId', 'status', 'seatsBooked', 'totalAmount', 'createdAt'],
        }),
        Vehicle.findAll({
          where: { driverId: id },
          // Asked for vehicleType and isActive, which Vehicle does not have, so
          // every user's page failed with a 500.
          attributes: ['id', 'make', 'model', 'year', 'color', 'licensePlate', 'type', 'capacity', 'status', 'isVerified'],
        }),
      ]);

      const totalRides = await Ride.count({ where: { driverId: id } });
      const completedRides = await Ride.count({ where: { driverId: id, status: RideStatus.COMPLETED } });
      const totalBookings = await Booking.count({ where: { passengerId: id } });
      const completedBookings = await Booking.count({ where: { passengerId: id, status: BookingStatus.COMPLETED } });

      const stats = {
        totalRides,
        completedRides,
        rideCompletionRate: totalRides > 0 ? Math.round((completedRides / totalRides) * 1000) / 10 : 0,
        totalBookings,
        completedBookings,
        bookingCompletionRate: totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 1000) / 10 : 0,
        totalVehicles: vehicles.length,
        accountAge: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      };

      res.status(200).json({
        success: true,
        data: {
          user: user.toJSON(),
          rides: rides.map(r => r.toJSON()),
          bookings: bookings.map(b => b.toJSON()),
          vehicles: vehicles.map(v => v.toJSON()),
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
  static async updateUser(req: AdminAuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const adminUser = req.user;
      const body = req.body ?? {};
      const fail = async (status: number, error: string, code: string) => {
        await transaction.rollback();
        res.status(status).json({ success: false, error, code, timestamp: new Date().toISOString() });
      };

      // Blocking and unblocking need a reason and their own side effects
      // (cancelling the driver's rides), so status is not editable here; it
      // used to be, which let an edit block or unblock without a reason.
      if (body.status !== undefined) {
        return fail(400, 'Use Block or Unblock to change an account\'s status, so the reason is recorded', 'STATUS_NOT_EDITABLE');
      }

      const user = await User.findByPk(id, { transaction });
      if (!user) return fail(404, 'User not found', 'USER_NOT_FOUND');

      const updateData: Record<string, unknown> = {};

      for (const field of ['firstName', 'lastName'] as const) {
        if (body[field] === undefined) continue;
        if (typeof body[field] !== 'string' || body[field].trim().length < 1 || body[field].trim().length > 50) {
          return fail(400, `${field} must be 1 to 50 characters`, 'VALIDATION_ERROR');
        }
        updateData[field] = body[field].trim();
      }

      if (body.email !== undefined) {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
          return fail(400, 'That is not a valid email address', 'VALIDATION_ERROR');
        }
        const taken = await User.findOne({ where: { email, id: { [Op.ne]: user.id } }, transaction });
        if (taken) return fail(409, 'Another account already uses that email', 'EMAIL_TAKEN');
        updateData['email'] = email;
      }

      if (body.phone !== undefined) {
        if (body.phone === null || body.phone === '') {
          updateData['phone'] = null;
        } else {
          // Stored in E.164 everywhere else; SMS and sign-in by phone rely on it.
          const phone = typeof body.phone === 'string' ? toE164(body.phone, user.countryCode ?? undefined) : null;
          if (!phone) return fail(400, 'That is not a valid phone number', 'VALIDATION_ERROR');
          const taken = await User.findOne({ where: { phone, id: { [Op.ne]: user.id } }, transaction });
          if (taken) return fail(409, 'Another account already uses that phone number', 'PHONE_TAKEN');
          updateData['phone'] = phone;
        }
      }

      if (body.role !== undefined) {
        // Admin panel staff are admin_users accounts; a rider is never made one here.
        const allowed = [UserRole.PASSENGER, UserRole.DRIVER, UserRole.COURIER] as string[];
        if (!allowed.includes(body.role)) {
          return fail(400, `role must be one of ${allowed.join(', ')}`, 'INVALID_ROLE');
        }
        updateData['role'] = body.role;
      }

      for (const field of ['isEmailVerified', 'isPhoneVerified'] as const) {
        if (body[field] === undefined) continue;
        if (typeof body[field] !== 'boolean') return fail(400, `${field} must be true or false`, 'VALIDATION_ERROR');
        updateData[field] = body[field];
      }

      if (Object.keys(updateData).length === 0) {
        return fail(400, 'Nothing to change', 'VALIDATION_ERROR');
      }

      const oldData = { ...user.toJSON() };
      await user.update(updateData, { transaction });
      await transaction.commit();

      // Log admin action
      logInfo('Admin updated user', {
        adminId: adminUser?.id,
        adminEmail: adminUser?.email,
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
        // Only what an admin needs. This spread the whole row, password
        // removed but the stored refresh-token hash and other internals not.
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            status: user.status,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
            updatedAt: user.updatedAt,
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
  static async blockUser(req: AdminAuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      const adminUser = req.user;

      // The reason is what anyone looking at this account later will read, in
      // its moderation history; a single word does not explain a block.
      if (reason.length < 5 || reason.length > 500) {
        res.status(400).json({
          success: false,
          error: 'Give a reason of 5 to 500 characters for blocking this account',
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

      if (user.status === UserStatus.SUSPENDED) {
        res.status(400).json({
          success: false,
          error: 'User is already blocked',
          code: 'USER_ALREADY_BLOCKED',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      const oldStatus = user.status;
      await user.update({
        status: UserStatus.SUSPENDED,
      }, { transaction });

      // Cancel all active rides where user is the driver
      await Ride.update(
        { status: RideStatus.CANCELLED },
        {
          where: {
            driverId: id,
            status: { [Op.in]: [RideStatus.PENDING, RideStatus.CONFIRMED] },
          },
          transaction,
        },
      );

      // Cancel all pending/confirmed bookings by the user as passenger
      await Booking.update(
        { status: BookingStatus.CANCELLED, cancelReason: `Account blocked by admin: ${reason}` },
        {
          where: {
            passengerId: id,
            status: { [Op.in]: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          },
          transaction,
        },
      );

      await transaction.commit();

      // Log admin action
      logInfo('Admin blocked user', {
        adminId: adminUser?.id,
        adminEmail: adminUser?.email,
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
  static async unblockUser(req: AdminAuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      const adminUser = req.user;

      // Lifting a block is as much a decision as making one, and is read back
      // the same way, so it needs a reason too.
      if (reason.length < 5 || reason.length > 500) {
        res.status(400).json({
          success: false,
          error: 'Give a reason of 5 to 500 characters for unblocking this account',
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

      if (user.status !== UserStatus.SUSPENDED) {
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
        status: UserStatus.ACTIVE,
      }, { transaction });

      await transaction.commit();

      // Log admin action
      logInfo('Admin unblocked user', {
        adminId: adminUser?.id,
        adminEmail: adminUser?.email,
        userId: id,
        userEmail: user.email,
        reason,
      });

      res.status(200).json({
        success: true,
        message: 'User unblocked successfully',
        data: {
          userId: id,
          newStatus: 'active',
          reason,
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
   * Set whether a user's email and phone count as verified
   *
   * The panel sent { verified } and this read { verificationType }, so both
   * "Approve" and "Revoke verification" changed nothing while reporting
   * success. It now takes each flag explicitly, true or false, with a reason:
   * marking a contact verified without the user proving it is a trust
   * decision, kept in the moderation history.
   */
  static async verifyUser(req: AdminAuthenticatedRequest, res: Response): Promise<void> {
    const fail = (status: number, code: string, error: string) => {
      res.status(status).json({ success: false, error, code, timestamp: new Date().toISOString() });
    };

    try {
      const { email, phone, reason } = req.body ?? {};
      if (email === undefined && phone === undefined) {
        return fail(400, 'NOTHING_TO_CHANGE', 'Set email, phone, or both, to true or false');
      }
      if ((email !== undefined && typeof email !== 'boolean') || (phone !== undefined && typeof phone !== 'boolean')) {
        return fail(400, 'VALIDATION_ERROR', 'email and phone must be true or false');
      }
      const trimmed = typeof reason === 'string' ? reason.trim() : '';
      if (trimmed.length < 5 || trimmed.length > 500) {
        return fail(400, 'REASON_REQUIRED', 'Give a reason of 5 to 500 characters');
      }

      const user = await User.findByPk(req.params['id']);
      if (!user) {
        return fail(404, 'USER_NOT_FOUND', 'User not found');
      }
      if (phone === true && !user.phone) {
        return fail(400, 'NO_PHONE', 'This user has no phone number to verify');
      }

      await user.update({
        ...(email !== undefined && { isEmailVerified: email }),
        ...(phone !== undefined && { isPhoneVerified: phone }),
      });

      logInfo('Admin changed user verification', {
        adminId: req.user?.id,
        userId: user.id,
        email,
        phone,
      });

      res.status(200).json({
        success: true,
        data: { userId: user.id, isEmailVerified: user.isEmailVerified, isPhoneVerified: user.isPhoneVerified },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logError('Admin verifyUser error', error as Error);
      fail(500, 'VERIFY_USER_FAILED', 'Failed to update verification');
    }
  }

  /**
   * Get user analytics and statistics
   */
  static async getUserAnalytics(req: AdminAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        groupBy = 'day',
      } = req.query;

      const ALLOWED_GROUP_BY = ['day', 'week', 'month'] as const;
      const safeGroupBy = ALLOWED_GROUP_BY.includes(groupBy as any) ? groupBy as string : 'day';

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
        type: QueryTypes.SELECT,
      });

      // Growth trend data
      const trendData = await sequelize.query(`
        SELECT 
          DATE_TRUNC('${safeGroupBy}', created_at) as period,
          COUNT(*) as new_users,
          COUNT(CASE WHEN role = 'driver' THEN 1 END) as new_drivers,
          COUNT(CASE WHEN role = 'passenger' THEN 1 END) as new_passengers
        FROM users
        WHERE created_at BETWEEN :start AND :end
        GROUP BY DATE_TRUNC('${safeGroupBy}', created_at)
        ORDER BY period
      `, {
        replacements: { start, end },
        type: QueryTypes.SELECT,
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
        type: QueryTypes.SELECT,
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
