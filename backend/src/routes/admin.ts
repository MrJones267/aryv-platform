/**
 * @fileoverview Admin panel API routes
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { AdminController } from '../controllers/AdminController';
import AdminRideController from '../controllers/AdminRideController';
import AdminUserController from '../controllers/AdminUserController';
import { authenticateAdminToken } from '../middleware/auth';
import Booking from '../models/Booking';
import Ride from '../models/Ride';
import User from '../models/User';
import { DeliveryDispute } from '../models/DeliveryDispute';
import { DeliveryAgreement, DeliveryStatus } from '../models/DeliveryAgreement';
import Package from '../models/Package';
import { BookingStatus, RideStatus } from '../types';
import { redisClient } from '../config/redis';

const SETTINGS_KEY = 'platform:settings';
const COMMISSION_KEY = 'platform:commission';

const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const admin = (req as any).user;
  if (!admin || admin.role !== 'super_admin') {
    res.status(403).json({
      success: false,
      error: 'Super admin access required',
      code: 'SUPER_ADMIN_REQUIRED',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  next();
};

const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  registrationOpen: true,
  driverApplicationsOpen: true,
  maxRideRadius: 100,
  defaultCurrency: 'BWP',
  supportedCountries: ['BW', 'ZA', 'ZW', 'ZM', 'NA'],
  minRidePrice: 5,
  maxRidePrice: 5000,
  maxPassengersPerRide: 8,
};

const DEFAULT_COMMISSION = {
  platformFeePercent: 5,
  minimumFee: 1,
  driverSharePercent: 95,
  courierFeePercent: 10,
};

const router = Router();

// Rate limiting for admin authentication endpoints
const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: 'Too many admin authentication attempts, please try again later',
    code: 'ADMIN_AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('admin-auth'),
});

// General admin API rate limiting
const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 _requests per windowMs for admin APIs
  message: {
    success: false,
    error: 'Too many admin API _requests, please try again later',
    code: 'ADMIN_API_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('admin-api'),
});

// Apply general rate limiting to all admin routes
router.use(adminApiLimiter);

/**
 * Authentication Routes
 */

/**
 * @route   POST /api/admin/auth/login
 * @desc    Admin login
 * @access  Public
 */
router.post(
  '/auth/login',
  adminAuthLimiter,
  AdminController.login,
);

/**
 * @route   GET /api/admin/auth/verify
 * @desc    Verify admin token
 * @access  Private (Admin)
 */
router.get(
  '/auth/verify',
  authenticateAdminToken,
  AdminController.verify,
);

/**
 * @route   POST /api/admin/auth/logout
 * @desc    Admin logout
 * @access  Private (Admin)
 */
router.post(
  '/auth/logout',
  authenticateAdminToken,
  AdminController.logout,
);

/**
 * @route   PUT /api/admin/auth/profile
 * @desc    Update admin profile
 * @access  Private (Admin)
 */
router.put(
  '/auth/profile',
  authenticateAdminToken,
  AdminController.updateProfile,
);

/**
 * Dashboard Routes
 */

/**
 * @route   GET /api/admin/analytics/dashboard
 * @desc    Get dashboard statistics
 * @access  Private (Admin)
 */
router.get(
  '/analytics/dashboard',
  authenticateAdminToken,
  AdminController.getDashboardStats,
);

/**
 * User Management Routes
 */

/**
 * @route   GET /api/admin/users
 * @desc    Get users with pagination and filtering
 * @access  Private (Admin)
 */
router.get('/users', authenticateAdminToken, AdminUserController.getAllUsers);

/**
 * @route   GET /api/admin/users/analytics
 * @desc    Get user analytics and statistics
 * @access  Private (Admin)
 */
router.get('/users/analytics', authenticateAdminToken, AdminUserController.getUserAnalytics);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get user details by ID
 * @access  Private (Admin)
 */
router.get('/users/:id', authenticateAdminToken, AdminUserController.getUserById);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user information
 * @access  Private (Admin)
 */
router.put('/users/:id', authenticateAdminToken, AdminUserController.updateUser);

/**
 * @route   POST /api/admin/users/:id/block
 * @desc    Block user account
 * @access  Private (Admin)
 */
router.post('/users/:id/block', authenticateAdminToken, AdminUserController.blockUser);

/**
 * @route   POST /api/admin/users/:id/unblock
 * @desc    Unblock user account
 * @access  Private (Admin)
 */
router.post('/users/:id/unblock', authenticateAdminToken, AdminUserController.unblockUser);

/**
 * @route   PUT /api/admin/users/:id/verify
 * @desc    Verify user identity (email/phone/documents)
 * @access  Private (Admin)
 */
router.put('/users/:id/verify', authenticateAdminToken, AdminUserController.verifyUser);

