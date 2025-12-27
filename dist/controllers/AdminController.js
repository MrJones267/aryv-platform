"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const AdminUser_1 = require("../models/AdminUser");
const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] || 'your-refresh-secret';
class AdminController {
    static async login(req, res) {
        try {
            const { email, password, rememberMe } = req.body;
            const admin = await AdminUser_1.AdminUser.findByEmail(email);
            if (!admin || !admin.isActive) {
                (0, logger_1.logWarn)('Admin login attempt with invalid email', { email, ip: req.ip });
                res.status(401).json({
                    success: false,
                    error: 'Invalid credentials',
                    code: 'INVALID_CREDENTIALS',
                });
                return;
            }
            if (admin.isAccountLocked()) {
                (0, logger_1.logWarn)('Admin login attempt on locked account', { email, ip: req.ip });
                res.status(423).json({
                    success: false,
                    error: 'Account is temporarily locked due to multiple failed login attempts',
                    code: 'ACCOUNT_LOCKED',
                });
                return;
            }
            const isValidPassword = await admin.validatePassword(password);
            if (!isValidPassword) {
                admin.incrementFailedAttempts();
                await admin.save();
                (0, logger_1.logWarn)('Admin login attempt with invalid password', {
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
            admin.resetFailedAttempts();
            admin.updateLastLogin();
            await admin.save();
            const tokenPayload = {
                id: admin.id,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions,
                type: 'admin',
            };
            const accessToken = jsonwebtoken_1.default.sign(tokenPayload, JWT_SECRET, { expiresIn: rememberMe ? '7d' : '24h' });
            const refreshToken = jsonwebtoken_1.default.sign({ id: admin.id, type: 'admin' }, JWT_REFRESH_SECRET, { expiresIn: '30d' });
            (0, logger_1.logInfo)('Admin login successful', {
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
        }
        catch (error) {
            (0, logger_1.logError)('Admin login error', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR',
            });
        }
    }
    static async verify(req, res) {
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
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            if (decoded.type !== 'admin') {
                res.status(403).json({
                    success: false,
                    error: 'Admin access required',
                    code: 'ADMIN_ACCESS_REQUIRED',
                });
                return;
            }
            const admin = await AdminUser_1.AdminUser.findByPk(decoded.id);
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
        }
        catch (error) {
            (0, logger_1.logError)('Admin token verification error', error);
            res.status(401).json({
                success: false,
                error: 'Invalid token',
                code: 'INVALID_TOKEN',
            });
        }
    }
    static async logout(req, res) {
        try {
            (0, logger_1.logInfo)('Admin logout', { adminId: req.user?.id, ip: req.ip });
            res.status(200).json({
                success: true,
                message: 'Logout successful',
            });
        }
        catch (error) {
            (0, logger_1.logError)('Admin logout error', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR',
            });
        }
    }
    static async updateProfile(req, res) {
        try {
            const { firstName, lastName } = req.body;
            const adminId = req.user?.id;
            const admin = await AdminUser_1.AdminUser.findByPk(adminId);
            if (!admin) {
                res.status(404).json({
                    success: false,
                    error: 'Admin not found',
                    code: 'ADMIN_NOT_FOUND',
                });
                return;
            }
            if (firstName)
                admin.firstName = firstName;
            if (lastName)
                admin.lastName = lastName;
            await admin.save();
            (0, logger_1.logInfo)('Admin profile updated', { adminId, changes: { firstName, lastName } });
            const safeUserData = admin.toSafeObject();
            res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: {
                    user: safeUserData,
                },
            });
        }
        catch (error) {
            (0, logger_1.logError)('Admin profile update error', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR',
            });
        }
    }
    static async getDashboardStats(_req, res) {
        try {
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
                    avgResolutionTime: 2.4,
                },
            };
            res.status(200).json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            (0, logger_1.logError)('Dashboard stats error', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR',
            });
        }
    }
}
exports.AdminController = AdminController;
//# sourceMappingURL=AdminController.js.map