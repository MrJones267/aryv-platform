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
import { AdminController, issueAdminAccessToken } from '../controllers/AdminController';
import AdminRideController from '../controllers/AdminRideController';
import AdminUserController from '../controllers/AdminUserController';
import { AdminUser } from '../models/AdminUser';
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
import { BOOKING_PLATFORM_FEE_RATE, CASH_COMMISSION_RATE, DEFAULT_COURIER_FEE_RATE } from '../utils/fees';
import { MIN_LENGTH as PASSWORD_MIN_LENGTH } from '../utils/password';
import logger from '../utils/logger';
import { recordAdminAction } from '../services/AuditService';
import { validatePasswordStrength } from '../utils/password';
import CommissionService from '../services/CommissionService';
import { SettlementMethod } from '../models/CommissionLedger';
import { adminTwoFactorService, isTwoFactorConfigured } from '../services/AdminTwoFactorService';
import path from 'path';
import DriverDocument from '../models/DriverDocument';
import { verificationService } from '../services/VerificationService';
import { UPLOADS_DIR } from '../middleware/upload';
import {
  ADMIN_SESSION_HOURS,
  MAX_ONCALL_PHONES,
  SETTINGS_KEY,
  getAdminSessionHours,
  getOnCallPhones,
  getServerOnCallPhones,
  getStoredOnCallPhones,
  isValidAdminSessionHours,
  normaliseOnCallPhones,
} from '../services/PlatformSettingsService';
import { smsService } from '../services/SMSService';
import { SOS_ESCALATION, reminderDueAfterMinutes } from '../services/EmergencyService';
import EmergencyAlert, { EmergencyAlertStatus } from '../models/EmergencyAlert';

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
  adminSessionHours: ADMIN_SESSION_HOURS.DEFAULT,
  onCallPhones: [] as string[],
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
 * The audit trail. Every admin request that changes something is recorded
 * once it has been answered: who, what, to which record, from where, the
 * request body with credentials removed, and whether it succeeded or was
 * refused. One hook rather than a call in each handler, so a route added
 * later cannot be left out. Sign-in is recorded by AdminController.login,
 * since there is no admin on the request until it succeeds.
 */
const AUDITED_ACTIONS: Record<string, { action: string; resourceType: string }> = {
  'POST /auth/logout': { action: 'admin.sign_out', resourceType: 'admin_user' },
  'PUT /auth/profile': { action: 'admin.profile_update', resourceType: 'admin_user' },
  'POST /auth/2fa/setup': { action: 'admin.two_factor_setup_started', resourceType: 'admin_user' },
  'POST /auth/2fa/confirm': { action: 'admin.two_factor_enabled', resourceType: 'admin_user' },
  'POST /auth/2fa/disable': { action: 'admin.two_factor_disabled', resourceType: 'admin_user' },
  'POST /auth/password': { action: 'admin.password_change', resourceType: 'admin_user' },
  'POST /auth/sessions/revoke-others': { action: 'admin.sessions_revoked', resourceType: 'admin_user' },
  'PUT /users/:id': { action: 'user.update', resourceType: 'user' },
  'POST /users/:id/block': { action: 'user.block', resourceType: 'user' },
  'POST /users/:id/unblock': { action: 'user.unblock', resourceType: 'user' },
  'PUT /users/:id/verify': { action: 'user.verify', resourceType: 'user' },
  'POST /rides/:id/cancel': { action: 'ride.cancel', resourceType: 'ride' },
  'PUT /rides/:id/status': { action: 'ride.status_change', resourceType: 'ride' },
  'POST /courier/disputes/:id/resolve': { action: 'dispute.resolve', resourceType: 'dispute' },
  'POST /courier/agreements/:id/release-payment': { action: 'delivery.release_payment', resourceType: 'delivery_agreement' },
  'PUT /settings': { action: 'settings.update', resourceType: 'settings' },
  'PUT /settings/commission': { action: 'settings.commission_update', resourceType: 'settings' },
  'PUT /delivery-tiers/:id': { action: 'tier.update', resourceType: 'delivery_tier' },
  'POST /emergency-alerts/:id/acknowledge': { action: 'sos.acknowledge', resourceType: 'emergency_alert' },
  'POST /emergency-alerts/:id/resolve': { action: 'sos.resolve', resourceType: 'emergency_alert' },
  'POST /settings/on-call/test': { action: 'settings.oncall_test', resourceType: 'settings' },
  'POST /verifications/documents/:id/review': { action: 'document.review', resourceType: 'driver_document' },
  'POST /commission/:id/settlements': { action: 'commission.payment_recorded', resourceType: 'driver' },
};