/**
 * Rides Management Routes (to be implemented)
 */

/**
 * @route   GET /api/admin/rides
 * @desc    Get rides with pagination and filtering
 * @access  Private (Admin)
 */
router.get('/rides', authenticateAdminToken, AdminRideController.getAllRides);

/**
 * @route   GET /api/admin/rides/analytics
 * @desc    Get ride analytics and statistics
 * @access  Private (Admin)
 */
router.get('/rides/analytics', authenticateAdminToken, AdminRideController.getRideAnalytics);

/**
 * @route   GET /api/admin/rides/:id
 * @desc    Get ride details by ID
 * @access  Private (Admin)
 */
router.get('/rides/:id', authenticateAdminToken, AdminRideController.getRideById);

/**
 * @route   POST /api/admin/rides/:id/cancel
 * @desc    Cancel ride with reason
 * @access  Private (Admin)
 */
router.post('/rides/:id/cancel', authenticateAdminToken, AdminRideController.cancelRide);

/**
 * @route   PUT /api/admin/rides/:id/status
 * @desc    Update ride status (admin override)
 * @access  Private (Admin)
 */
router.put('/rides/:id/status', authenticateAdminToken, AdminRideController.updateRideStatus);

/**
 * @route   GET /api/admin/rides/:id/bookings
 * @desc    Get bookings for a specific ride
 * @access  Private (Admin)
 */
router.get('/rides/:id/bookings', authenticateAdminToken, AdminRideController.getRideBookings);

/**
 * @route   GET /api/admin/bookings
 * @desc    Get all bookings with pagination and filtering
 * @access  Private (Admin)
 */
router.get('/bookings', authenticateAdminToken, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query['page'] || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query['limit'] || 20)));
    const offset = (page - 1) * limit;
    const { status, rideId, passengerId } = req.query;

    const where: Record<string, any> = {};
    if (status) where['status'] = status;
    if (rideId) where['rideId'] = rideId;
    if (passengerId) where['passengerId'] = passengerId;

    const result = await Booking.findAndCountAll({
      where,
      include: [
        {
          model: Ride,
          as: 'ride',
          attributes: ['id', 'originAddress', 'destinationAddress', 'departureTime', 'status'],
          include: [{ model: User, as: 'driver', attributes: ['id', 'firstName', 'lastName', 'email'] }],
        },
        { model: User, as: 'passenger', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        bookings: result.rows,
        pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit) },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch bookings', code: 'FETCH_BOOKINGS_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * Courier & Disputes Routes (to be implemented)
 */

/**
 * @route   GET /api/admin/courier/disputes
 * @desc    Get courier disputes
 * @access  Private (Admin)
 */
router.get('/courier/disputes', authenticateAdminToken, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query['page'] || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query['limit'] || 20)));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    const where: Record<string, any> = {};
    if (status) where['status'] = status;

    const result = await DeliveryDispute.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: { disputes: result.rows, pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit) } },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch disputes', code: 'FETCH_DISPUTES_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   POST /api/admin/courier/disputes/:id/resolve
 * @desc    Resolve courier dispute
 * @access  Private (Admin)
 */
