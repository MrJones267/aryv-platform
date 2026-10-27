/**
 * @fileoverview Admin panel API routes
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Router } from 'express';
import { Op } from 'sequelize';
import { sequelize, QueryTypes } from '../config/database';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { rateLimitKey } from '../config/rateLimitKey';
import { AdminController } from '../controllers/AdminController';
import AdminRideController from '../controllers/AdminRideController';
import AdminUserController from '../controllers/AdminUserController';
import { authenticateAdminToken, authorizeAdminRoles } from '../middleware/auth';
import Booking from '../models/Booking';
import Ride from '../models/Ride';
import User from '../models/User';
import { DeliveryDispute } from '../models/DeliveryDispute';
import { DeliveryAgreement, DeliveryStatus } from '../models/DeliveryAgreement';
import { Currency } from '../models/Currency';
import { BookingStatus, RideStatus } from '../types';
import { redisClient } from '../config/redis';
import { PLATFORM_DEFAULT_CURRENCY } from '../services/CurrencyService';
import { getMonthlyRevenue, getRevenueByCurrency } from '../services/RevenueReportService';
import { DeliveryTier } from '../models/DeliveryTier';
import { ADMIN_TOKEN_TTL_SECONDS } from '../controllers/AdminController';
import { BOOKING_PLATFORM_FEE_RATE, CASH_COMMISSION_RATE, DEFAULT_COURIER_FEE_RATE } from '../utils/fees';
import { MIN_LENGTH as PASSWORD_MIN_LENGTH } from '../utils/password';
import logger from '../utils/logger';

const SETTINGS_KEY = 'platform:settings';
const COMMISSION_KEY = 'platform:commission';

// Hierarchical: super_admin implies admin implies moderator. The local
// equality check this replaced could only express "super_admin or nothing",
// which is why the middle ground — operations a full admin should do but a
// moderator should not — ended up with no role check at all.
const requireSuperAdmin = authorizeAdminRoles('super_admin');
const requireAdmin = authorizeAdminRoles('admin');

const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  registrationOpen: true,
  driverApplicationsOpen: true,
  maxRideRadius: 100,
  defaultCurrency: PLATFORM_DEFAULT_CURRENCY,
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

// Rate limiting for admin authentication endpoints. Named so the settings
// page can report the limit actually in force.
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;

const adminAuthLimiter = rateLimit({
  windowMs: ADMIN_LOGIN_WINDOW_MS,
  max: ADMIN_LOGIN_MAX_ATTEMPTS, // per IP per window
  message: {
    success: false,
    error: 'Too many admin authentication attempts, please try again later',
    code: 'ADMIN_AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('admin-auth'),
  keyGenerator: rateLimitKey,
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
  keyGenerator: rateLimitKey,
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
router.put('/users/:id', authenticateAdminToken, requireAdmin, AdminUserController.updateUser);

/**
 * @route   POST /api/admin/users/:id/block
 * @desc    Block user account
 * @access  Private (Admin)
 */
router.post('/users/:id/block', authenticateAdminToken, requireAdmin, AdminUserController.blockUser);

/**
 * @route   POST /api/admin/users/:id/unblock
 * @desc    Unblock user account
 * @access  Private (Admin)
 */
router.post('/users/:id/unblock', authenticateAdminToken, requireAdmin, AdminUserController.unblockUser);

/**
 * @route   PUT /api/admin/users/:id/verify
 * @desc    Verify user identity (email/phone/documents)
 * @access  Private (Admin)
 */
