"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const AuthService_1 = require("../services/AuthService");
const types_1 = require("../types");
class AuthController {
    static async register(req, res) {
        try {
            const result = await AuthService_1.AuthService.register(req.body);
            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: result,
                timestamp: new Date().toISOString(),
            });
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
            console.error(`[${new Date().toISOString()}] Registration error:`, {
                error: error.message,
                stack: error.stack,
                body: req.body,
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async login(req, res) {
        try {
            const result = await AuthService_1.AuthService.login(req.body);
            res.status(200).json({
                success: true,
                message: 'Login successful',
                data: result,
                timestamp: new Date().toISOString(),
            });
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
            console.error(`[${new Date().toISOString()}] Login error:`, {
                error: error.message,
                stack: error.stack,
                email: req.body.email,
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;
            const result = await AuthService_1.AuthService.refreshToken(refreshToken);
            res.status(200).json({
                success: true,
                message: 'Token refreshed successfully',
                data: result,
                timestamp: new Date().toISOString(),
            });
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
            console.error(`[${new Date().toISOString()}] Token refresh error:`, {
                error: error.message,
                stack: error.stack,
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async logout(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'AUTHENTICATION_REQUIRED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            await AuthService_1.AuthService.logout(req.user.id);
            res.status(200).json({
                success: true,
                message: 'Logout successful',
                timestamp: new Date().toISOString(),
            });
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
            console.error(`[${new Date().toISOString()}] Logout error:`, {
                error: error.message,
                stack: error.stack,
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async getProfile(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'AUTHENTICATION_REQUIRED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const user = await AuthService_1.AuthService.getUserById(req.user.id);
            res.status(200).json({
                success: true,
                message: 'Profile retrieved successfully',
                data: user,
                timestamp: new Date().toISOString(),
            });
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
            console.error(`[${new Date().toISOString()}] Get profile error:`, {
                error: error.message,
                stack: error.stack,
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async verifyToken(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid token',
                    code: 'INVALID_TOKEN',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            res.status(200).json({
                success: true,
                message: 'Token is valid',
                data: {
                    user: req.user,
                    tokenValid: true,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Token verification error:`, {
                error: error.message,
                stack: error.stack,
            });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=AuthController.js.map