router.use((req: any, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  res.on('finish', () => {
    const adminId = req.user?.id;
    const routePath: string | undefined = req.route?.path;
    // No admin means the request never got past authentication: nothing was
    // done, and there is no one to attribute it to.
    if (!adminId || !routePath) return;
    const key = `${req.method} ${routePath}`;
    const known = AUDITED_ACTIONS[key];
    void recordAdminAction(req, {
      adminUserId: adminId,
      action: known?.action ?? key.toLowerCase(),
      resourceType: known?.resourceType ?? 'other',
      resourceId: req.params?.id ?? null,
      details: {
        outcome: res.statusCode < 400 ? 'succeeded' : res.statusCode === 401 || res.statusCode === 403 ? 'refused' : 'failed',
        statusCode: res.statusCode,
        request: req.body,
      },
    });
  });
  return next();
});

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
// a.status is cast to text: where it is a Postgres enum, the CASE would
// otherwise take the enum type and reject 'open' and 'expired'.
const PACKAGE_STATE_SQL = `
  CASE
    WHEN a.status IS NOT NULL THEN a.status::text
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

    if (req.body?.adminSessionHours !== undefined && !isValidAdminSessionHours(req.body.adminSessionHours)) {
      return res.status(400).json({
        success: false,
        error: `adminSessionHours must be a whole number of hours from ${ADMIN_SESSION_HOURS.MIN} to ${ADMIN_SESSION_HOURS.MAX}`,
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      });
    }

    if (req.body?.onCallPhones !== undefined) {
      const numbers = normaliseOnCallPhones(req.body.onCallPhones);
      if (!numbers) {
        return res.status(400).json({
          success: false,
          error: `onCallPhones must be a list of up to ${MAX_ONCALL_PHONES} valid phone numbers`,
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        });
      }
      req.body.onCallPhones = numbers;
    }

    const raw = await redisClient.get(SETTINGS_KEY);
    const current = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    const updated = { ...current, ...req.body };
    const serialised = JSON.stringify(updated);
    await redisClient.set(SETTINGS_KEY, serialised);

    // The Redis client drops writes when it is disconnected, and swallows
    // errors when it is not, so this used to report success for a change
    // that was never stored. Read it back; for a security setting such as the
    // session length, "saved" has to be true.
    if ((await redisClient.get(SETTINGS_KEY)) !== serialised) {
      logger.error('Admin settings were not stored: Redis did not keep the write');
      return res.status(503).json({ success: false, error: 'The settings store is unavailable, so nothing was saved. Try again shortly.', code: 'SETTINGS_STORE_UNAVAILABLE', timestamp: new Date().toISOString() });
    }
    logger.info('Admin settings changed', { adminId: (req as any).user?.id, changes: Object.keys(req.body ?? {}) });
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
router.get('/settings/platform', authenticateAdminToken, async (_req, res) => {
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
        sessionHours: await getAdminSessionHours(),
        sessionHoursMin: ADMIN_SESSION_HOURS.MIN,
        sessionHoursMax: ADMIN_SESSION_HOURS.MAX,
        loginAttemptsPerWindow: ADMIN_LOGIN_MAX_ATTEMPTS,
        loginWindowMinutes: ADMIN_LOGIN_WINDOW_MS / 60000,
        passwordMinLength: PASSWORD_MIN_LENGTH,
        // Whether the server can hold two-factor secrets (TOTP_ENCRYPTION_KEY).
        twoFactorAvailable: isTwoFactorConfigured(),
      },
      sos: {
        // The saved numbers, which the panel edits. Numbers set on the server
        // (ONCALL_PHONE_NUMBERS) are texted too, but only counted here.
        onCallPhones: await getStoredOnCallPhones(),
        serverOnCallPhones: getServerOnCallPhones().length,
        maxOnCallPhones: MAX_ONCALL_PHONES,
        smsConfigured: smsService.isConfigured(),
        // Minutes after raising at which an unacknowledged SOS is re-sent.
        reminderMinutes: Array.from({ length: SOS_ESCALATION.MAX_REMINDERS }, (_, i) => reminderDueAfterMinutes(i + 1)),
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

/**
 * @route   GET /api/admin/alerts
 * @desc    Everything waiting on an operator: active SOS alerts, open
 *          disputes, and drivers whose documents need review
 * @access  Private (Admin)
 *
 * The admin panel's notification bell showed a hardcoded 5 and the Disputes
 * badge a hardcoded 3. Worse, an SOS alert reached nobody at ARYV:
 * EmergencyService.notifyOperators() only confirms back to the user who
 * raised it. This is what the panel polls instead.
 */
router.get('/alerts', authenticateAdminToken, async (_req, res) => {
  try {
    const [sos, disputes, verifications, [counts]] = await Promise.all([
      sequelize.query(
        `SELECT ea.id, ea.alert_type AS "alertType", ea.status, ea.message, ea.created_at AS "createdAt",
                ea.last_location_at AS "lastLocationAt",
                ST_Y(ea.last_coordinates) AS latitude, ST_X(ea.last_coordinates) AS longitude,
                ea.contacts_notified AS "contactsNotified", ea.ride_id AS "rideId",
                ea.user_id AS "userId", TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "userName",
                u.phone_number AS "userPhone"
           FROM emergency_alerts ea
           JOIN users u ON u.id = ea.user_id
          WHERE ea.status IN ('raised', 'acknowledged')
          ORDER BY ea.created_at DESC
          LIMIT 20`,
        { type: QueryTypes.SELECT },
      ),
      sequelize.query(
        `SELECT d.id, d.dispute_type AS "disputeType", d.status::text AS status, d.created_at AS "createdAt",
                p.title AS "packageTitle"
           FROM delivery_disputes d
           LEFT JOIN delivery_agreements a ON a.id = d.delivery_agreement_id
           LEFT JOIN packages p ON p.id = a.package_id
          WHERE d.status::text IN ('open', 'under_review')
          ORDER BY d.created_at DESC
          LIMIT 20`,
        { type: QueryTypes.SELECT },
      ),
      sequelize.query(
        `SELECT u.id AS "userId", TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "userName",
                COUNT(*)::int AS documents, MIN(dd.submitted_at) AS "waitingSince"
           FROM driver_documents dd
           JOIN users u ON u.id = dd.user_id
          WHERE dd.status::text IN ('uploaded', 'under_review')
          GROUP BY u.id, u.first_name, u.last_name
          ORDER BY MIN(dd.submitted_at)
          LIMIT 20`,
        { type: QueryTypes.SELECT },
      ),
      sequelize.query<{ sos: number; disputes: number; verifications: number }>(
        `SELECT
           (SELECT COUNT(*)::int FROM emergency_alerts WHERE status IN ('raised', 'acknowledged')) AS sos,
           (SELECT COUNT(*)::int FROM delivery_disputes WHERE status::text IN ('open', 'under_review')) AS disputes,
           (SELECT COUNT(DISTINCT user_id)::int FROM driver_documents WHERE status::text IN ('uploaded', 'under_review')) AS verifications`,
        { type: QueryTypes.SELECT },
      ),
    ]);

    return res.json({
      success: true,
      data: {
        counts: { ...counts, total: counts!.sos + counts!.disputes + counts!.verifications },
        sos,
        disputes,
        verifications,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Admin alerts failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to load alerts', code: 'ALERTS_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * An admin's handling of an SOS alert is written into resolution_note and the
 * log. acknowledged_by references users(id), and admins are admin_users, so
 * it cannot hold the admin's id and is left empty.
 */
const adminLabel = (req: any): string => req.user?.email ?? req.user?.id ?? 'unknown admin';

/**
 * @route   POST /api/admin/emergency-alerts/:id/acknowledge
 * @desc    Mark a raised SOS alert as being handled
 * @access  Private (any admin role)
 */
// Any signed-in staff member, moderators included: an emergency should not
// wait for someone with a higher role to be on duty.
router.post('/emergency-alerts/:id/acknowledge', authenticateAdminToken, async (req, res) => {
  try {
    const alert = await EmergencyAlert.findByPk(req.params['id']);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found', code: 'NOT_FOUND', timestamp: new Date().toISOString() });
    }
    if (alert.status !== EmergencyAlertStatus.RAISED) {
      return res.status(409).json({ success: false, error: `Alert is already ${alert.status}`, code: 'INVALID_STATUS', timestamp: new Date().toISOString() });
    }
    const at = new Date();
    await alert.update({
      status: EmergencyAlertStatus.ACKNOWLEDGED,
      acknowledgedAt: at,
      resolutionNote: `Acknowledged by ${adminLabel(req)} at ${at.toISOString()}`,
    });
    logger.warn('SOS alert acknowledged', { alertId: alert.id, admin: adminLabel(req) });
    return res.json({ success: true, data: alert, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Acknowledging SOS alert failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to acknowledge alert', code: 'ALERT_UPDATE_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   POST /api/admin/emergency-alerts/:id/resolve
 * @desc    Close an SOS alert as resolved or as a false alarm, with a note
 * @access  Private (any admin role)
 */
router.post('/emergency-alerts/:id/resolve', authenticateAdminToken, async (req, res) => {
  try {
    const outcome = req.body?.outcome;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (outcome !== EmergencyAlertStatus.RESOLVED && outcome !== EmergencyAlertStatus.FALSE_ALARM) {
      return res.status(400).json({ success: false, error: "outcome must be 'resolved' or 'false_alarm'", code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
    }
    if (!note || note.length > 1000) {
      return res.status(400).json({ success: false, error: 'A note of up to 1000 characters saying what happened is required', code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
    }

    const alert = await EmergencyAlert.findByPk(req.params['id']);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found', code: 'NOT_FOUND', timestamp: new Date().toISOString() });
    }
    if (alert.status !== EmergencyAlertStatus.RAISED && alert.status !== EmergencyAlertStatus.ACKNOWLEDGED) {
      return res.status(409).json({ success: false, error: `Alert is already ${alert.status}`, code: 'INVALID_STATUS', timestamp: new Date().toISOString() });
    }
    const at = new Date();
    const previous = alert.resolutionNote ? `${alert.resolutionNote}\n` : '';
    await alert.update({
      status: outcome,
      resolvedAt: at,
      acknowledgedAt: alert.acknowledgedAt ?? at,
      resolutionNote: `${previous}${outcome === EmergencyAlertStatus.FALSE_ALARM ? 'False alarm' : 'Resolved'} by ${adminLabel(req)} at ${at.toISOString()}: ${note}`,
    });
    logger.warn('SOS alert closed', { alertId: alert.id, outcome, admin: adminLabel(req) });
    return res.json({ success: true, data: alert, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Resolving SOS alert failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to resolve alert', code: 'ALERT_UPDATE_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   POST /api/admin/settings/on-call/test
 * @desc    Send a test SMS to every on-call number
 * @access  Private (Super admin)
 *
 * The only way to know an SOS will reach someone is to try it. Reports each
 * number's result rather than one overall success.
 */
router.post('/settings/on-call/test', authenticateAdminToken, requireSuperAdmin, async (req, res) => {
  try {
    const numbers = await getOnCallPhones();
    if (numbers.length === 0) {
      return res.status(400).json({ success: false, error: 'No on-call numbers are set', code: 'NO_ONCALL_NUMBERS', timestamp: new Date().toISOString() });
    }
    if (!smsService.isConfigured()) {
      return res.status(503).json({ success: false, error: 'SMS is not configured on the server (Twilio credentials or sending number missing)', code: 'SMS_NOT_CONFIGURED', timestamp: new Date().toISOString() });
    }
    const body = 'ARYV test: this number will be texted when someone raises an SOS. No action needed.';
    const results = await Promise.all(numbers.map(async (number) => ({ number, sent: await smsService.sendMessage(number, body) })));
    logger.info('On-call SMS test sent', { adminId: (req as any).user?.id, results });
    return res.json({ success: true, data: { results }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`On-call SMS test failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to send the test', code: 'ONCALL_TEST_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * Driver document review from the admin panel.
 *
 * Documents could not be reviewed from the panel: the existing review routes
 * under /api/verification/admin take a rider's token, not an admin panel
 * one, and driver_documents.reviewed_by could not hold an admin_users id
 * (migration 029). These call the same VerificationService.reviewDocument,
 * so approval and rejection, and the driver's resulting status, work exactly
 * as before.
 */

