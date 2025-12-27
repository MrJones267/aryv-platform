"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const types_1 = require("../types");
const JWT_SECRET = process.env['JWT_SECRET'] || 'fallback-secret-key';
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] || '24h';
class AuthService {
    static generateAccessToken(payload) {
        try {
            const signOptions = {
                expiresIn: JWT_EXPIRES_IN,
                issuer: 'hitch-api',
                audience: 'hitch-app',
            };
            return jsonwebtoken_1.default.sign(payload, JWT_SECRET, signOptions);
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error generating access token:`, {
                error: error.message,
                userId: payload.userId,
            });
            throw new types_1.AppError('Token generation failed', 500, 'TOKEN_GENERATION_ERROR');
        }
    }
    static generateRefreshToken() {
        try {
            return crypto_1.default.randomBytes(40).toString('hex');
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error generating refresh token:`, {
                error: error.message,
            });
            throw new types_1.AppError('Refresh token generation failed', 500, 'REFRESH_TOKEN_ERROR');
        }
    }
    static verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, {
                issuer: 'hitch-api',
                audience: 'hitch-app',
            });
            return decoded;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new types_1.AppError('Token has expired', 401, 'TOKEN_EXPIRED');
            }
            else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new types_1.AppError('Invalid token', 401, 'INVALID_TOKEN');
            }
            else {
                console.error(`[${new Date().toISOString()}] Token verification error:`, {
                    error: error.message,
                });
                throw new types_1.AppError('Token verification failed', 401, 'TOKEN_VERIFICATION_ERROR');
            }
        }
    }
    static async register(userData) {
        try {
            const existingUser = await models_1.User.findOne({
                where: {
                    [sequelize_1.Op.or]: [
                        { email: userData.email },
                        { phone: userData.phone },
                    ],
                },
            });
            if (existingUser) {
                throw new types_1.AppError('User with this email or phone already exists', 409, 'USER_ALREADY_EXISTS');
            }
            const user = await models_1.User.create({
                email: userData.email,
                password: userData.password,
                phone: userData.phone,
                firstName: userData.firstName,
                lastName: userData.lastName,
                role: userData.role || types_1.UserRole.PASSENGER,
                dateOfBirth: userData.dateOfBirth,
            });
            const accessToken = this.generateAccessToken({
                userId: user.id,
                email: user.email,
                role: user.role,
            });
            const refreshToken = this.generateRefreshToken();
            await user.update({ refreshToken });
            await user.update({ lastLoginAt: new Date() });
            return {
                success: true,
                user: user.toSafeObject(),
                accessToken,
                refreshToken,
                expiresIn: this.getTokenExpiryTime(),
            };
        }
        catch (error) {
            if (error instanceof types_1.AppError) {
                throw error;
            }
            console.error(`[${new Date().toISOString()}] Registration error:`, {
                error: error.message,
                email: userData.email,
            });
            throw new types_1.AppError('Registration failed', 500, 'REGISTRATION_ERROR');
        }
    }
    static async login(credentials) {
        try {
            const user = await models_1.User.findOne({
                where: { email: credentials.email },
            });
            if (!user) {
                throw new types_1.AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
            }
            if (user.status === 'suspended' || user.status === 'deactivated') {
                throw new types_1.AppError('Account is suspended or deactivated', 403, 'ACCOUNT_SUSPENDED');
            }
            const isPasswordValid = await user.comparePassword(credentials.password);
            if (!isPasswordValid) {
                throw new types_1.AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
            }
            const accessToken = this.generateAccessToken({
                userId: user.id,
                email: user.email,
                role: user.role,
            });
            const refreshToken = this.generateRefreshToken();
            await user.update({
                refreshToken,
                lastLoginAt: new Date(),
            });
            return {
                success: true,
                user: user.toSafeObject(),
                accessToken,
                refreshToken,
                expiresIn: this.getTokenExpiryTime(),
            };
        }
        catch (error) {
            if (error instanceof types_1.AppError) {
                throw error;
            }
            console.error(`[${new Date().toISOString()}] Login error:`, {
                error: error.message,
                email: credentials.email,
            });
            throw new types_1.AppError('Login failed', 500, 'LOGIN_ERROR');
        }
    }
    static async refreshToken(refreshToken) {
        try {
            if (!refreshToken) {
                throw new types_1.AppError('Refresh token is required', 400, 'REFRESH_TOKEN_REQUIRED');
            }
            const user = await models_1.User.findOne({
                where: { refreshToken },
            });
            if (!user) {
                throw new types_1.AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
            }
            if (user.status === 'suspended' || user.status === 'deactivated') {
                throw new types_1.AppError('Account is suspended or deactivated', 403, 'ACCOUNT_SUSPENDED');
            }
            const newAccessToken = this.generateAccessToken({
                userId: user.id,
                email: user.email,
                role: user.role,
            });
            const newRefreshToken = this.generateRefreshToken();
            await user.update({ refreshToken: newRefreshToken });
            return {
                success: true,
                user: user.toSafeObject(),
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expiresIn: this.getTokenExpiryTime(),
            };
        }
        catch (error) {
            if (error instanceof types_1.AppError) {
                throw error;
            }
            console.error(`[${new Date().toISOString()}] Token refresh error:`, {
                error: error.message,
            });
            throw new types_1.AppError('Token refresh failed', 500, 'TOKEN_REFRESH_ERROR');
        }
    }
    static async logout(userId) {
        try {
            await models_1.User.update({ refreshToken: null }, { where: { id: userId } });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Logout error:`, {
                error: error.message,
                userId,
            });
            throw new types_1.AppError('Logout failed', 500, 'LOGOUT_ERROR');
        }
    }
    static async getUserById(userId) {
        try {
            const user = await models_1.User.findByPk(userId);
            if (!user) {
                throw new types_1.AppError('User not found', 404, 'USER_NOT_FOUND');
            }
            return user.toSafeObject();
        }
        catch (error) {
            if (error instanceof types_1.AppError) {
                throw error;
            }
            console.error(`[${new Date().toISOString()}] Get user error:`, {
                error: error.message,
                userId,
            });
            throw new types_1.AppError('Failed to retrieve user', 500, 'USER_RETRIEVAL_ERROR');
        }
    }
    static getTokenExpiryTime() {
        const expiresIn = JWT_EXPIRES_IN;
        if (expiresIn.endsWith('h')) {
            return parseInt(expiresIn) * 3600;
        }
        else if (expiresIn.endsWith('d')) {
            return parseInt(expiresIn) * 86400;
        }
        else if (expiresIn.endsWith('m')) {
            return parseInt(expiresIn) * 60;
        }
        else {
            return parseInt(expiresIn);
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=AuthService.js.map