"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const sequelize_1 = require("sequelize");
const Booking_1 = __importDefault(require("../models/Booking"));
const Ride_1 = __importDefault(require("../models/Ride"));
const User_1 = __importDefault(require("../models/User"));
const Vehicle_1 = __importDefault(require("../models/Vehicle"));
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
class NotificationService {
    constructor(io) {
        this.io = null;
        this.connectedUsers = new Map();
        if (io) {
            this.io = io;
            this.setupSocketHandlers();
        }
    }
    setSocketIO(io) {
        this.io = io;
        this.setupSocketHandlers();
    }
    setupSocketHandlers() {
        if (!this.io)
            return;
        this.io.on('connection', (socket) => {
            (0, logger_1.logInfo)('New socket connection', { socketId: socket.id });
            socket.on('authenticate', (data) => {
                try {
                    const { userId } = data;
                    if (!this.connectedUsers.has(userId)) {
                        this.connectedUsers.set(userId, []);
                    }
                    this.connectedUsers.get(userId).push(socket.id);
                    socket.join(`user_${userId}`);
                    (0, logger_1.logInfo)('User authenticated and joined room', { userId, socketId: socket.id });
                    socket.emit('authenticated', { success: true });
                }
                catch (error) {
                    (0, logger_1.logError)('Error authenticating user', error);
                    socket.emit('authenticated', { success: false, error: 'Authentication failed' });
                }
            });
            socket.on('join_booking', (data) => {
                socket.join(`booking_${data.bookingId}`);
                (0, logger_1.logInfo)('Socket joined booking room', { bookingId: data.bookingId, socketId: socket.id });
            });
            socket.on('join_ride', (data) => {
                socket.join(`ride_${data.rideId}`);
                (0, logger_1.logInfo)('Socket joined ride room', { rideId: data.rideId, socketId: socket.id });
            });
            socket.on('disconnect', () => {
                for (const [userId, socketIds] of this.connectedUsers.entries()) {
                    const index = socketIds.indexOf(socket.id);
                    if (index !== -1) {
                        socketIds.splice(index, 1);
                        if (socketIds.length === 0) {
                            this.connectedUsers.delete(userId);
                        }
                        (0, logger_1.logInfo)('User socket disconnected', { userId, socketId: socket.id });
                        break;
                    }
                }
            });
        });
    }
    async sendToUser(userId, notification) {
        try {
            if (!this.io) {
                (0, logger_1.logError)('Socket.io not initialized', new Error('Socket.io server not available'));
                return;
            }
            this.io.to(`user_${userId}`).emit('notification', notification);
            (0, logger_1.logInfo)('Notification sent to user', {
                userId,
                type: notification.type,
                title: notification.title,
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error sending notification to user', error);
        }
    }
    async sendToBooking(bookingId, notification) {
        try {
            if (!this.io) {
                (0, logger_1.logError)('Socket.io not initialized', new Error('Socket.io server not available'));
                return;
            }
            this.io.to(`booking_${bookingId}`).emit('notification', notification);
            (0, logger_1.logInfo)('Notification sent to booking room', {
                bookingId,
                type: notification.type,
                title: notification.title,
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error sending notification to booking', error);
        }
    }
    async sendToRide(rideId, notification) {
        try {
            if (!this.io) {
                (0, logger_1.logError)('Socket.io not initialized', new Error('Socket.io server not available'));
                return;
            }
            this.io.to(`ride_${rideId}`).emit('notification', notification);
            (0, logger_1.logInfo)('Notification sent to ride room', {
                rideId,
                type: notification.type,
                title: notification.title,
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error sending notification to ride', error);
        }
    }
    async notifyBookingStatusChange(bookingId, newStatus, updatedBy) {
        try {
            const booking = await Booking_1.default.findByPk(bookingId, {
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
            if (!booking) {
                (0, logger_1.logError)('Booking not found for status change notification', new Error(`Booking ${bookingId} not found`));
                return;
            }
            const ride = booking.ride;
            const driver = ride.driver;
            const passenger = booking.passenger;
            const notifications = this.createBookingStatusNotifications(booking, newStatus, updatedBy);
            if (driver.id !== updatedBy) {
                await this.sendToUser(driver.id, notifications.driver);
            }
            if (passenger.id !== updatedBy) {
                await this.sendToUser(passenger.id, notifications.passenger);
            }
            await this.sendToBooking(bookingId, {
                type: 'booking_status_change',
                title: 'Booking Status Updated',
                message: `Booking status changed to ${newStatus}`,
                data: {
                    bookingId,
                    newStatus,
                    updatedBy,
                    booking: booking.toJSON(),
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error sending booking status change notification', error);
        }
    }
    async notifyRideStatusChange(rideId, newStatus, updatedBy) {
        try {
            const ride = await Ride_1.default.findByPk(rideId, {
                include: [
                    {
                        model: User_1.default,
                        as: 'driver',
                        attributes: ['id', 'firstName', 'lastName'],
                    },
                    {
                        model: Vehicle_1.default,
                        as: 'vehicle',
                        attributes: ['make', 'model', 'color'],
                    },
                ],
            });
            if (!ride) {
                (0, logger_1.logError)('Ride not found for status change notification', new Error(`Ride ${rideId} not found`));
                return;
            }
            const bookings = await Booking_1.default.findAll({
                where: {
                    rideId,
                    status: { [sequelize_1.Op.in]: [types_1.BookingStatus.CONFIRMED, types_1.BookingStatus.PENDING] },
                },
                include: [
                    {
                        model: User_1.default,
                        as: 'passenger',
                        attributes: ['id', 'firstName', 'lastName'],
                    },
                ],
            });
            const notification = {
                type: 'ride_status_change',
                title: 'Ride Status Updated',
                message: this.getRideStatusMessage(newStatus, ride.driver.firstName),
                data: {
                    rideId,
                    newStatus,
                    updatedBy,
                    ride: ride.toJSON(),
                },
                timestamp: new Date().toISOString(),
            };
            for (const booking of bookings) {
                if (booking.passenger && booking.passenger.id !== updatedBy) {
                    await this.sendToUser(booking.passenger.id, notification);
                }
            }
            await this.sendToRide(rideId, notification);
        }
        catch (error) {
            (0, logger_1.logError)('Error sending ride status change notification', error);
        }
    }
    async notifyNewBookingRequest(bookingId) {
        try {
            const booking = await Booking_1.default.findByPk(bookingId, {
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
            if (!booking) {
                (0, logger_1.logError)('Booking not found for new booking notification', new Error(`Booking ${bookingId} not found`));
                return;
            }
            const driver = booking.ride.driver;
            const passenger = booking.passenger;
            await this.sendToUser(driver.id, {
                type: 'new_booking_request',
                title: 'New Booking Request',
                message: `${passenger.firstName} ${passenger.lastName} wants to book your ride`,
                data: {
                    bookingId,
                    booking: booking.toJSON(),
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            (0, logger_1.logError)('Error sending new booking request notification', error);
        }
    }
    createBookingStatusNotifications(booking, newStatus, updatedBy) {
        const passenger = booking.passenger;
        const driver = booking.ride.driver;
        const notifications = {
            driver: {
                type: 'booking_status_change',
                title: '',
                message: '',
                data: { bookingId: booking.id, newStatus, booking: booking.toJSON() },
                timestamp: new Date().toISOString(),
            },
            passenger: {
                type: 'booking_status_change',
                title: '',
                message: '',
                data: { bookingId: booking.id, newStatus, booking: booking.toJSON() },
                timestamp: new Date().toISOString(),
            },
        };
        switch (newStatus) {
            case types_1.BookingStatus.CONFIRMED:
                notifications.driver.title = 'Booking Confirmed';
                notifications.driver.message = `You confirmed ${passenger.firstName}'s booking`;
                notifications.passenger.title = 'Booking Confirmed!';
                notifications.passenger.message = `${driver.firstName} confirmed your booking`;
                break;
            case types_1.BookingStatus.CANCELLED:
                const canceledBy = updatedBy === driver.id ? driver.firstName : passenger.firstName;
                notifications.driver.title = 'Booking Cancelled';
                notifications.driver.message = `Booking cancelled by ${canceledBy}`;
                notifications.passenger.title = 'Booking Cancelled';
                notifications.passenger.message = `Booking cancelled by ${canceledBy}`;
                break;
            case types_1.BookingStatus.COMPLETED:
                notifications.driver.title = 'Ride Completed';
                notifications.driver.message = `Ride with ${passenger.firstName} completed`;
                notifications.passenger.title = 'Ride Completed';
                notifications.passenger.message = `Your ride with ${driver.firstName} is completed`;
                break;
            default:
                notifications.driver.title = 'Booking Updated';
                notifications.driver.message = `Booking status changed to ${newStatus}`;
                notifications.passenger.title = 'Booking Updated';
                notifications.passenger.message = `Booking status changed to ${newStatus}`;
        }
        return notifications;
    }
    getRideStatusMessage(status, driverName) {
        switch (status) {
            case types_1.RideStatus.CONFIRMED:
                return `${driverName} confirmed the ride`;
            case types_1.RideStatus.IN_PROGRESS:
                return `Your ride with ${driverName} has started`;
            case types_1.RideStatus.COMPLETED:
                return `Your ride with ${driverName} is completed`;
            case types_1.RideStatus.CANCELLED:
                return `${driverName} cancelled the ride`;
            default:
                return `Ride status updated to ${status}`;
        }
    }
    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }
    getUserSocketCount(userId) {
        return this.connectedUsers.get(userId)?.length || 0;
    }
    isUserConnected(userId) {
        return this.connectedUsers.has(userId) && this.connectedUsers.get(userId).length > 0;
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
exports.default = exports.notificationService;
//# sourceMappingURL=NotificationService.js.map