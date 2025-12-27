"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingController = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const Booking_1 = __importDefault(require("../models/Booking"));
const Ride_1 = __importDefault(require("../models/Ride"));
const User_1 = __importDefault(require("../models/User"));
const Vehicle_1 = __importDefault(require("../models/Vehicle"));
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
const PaymentService_1 = require("../services/PaymentService");
const NotificationService_1 = require("../services/NotificationService");
class BookingController {
    async getMyBookings(req, res) {
        try {
            const userId = req.user?.id;
            const { status, type = 'both', page = 1, limit = 20 } = req.query;
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
            let bookings = [];
            if (type === 'passenger' || type === 'both') {
                const passengerBookings = await Booking_1.default.findAll({
                    where: {
                        passengerId: userId,
                        ...whereClause,
                    },
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
                                {
                                    model: Vehicle_1.default,
                                    as: 'vehicle',
                                    attributes: ['id', 'make', 'model', 'year', 'color', 'licensePlate'],
                                },
                            ],
                        },
                    ],
                    order: [['createdAt', 'DESC']],
                    limit: Number(limit),
                    offset,
                });
                bookings = [...bookings, ...passengerBookings.map(b => ({ ...b.toJSON(), userType: 'passenger' }))];
            }
            if (type === 'driver' || type === 'both') {
                const driverBookings = await Booking_1.default.findAll({
                    where: whereClause,
                    include: [
                        {
                            model: Ride_1.default,
                            as: 'ride',
                            where: { driverId: userId },
                            include: [
                                {
                                    model: Vehicle_1.default,
                                    as: 'vehicle',
                                    attributes: ['id', 'make', 'model', 'year', 'color', 'licensePlate'],
                                },
                            ],
                        },
                        {
                            model: User_1.default,
                            as: 'passenger',
                            attributes: ['id', 'firstName', 'lastName', 'phoneNumber', 'profileImage'],
                        },
                    ],
                    order: [['createdAt', 'DESC']],
                    limit: Number(limit),
                    offset,
                });
                bookings = [...bookings, ...driverBookings.map(b => ({ ...b.toJSON(), userType: 'driver' }))];
            }
            bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const paginatedBookings = bookings.slice(0, Number(limit));
            res.json({
                success: true,
                data: {
                    bookings: paginatedBookings,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total: bookings.length,
                        totalPages: Math.ceil(bookings.length / Number(limit)),
                    },
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getMyBookings:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get bookings',
                code: 'GET_BOOKINGS_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getBookingById(req, res) {
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
                return;
            }
            const booking = await Booking_1.default.findByPk(id, {
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
                            {
                                model: Vehicle_1.default,
                                as: 'vehicle',
                                attributes: ['id', 'make', 'model', 'year', 'color', 'licensePlate'],
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
            if (!booking) {
                res.status(404).json({
                    success: false,
                    error: 'Booking not found',
                    code: 'BOOKING_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const hasAccess = booking.passengerId === userId || booking.ride?.driverId === userId;
            if (!hasAccess) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied to this booking',
                    code: 'FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            res.json({
                success: true,
                data: booking,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in getBookingById:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                bookingId: req.params['id'],
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get booking',
                code: 'GET_BOOKING_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async updateBooking(req, res) {
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
            const booking = await Booking_1.default.findByPk(id, {
                include: [
                    {
                        model: Ride_1.default,
                        as: 'ride',
                    },
                ],
                transaction,
            });
            if (!booking) {
                res.status(404).json({
                    success: false,
                    error: 'Booking not found',
                    code: 'BOOKING_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const isPassenger = booking.passengerId === userId;
            const isDriver = booking.ride?.driverId === userId;
            if (!isPassenger && !isDriver) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied to update this booking',
                    code: 'FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if ([types_1.BookingStatus.CANCELLED, types_1.BookingStatus.COMPLETED].includes(booking.status)) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot update cancelled or completed booking',
                    code: 'BOOKING_NOT_UPDATABLE',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const allowedUpdates = {};
            if (isPassenger) {
                if (updateData.pickupAddress !== undefined)
                    allowedUpdates.pickupAddress = updateData.pickupAddress;
                if (updateData.dropoffAddress !== undefined)
                    allowedUpdates.dropoffAddress = updateData.dropoffAddress;
                if (updateData.specialRequests !== undefined)
                    allowedUpdates.specialRequests = updateData.specialRequests;
                if (updateData.seatsBooked !== undefined) {
                    const ride = booking.ride;
                    const existingBookings = await Booking_1.default.sum('seatsBooked', {
                        where: {
                            rideId: ride.id,
                            id: { [sequelize_1.Op.ne]: booking.id },
                            status: { [sequelize_1.Op.in]: [types_1.BookingStatus.PENDING, types_1.BookingStatus.CONFIRMED] },
                        },
                        transaction,
                    });
                    const otherBookedSeats = existingBookings || 0;
                    const availableSeats = ride.availableSeats - otherBookedSeats;
                    if (updateData.seatsBooked > availableSeats) {
                        res.status(400).json({
                            success: false,
                            error: `Only ${availableSeats} seats available`,
                            code: 'INSUFFICIENT_SEATS',
                            timestamp: new Date().toISOString(),
                        });
                        await transaction.rollback();
                        return;
                    }
                    allowedUpdates.seatsBooked = updateData.seatsBooked;
                    allowedUpdates.totalAmount = ride.pricePerSeat * updateData.seatsBooked * 1.05;
                }
            }
            if (isDriver) {
                if (updateData.status !== undefined) {
                    const validDriverUpdates = {
                        [types_1.BookingStatus.PENDING]: [types_1.BookingStatus.CONFIRMED, types_1.BookingStatus.CANCELLED],
                        [types_1.BookingStatus.CONFIRMED]: [types_1.BookingStatus.CANCELLED],
                        [types_1.BookingStatus.CANCELLED]: [],
                        [types_1.BookingStatus.COMPLETED]: [],
                    };
                    if (!validDriverUpdates[booking.status]?.includes(updateData.status)) {
                        res.status(400).json({
                            success: false,
                            error: `Cannot change booking status from ${booking.status} to ${updateData.status}`,
                            code: 'INVALID_STATUS_TRANSITION',
                            timestamp: new Date().toISOString(),
                        });
                        await transaction.rollback();
                        return;
                    }
                    allowedUpdates.status = updateData.status;
                }
            }
            if (Object.keys(allowedUpdates).length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'No valid updates provided',
                    code: 'NO_VALID_UPDATES',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await booking.update(allowedUpdates, { transaction });
            await transaction.commit();
            if (allowedUpdates.status && allowedUpdates.status !== booking.status) {
                await NotificationService_1.notificationService.notifyBookingStatusChange(booking.id, allowedUpdates.status, userId);
            }
            const updatedBooking = await Booking_1.default.findByPk(id, {
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
                            {
                                model: Vehicle_1.default,
                                as: 'vehicle',
                                attributes: ['id', 'make', 'model', 'year', 'color'],
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
            res.json({
                success: true,
                data: updatedBooking,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in updateBooking:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                bookingId: req.params['id'],
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to update booking',
                code: 'BOOKING_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async cancelBooking(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id } = req.params;
            const { reason } = req.body;
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
            const booking = await Booking_1.default.findByPk(id, {
                include: [
                    {
                        model: Ride_1.default,
                        as: 'ride',
                    },
                ],
                transaction,
            });
            if (!booking) {
                res.status(404).json({
                    success: false,
                    error: 'Booking not found',
                    code: 'BOOKING_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const canCancel = booking.passengerId === userId || booking.ride?.driverId === userId;
            if (!canCancel) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied to cancel this booking',
                    code: 'FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (!booking.canCancel) {
                res.status(400).json({
                    success: false,
                    error: 'Booking cannot be cancelled',
                    code: 'BOOKING_NOT_CANCELLABLE',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await booking.update({
                status: types_1.BookingStatus.CANCELLED,
                cancelReason: reason,
            }, { transaction });
            await transaction.commit();
            await NotificationService_1.notificationService.notifyBookingStatusChange(booking.id, types_1.BookingStatus.CANCELLED, userId);
            res.json({
                success: true,
                message: 'Booking cancelled successfully',
                data: booking,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in cancelBooking:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                bookingId: req.params['id'],
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to cancel booking',
                code: 'BOOKING_CANCEL_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async confirmBooking(req, res) {
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
            const booking = await Booking_1.default.findByPk(id, {
                include: [
                    {
                        model: Ride_1.default,
                        as: 'ride',
                    },
                ],
                transaction,
            });
            if (!booking) {
                res.status(404).json({
                    success: false,
                    error: 'Booking not found',
                    code: 'BOOKING_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (booking.ride?.driverId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Only the driver can confirm bookings',
                    code: 'FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (booking.status !== types_1.BookingStatus.PENDING) {
                res.status(400).json({
                    success: false,
                    error: 'Only pending bookings can be confirmed',
                    code: 'BOOKING_NOT_PENDING',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await booking.update({ status: types_1.BookingStatus.CONFIRMED }, { transaction });
            await transaction.commit();
            await NotificationService_1.notificationService.notifyBookingStatusChange(booking.id, types_1.BookingStatus.CONFIRMED, userId);
            const updatedBooking = await Booking_1.default.findByPk(id, {
                include: [
                    {
                        model: Ride_1.default,
                        as: 'ride',
                        include: [
                            {
                                model: Vehicle_1.default,
                                as: 'vehicle',
                                attributes: ['id', 'make', 'model', 'year', 'color'],
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
            res.json({
                success: true,
                message: 'Booking confirmed successfully',
                data: updatedBooking,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in confirmBooking:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                bookingId: req.params['id'],
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to confirm booking',
                code: 'BOOKING_CONFIRM_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async rateBooking(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id } = req.params;
            const { rating, review } = req.body;
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
            const booking = await Booking_1.default.findByPk(id, {
                include: [
                    {
                        model: Ride_1.default,
                        as: 'ride',
                    },
                ],
                transaction,
            });
            if (!booking) {
                res.status(404).json({
                    success: false,
                    error: 'Booking not found',
                    code: 'BOOKING_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (booking.passengerId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Only the passenger can rate this booking',
                    code: 'FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (!booking.canRate) {
                res.status(400).json({
                    success: false,
                    error: 'Booking cannot be rated',
                    code: 'BOOKING_NOT_RATABLE',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await booking.update({
                ratingGiven: rating,
                reviewText: review,
            }, { transaction });
            await transaction.commit();
            const bookingWithRide = await Booking_1.default.findByPk(id, {
                include: [
                    {
                        model: Ride_1.default,
                        as: 'ride',
                        include: [
                            {
                                model: User_1.default,
                                as: 'driver',
                                attributes: ['id', 'firstName', 'lastName'],
                            },
                        ],
                    },
                    {
                        model: User_1.default,
                        as: 'passenger',
                        attributes: ['id', 'firstName', 'lastName'],
                    },
                ],
            });
            if (bookingWithRide?.ride?.driver) {
                await NotificationService_1.notificationService.sendToUser(bookingWithRide.ride.driver.id, {
                    type: 'booking_rated',
                    title: 'New Rating Received',
                    message: `${bookingWithRide.passenger?.firstName} rated your ride ${rating}/5 stars`,
                    data: {
                        bookingId: id,
                        rating,
                        review,
                        passenger: bookingWithRide.passenger,
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            res.json({
                success: true,
                message: 'Booking rated successfully',
                data: booking,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in rateBooking:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                bookingId: req.params['id'],
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to rate booking',
                code: 'BOOKING_RATE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async createPaymentIntent(req, res) {
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
                return;
            }
            const booking = await Booking_1.default.findByPk(id, {
                include: [
                    {
                        model: Ride_1.default,
                        as: 'ride',
                        include: [
                            {
                                model: User_1.default,
                                as: 'driver',
                                attributes: ['id', 'firstName', 'lastName'],
                            },
                        ],
                    },
                    {
                        model: User_1.default,
                        as: 'passenger',
                        attributes: ['id', 'firstName', 'lastName', 'email'],
                    },
                ],
            });
            if (!booking) {
                res.status(404).json({
                    success: false,
                    error: 'Booking not found',
                    code: 'BOOKING_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            if (booking.passengerId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Only the passenger can create payment intent',
                    code: 'FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            if (booking.status !== types_1.BookingStatus.CONFIRMED) {
                res.status(400).json({
                    success: false,
                    error: 'Booking must be confirmed to create payment intent',
                    code: 'BOOKING_NOT_CONFIRMED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            if (booking.paymentIntentId) {
                res.status(400).json({
                    success: false,
                    error: 'Payment intent already created for this booking',
                    code: 'PAYMENT_INTENT_EXISTS',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const paymentData = {
                bookingId: booking.id,
                amount: booking.totalAmount,
                currency: 'usd',
                description: `ARYV ride booking: ${booking.ride?.originAddress} to ${booking.ride?.destinationAddress}`,
            };
            if (booking.passenger?.email) {
                paymentData.receiptEmail = booking.passenger.email;
            }
            const paymentResult = await PaymentService_1.paymentService.createPaymentIntent(paymentData);
            if (!paymentResult.success) {
                res.status(500).json({
                    success: false,
                    error: paymentResult.error || 'Failed to create payment intent',
                    code: 'PAYMENT_SERVICE_ERROR',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            await booking.update({ paymentIntentId: paymentResult.data.id });
            res.json({
                success: true,
                data: paymentResult.data,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error in createPaymentIntent:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                bookingId: req.params['id'],
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to create payment intent',
                code: 'PAYMENT_INTENT_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async confirmPayment(req, res) {
        const transaction = await database_1.sequelize.transaction();
        try {
            const { id } = req.params;
            const { paymentIntentId } = req.body;
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
            const booking = await Booking_1.default.findByPk(id, {
                include: [
                    {
                        model: Ride_1.default,
                        as: 'ride',
                    },
                ],
                transaction,
            });
            if (!booking) {
                res.status(404).json({
                    success: false,
                    error: 'Booking not found',
                    code: 'BOOKING_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (booking.passengerId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Only the passenger can confirm payment',
                    code: 'FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            if (booking.paymentIntentId !== paymentIntentId) {
                res.status(400).json({
                    success: false,
                    error: 'Payment intent ID mismatch',
                    code: 'PAYMENT_INTENT_MISMATCH',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const verificationResult = await PaymentService_1.paymentService.verifyPaymentIntent(paymentIntentId);
            if (!verificationResult.success) {
                res.status(400).json({
                    success: false,
                    error: verificationResult.error || 'Payment verification failed',
                    code: 'PAYMENT_VERIFICATION_FAILED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            const paymentSuccessful = verificationResult.data.status === 'succeeded';
            if (!paymentSuccessful) {
                res.status(400).json({
                    success: false,
                    error: 'Payment verification failed',
                    code: 'PAYMENT_FAILED',
                    timestamp: new Date().toISOString(),
                });
                await transaction.rollback();
                return;
            }
            await booking.update({}, { transaction });
            const ride = booking.ride;
            if (ride && ride.status === 'pending') {
                const otherPendingBookings = await Booking_1.default.count({
                    where: {
                        rideId: ride.id,
                        id: { [sequelize_1.Op.ne]: booking.id },
                        status: types_1.BookingStatus.PENDING,
                    },
                    transaction,
                });
                if (otherPendingBookings === 0) {
                    await ride.update({ status: 'confirmed' }, { transaction });
                }
            }
            await transaction.commit();
            const updatedBooking = await Booking_1.default.findByPk(id, {
                include: [
                    {
                        model: Ride_1.default,
                        as: 'ride',
                        include: [
                            {
                                model: User_1.default,
                                as: 'driver',
                                attributes: ['id', 'firstName', 'lastName', 'phoneNumber'],
                            },
                        ],
                    },
                    {
                        model: User_1.default,
                        as: 'passenger',
                        attributes: ['id', 'firstName', 'lastName'],
                    },
                ],
            });
            res.json({
                success: true,
                message: 'Payment confirmed successfully',
                data: updatedBooking,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            await transaction.rollback();
            console.error(`[${new Date().toISOString()}] Error in confirmPayment:`, {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                bookingId: req.params['id'],
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to confirm payment',
                code: 'PAYMENT_CONFIRM_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
}
exports.BookingController = BookingController;
//# sourceMappingURL=BookingController.js.map