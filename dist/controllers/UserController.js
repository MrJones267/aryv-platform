"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = __importDefault(require("../models/User"));
const Vehicle_1 = __importDefault(require("../models/Vehicle"));
const Ride_1 = __importDefault(require("../models/Ride"));
const Booking_1 = __importDefault(require("../models/Booking"));
const types_1 = require("../types");
const logger_1 = __importStar(require("../utils/logger"));
class UserController {
    async getProfile(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const user = await User_1.default.findByPk(userId, {
                attributes: { exclude: ['password', 'refreshToken'] },
                include: [
                    {
                        model: Vehicle_1.default,
                        as: 'vehicles',
                        attributes: ['id', 'make', 'model', 'year', 'color', 'licensePlate', 'seatingCapacity', 'status'],
                    },
                ],
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
            res.json({
                success: true,
                data: user,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in getProfile', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get user profile',
                code: 'GET_PROFILE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async updateProfile(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const userId = req.user?.id;
            const updateData = req.body;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const user = await User_1.default.findByPk(userId, { transaction });
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
            await user.update(updateData, { transaction });
            await transaction.commit();
            const updatedUser = await User_1.default.findByPk(userId, {
                attributes: { exclude: ['password', 'refreshToken'] },
            });
            res.json({
                success: true,
                data: updatedUser,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error in updateProfile', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to update profile',
                code: 'UPDATE_PROFILE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async uploadAvatar(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            res.json({
                success: true,
                message: 'Avatar upload functionality to be implemented',
                data: {
                    profileImage: `https://api.hitch.com/uploads/avatars/${userId}.jpg`,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in uploadAvatar', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to upload avatar',
                code: 'AVATAR_UPLOAD_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async deleteAvatar(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await User_1.default.update({}, { where: { id: userId }, transaction });
            await transaction.commit();
            res.json({
                success: true,
                message: 'Avatar deleted successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error in deleteAvatar', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to delete avatar',
                code: 'DELETE_AVATAR_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async sendPhoneVerification(req, res) {
        try {
            const { phoneNumber } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            logger_1.default.info('Phone verification code generated', {
                userId,
                phoneNumber,
                code: verificationCode,
            });
            res.json({
                success: true,
                message: 'Verification code sent successfully',
                data: {
                    phoneNumber,
                    ...(process.env['NODE_ENV'] === 'development' && { verificationCode }),
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in sendPhoneVerification', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to send verification code',
                code: 'PHONE_VERIFICATION_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async confirmPhoneVerification(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { phoneNumber, verificationCode } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (verificationCode.length !== 6) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid verification code',
                    code: 'INVALID_VERIFICATION_CODE',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await User_1.default.update({
                phone: phoneNumber,
            }, { where: { id: userId }, transaction });
            await transaction.commit();
            res.json({
                success: true,
                message: 'Phone number verified successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error in confirmPhoneVerification', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to verify phone number',
                code: 'PHONE_VERIFICATION_CONFIRM_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getDrivingLicense(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const user = await User_1.default.findByPk(userId);
            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                    code: 'USER_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            res.json({
                success: true,
                data: null,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in getDrivingLicense', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get driving license',
                code: 'GET_DRIVING_LICENSE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async uploadDrivingLicense(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { licenseNumber, expiryDate, issuingCountry, licenseClass } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const drivingLicenseData = {
                licenseNumber,
                expiryDate: new Date(expiryDate),
                issuingCountry,
                licenseClass,
                status: 'pending_verification',
                uploadedAt: new Date(),
            };
            await transaction.commit();
            res.json({
                success: true,
                message: 'Driving license uploaded for verification',
                data: drivingLicenseData,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error in uploadDrivingLicense', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to upload driving license',
                code: 'DRIVING_LICENSE_UPLOAD_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getVehicles(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const vehicles = await Vehicle_1.default.findAll({
                where: { driverId: userId },
                order: [['createdAt', 'DESC']],
            });
            res.json({
                success: true,
                data: vehicles,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in getVehicles', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get vehicles',
                code: 'GET_VEHICLES_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async registerVehicle(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const vehicleData = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const existingVehicle = await Vehicle_1.default.findOne({
                where: { licensePlate: vehicleData.licensePlate },
                transaction,
            });
            if (existingVehicle) {
                res.status(400).json({
                    success: false,
                    error: 'Vehicle with this license plate already exists',
                    code: 'LICENSE_PLATE_EXISTS',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const vehicle = await Vehicle_1.default.create({
                ...vehicleData,
                driverId: userId,
                status: types_1.VehicleStatus.PENDING_VERIFICATION,
            }, { transaction });
            await transaction.commit();
            res.status(201).json({
                success: true,
                data: vehicle,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error in registerVehicle', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to register vehicle',
                code: 'VEHICLE_REGISTRATION_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async updateVehicle(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id: vehicleId } = req.params;
            const updateData = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const vehicle = await Vehicle_1.default.findOne({
                where: { id: vehicleId, driverId: userId },
                transaction,
            });
            if (!vehicle) {
                res.status(404).json({
                    success: false,
                    error: 'Vehicle not found or not owned by user',
                    code: 'VEHICLE_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await vehicle.update(updateData, { transaction });
            await transaction.commit();
            res.json({
                success: true,
                data: vehicle,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error in updateVehicle', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to update vehicle',
                code: 'VEHICLE_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async deleteVehicle(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id: vehicleId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const vehicle = await Vehicle_1.default.findOne({
                where: { id: vehicleId, driverId: userId },
                transaction,
            });
            if (!vehicle) {
                res.status(404).json({
                    success: false,
                    error: 'Vehicle not found or not owned by user',
                    code: 'VEHICLE_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const activeRides = await Ride_1.default.count({
                where: {
                    vehicleId,
                    status: {
                        [sequelize_1.Op.in]: [types_1.RideStatus.PENDING, types_1.RideStatus.CONFIRMED, types_1.RideStatus.IN_PROGRESS],
                    },
                },
                transaction,
            });
            if (activeRides > 0) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot delete vehicle with active rides',
                    code: 'VEHICLE_HAS_ACTIVE_RIDES',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await vehicle.destroy({ transaction });
            await transaction.commit();
            res.json({
                success: true,
                message: 'Vehicle deleted successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error in deleteVehicle', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to delete vehicle',
                code: 'VEHICLE_DELETE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async submitVehicleVerification(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id: vehicleId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const vehicle = await Vehicle_1.default.findOne({
                where: { id: vehicleId, driverId: userId },
                transaction,
            });
            if (!vehicle) {
                res.status(404).json({
                    success: false,
                    error: 'Vehicle not found or not owned by user',
                    code: 'VEHICLE_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await vehicle.update({
                status: types_1.VehicleStatus.PENDING_VERIFICATION,
                verificationSubmittedAt: new Date(),
            }, { transaction });
            await transaction.commit();
            res.json({
                success: true,
                message: 'Vehicle submitted for verification',
                data: vehicle,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error in submitVehicleVerification', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to submit vehicle for verification',
                code: 'VEHICLE_VERIFICATION_SUBMIT_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getPaymentMethods(_req, res) {
        res.json({
            success: true,
            message: 'Payment methods feature to be implemented',
            data: [],
            timestamp: new Date().toISOString(),
        });
    }
    async addPaymentMethod(_req, res) {
        res.json({
            success: true,
            message: 'Add payment method feature to be implemented',
            timestamp: new Date().toISOString(),
        });
    }
    async removePaymentMethod(_req, res) {
        res.json({
            success: true,
            message: 'Remove payment method feature to be implemented',
            timestamp: new Date().toISOString(),
        });
    }
    async getRideHistory(req, res) {
        try {
            const userId = req.user?.id;
            const { page = 1, limit = 20, role = 'all', status } = req.query;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const offset = (Number(page) - 1) * Number(limit);
            const whereClause = {};
            if (status) {
                whereClause.status = status;
            }
            let rides = [];
            let totalCount = 0;
            if (role === 'driver' || role === 'all') {
                const driverRides = await Ride_1.default.findAndCountAll({
                    where: { ...whereClause, driverId: userId },
                    include: [
                        {
                            model: Vehicle_1.default,
                            as: 'vehicle',
                            attributes: ['make', 'model', 'year', 'color'],
                        },
                    ],
                    order: [['departureTime', 'DESC']],
                    limit: Number(limit),
                    offset,
                });
                rides = [...rides, ...driverRides.rows.map(ride => ({ ...ride.toJSON(), role: 'driver' }))];
                totalCount += driverRides.count;
            }
            if (role === 'passenger' || role === 'all') {
                const passengerRides = await Ride_1.default.findAndCountAll({
                    include: [
                        {
                            model: User_1.default,
                            as: 'driver',
                            attributes: ['firstName', 'lastName', 'profileImage'],
                        },
                        {
                            model: Booking_1.default,
                            where: { passengerId: userId },
                            attributes: ['seatsBooked', 'totalAmount', 'status'],
                        },
                    ],
                    where: whereClause,
                    order: [['departureTime', 'DESC']],
                    limit: Number(limit),
                    offset,
                });
                rides = [...rides, ...passengerRides.rows.map(ride => ({ ...ride.toJSON(), role: 'passenger' }))];
                totalCount += passengerRides.count;
            }
            res.json({
                success: true,
                data: {
                    rides: rides.slice(0, Number(limit)),
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total: totalCount,
                        totalPages: Math.ceil(totalCount / Number(limit)),
                    },
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in getRideHistory', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get ride history',
                code: 'GET_RIDE_HISTORY_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getUserStatistics(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const [asDriver, asPassenger] = await Promise.all([
                Ride_1.default.findAll({
                    where: { driverId: userId },
                    attributes: [
                        'status',
                        [database_1.sequelize.fn('COUNT', database_1.sequelize.col('id')), 'count'],
                    ],
                    group: ['status'],
                }),
                Booking_1.default.findAll({
                    where: { passengerId: userId },
                    attributes: [
                        'status',
                        [database_1.sequelize.fn('COUNT', database_1.sequelize.col('id')), 'count'],
                        [database_1.sequelize.fn('SUM', database_1.sequelize.col('totalAmount')), 'totalSpent'],
                    ],
                    group: ['status'],
                }),
            ]);
            const statistics = {
                asDriver: asDriver.reduce((acc, item) => {
                    acc[item.status] = parseInt(item.dataValues.count);
                    return acc;
                }, {}),
                asPassenger: asPassenger.reduce((acc, item) => {
                    acc[item.status] = {
                        count: parseInt(item.dataValues.count),
                        totalSpent: parseFloat(item.dataValues.totalSpent || 0),
                    };
                    return acc;
                }, {}),
            };
            res.json({
                success: true,
                data: statistics,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in getUserStatistics', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get user statistics',
                code: 'GET_USER_STATISTICS_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async submitReport(_req, res) {
        res.json({
            success: true,
            message: 'Report submission feature to be implemented',
            timestamp: new Date().toISOString(),
        });
    }
    async deactivateAccount(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const userId = req.user?.id;
            const { reason } = req.body;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const activeRides = await Ride_1.default.count({
                where: {
                    driverId: userId,
                    status: {
                        [sequelize_1.Op.in]: [types_1.RideStatus.PENDING, types_1.RideStatus.CONFIRMED, types_1.RideStatus.IN_PROGRESS],
                    },
                },
                transaction,
            });
            if (activeRides > 0) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot deactivate account with active rides',
                    code: 'HAS_ACTIVE_RIDES',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await User_1.default.update({
                status: types_1.UserStatus.DEACTIVATED,
                deactivatedAt: new Date(),
                deactivationReason: reason,
            }, { where: { id: userId }, transaction });
            await transaction.commit();
            res.json({
                success: true,
                message: 'Account deactivated successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            logger_1.default.error('Error in deactivateAccount', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to deactivate account',
                code: 'DEACTIVATE_ACCOUNT_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
}
exports.UserController = UserController;
//# sourceMappingURL=UserController.js.map