router.put('/users/:id/verify', authenticateAdminToken, requireAdmin, AdminUserController.verifyUser);

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
router.post('/courier/disputes/:id/resolve', authenticateAdminToken, requireAdmin, async (req: any, res) => {
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
// A package has no status of its own. Its state is its latest delivery
// agreement's status, or, before any courier has accepted it, whether it is
// still listed. This filtered Package on a `status` attribute it does not
// have, and the admin panel's Courier page showed invented packages instead.
const PACKAGE_STATE_SQL = `
  CASE
    WHEN a.status IS NOT NULL THEN a.status
    WHEN p.is_active AND (p.expires_at IS NULL OR p.expires_at > NOW()) THEN 'open'
    ELSE 'expired'
  END`;
const PACKAGE_STATES = ['open', 'expired', 'pending_pickup', 'in_transit', 'completed', 'disputed', 'cancelled'] as const;
const PACKAGES_FROM_SQL = `
  FROM packages p
  LEFT JOIN users s ON s.id = p.sender_id
  LEFT JOIN LATERAL (
    SELECT da.* FROM delivery_agreements da
     WHERE da.package_id = p.id
     ORDER BY da.created_at DESC
     LIMIT 1
  ) a ON true
  LEFT JOIN users c ON c.id = a.courier_id`;

/**
 * @route   GET /api/admin/courier/packages
 * @desc    Packages with their current state and courier, newest first
 * @access  Private (Admin)
 */
router.get('/courier/packages', authenticateAdminToken, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query['page'] || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query['limit'] || 20)));
    const state = req.query['status'] ? String(req.query['status']) : null;
    if (state && !(PACKAGE_STATES as readonly string[]).includes(state)) {
      return res.status(400).json({ success: false, error: `status must be one of ${PACKAGE_STATES.join(', ')}`, code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
    }
    const filter = state ? `WHERE ${PACKAGE_STATE_SQL} = :state` : '';
    const replacements = { state, limit, offset: (page - 1) * limit };

    const [packages, [{ total }]] = await Promise.all([
      sequelize.query(
        `SELECT p.id, p.title, p.pickup_address AS "pickupAddress", p.dropoff_address AS "dropoffAddress",
                p.package_size AS "packageSize", p.fragile, p.valuable, p.urgency_level AS "urgencyLevel",
                p.sender_price_offer AS "senderPriceOffer", p.currency, p.payment_method AS "paymentMethod",
                p.requested_delivery_time AS "requestedDeliveryTime", p.created_at AS "createdAt",
                ${PACKAGE_STATE_SQL} AS status,
                TRIM(CONCAT(s.first_name, ' ', s.last_name)) AS "senderName",
                NULLIF(TRIM(CONCAT(c.first_name, ' ', c.last_name)), '') AS "courierName",
                a.id AS "agreementId", a.agreed_price AS "agreedPrice", a.platform_fee AS "platformFee",
                a.currency AS "agreementCurrency"
           ${PACKAGES_FROM_SQL}
           ${filter}
          ORDER BY p.created_at DESC
          LIMIT :limit OFFSET :offset`,
        { type: QueryTypes.SELECT, replacements },
      ),
      sequelize.query(
        `SELECT COUNT(*)::int AS total ${PACKAGES_FROM_SQL} ${filter}`,
        { type: QueryTypes.SELECT, replacements },
      ) as Promise<Array<{ total: number }>>,
    ]);

    return res.json({
      success: true,
      data: { packages, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Admin courier packages failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to fetch packages', code: 'FETCH_PACKAGES_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   GET /api/admin/courier/stats
 * @desc    Package counts by state, and courier money per currency
 * @access  Private (Admin)
 *
 * Money is the agreed price and platform fee of completed deliveries, kept
 * per currency and never added across them.
 */
router.get('/courier/stats', authenticateAdminToken, async (_req, res) => {
  try {
    const [counts, money] = await Promise.all([
      sequelize.query<{ status: string; count: number }>(
        `SELECT ${PACKAGE_STATE_SQL} AS status, COUNT(*)::int AS count ${PACKAGES_FROM_SQL} GROUP BY 1`,
        { type: QueryTypes.SELECT },
      ),
      sequelize.query<{ currency: string; deliveries: number; value: string; platformFees: string }>(
        `SELECT currency, COUNT(*)::int AS deliveries,
                SUM(agreed_price) AS value, SUM(platform_fee) AS "platformFees"
           FROM delivery_agreements
          WHERE status = 'completed'
          GROUP BY currency
          ORDER BY SUM(agreed_price) DESC`,
        { type: QueryTypes.SELECT },
      ),
    ]);

    const byState = Object.fromEntries(PACKAGE_STATES.map((st) => [st, 0])) as Record<string, number>;
    for (const row of counts) byState[row.status] = row.count;

    return res.json({
      success: true,
      data: {
        total: counts.reduce((sum, row) => sum + row.count, 0),
        byState,
        completedByCurrency: money.map((m) => ({
          currency: m.currency,
          deliveries: m.deliveries,
          value: Number(m.value) || 0,
          platformFees: Number(m.platformFees) || 0,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Admin courier stats failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to fetch courier stats', code: 'COURIER_STATS_FAILED', timestamp: new Date().toISOString() });
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
router.get('/analytics/revenue', authenticateAdminToken, async (req, res) => {
  try {
    // The dashboard chart asks for six months; allow up to two years.
    const requested = parseInt(String(req.query['months'] ?? '6'), 10);
    const months = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 24) : 6;

    const [byCurrency, monthly] = await Promise.all([
      getRevenueByCurrency(),
      getMonthlyRevenue(months),
    ]);

    // Each figure stays in the currency it was charged in. This used to sum
    // completed bookings across every currency and label the result 'BWP'.
    res.json({
      success: true,
      data: {
        platformCurrency: PLATFORM_DEFAULT_CURRENCY,
        months,
        byCurrency,
        monthly,
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
router.get('/analytics/top-routes', authenticateAdminToken, async (req, res) => {
  try {
    // This used Ride.findAll with group: ['originAddress', ...] and ORDER BY
    // an unquoted tripCount. Both reach Postgres as identifiers that do not
    // exist (the columns are origin_address and destination_address, and an
    // unquoted alias is folded to lower case), so the query failed. It also
    // averaged seat prices across currencies. Routes are now grouped per
    // currency, with the price in the currency it was charged in.
    const requested = parseInt(String(req.query['limit'] ?? '10'), 10);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 50) : 10;

    const routes = await sequelize.query<{
      origin: string;
      destination: string;
      currency: string;
      tripCount: number;
      avgPricePerSeat: string;
    }>(
      `SELECT origin_address AS origin,
              destination_address AS destination,
              currency,
              COUNT(*)::int AS "tripCount",
              ROUND(AVG(price_per_seat)::numeric, 2) AS "avgPricePerSeat"
         FROM rides
        WHERE status = :completed
        GROUP BY origin_address, destination_address, currency
        ORDER BY "tripCount" DESC, origin_address
        LIMIT :limit`,
      { type: QueryTypes.SELECT, replacements: { completed: RideStatus.COMPLETED, limit } },
    );

    res.json({
      success: true,
      data: routes.map((r) => ({ ...r, avgPricePerSeat: Number(r.avgPricePerSeat) })),
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
    // The admin panel's currency picker is filled from the currencies table,
    // so anything else did not come from it.
    if (req.body?.defaultCurrency !== undefined) {
      const code = String(req.body.defaultCurrency).toUpperCase();
      const known = /^[A-Z]{3}$/.test(code) && await Currency.findOne({ where: { code, isActive: true } });
      if (!known) {
        return res.status(400).json({ success: false, error: `Unknown or inactive currency: ${req.body.defaultCurrency}`, code: 'INVALID_CURRENCY', timestamp: new Date().toISOString() });
      }
      req.body.defaultCurrency = code;
    }

    const raw = await redisClient.get(SETTINGS_KEY);
    const current = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    const updated = { ...current, ...req.body };
    await redisClient.set(SETTINGS_KEY, JSON.stringify(updated));
    return res.json({ success: true, message: 'Settings updated', data: updated, timestamp: new Date().toISOString() });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to update settings', code: 'UPDATE_SETTINGS_FAILED', timestamp: new Date().toISOString() });
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

/**
 * @route   GET /api/admin/settings/platform
 * @desc    The fee, session and sign-in values the platform actually runs on
 * @access  Private (Admin)
 *
 * Read-only, and read from the constants the code itself uses, so the admin
 * panel can show them without being able to drift from them. The settings
 * page used to show invented rates (rides 15%, courier 20%) and security
 * options the backend does not have.
 */
router.get('/settings/platform', authenticateAdminToken, (_req, res) => {
  res.json({
    success: true,
    data: {
      platformCurrency: PLATFORM_DEFAULT_CURRENCY,
      fees: {
        bookingPlatformFeePercent: BOOKING_PLATFORM_FEE_RATE * 100,
        cashCommissionPercent: CASH_COMMISSION_RATE * 100,
        defaultCourierFeePercent: DEFAULT_COURIER_FEE_RATE * 100,
      },
      adminSecurity: {
        sessionHours: ADMIN_TOKEN_TTL_SECONDS / 3600,
        loginAttemptsPerWindow: ADMIN_LOGIN_MAX_ATTEMPTS,
        loginWindowMinutes: ADMIN_LOGIN_WINDOW_MS / 60000,
        passwordMinLength: PASSWORD_MIN_LENGTH,
        twoFactorAvailable: false,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route   GET /api/admin/delivery-tiers
 * @desc    Every courier delivery tier, active or not
 * @access  Private (Admin)
 */
router.get('/delivery-tiers', authenticateAdminToken, async (_req, res) => {
  try {
    const tiers = await DeliveryTier.findAll({ order: [['minDeliveryHours', 'ASC']] });
    res.json({ success: true, data: tiers, timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load delivery tiers', code: 'DELIVERY_TIERS_ERROR', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   PUT /api/admin/delivery-tiers/:id
 * @desc    Change a tier's platform fee, delivery window or availability
 * @access  Private (Super admin)
 *
 * These are real controls: courier pricing reads the tiers from the
 * database on every quote and package. Only these four fields can change;
 * the model's validators bound each one and keep the window ordered.
 */
router.put('/delivery-tiers/:id', authenticateAdminToken, requireSuperAdmin, async (req, res) => {
  const EDITABLE = ['platformFeePercentage', 'minDeliveryHours', 'maxDeliveryHours', 'isActive'] as const;
  try {
    const tier = await DeliveryTier.findByPk(req.params['id']);
    if (!tier) {
      return res.status(404).json({ success: false, error: 'Delivery tier not found', code: 'NOT_FOUND', timestamp: new Date().toISOString() });
    }

    const changes: Record<string, unknown> = {};
    for (const field of EDITABLE) {
      if (req.body?.[field] === undefined) continue;
      const value = req.body[field];
      if (field === 'isActive' ? typeof value !== 'boolean' : typeof value !== 'number' || !Number.isFinite(value)) {
        return res.status(400).json({ success: false, error: `${field} has the wrong type`, code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
      }
      changes[field] = value;
    }
    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ success: false, error: `Nothing to change. Editable fields: ${EDITABLE.join(', ')}`, code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
    }

    const before = {
      platformFeePercentage: Number(tier.platformFeePercentage),
      minDeliveryHours: tier.minDeliveryHours,
      maxDeliveryHours: tier.maxDeliveryHours,
      isActive: tier.isActive,
    };
    await tier.update(changes);
    logger.info('Delivery tier changed', { tierType: tier.tierType, adminId: (req as any).user?.id, before, after: changes });

    return res.json({ success: true, data: tier, timestamp: new Date().toISOString() });
  } catch (error) {
    if ((error as Error).name === 'SequelizeValidationError') {
      const details = ((error as any).errors ?? []).map((e: { message: string }) => e.message);
      return res.status(400).json({ success: false, error: details.join('; ') || 'Invalid value', code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
    }
    return res.status(500).json({ success: false, error: 'Failed to update delivery tier', code: 'DELIVERY_TIERS_ERROR', timestamp: new Date().toISOString() });
  }
});

export default router;
