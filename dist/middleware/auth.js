"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateAdminToken = exports.optionalAuth = exports.requireOwnership = exports.requireVerification = exports.authorizeRoles = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const AuthService_1 = require("../services/AuthService");
const models_1 = require("../models");
const AdminUser_1 = require("../models/AdminUser");
const types_1 = require("../types");
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (!token) {
            res.status(401).json({
                success: false,
                error: 'Access token is required',
                code: 'ACCESS_TOKEN_REQUIRED',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        const decoded = AuthService_1.AuthService.verifyToken(token);
        const user = await models_1.User.findByPk(decoded.userId);
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        if (user.status === 'suspended' || user.status === 'deactivated') {
            res.status(403).json({
                success: false,
                error: 'Account is suspended or deactivated',
                code: 'ACCOUNT_SUSPENDED',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        req.user = user.toSafeObject();
        next();
    }
    catch (error) {
        if (error instanceof types_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        console.error(`[${new Date().toISOString()}] Authentication error:`, {
            error: error.message,
            url: req.url,
            method: req.method,
        });
        res.status(401).json({
            success: false,
            error: 'Authentication failed',
            code: 'AUTHENTICATION_FAILED',
            timestamp: new Date().toISOString(),
        });
    }
};
exports.authenticateToken = authenticateToken;
const authorizeRoles = (...roles) => {
    return (req, _res, next) => {
        if (!req.user) {
            _res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        if (!roles.includes(req.user.role)) {
            _res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
const requireVerification = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
        });
        return;
    }
    if (!req.user.isEmailVerified) {
        res.status(403).json({
            success: false,
            error: 'Email verification required',
            code: 'EMAIL_VERIFICATION_REQUIRED',
            timestamp: new Date().toISOString(),
        });
        return;
    }
    next();
};
exports.requireVerification = requireVerification;
const requireOwnership = (userIdField = 'userId') => {
    return (req, _res, next) => {
        if (!req.user) {
            _res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        const resourceUserId = req.params[userIdField] || req.body[userIdField];
        if (req.user.role !== types_1.UserRole.ADMIN && req.user.id !== resourceUserId) {
            _res.status(403).json({
                success: false,
                error: 'Access denied: You can only access your own resources',
                code: 'ACCESS_DENIED',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        next();
    };
};
exports.requireOwnership = requireOwnership;
const optionalAuth = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (token) {
            const decoded = AuthService_1.AuthService.verifyToken(token);
            const user = await models_1.User.findByPk(decoded.userId);
            if (user && user.status === 'active') {
                req.user = user.toSafeObject();
            }
        }
        next();
    }
    catch (error) {
        next();
    }
};
exports.optionalAuth = optionalAuth;
const authenticateAdminToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: 'Access token is required',
                code: 'ACCESS_TOKEN_REQUIRED',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        const token = authHeader.substring(7);
        const decoded = jsonwebtoken_1.default.verify(token, process.env['JWT_SECRET'] || 'your-secret-key');
        if (decoded.type !== 'admin') {
            res.status(403).json({
                success: false,
                error: 'Admin access required',
                code: 'ADMIN_ACCESS_REQUIRED',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        const admin = await AdminUser_1.AdminUser.findByPk(decoded.id);
        if (!admin || !admin.isActive) {
            res.status(401).json({
                success: false,
                error: 'Admin not found or inactive',
                code: 'ADMIN_NOT_FOUND',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        req.user = admin.toSafeObject();
        next();
    }
    catch (error) {
        console.error(`[${new Date().toISOString()}] Admin authentication error:`, {
            error: error.message,
            url: req.url,
            method: req.method,
        });
        res.status(401).json({
            success: false,
            error: 'Invalid or expired admin token',
            code: 'INVALID_ADMIN_TOKEN',
            timestamp: new Date().toISOString(),
        });
    }
};
exports.authenticateAdminToken = authenticateAdminToken;
//# sourceMappingURL=auth.js.map