/**
 * @route   GET /api/admin/verifications
 * @desc    Documents waiting for review, grouped by driver, oldest first
 * @access  Private (Admin)
 */
router.get('/verifications', authenticateAdminToken, async (_req, res) => {
  try {
    const rows = await sequelize.query<any>(
      `SELECT dd.id, dd.user_id AS "userId", dd.document_type AS "documentType", dd.status::text AS status,
              dd.original_filename AS "originalFilename", dd.mime_type AS "mimeType",
              dd.file_size_bytes AS "fileSizeBytes", dd.document_expires_at AS "documentExpiresAt",
              dd.attempt_number AS "attemptNumber", dd.submitted_at AS "submittedAt",
              TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "userName", u.email,
              u.phone_number AS phone, u.driver_verification_status AS "driverStatus"
         FROM driver_documents dd
         JOIN users u ON u.id = dd.user_id
        WHERE dd.status::text IN ('uploaded', 'under_review')
        ORDER BY dd.submitted_at ASC
        LIMIT 200`,
      { type: QueryTypes.SELECT },
    );

    const drivers = new Map<string, any>();
    for (const row of rows) {
      const { userId, userName, email, phone, driverStatus, ...document } = row;
      if (!drivers.has(userId)) drivers.set(userId, { userId, userName, email, phone, driverStatus, documents: [] });
      drivers.get(userId).documents.push(document);
    }
    return res.json({ success: true, data: { drivers: [...drivers.values()] }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Admin verification queue failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to load the review queue', code: 'VERIFICATION_QUEUE_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   GET /api/admin/verifications/documents/:id/file
 * @desc    The uploaded file, for the reviewer to look at
 * @access  Private (Admin)
 */
router.get('/verifications/documents/:id/file', authenticateAdminToken, requireAdmin, async (req, res) => {
  try {
    const document = await DriverDocument.findByPk(req.params['id']);
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found', code: 'NOT_FOUND', timestamp: new Date().toISOString() });
    }
    // storageKey is a bare filename from the upload middleware; basename
    // still guards against a crafted value walking out of the directory.
    const filePath = path.resolve(UPLOADS_DIR, 'documents', path.basename(document.storageKey));
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ success: false, error: 'The file is no longer on the server', code: 'FILE_NOT_FOUND', timestamp: new Date().toISOString() });
      }
    });
  } catch (error) {
    logger.error(`Admin document file failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to load the file', code: 'DOCUMENT_FILE_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   POST /api/admin/verifications/documents/:id/review
 * @desc    Approve or reject a document; a rejection needs a reason
 * @access  Private (Admin)
 */
router.post('/verifications/documents/:id/review', authenticateAdminToken, requireAdmin, async (req: any, res) => {
  const { approve, rejectionReason, adminNotes, allowResubmission } = req.body ?? {};
  if (typeof approve !== 'boolean') {
    return res.status(400).json({ success: false, error: 'approve must be true or false', code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
  }
  if (rejectionReason !== undefined && (typeof rejectionReason !== 'string' || rejectionReason.trim().length < 3 || rejectionReason.length > 1000)) {
    return res.status(400).json({ success: false, error: 'rejectionReason must be 3 to 1000 characters', code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
  }
  if (adminNotes !== undefined && (typeof adminNotes !== 'string' || adminNotes.length > 2000)) {
    return res.status(400).json({ success: false, error: 'adminNotes must be up to 2000 characters', code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
  }
  if (allowResubmission !== undefined && typeof allowResubmission !== 'boolean') {
    return res.status(400).json({ success: false, error: 'allowResubmission must be true or false', code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
  }

  const result = await verificationService.reviewDocument({
    documentId: String(req.params['id']),
    adminId: req.user?.id,
    approve,
    rejectionReason: rejectionReason?.trim(),
    adminNotes,
    allowResubmission,
  });

  if (!result.success) {
    const status = result.code === 'DOCUMENT_NOT_FOUND' ? 404
      : result.code === 'ALREADY_REVIEWED' ? 409
        : result.code === 'REJECTION_REASON_REQUIRED' ? 400
          : 500;
    return res.status(status).json({ success: false, error: result.error, code: result.code, timestamp: new Date().toISOString() });
  }
  return res.json({ success: true, data: { status: result.status, driverStatus: result.driverStatus }, timestamp: new Date().toISOString() });
});

/**
 * @route   GET /api/admin/audit-logs
 * @desc    The admin audit trail, newest first, filterable
 * @access  Private (Admin)
 */
router.get('/audit-logs', authenticateAdminToken, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query['page'] || 1));
    const limit = Math.min(200, Math.max(1, Number(req.query['limit'] || 50)));
    const filters: string[] = [];
    const replacements: Record<string, unknown> = { limit, offset: (page - 1) * limit };
    for (const [param, column] of [['adminId', 'l.admin_user_id'], ['action', 'l.action'], ['resourceType', 'l.resource_type'], ['resourceId', 'l.resource_id']] as const) {
      const value = req.query[param];
      if (typeof value === 'string' && value) {
        filters.push(`${column}${param === 'adminId' ? '::text' : ''} = :${param}`);
        replacements[param] = value;
      }
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [entries, [{ total }]] = await Promise.all([
      sequelize.query(
        `SELECT l.id, l.action, l.resource_type AS "resourceType", l.resource_id AS "resourceId", l.details,
                host(l.ip_address) AS "ipAddress", l.user_agent AS "userAgent", l.created_at AS "createdAt",
                l.admin_user_id AS "adminId", a.email AS "adminEmail",
                TRIM(CONCAT(a.first_name, ' ', a.last_name)) AS "adminName", a.role AS "adminRole"
           FROM admin_audit_logs l
           LEFT JOIN admin_users a ON a.id = l.admin_user_id
           ${where}
          ORDER BY l.created_at DESC
          LIMIT :limit OFFSET :offset`,
        { type: QueryTypes.SELECT, replacements },
      ),
      sequelize.query(`SELECT COUNT(*)::int AS total FROM admin_audit_logs l ${where}`, { type: QueryTypes.SELECT, replacements }) as Promise<Array<{ total: number }>>,
    ]);

    return res.json({
      success: true,
      data: { entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Admin audit log query failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to load the audit log', code: 'AUDIT_LOG_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * Two-factor sign-in for the signed-in admin's own account. Each admin turns
 * it on for themselves, with their own phone; a super admin cannot do it for
 * them. See AdminTwoFactorService.
 */
const TWO_FACTOR_ERRORS: Record<string, { status: number; message: string }> = {
  NOT_CONFIGURED: { status: 503, message: 'Two-factor sign-in is not available: the server has no TOTP_ENCRYPTION_KEY' },
  ALREADY_ENABLED: { status: 409, message: 'Two-factor sign-in is already on' },
  NOT_STARTED: { status: 409, message: 'Start setting up two-factor sign-in first' },
  NOT_ENABLED: { status: 409, message: 'Two-factor sign-in is not on' },
  INVALID_CODE: { status: 400, message: 'That code is not right. Check the time on your phone is set automatically.' },
  CODE_REUSED: { status: 400, message: 'That code has already been used; wait for the next one' },
  INVALID_PASSWORD: { status: 400, message: 'That password is not right' },
};

const twoFactorFailure = (res: any, error: string) => {
  const known = TWO_FACTOR_ERRORS[error] ?? { status: 500, message: 'Two-factor request failed' };
  return res.status(known.status).json({ success: false, error: known.message, code: error, timestamp: new Date().toISOString() });
};

const signedInAdmin = (req: any) => AdminUser.findByPk(req.user?.id);

/**
 * @route   GET /api/admin/auth/2fa
 * @desc    Whether the signed-in admin has two-factor on, and whether it is available
 * @access  Private (Admin)
 */
router.get('/auth/2fa', authenticateAdminToken, async (req, res) => {
  const admin = await signedInAdmin(req);
  if (!admin) return res.status(404).json({ success: false, error: 'Admin not found', code: 'NOT_FOUND' });
  return res.json({
    success: true,
    data: { enabled: admin.twoFactorEnabled, available: isTwoFactorConfigured() },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route   POST /api/admin/auth/2fa/setup
 * @desc    Start setup: a new secret, as a QR code and as text. Two-factor
 *          stays off until a code from the app is confirmed.
 * @access  Private (Admin)
 */
router.post('/auth/2fa/setup', authenticateAdminToken, async (req, res) => {
  try {
    const admin = await signedInAdmin(req);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found', code: 'NOT_FOUND' });
    const result = await adminTwoFactorService.beginSetup(admin);
    if (!result.ok) return twoFactorFailure(res, result.error);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: { secret: result.secret, otpauthUri: result.otpauthUri, qrCodeDataUrl: result.qrCodeDataUrl },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Two-factor setup failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Two-factor setup failed', code: 'TWO_FACTOR_FAILED' });
  }
});

/**
 * @route   POST /api/admin/auth/2fa/confirm
 * @desc    Turn two-factor on with a code from the app just set up
 * @access  Private (Admin)
 */
router.post('/auth/2fa/confirm', authenticateAdminToken, async (req, res) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\s+/g, '') : '';
    const admin = await signedInAdmin(req);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found', code: 'NOT_FOUND' });
    const result = await adminTwoFactorService.confirmSetup(admin, code);
    if (!result.ok) return twoFactorFailure(res, result.error);
    return res.json({ success: true, data: { enabled: true }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Two-factor confirm failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Two-factor confirmation failed', code: 'TWO_FACTOR_FAILED' });
  }
});

/**
 * @route   POST /api/admin/auth/2fa/disable
 * @desc    Turn two-factor off; needs the password and a current code
 * @access  Private (Admin)
 */
router.post('/auth/2fa/disable', authenticateAdminToken, async (req, res) => {
  try {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\s+/g, '') : '';
    const admin = await signedInAdmin(req);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found', code: 'NOT_FOUND' });
    const result = await adminTwoFactorService.disable(admin, password, code);
    if (!result.ok) return twoFactorFailure(res, result.error);
    return res.json({ success: true, data: { enabled: false }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Two-factor disable failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Turning two-factor off failed', code: 'TWO_FACTOR_FAILED' });
  }
});

/**
 * Commission collection.
 *
 * Riders pay drivers in cash, and the platform's commission on each cash ride
 * accrues as a debt on the driver (user_wallets.commission_owed). A driver
 * owing the block threshold (P50 by default) cannot take cash rides. The only
 * way to record a payment was a driver-side endpoint that settles from the
 * in-app wallet, which does not exist in production, so a blocked driver
 * stayed blocked. These let an admin see who owes what and record a payment
 * received, through the existing CommissionService.settleCommission.
 */

const commissionService = new CommissionService();

// Ways an admin can receive commission. Wallet deduction is the driver-side
// path and is not offered here.
const ADMIN_SETTLEMENT_METHODS = [
  SettlementMethod.CASH_AGENT,
  SettlementMethod.MOBILE_MONEY,
  SettlementMethod.BANK_TRANSFER,
  SettlementMethod.MANUAL,
] as const;

/**
 * @route   GET /api/admin/commission
 * @desc    Drivers who owe commission, most owed first
 * @access  Private (Admin)
 */
router.get('/commission', authenticateAdminToken, requireAdmin, async (req, res) => {
  try {
    const blockedOnly = req.query['filter'] === 'blocked';
    const drivers = await sequelize.query(
      `SELECT w.user_id AS "driverId",
              TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "driverName", u.email, u.phone_number AS phone,
              w.commission_owed::float AS owed, w.commission_block_threshold::float AS threshold,
              w.total_commission_paid::float AS "totalPaid", w.last_commission_settled_at AS "lastSettledAt",
              (w.commission_owed >= w.commission_block_threshold) AS blocked,
              -- The debt has no currency of its own; it accrues from the
              -- driver's rides, so it is labelled with their latest ride's.
              (SELECT r.currency FROM rides r WHERE r.driver_id = w.user_id ORDER BY r.created_at DESC LIMIT 1) AS currency
         FROM user_wallets w
         JOIN users u ON u.id = w.user_id
        WHERE w.commission_owed > 0
          ${blockedOnly ? 'AND w.commission_owed >= w.commission_block_threshold' : ''}
        ORDER BY w.commission_owed DESC
        LIMIT 500`,
      { type: QueryTypes.SELECT },
    );
    const [totals] = await sequelize.query<{ drivers: number; blocked: number }>(
      `SELECT COUNT(*)::int AS drivers,
              COUNT(*) FILTER (WHERE commission_owed >= commission_block_threshold)::int AS blocked
         FROM user_wallets WHERE commission_owed > 0`,
      { type: QueryTypes.SELECT },
    );
    return res.json({ success: true, data: { drivers, totals }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Admin commission list failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to load commission balances', code: 'COMMISSION_LIST_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   GET /api/admin/commission/:id/ledger
 * @desc    A driver's commission history, newest first
 * @access  Private (Admin)
 */
router.get('/commission/:id/ledger', authenticateAdminToken, requireAdmin, async (req, res) => {
  try {
    const entries = await sequelize.query(
      `SELECT l.id, l.entry_type AS "entryType", l.amount::float AS amount, l.balance_after::float AS "balanceAfter",
              l.settlement_method AS "settlementMethod", l.description, l.created_at AS "createdAt",
              COALESCE(a.email, u.email) AS "recordedBy"
         FROM commission_ledger l
         LEFT JOIN admin_users a ON a.id = l.recorded_by
         LEFT JOIN users u ON u.id = l.recorded_by
        WHERE l.driver_id::text = :driverId
        ORDER BY l.created_at DESC
        LIMIT 200`,
      { type: QueryTypes.SELECT, replacements: { driverId: String(req.params['id']) } },
    );
    return res.json({ success: true, data: { entries }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Admin commission ledger failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to load the commission history', code: 'COMMISSION_LEDGER_FAILED', timestamp: new Date().toISOString() });
  }
});

/**
 * @route   POST /api/admin/commission/:id/settlements
 * @desc    Record commission a driver has paid; clears the debt by that much
 * @access  Private (Admin)
 */
router.post('/commission/:id/settlements', authenticateAdminToken, requireAdmin, async (req: any, res) => {
  const { amount, method, reference, note } = req.body ?? {};
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
    return res.status(400).json({ success: false, error: 'amount must be a positive amount with at most two decimal places', code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
  }
  if (!(ADMIN_SETTLEMENT_METHODS as readonly string[]).includes(method)) {
    return res.status(400).json({ success: false, error: `method must be one of ${ADMIN_SETTLEMENT_METHODS.join(', ')}`, code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
  }
  if (typeof reference !== 'string' || reference.trim().length < 2 || reference.length > 100) {
    return res.status(400).json({ success: false, error: 'A reference of 2 to 100 characters is required (receipt number, transaction id…)', code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
  }
  if (note !== undefined && (typeof note !== 'string' || note.length > 500)) {
    return res.status(400).json({ success: false, error: 'note must be up to 500 characters', code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
  }

  const result = await commissionService.settleCommission(
    String(req.params['id']),
    amount,
    method,
    req.user?.id,
    `Recorded by ${req.user?.email ?? 'an admin'} via ${method}, ref ${reference.trim()}${note ? `: ${note.trim()}` : ''}`,
  );
  if (!result.success) {
    const status = /not found/i.test(result.error ?? '') ? 404 : /no outstanding/i.test(result.error ?? '') ? 409 : 400;
    return res.status(status).json({ success: false, error: result.error, code: 'SETTLEMENT_REFUSED', timestamp: new Date().toISOString() });
  }
  return res.json({
    success: true,
    data: { amountSettled: result.amountSettled, remainingOwed: result.remainingOwed, ledgerEntryId: result.ledgerEntryId },
    timestamp: new Date().toISOString(),
  });
});

/**
 * The signed-in admin's own account: password, other sessions, and their
 * own recent activity. Ending sessions sets sessions_revoked_at, which
 * authenticateAdminToken checks; the caller gets a new token so the device
 * they are using stays signed in.
 */

/**
 * @route   POST /api/admin/auth/password
 * @desc    Change your password; ends every other session
 * @access  Private (any admin role)
 */
router.post('/auth/password', authenticateAdminToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\s+/g, '') : '';
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required', code: 'VALIDATION_ERROR' });
    }

    const admin = await signedInAdmin(req);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found', code: 'NOT_FOUND' });

    if (!(await admin.validatePassword(currentPassword))) {
      return res.status(400).json({ success: false, error: 'Your current password is not right', code: 'INVALID_PASSWORD' });
    }
    // With two-factor on, a password alone is not enough to replace the
    // password: otherwise a stolen session could lock the owner out.
    if (admin.twoFactorEnabled) {
      if (!code) return res.status(400).json({ success: false, error: 'Enter the code from your authenticator app', code: 'TWO_FACTOR_REQUIRED' });
      const check = await adminTwoFactorService.verifySignInCode(admin, code);
      if (!check.ok) return twoFactorFailure(res, check.error);
    }
    const strength = validatePasswordStrength(newPassword);
    if (!strength.ok) {
      return res.status(400).json({ success: false, error: strength.message, code: 'WEAK_PASSWORD' });
    }
    if (await admin.validatePassword(newPassword)) {
      return res.status(400).json({ success: false, error: 'Choose a password different from the current one', code: 'SAME_PASSWORD' });
    }

    await admin.setPassword(newPassword);
    admin.sessionsRevokedAt = new Date();
    await admin.save();
    const { accessToken } = await issueAdminAccessToken(admin);
    return res.json({ success: true, data: { accessToken }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Admin password change failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Changing the password failed', code: 'PASSWORD_CHANGE_FAILED' });
  }
});

/**
 * @route   POST /api/admin/auth/sessions/revoke-others
 * @desc    Sign out every other device signed in to your account
 * @access  Private (any admin role)
 */
router.post('/auth/sessions/revoke-others', authenticateAdminToken, async (req, res) => {
  try {
    const admin = await signedInAdmin(req);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found', code: 'NOT_FOUND' });
    admin.sessionsRevokedAt = new Date();
    await admin.save();
    const { accessToken } = await issueAdminAccessToken(admin);
    return res.json({ success: true, data: { accessToken }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Admin session revoke failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Signing out other devices failed', code: 'SESSION_REVOKE_FAILED' });
  }
});

/**
 * @route   GET /api/admin/auth/activity
 * @desc    Your own recent sign-ins and actions, from the audit trail
 * @access  Private (any admin role; each admin sees only their own)
 */
router.get('/auth/activity', authenticateAdminToken, async (req: any, res) => {
  try {
    const entries = await sequelize.query(
      `SELECT id, action, resource_type AS "resourceType", resource_id AS "resourceId",
              details->>'outcome' AS outcome, details->>'reason' AS reason,
              host(ip_address) AS "ipAddress", user_agent AS "userAgent", created_at AS "createdAt"
         FROM admin_audit_logs
        WHERE admin_user_id::text = :adminId
        ORDER BY created_at DESC
        LIMIT 30`,
      { type: QueryTypes.SELECT, replacements: { adminId: String(req.user?.id) } },
    );
    return res.json({ success: true, data: { entries }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Admin own activity failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to load your activity', code: 'ACTIVITY_FAILED' });
  }
});

/**
 * @route   GET /api/admin/users/:id/moderation
 * @desc    Every admin decision about one user: blocks, unblocks, edits and
 *          verification changes, with who made it, when and why
 * @access  Private (any admin role)
 *
 * Read from the audit trail, which has kept each request's body (credentials
 * removed) since #24, so a block's reason is no longer only in a log line.
 */
router.get('/users/:id/moderation', authenticateAdminToken, async (req, res) => {
  try {
    const entries = await sequelize.query(
      `SELECT l.id, l.action, l.created_at AS "createdAt",
              l.details->>'outcome' AS outcome,
              l.details->'request'->>'reason' AS reason,
              l.details->'request' AS request,
              a.email AS "adminEmail", NULLIF(TRIM(CONCAT(a.first_name, ' ', a.last_name)), '') AS "adminName"
         FROM admin_audit_logs l
         LEFT JOIN admin_users a ON a.id = l.admin_user_id
        WHERE l.resource_type = 'user' AND l.resource_id = :userId
        ORDER BY l.created_at DESC
        LIMIT 100`,
      { type: QueryTypes.SELECT, replacements: { userId: String(req.params['id']) } },
    );
    return res.json({ success: true, data: { entries }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`User moderation history failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: 'Failed to load the moderation history', code: 'MODERATION_HISTORY_FAILED' });
  }
});

export default router;
