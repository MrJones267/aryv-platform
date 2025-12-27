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
exports.RideController = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const Ride_1 = __importDefault(require("../models/Ride"));
const Booking_1 = __importDefault(require("../models/Booking"));
const User_1 = __importDefault(require("../models/User"));
const Vehicle_1 = __importDefault(require("../models/Vehicle"));
const types_1 = require("../types");
const AIService_1 = require("../services/AIService");
const NotificationService_1 = require("../services/NotificationService");
const GroupChatService_1 = __importDefault(require("../services/GroupChatService"));
const logger_1 = __importStar(require("../utils/logger"));
class RideController {
    constructor() {
        this.groupChatService = new GroupChatService_1.default();
    }
    async createRide(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { originAddress, originCoordinates, destinationAddress, destinationCoordinates, departureTime, availableSeats, pricePerSeat, vehicleId, description, estimatedDuration, distance, } = req.body;
            const driverId = req.user?.id;
            if (!driverId) {
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
                where: { id: vehicleId, driverId: driverId },
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
            const ride = await Ride_1.default.create({
                driverId,
                vehicleId,
                originAddress,
                originCoordinates: {
                    type: 'Point',
                    coordinates: [originCoordinates.longitude, originCoordinates.latitude],
                },
                destinationAddress,
                destinationCoordinates: {
                    type: 'Point',
                    coordinates: [destinationCoordinates.longitude, destinationCoordinates.latitude],
                },
                departureTime: new Date(departureTime),
                availableSeats,
                pricePerSeat,
                description,
                estimatedDuration,
                distance,
                status: types_1.RideStatus.PENDING,
            }, { transaction });
            await transaction.commit();
            const createdRide = await Ride_1.default.findByPk(ride.id, {
                include: [
                    {
                        model: User_1.default,
                        as: 'driver',
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'profileImage'],
                    },
                    {
                        model: Vehicle_1.default,
                        as: 'vehicle',
                        attributes: ['id', 'make', 'model', 'year', 'color', 'licensePlate'],
                    },
                ],
            });
            res.status(201).json({
                success: true,
                data: createdRide,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in createRide:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to create ride',
                code: 'RIDE_CREATION_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async searchRides(req, res) {
        try {
            const { originLat, originLng, destinationLat, destinationLng, departureDate, radius = 10, seats = 1, maxPrice, page = 1, limit = 20, } = req.query;
            const offset = (Number(page) - 1) * Number(limit);
            const searchDate = new Date(departureDate);
            const searchRadius = Number(radius) * 1000;
            const whereClause = {
                status: {
                    [sequelize_1.Op.in]: [types_1.RideStatus.PENDING, types_1.RideStatus.CONFIRMED],
                },
                availableSeats: {
                    [sequelize_1.Op.gte]: Number(seats),
                },
                departureTime: {
                    [sequelize_1.Op.gte]: searchDate,
                    [sequelize_1.Op.lt]: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000),
                },
            };
            if (maxPrice) {
                whereClause.pricePerSeat = {
                    [sequelize_1.Op.lte]: Number(maxPrice),
                };
            }
            const rides = await Ride_1.default.findAndCountAll({
                where: {
                    ...whereClause,
                    [sequelize_1.Op.and]: [
                        database_1.sequelize.where(database_1.sequelize.fn('ST_DWithin', database_1.sequelize.col('originCoordinates'), database_1.sequelize.fn('ST_GeomFromText', `POINT(${originLng} ${originLat})`, 4326), searchRadius), true),
                        database_1.sequelize.where(database_1.sequelize.fn('ST_DWithin', database_1.sequelize.col('destinationCoordinates'), database_1.sequelize.fn('ST_GeomFromText', `POINT(${destinationLng} ${destinationLat})`, 4326), searchRadius), true),
                    ],
                },
                include: [
                    {
                        model: User_1.default,
                        as: 'driver',
                        attributes: ['id', 'firstName', 'lastName', 'profileImage'],
                    },
                    {
                        model: Vehicle_1.default,
                        as: 'vehicle',
                        attributes: ['id', 'make', 'model', 'year', 'color'],
                    },
                ],
                order: [['departureTime', 'ASC']],
                limit: Number(limit),
                offset,
            });
            const ridesWithDistance = rides.rows.map((ride) => {
                const originDistance = this.calculateDistance(Number(originLat), Number(originLng), ride.originCoordinates.coordinates[1], ride.originCoordinates.coordinates[0]);
                const destinationDistance = this.calculateDistance(Number(destinationLat), Number(destinationLng), ride.destinationCoordinates.coordinates[1], ride.destinationCoordinates.coordinates[0]);
                return {
                    ...ride.toJSON(),
                    originDistance,
                    destinationDistance,
                    totalDistance: originDistance + destinationDistance,
                };
            });
            ridesWithDistance.sort((a, b) => a.totalDistance - b.totalDistance);
            res.json({
                success: true,
                data: {
                    rides: ridesWithDistance,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total: rides.count,
                        totalPages: Math.ceil(rides.count / Number(limit)),
                    },
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in searchRides:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                query: req.query,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to search rides',
                code: 'RIDE_SEARCH_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getRideById(req, res) {
        try {
            const { id } = req.params;
            const ride = await Ride_1.default.findByPk(id, {
                include: [
                    {
                        model: User_1.default,
                        as: 'driver',
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'profileImage'],
                    },
                    {
                        model: Vehicle_1.default,
                        as: 'vehicle',
                        attributes: ['id', 'make', 'model', 'year', 'color', 'licensePlate'],
                    },
                ],
            });
            if (!ride) {
                res.status(404).json({
                    success: false,
                    error: 'Ride not found',
                    code: 'RIDE_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const bookingCount = await Booking_1.default.count({
                where: {
                    rideId: id,
                    status: {
                        [sequelize_1.Op.in]: [types_1.BookingStatus.CONFIRMED, types_1.BookingStatus.PENDING],
                    },
                },
            });
            res.json({
                success: true,
                data: {
                    ...ride.toJSON(),
                    bookedSeats: bookingCount,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getRideById:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                rideId: req.params['id'],
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get ride',
                code: 'GET_RIDE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getUserRides(req, res) {
        try {
            const { userId } = req.params;
            const requesterId = req.user?.id;
            if (userId !== requesterId) {
                res.status(403).json({
                    success: false,
                    error: 'Forbidden: Cannot view other users rides',
                    code: 'FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const driverRides = await Ride_1.default.findAll({
                where: { driverId: userId },
                include: [
                    {
                        model: Vehicle_1.default,
                        as: 'vehicle',
                        attributes: ['id', 'make', 'model', 'year', 'color'],
                    },
                ],
                order: [['departureTime', 'ASC']],
            });
            const passengerRides = await Ride_1.default.findAll({
                include: [
                    {
                        model: User_1.default,
                        as: 'driver',
                        attributes: ['id', 'firstName', 'lastName', 'profileImage'],
                    },
                    {
                        model: Vehicle_1.default,
                        as: 'vehicle',
                        attributes: ['id', 'make', 'model', 'year', 'color'],
                    },
                    {
                        model: Booking_1.default,
                        where: { passengerId: userId },
                        attributes: ['id', 'seatsBooked', 'status', 'totalAmount'],
                    },
                ],
                order: [['departureTime', 'ASC']],
            });
            res.json({
                success: true,
                data: {
                    asDriver: driverRides,
                    asPassenger: passengerRides,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getUserRides:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.params['userId'],
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get user rides',
                code: 'GET_USER_RIDES_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getMyRides(req, res) {
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
            req.params['userId'] = userId;
            await this.getUserRides(req, res);
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getMyRides:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get user rides',
                code: 'GET_MY_RIDES_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async updateRide(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id } = req.params;
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
            if (ride.driverId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Only the driver can update this ride',
                    code: 'FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if ([types_1.RideStatus.IN_PROGRESS, types_1.RideStatus.COMPLETED].includes(ride.status)) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot update ride that is in progress or completed',
                    code: 'RIDE_NOT_UPDATABLE',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (updateData.originCoordinates) {
                updateData.originCoordinates = {
                    type: 'Point',
                    coordinates: [
                        updateData.originCoordinates.longitude,
                        updateData.originCoordinates.latitude,
                    ],
                };
            }
            if (updateData.destinationCoordinates) {
                updateData.destinationCoordinates = {
                    type: 'Point',
                    coordinates: [
                        updateData.destinationCoordinates.longitude,
                        updateData.destinationCoordinates.latitude,
                    ],
                };
            }
            await ride.update(updateData, { transaction });
            await transaction.commit();
            const updatedRide = await Ride_1.default.findByPk(id, {
                include: [
                    {
                        model: User_1.default,
                        as: 'driver',
                        attributes: ['id', 'firstName', 'lastName', 'profileImage'],
                    },
                    {
                        model: Vehicle_1.default,
                        as: 'vehicle',
                        attributes: ['id', 'make', 'model', 'year', 'color'],
                    },
                ],
            });
            res.json({
                success: true,
                data: updatedRide,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in updateRide:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                rideId: req.params['id'],
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to update ride',
                code: 'RIDE_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async deleteRide(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id } = req.params;
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
            if (ride.driverId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Only the driver can delete this ride',
                    code: 'FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const confirmedBookings = await Booking_1.default.count({
                where: {
                    rideId: id,
                    status: types_1.BookingStatus.CONFIRMED,
                },
                transaction,
            });
            if (confirmedBookings > 0) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot delete ride with confirmed bookings',
                    code: 'RIDE_HAS_BOOKINGS',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await Booking_1.default.update({ status: types_1.BookingStatus.CANCELLED, cancelReason: 'Ride cancelled by driver' }, {
                where: {
                    rideId: id,
                    status: types_1.BookingStatus.PENDING,
                },
                transaction,
            });
            await ride.destroy({ transaction });
            await transaction.commit();
            res.json({
                success: true,
                message: 'Ride cancelled successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in deleteRide:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                rideId: req.params['id'],
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to delete ride',
                code: 'RIDE_DELETE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async bookRide(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id: rideId } = req.params;
            const { seatsRequested, pickupAddress, dropoffAddress, specialRequests } = req.body;
            const passengerId = req.user?.id;
            if (!passengerId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const ride = await Ride_1.default.findByPk(rideId, { transaction });
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
            if (ride.driverId === passengerId) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot book your own ride',
                    code: 'CANNOT_BOOK_OWN_RIDE',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (ride.status !== types_1.RideStatus.PENDING && ride.status !== types_1.RideStatus.CONFIRMED) {
                res.status(400).json({
                    success: false,
                    error: 'Ride is not available for booking',
                    code: 'RIDE_NOT_AVAILABLE',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const existingBookings = await Booking_1.default.sum('seatsBooked', {
                where: {
                    rideId,
                    status: {
                        [sequelize_1.Op.in]: [types_1.BookingStatus.PENDING, types_1.BookingStatus.CONFIRMED],
                    },
                },
                transaction,
            });
            const bookedSeats = existingBookings || 0;
            const availableSeats = ride.availableSeats - bookedSeats;
            if (seatsRequested > availableSeats) {
                res.status(400).json({
                    success: false,
                    error: `Only ${availableSeats} seats available`,
                    code: 'INSUFFICIENT_SEATS',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const existingBooking = await Booking_1.default.findOne({
                where: {
                    rideId,
                    passengerId,
                },
                transaction,
            });
            if (existingBooking) {
                res.status(400).json({
                    success: false,
                    error: 'You already have a booking for this ride',
                    code: 'BOOKING_EXISTS',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const totalAmount = ride.pricePerSeat * seatsRequested;
            const platformFee = totalAmount * 0.05;
            const booking = await Booking_1.default.create({
                rideId,
                passengerId,
                seatsBooked: seatsRequested,
                totalAmount: totalAmount + platformFee,
                platformFee,
                pickupAddress,
                dropoffAddress,
                specialRequests,
                status: types_1.BookingStatus.PENDING,
            }, { transaction });
            await transaction.commit();
            await NotificationService_1.notificationService.notifyNewBookingRequest(booking.id);
            const createdBooking = await Booking_1.default.findByPk(booking.id, {
                include: [
                    {
                        model: Ride_1.default,
                        as: 'ride',
                        include: [
                            {
                                model: User_1.default,
                                as: 'driver',
                                attributes: ['id', 'firstName', 'lastName', 'phoneNumber', 'profileImage'],
                            },
                        ],
                    },
                    {
                        model: User_1.default,
                        as: 'passenger',
                        attributes: ['id', 'firstName', 'lastName', 'phoneNumber', 'profileImage'],
                    },
                ],
            });
            res.status(201).json({
                success: true,
                data: createdBooking,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in bookRide:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                rideId: req.params['id'],
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to book ride',
                code: 'BOOKING_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getRideBookings(req, res) {
        try {
            const { id: rideId } = req.params;
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
            const ride = await Ride_1.default.findByPk(rideId);
            if (!ride) {
                res.status(404).json({
                    success: false,
                    error: 'Ride not found',
                    code: 'RIDE_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            if (ride.driverId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Only the driver can view ride bookings',
                    code: 'FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const bookings = await Booking_1.default.findAll({
                where: { rideId },
                include: [
                    {
                        model: User_1.default,
                        as: 'passenger',
                        attributes: ['id', 'firstName', 'lastName', 'phoneNumber', 'profileImage'],
                    },
                ],
                order: [['createdAt', 'ASC']],
            });
            res.json({
                success: true,
                data: bookings,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getRideBookings:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                rideId: req.params['id'],
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get ride bookings',
                code: 'GET_BOOKINGS_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async updateRideStatus(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id: rideId } = req.params;
            const { status } = req.body;
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
            const ride = await Ride_1.default.findByPk(rideId, { transaction });
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
            if (ride.driverId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Only the driver can update ride status',
                    code: 'FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const validTransitions = {
                [types_1.RideStatus.PENDING]: [types_1.RideStatus.CONFIRMED, types_1.RideStatus.CANCELLED],
                [types_1.RideStatus.CONFIRMED]: [types_1.RideStatus.IN_PROGRESS, types_1.RideStatus.CANCELLED],
                [types_1.RideStatus.IN_PROGRESS]: [types_1.RideStatus.COMPLETED],
                [types_1.RideStatus.COMPLETED]: [],
                [types_1.RideStatus.CANCELLED]: [],
            };
            if (!validTransitions[ride.status].includes(status)) {
                res.status(400).json({
                    success: false,
                    error: `Cannot change status from ${ride.status} to ${status}`,
                    code: 'INVALID_STATUS_TRANSITION',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await ride.update({ status }, { transaction });
            if (status === types_1.RideStatus.COMPLETED) {
                await Booking_1.default.update({ status: types_1.BookingStatus.COMPLETED }, {
                    where: {
                        rideId,
                        status: types_1.BookingStatus.CONFIRMED,
                    },
                    transaction,
                });
                await transaction.commit();
                try {
                    await this.groupChatService.handleRideCompletion(rideId);
                    logger_1.default.info('Successfully processed ride group completion', { rideId });
                }
                catch (error) {
                    logger_1.default.error('Error processing ride group completion:', { rideId, error });
                }
            }
            else {
                await transaction.commit();
            }
            res.json({
                success: true,
                data: { ...ride.toJSON(), status },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in updateRideStatus:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                rideId: req.params['id'],
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to update ride status',
                code: 'STATUS_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance;
    }
    deg2rad(deg) {
        return deg * (Math.PI / 180);
    }
    async findRideMatches(req, res) {
        try {
            const { originAddress, originCoordinates, destinationAddress, destinationCoordinates, departureTime, preferences = {}, } = req.body;
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
            logger_1.default.info('AI ride matching request', {
                userId,
                origin: originCoordinates,
                destination: destinationCoordinates,
                departureTime,
            });
            const aiResult = await AIService_1.aiService.findRideMatches({
                origin: {
                    latitude: originCoordinates.latitude,
                    longitude: originCoordinates.longitude,
                },
                destination: {
                    latitude: destinationCoordinates.latitude,
                    longitude: destinationCoordinates.longitude,
                },
                departure_time: departureTime,
                preferences: {
                    max_distance: preferences.maxDistance || 10,
                    max_time_difference: preferences.maxTimeDifference || 2,
                    max_price: preferences.maxPrice,
                    vehicle_preferences: preferences.vehiclePreferences || {},
                    seats_needed: preferences.seatsNeeded || 1,
                },
            });
            if (!aiResult.success) {
                logger_1.default.warn('AI ride matching failed', { error: aiResult.error, userId });
                res.status(500).json({
                    success: false,
                    error: aiResult.error || 'AI matching service unavailable',
                    code: 'AI_MATCHING_FAILED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            res.json({
                success: true,
                data: {
                    matches: aiResult.data?.matches || [],
                    total_matches: aiResult.data?.total_matches || 0,
                    search_params: {
                        origin: { address: originAddress, coordinates: originCoordinates },
                        destination: { address: destinationAddress, coordinates: destinationCoordinates },
                        departure_time: departureTime,
                    },
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in findRideMatches', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                body: req.body,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to find ride matches',
                code: 'FIND_MATCHES_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async calculateDynamicPrice(req, res) {
        try {
            const { originCoordinates, destinationCoordinates, departureTime, distance, estimatedDuration, marketConditions = {}, } = req.body;
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
            logger_1.default.info('AI pricing calculation request', {
                userId,
                origin: originCoordinates,
                destination: destinationCoordinates,
                distance,
                departureTime,
            });
            const aiResult = await AIService_1.aiService.calculateDynamicPrice({
                ride_data: {
                    origin: {
                        latitude: originCoordinates.latitude,
                        longitude: originCoordinates.longitude,
                    },
                    destination: {
                        latitude: destinationCoordinates.latitude,
                        longitude: destinationCoordinates.longitude,
                    },
                    departure_time: departureTime,
                    distance_km: distance || this.calculateDistance(originCoordinates.latitude, originCoordinates.longitude, destinationCoordinates.latitude, destinationCoordinates.longitude),
                    estimated_duration_minutes: estimatedDuration || ((distance || 10) * 2),
                },
                market_conditions: marketConditions,
            });
            if (!aiResult.success) {
                logger_1.default.warn('AI pricing calculation failed', { error: aiResult.error, userId });
                res.status(500).json({
                    success: false,
                    error: aiResult.error || 'AI pricing service unavailable',
                    code: 'AI_PRICING_FAILED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            res.json({
                success: true,
                data: aiResult.data,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in calculateDynamicPrice', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                body: req.body,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to calculate dynamic price',
                code: 'PRICING_CALCULATION_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async optimizeRoute(req, res) {
        try {
            const { waypoints, constraints = {} } = req.body;
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
            if (!waypoints || waypoints.length < 2) {
                res.status(400).json({
                    success: false,
                    error: 'At least 2 waypoints required for route optimization',
                    code: 'INSUFFICIENT_WAYPOINTS',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            logger_1.default.info('AI route optimization request', {
                userId,
                waypointCount: waypoints.length,
                constraints,
            });
            const aiResult = await AIService_1.aiService.optimizeRoute({
                waypoints,
                constraints: {
                    max_passengers: constraints.maxPassengers || 4,
                    max_detour_factor: constraints.maxDetourFactor || 1.5,
                },
            });
            if (!aiResult.success) {
                logger_1.default.warn('AI route optimization failed', { error: aiResult.error, userId });
                res.status(500).json({
                    success: false,
                    error: aiResult.error || 'AI route optimization service unavailable',
                    code: 'AI_ROUTE_OPTIMIZATION_FAILED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            res.json({
                success: true,
                data: aiResult.data,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in optimizeRoute', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                body: req.body,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to optimize route',
                code: 'ROUTE_OPTIMIZATION_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async predictDemand(req, res) {
        try {
            const { location, timeRange } = req.body;
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
            if (!location || !timeRange) {
                res.status(400).json({
                    success: false,
                    error: 'Location and time range are required',
                    code: 'MISSING_REQUIRED_PARAMETERS',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            logger_1.default.info('AI demand prediction request', {
                userId,
                location,
                timeRange,
            });
            const aiResult = await AIService_1.aiService.predictDemand({
                location: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                },
                time_range: {
                    start: timeRange.start,
                    end: timeRange.end,
                },
            });
            if (!aiResult.success) {
                logger_1.default.warn('AI demand prediction failed', { error: aiResult.error, userId });
                res.status(500).json({
                    success: false,
                    error: aiResult.error || 'AI demand prediction service unavailable',
                    code: 'AI_DEMAND_PREDICTION_FAILED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            res.json({
                success: true,
                data: aiResult.data,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in predictDemand', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                body: req.body,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to predict demand',
                code: 'DEMAND_PREDICTION_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getRideRecommendations(req, res) {
        try {
            const { originCoordinates, destinationCoordinates, departureTime, userPreferences = {}, } = req.body;
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
            logger_1.default.info('AI ride recommendations request', {
                userId,
                origin: originCoordinates,
                destination: destinationCoordinates,
                departureTime,
            });
            const aiResult = await AIService_1.aiService.getRideRecommendations({ latitude: originCoordinates.latitude, longitude: originCoordinates.longitude }, { latitude: destinationCoordinates.latitude, longitude: destinationCoordinates.longitude }, departureTime, userPreferences);
            if (!aiResult.success) {
                logger_1.default.warn('AI ride recommendations failed', { error: aiResult.error, userId });
                res.status(500).json({
                    success: false,
                    error: aiResult.error || 'AI recommendations service unavailable',
                    code: 'AI_RECOMMENDATIONS_FAILED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            res.json({
                success: true,
                data: aiResult.data,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in getRideRecommendations', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                body: req.body,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get ride recommendations',
                code: 'RECOMMENDATIONS_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
}
exports.RideController = RideController;
//# sourceMappingURL=RideController.js.map