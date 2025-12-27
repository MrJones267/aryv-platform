"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const AdminController_1 = require("../controllers/AdminController");
const AdminRideController_1 = __importDefault(require("../controllers/AdminRideController"));
const AdminUserController_1 = __importDefault(require("../controllers/AdminUserController"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const adminAuthLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        error: 'Too many admin authentication attempts, please try again later',
        code: 'ADMIN_AUTH_RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
const adminApiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        error: 'Too many admin API _requests, please try again later',
        code: 'ADMIN_API_RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
router.use(adminApiLimiter);
router.post('/auth/login', adminAuthLimiter, AdminController_1.AdminController.login);
router.get('/auth/verify', AdminController_1.AdminController.verify);
router.post('/auth/logout', auth_1.authenticateAdminToken, AdminController_1.AdminController.logout);
router.put('/auth/profile', auth_1.authenticateAdminToken, AdminController_1.AdminController.updateProfile);
router.get('/analytics/dashboard', auth_1.authenticateAdminToken, AdminController_1.AdminController.getDashboardStats);
router.get('/users', auth_1.authenticateAdminToken, AdminUserController_1.default.getAllUsers);
router.get('/users/analytics', auth_1.authenticateAdminToken, AdminUserController_1.default.getUserAnalytics);
router.get('/users/:id', auth_1.authenticateAdminToken, AdminUserController_1.default.getUserById);
router.put('/users/:id', auth_1.authenticateAdminToken, AdminUserController_1.default.updateUser);
router.post('/users/:id/block', auth_1.authenticateAdminToken, AdminUserController_1.default.blockUser);
router.post('/users/:id/unblock', auth_1.authenticateAdminToken, AdminUserController_1.default.unblockUser);
router.put('/users/:id/verify', auth_1.authenticateAdminToken, AdminUserController_1.default.verifyUser);
router.get('/rides', auth_1.authenticateAdminToken, AdminRideController_1.default.getAllRides);
router.get('/rides/analytics', auth_1.authenticateAdminToken, AdminRideController_1.default.getRideAnalytics);
router.get('/rides/:id', auth_1.authenticateAdminToken, AdminRideController_1.default.getRideById);
router.post('/rides/:id/cancel', auth_1.authenticateAdminToken, AdminRideController_1.default.cancelRide);
router.put('/rides/:id/status', auth_1.authenticateAdminToken, AdminRideController_1.default.updateRideStatus);
router.get('/rides/:id/bookings', auth_1.authenticateAdminToken, AdminRideController_1.default.getRideBookings);
router.get('/bookings', auth_1.authenticateAdminToken, (_req, res) => {
    res.status(501).json({
        success: false,
        error: 'Global bookings management endpoint not yet implemented',
        code: 'NOT_IMPLEMENTED',
    });
});
router.get('/courier/disputes', auth_1.authenticateAdminToken, (_req, res) => {
    res.status(501).json({
        success: false,
        error: 'Courier dispute endpoints not yet implemented',
        code: 'NOT_IMPLEMENTED',
    });
});
router.post('/courier/disputes/:id/resolve', auth_1.authenticateAdminToken, (_req, res) => {
    res.status(501).json({
        success: false,
        error: 'Courier dispute endpoints not yet implemented',
        code: 'NOT_IMPLEMENTED',
    });
});
router.get('/courier/packages', auth_1.authenticateAdminToken, (_req, res) => {
    res.status(501).json({
        success: false,
        error: 'Courier management endpoints not yet implemented',
        code: 'NOT_IMPLEMENTED',
    });
});
router.post('/courier/agreements/:id/release-payment', auth_1.authenticateAdminToken, (_req, res) => {
    res.status(501).json({
        success: false,
        error: 'Courier management endpoints not yet implemented',
        code: 'NOT_IMPLEMENTED',
    });
});
router.get('/analytics/revenue', auth_1.authenticateAdminToken, (_req, res) => {
    res.status(501).json({
        success: false,
        error: 'Analytics endpoints not yet implemented',
        code: 'NOT_IMPLEMENTED',
    });
});
router.get('/analytics/user-growth/:period', auth_1.authenticateAdminToken, (req, res) => {
    const { period } = req.params;
    const mockData = [
        { date: '2025-01-01', newUsers: 45, totalUsers: 1200 },
        { date: '2025-01-02', newUsers: 32, totalUsers: 1232 },
        { date: '2025-01-03', newUsers: 67, totalUsers: 1299 },
        { date: '2025-01-04', newUsers: 28, totalUsers: 1327 },
        { date: '2025-01-05', newUsers: 89, totalUsers: 1416 },
    ];
    res.json({
        success: true,
        data: mockData,
        period,
        timestamp: new Date().toISOString(),
    });
});
router.get('/analytics/usage', auth_1.authenticateAdminToken, (_req, res) => {
    const mockUsageData = {
        platform: {
            activeUsers: 1850,
            sessionsToday: 4200,
            avgSessionDuration: 12.5,
            bounceRate: 23.4,
        },
        rides: {
            todayRides: 120,
            avgRideTime: 28.5,
            completionRate: 94.2,
            avgRating: 4.6,
        },
        courier: {
            activeDeliveries: 85,
            avgDeliveryTime: 45.8,
            successRate: 96.8,
            avgPackageValue: 125.50,
        },
    };
    res.json({
        success: true,
        data: mockUsageData,
        timestamp: new Date().toISOString(),
    });
});
router.get('/analytics/top-routes', auth_1.authenticateAdminToken, (_req, res) => {
    res.status(501).json({
        success: false,
        error: 'Analytics endpoints not yet implemented',
        code: 'NOT_IMPLEMENTED',
    });
});
router.get('/settings', auth_1.authenticateAdminToken, (_req, res) => {
    res.status(501).json({
        success: false,
        error: 'Settings endpoints not yet implemented',
        code: 'NOT_IMPLEMENTED',
    });
});
router.put('/settings', auth_1.authenticateAdminToken, (_req, res) => {
    res.status(501).json({
        success: false,
        error: 'Settings endpoints not yet implemented',
        code: 'NOT_IMPLEMENTED',
    });
});
router.get('/settings/commission', auth_1.authenticateAdminToken, (_req, res) => {
    res.status(501).json({
        success: false,
        error: 'Settings endpoints not yet implemented',
        code: 'NOT_IMPLEMENTED',
    });
});
router.put('/settings/commission', auth_1.authenticateAdminToken, (_req, res) => {
    res.status(501).json({
        success: false,
        error: 'Settings endpoints not yet implemented',
        code: 'NOT_IMPLEMENTED',
    });
});
exports.default = router;
//# sourceMappingURL=admin.js.map