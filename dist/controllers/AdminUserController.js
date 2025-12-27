"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUserController = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = __importDefault(require("../models/User"));
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
class AdminUserController {
    static async getAllUsers(req, res) {
        try {
            const { page = 1, limit = 20, status, role, verified, startDate, endDate, search, sortBy = 'createdAt', sortOrder = 'DESC', } = req.query;
            const offset = (Number(page) - 1) * Number(limit);
            const whereClause = {};
            if (status && status !== 'all') {
                if (status === 'active') {
                    whereClause[sequelize_1.Op.and] = whereClause[sequelize_1.Op.and] || [];
                    whereClause[sequelize_1.Op.and].push(database_1.sequelize.where(database_1.sequelize.col('is_active'), '=', true));
                }
                else if (status === 'inactive') {
                    whereClause[sequelize_1.Op.and] = whereClause[sequelize_1.Op.and] || [];
                    whereClause[sequelize_1.Op.and].push(database_1.sequelize.where(database_1.sequelize.col('is_active'), '=', false));
                }
            }
            if (role && role !== 'all') {
                whereClause.role = role;
            }
            if (verified === 'true') {
                whereClause[sequelize_1.Op.and] = whereClause[sequelize_1.Op.and] || [];
                whereClause[sequelize_1.Op.and].push(database_1.sequelize.where(database_1.sequelize.col('is_verified'), '=', true));
            }
            else if (verified === 'false') {
                whereClause[sequelize_1.Op.and] = whereClause[sequelize_1.Op.and] || [];
                whereClause[sequelize_1.Op.and].push(database_1.sequelize.where(database_1.sequelize.col('is_verified'), '=', false));
            }
            if (startDate && endDate) {
                whereClause.createdAt = {
                    [sequelize_1.Op.between]: [new Date(startDate), new Date(endDate)],
                };
            }
            if (search) {
                whereClause[sequelize_1.Op.or] = [
                    database_1.sequelize.where(database_1.sequelize.col('first_name'), sequelize_1.Op.iLike, `%${search}%`),
                    database_1.sequelize.where(database_1.sequelize.col('last_name'), sequelize_1.Op.iLike, `%${search}%`),
                    { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                    database_1.sequelize.where(database_1.sequelize.col('phone_number'), sequelize_1.Op.iLike, `%${search}%`),
                ];
            }
            const { rows: users, count: total } = await User_1.default.findAndCountAll({
                where: whereClause,
                attributes: {
                    exclude: ['password'],
                },
                order: [[sortBy, sortOrder]],
                limit: Number(limit),
                offset,
            });
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
        }
        catch (error) {
            (0, logger_1.logError)('Admin getAllUsers error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve users',
                code: 'GET_USERS_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async getUserById(req, res) {
        try {
            const { id } = req.params;
            const user = await User_1.default.findByPk(id, {
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
        }
        catch (error) {
            (0, logger_1.logError)('Admin getUserById error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve user details',
                code: 'GET_USER_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async updateUser(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id } = req.params;
            const updateData = req.body;
            const adminUser = req.user;
            const user = await User_1.default.findByPk(id, { transaction });
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
            delete updateData.password;
            delete updateData.id;
            if (updateData.role && !Object.values(types_1.UserRole).includes(updateData.role)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid user role',
                    code: 'INVALID_ROLE',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (updateData.status && !Object.values(types_1.UserStatus).includes(updateData.status)) {
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
            (0, logger_1.logInfo)('Admin updated user', {
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
        }
        catch (error) {
            await transaction.rollback();
            (0, logger_1.logError)('Admin updateUser error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update user',
                code: 'UPDATE_USER_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async blockUser(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const adminUser = req.user;
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
            const user = await User_1.default.findByPk(id, { transaction });
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
            await transaction.commit();
            (0, logger_1.logInfo)('Admin blocked user', {
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
        }
        catch (error) {
            await transaction.rollback();
            (0, logger_1.logError)('Admin blockUser error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to block user',
                code: 'BLOCK_USER_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async unblockUser(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const adminUser = req.user;
            const user = await User_1.default.findByPk(id, { transaction });
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
            (0, logger_1.logInfo)('Admin unblocked user', {
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
        }
        catch (error) {
            await transaction.rollback();
            (0, logger_1.logError)('Admin unblockUser error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to unblock user',
                code: 'UNBLOCK_USER_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async verifyUser(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id } = req.params;
            const { verificationType, documents, notes } = req.body;
            const adminUser = req.user;
            const user = await User_1.default.findByPk(id, { transaction });
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
            const updateData = {};
            if (verificationType === 'email' || verificationType === 'both') {
                updateData.isEmailVerified = true;
            }
            if (verificationType === 'phone' || verificationType === 'both') {
                updateData.isPhoneVerified = true;
            }
            if (verificationType === 'identity') {
                updateData.isEmailVerified = true;
                updateData.isPhoneVerified = true;
            }
            await user.update(updateData, { transaction });
            await transaction.commit();
            (0, logger_1.logInfo)('Admin verified user', {
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
        }
        catch (error) {
            await transaction.rollback();
            (0, logger_1.logError)('Admin verifyUser error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to verify user',
                code: 'VERIFY_USER_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async getUserAnalytics(req, res) {
        try {
            const { startDate, endDate, groupBy = 'day', } = req.query;
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();
            const totalUsers = await User_1.default.count({
                where: {
                    createdAt: { [sequelize_1.Op.between]: [start, end] },
                },
            });
            const usersByStatus = await User_1.default.findAll({
                where: {
                    createdAt: { [sequelize_1.Op.between]: [start, end] },
                },
                attributes: [
                    'status',
                    [database_1.sequelize.fn('COUNT', database_1.sequelize.col('id')), 'count'],
                ],
                group: ['status'],
                raw: true,
            });
            const usersByRole = await User_1.default.findAll({
                where: {
                    createdAt: { [sequelize_1.Op.between]: [start, end] },
                },
                attributes: [
                    'role',
                    [database_1.sequelize.fn('COUNT', database_1.sequelize.col('id')), 'count'],
                ],
                group: ['role'],
                raw: true,
            });
            const verificationStats = await database_1.sequelize.query(`
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
                type: database_1.sequelize.QueryTypes.SELECT,
            });
            const trendData = await database_1.sequelize.query(`
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
                type: database_1.sequelize.QueryTypes.SELECT,
            });
            const topDrivers = await database_1.sequelize.query(`
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
                type: database_1.sequelize.QueryTypes.SELECT,
            });
            res.status(200).json({
                success: true,
                data: {
                    summary: {
                        totalUsers,
                        usersByStatus: usersByStatus.reduce((acc, curr) => {
                            acc[curr.status] = Number(curr.count);
                            return acc;
                        }, {}),
                        usersByRole: usersByRole.reduce((acc, curr) => {
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
        }
        catch (error) {
            (0, logger_1.logError)('Admin getUserAnalytics error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve user analytics',
                code: 'GET_USER_ANALYTICS_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
}
exports.AdminUserController = AdminUserController;
exports.default = AdminUserController;
//# sourceMappingURL=AdminUserController.js.map