router.post('/courier/disputes/:id/resolve', authenticateAdminToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { resolutionAmount, notes } = req.body;
    const adminId = req.user?.id || 'admin';

    const dispute = await DeliveryDispute.findByPk(id);
    if (!dispute) {
      return res.status(404).json({ success: false, error: 'Dispute not found', code: 'NOT_FOUND', timestamp: new Date().toISOString() });
    }

    if (!dispute.canBeResolved()) {
      return res.status(400).json({ success: false, error: 'Dispute cannot be resolved in its current status', code: 'INVALID_STATUS', timestamp: new Date().toISOString() });
    }

    // resolve() calls save() internally
    await dispute.resolve(adminId, resolutionAmount !== undefined ? Number(resolutionAmount) : undefined, notes);

    return res.json({ success: true, message: 'Dispute resolved', data: dispute, timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to resolve dispute', code: 'RESOLVE_DISPUTE_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   GET /api/admin/courier/packages
 * @desc    Get courier packages
 * @access  Private (Admin)
 */
router.get('/courier/packages', authenticateAdminToken, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query['page'] || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query['limit'] || 20)));
    const offset = (page - 1) * limit;
    const { status, senderId } = req.query;

    const where: Record<string, any> = {};
    if (status) where['status'] = status;
    if (senderId) where['senderId'] = senderId;

    const result = await Package.findAndCountAll({
      where,
      include: [
        { model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: { packages: result.rows, pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit) } },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch packages', code: 'FETCH_PACKAGES_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   POST /api/admin/courier/agreements/:id/release-payment
 * @desc    Release payment for delivery agreement
 * @access  Private (Admin)
 */
router.post('/courier/agreements/:id/release-payment', authenticateAdminToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const agreement = await DeliveryAgreement.findByPk(id);
    if (!agreement) {
      return res.status(404).json({ success: false, error: 'Agreement not found', code: 'NOT_FOUND', timestamp: new Date().toISOString() });
    }

    await agreement.transitionTo(DeliveryStatus.COMPLETED);

    return res.json({ success: true, message: 'Payment released successfully', data: { agreementId: id, status: 'payment_released' }, timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to release payment', code: 'RELEASE_PAYMENT_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * Analytics Routes (to be implemented)
 */

/**
 * @route   GET /api/admin/analytics/revenue
 * @desc    Get revenue analytics
 * @access  Private (Admin)
 */
router.get('/analytics/revenue', authenticateAdminToken, async (_req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [thisMonthRevenue, lastMonthRevenue, totalRevenue, completedBookings] = await Promise.all([
      Booking.sum('totalAmount' as any, {
        where: { status: BookingStatus.COMPLETED, createdAt: { [Op.gte]: startOfMonth } },
      }),
      Booking.sum('totalAmount' as any, {
        where: { status: BookingStatus.COMPLETED, createdAt: { [Op.between]: [startOfLastMonth, endOfLastMonth] } },
      }),
      Booking.sum('totalAmount' as any, { where: { status: BookingStatus.COMPLETED } }),
      Booking.count({ where: { status: BookingStatus.COMPLETED } }),
    ]);

    const thisMonth = Number(thisMonthRevenue) || 0;
    const lastMonth = Number(lastMonthRevenue) || 0;
    const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
    const avgBookingValue = completedBookings > 0 ? (Number(totalRevenue) || 0) / completedBookings : 0;

    res.json({
      success: true,
      data: {
        totalRevenue: Number(totalRevenue) || 0,
        thisMonthRevenue: thisMonth,
        lastMonthRevenue: lastMonth,
        revenueGrowth: Math.round(growth * 10) / 10,
        totalCompletedBookings: completedBookings,
        averageBookingValue: Math.round(avgBookingValue * 100) / 100,
        currency: 'BWP',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get revenue analytics', code: 'ANALYTICS_ERROR', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   GET /api/admin/analytics/user-growth/:period
 * @desc    Get user growth analytics by period
 * @access  Private (Admin)
 */
router.get('/analytics/user-growth/:period', authenticateAdminToken, async (req, res) => {
  try {
    const { period } = req.params;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Build daily buckets using SQL DATE_TRUNC
    const rows = await User.findAll({
      where: { createdAt: { [Op.gte]: since } },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'newUsers'],
      ],
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
      raw: true,
    }) as unknown as Array<{ date: string; newUsers: string }>;

    // Calculate running total
    const totalBefore = await User.count({ where: { createdAt: { [Op.lt]: since } } });
    let running = totalBefore;
    const data = rows.map((r) => {
      running += parseInt(r.newUsers, 10);
      return { date: r.date, newUsers: parseInt(r.newUsers, 10), totalUsers: running };
    });

    res.json({ success: true, data, period, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch user growth analytics', code: 'ANALYTICS_ERROR', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   GET /api/admin/analytics/usage
 * @desc    Get platform usage statistics
 * @access  Private (Admin)
 */
router.get('/analytics/usage', authenticateAdminToken, async (_req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      todayRides,
      totalRides,
      completedRides,
      activeDeliveries,
      totalDeliveries,
      completedDeliveries,
    ] = await Promise.all([
      Ride.count({ where: { createdAt: { [Op.gte]: startOfToday } } }),
      Ride.count(),
      Ride.count({ where: { status: RideStatus.COMPLETED } }),
      Booking.count({ where: { status: BookingStatus.CONFIRMED } }),
      Booking.count(),
      Booking.count({ where: { status: BookingStatus.COMPLETED } }),
    ]);

    const avgRatingRow = await Booking.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('rating_given')), 'avg']],
      where: { ratingGiven: { [Op.not]: null } },
      raw: true,
    }) as unknown as { avg: string | null } | null;

    const rideCompletionRate = totalRides > 0 ? Math.round((completedRides / totalRides) * 1000) / 10 : 0;
    const courierSuccessRate = totalDeliveries > 0 ? Math.round((completedDeliveries / totalDeliveries) * 1000) / 10 : 0;
    const avgRating = avgRatingRow?.avg ? Math.round(parseFloat(avgRatingRow.avg) * 10) / 10 : null;

    res.json({
      success: true,
      data: {
        rides: {
          todayRides,
          total: totalRides,
          completed: completedRides,
          completionRate: rideCompletionRate,
          avgRating,
        },
        courier: {
          activeDeliveries,
          total: totalDeliveries,
          completed: completedDeliveries,
          successRate: courierSuccessRate,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch usage analytics', code: 'ANALYTICS_ERROR', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   GET /api/admin/analytics/top-routes
 * @desc    Get top routes analytics
 * @access  Private (Admin)
 */
router.get('/analytics/top-routes', authenticateAdminToken, async (_req, res) => {
  try {
    const routes = await Ride.findAll({
      where: { status: RideStatus.COMPLETED },
      attributes: [
        'originAddress',
        'destinationAddress',
        [sequelize.fn('COUNT', sequelize.col('Ride.id')), 'tripCount'],
        [sequelize.fn('AVG', sequelize.col('price_per_seat')), 'avgPrice'],
        [sequelize.fn('SUM', sequelize.col('available_seats')), 'totalSeats'],
      ],
      group: ['originAddress', 'destinationAddress'],
      order: [[sequelize.literal('tripCount'), 'DESC']],
      limit: 10,
    });

    res.json({
      success: true,
      data: routes.map((r: any) => ({
        origin: r.originAddress,
        destination: r.destinationAddress,
        tripCount: parseInt(r.getDataValue('tripCount'), 10),
        avgPrice: parseFloat(parseFloat(r.getDataValue('avgPrice') || '0').toFixed(2)),
        totalSeats: parseInt(r.getDataValue('totalSeats') || '0', 10),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get top routes', code: 'ANALYTICS_ERROR', timestamp: new Date().toISOString() });
  }
});

/**
 * Settings Routes (to be implemented)
 */

/**
 * @route   GET /api/admin/settings
 * @desc    Get platform settings
 * @access  Private (Admin)
 */
router.get('/settings', authenticateAdminToken, async (_req, res) => {
  try {
    const raw = await redisClient.get(SETTINGS_KEY);
    const settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    res.json({ success: true, data: settings, timestamp: new Date().toISOString() });
  } catch {
    res.json({ success: true, data: DEFAULT_SETTINGS, timestamp: new Date().toISOString() });
  }
});

/**
 * @route   PUT /api/admin/settings
 * @desc    Update platform settings
 * @access  Private (Admin)
 */
router.put('/settings', authenticateAdminToken, requireSuperAdmin, async (req, res) => {
  try {
    const raw = await redisClient.get(SETTINGS_KEY);
    const current = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    const updated = { ...current, ...req.body };
    await redisClient.set(SETTINGS_KEY, JSON.stringify(updated));
    res.json({ success: true, message: 'Settings updated', data: updated, timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update settings', code: 'UPDATE_SETTINGS_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   GET /api/admin/settings/commission
 * @desc    Get commission settings
 * @access  Private (Admin)
 */
router.get('/settings/commission', authenticateAdminToken, async (_req, res) => {
  try {
    const raw = await redisClient.get(COMMISSION_KEY);
    const commission = raw ? { ...DEFAULT_COMMISSION, ...JSON.parse(raw) } : DEFAULT_COMMISSION;
    res.json({ success: true, data: commission, timestamp: new Date().toISOString() });
  } catch {
    res.json({ success: true, data: DEFAULT_COMMISSION, timestamp: new Date().toISOString() });
  }
});

/**
 * @route   PUT /api/admin/settings/commission
 * @desc    Update commission settings
 * @access  Private (Admin)
 */
router.put('/settings/commission', authenticateAdminToken, requireSuperAdmin, async (req, res) => {
  try {
    const { platformFeePercent, minimumFee, driverSharePercent, courierFeePercent } = req.body;

    // Validate: driver + platform shares must add up to 100
    if (platformFeePercent !== undefined && driverSharePercent !== undefined) {
      if (platformFeePercent + driverSharePercent !== 100) {
        return res.status(400).json({ success: false, error: 'platformFeePercent + driverSharePercent must equal 100', code: 'INVALID_COMMISSION', timestamp: new Date().toISOString() });
      }
    }

    const raw = await redisClient.get(COMMISSION_KEY);
    const current = raw ? { ...DEFAULT_COMMISSION, ...JSON.parse(raw) } : { ...DEFAULT_COMMISSION };
    const updated = {
      ...current,
      ...(platformFeePercent !== undefined && { platformFeePercent }),
      ...(minimumFee !== undefined && { minimumFee }),
      ...(driverSharePercent !== undefined && { driverSharePercent }),
      ...(courierFeePercent !== undefined && { courierFeePercent }),
    };

    await redisClient.set(COMMISSION_KEY, JSON.stringify(updated));
    return res.json({ success: true, message: 'Commission settings updated', data: updated, timestamp: new Date().toISOString() });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to update commission settings', code: 'UPDATE_COMMISSION_FAILED', timestamp: new Date().toISOString() });
  }
});

export default router;
