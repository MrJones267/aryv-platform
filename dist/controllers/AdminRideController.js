"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRideController = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const Ride_1 = __importDefault(require("../models/Ride"));
const Booking_1 = __importDefault(require("../models/Booking"));
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
class AdminRideController {
    static async getAllRides(req, res) {
        try {
            const { page = 1, limit = 20, status, sortBy = 'createdAt', sortOrder = 'DESC', } = req.query;
            const offset = (Number(page) - 1) * Number(limit);
            const whereClause = {};
            if (status && status !== 'all') {
                whereClause.status = status;
            }
            const { rows: rides, count: total } = await Ride_1.default.findAndCountAll({
                where: whereClause,
                order: [[sortBy, sortOrder]],
                limit: Number(limit),
                offset,
            });
            res.status(200).json({
                success: true,
                data: {
                    rides: rides.map(ride => ride.toJSON()),
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
            console.error('DEBUG - getAllRides error details:', error);
            (0, logger_1.logError)('Admin getAllRides error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve rides',
                code: 'GET_RIDES_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async getRideById(req, res) {
        try {
            const { id } = req.params;
            const ride = await Ride_1.default.findByPk(id);
            if (!ride) {
                res.status(404).json({
                    success: false,
                    error: 'Ride not found',
                    code: 'RIDE_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: {
                    ride: ride.toJSON(),
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            (0, logger_1.logError)('Admin getRideById error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve ride details',
                code: 'GET_RIDE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async cancelRide(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const adminUser = req.user;
            if (!reason) {
                res.status(400).json({
                    success: false,
                    error: 'Cancellation reason is required',
                    code: 'REASON_REQUIRED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const ride = await Ride_1.default.findByPk(id, { transaction });
            if (!ride) {
                res.status(404).json({
                    success: false,
                    error: 'Ride not found',
                    code: 'RIDE_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (ride.status === types_1.RideStatus.COMPLETED) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot cancel completed ride',
                    code: 'RIDE_COMPLETED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (ride.status === types_1.RideStatus.CANCELLED) {
                res.status(400).json({
                    success: false,
                    error: 'Ride is already cancelled',
                    code: 'RIDE_ALREADY_CANCELLED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await ride.update({
                status: types_1.RideStatus.CANCELLED,
            }, { transaction });
            await transaction.commit();
            (0, logger_1.logInfo)('Admin cancelled ride', {
                adminId: adminUser.id,
                adminEmail: adminUser.email,
                rideId: id,
                reason,
            });
            res.status(200).json({
                success: true,
                message: 'Ride cancelled successfully',
                data: {
                    rideId: id,
                    reason,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            (0, logger_1.logError)('Admin cancelRide error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cancel ride',
                code: 'CANCEL_RIDE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async getRideAnalytics(req, res) {
        try {
            const { startDate, endDate, groupBy = 'day', } = req.query;
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();
            const totalRides = await Ride_1.default.count({
                where: {
                    createdAt: { [sequelize_1.Op.between]: [start, end] },
                },
            });
            const ridesByStatus = await Ride_1.default.findAll({
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
            const revenueStats = await database_1.sequelize.query(`
        SELECT 
          SUM(b.total_amount) as total_revenue,
          SUM(b.platform_fee) as platform_revenue,
          COUNT(b.id) as total_bookings,
          AVG(r.price_per_seat) as avg_price_per_seat
        FROM bookings b
        JOIN rides r ON b.ride_id = r.id
        WHERE b.status = 'confirmed'
          AND r.created_at BETWEEN :start AND :end
      `, {
                replacements: { start, end },
                type: database_1.sequelize.QueryTypes.SELECT,
            });
            const topRoutes = await database_1.sequelize.query(`
        SELECT 
          origin_address,
          destination_address,
          COUNT(*) as ride_count,
          AVG(price_per_seat) as avg_price,
          SUM(available_seats) as total_seats_offered
        FROM rides
        WHERE created_at BETWEEN :start AND :end
        GROUP BY origin_address, destination_address
        ORDER BY ride_count DESC
        LIMIT 10
      `, {
                replacements: { start, end },
                type: database_1.sequelize.QueryTypes.SELECT,
            });
            const driverStats = await database_1.sequelize.query(`
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          COUNT(r.id) as total_rides,
          COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_rides,
          AVG(r.price_per_seat) as avg_price,
          SUM(COALESCE(booking_stats.total_bookings, 0)) as total_bookings
        FROM users u
        JOIN rides r ON u.id = r.driver_id
        LEFT JOIN (
          SELECT 
            ride_id,
            COUNT(*) as total_bookings
          FROM bookings
          WHERE status = 'confirmed'
          GROUP BY ride_id
        ) booking_stats ON r.id = booking_stats.ride_id
        WHERE r.created_at BETWEEN :start AND :end
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY total_rides DESC
        LIMIT 10
      `, {
                replacements: { start, end },
                type: database_1.sequelize.QueryTypes.SELECT,
            });
            const trendData = await database_1.sequelize.query(`
        SELECT 
          DATE_TRUNC('${groupBy}', created_at) as period,
          COUNT(*) as rides_created,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as rides_completed,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as rides_cancelled,
          AVG(price_per_seat) as avg_price
        FROM rides
        WHERE created_at BETWEEN :start AND :end
        GROUP BY DATE_TRUNC('${groupBy}', created_at)
        ORDER BY period
      `, {
                replacements: { start, end },
                type: database_1.sequelize.QueryTypes.SELECT,
            });
            res.status(200).json({
                success: true,
                data: {
                    summary: {
                        totalRides,
                        ridesByStatus: ridesByStatus.reduce((acc, curr) => {
                            acc[curr.status] = Number(curr.count);
                            return acc;
                        }, {}),
                        revenue: revenueStats[0] || {},
                        period: { start, end },
                    },
                    topRoutes,
                    driverStats,
                    trendData,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            (0, logger_1.logError)('Admin getRideAnalytics error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve ride analytics',
                code: 'GET_ANALYTICS_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async updateRideStatus(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id } = req.params;
            const { status, reason } = req.body;
            const adminUser = req.user;
            if (!Object.values(types_1.RideStatus).includes(status)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid ride status',
                    code: 'INVALID_STATUS',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const ride = await Ride_1.default.findByPk(id, { transaction });
            if (!ride) {
                res.status(404).json({
                    success: false,
                    error: 'Ride not found',
                    code: 'RIDE_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const oldStatus = ride.status;
            await ride.update({
                status,
            }, { transaction });
            await transaction.commit();
            (0, logger_1.logInfo)('Admin updated ride status', {
                adminId: adminUser.id,
                adminEmail: adminUser.email,
                rideId: id,
                oldStatus,
                newStatus: status,
                reason,
            });
            res.status(200).json({
                success: true,
                message: 'Ride status updated successfully',
                data: {
                    rideId: id,
                    oldStatus,
                    newStatus: status,
                    reason,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            (0, logger_1.logError)('Admin updateRideStatus error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update ride status',
                code: 'UPDATE_STATUS_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    static async getRideBookings(req, res) {
        try {
            const { id } = req.params;
            const { status, page = 1, limit = 50 } = req.query;
            const offset = (Number(page) - 1) * Number(limit);
            const whereClause = { rideId: id };
            if (status && status !== 'all') {
                whereClause.status = status;
            }
            const { rows: bookings, count: total } = await Booking_1.default.findAndCountAll({
                where: whereClause,
                order: [['createdAt', 'DESC']],
                limit: Number(limit),
                offset,
            });
            res.status(200).json({
                success: true,
                data: {
                    bookings: bookings.map(booking => booking.toJSON()),
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
            (0, logger_1.logError)('Admin getRideBookings error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve ride bookings',
                code: 'GET_BOOKINGS_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
}
exports.AdminRideController = AdminRideController;
exports.default = AdminRideController;
//# sourceMappingURL=AdminRideController.js.map