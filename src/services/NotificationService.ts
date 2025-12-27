/**
 * @fileoverview Notification service for real-time booking and ride updates
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Server as SocketIOServer } from 'socket.io';
import { Op } from 'sequelize';
import Booking from '../models/Booking';
import Ride from '../models/Ride';
import User from '../models/User';
import Vehicle from '../models/Vehicle';
import { BookingStatus, RideStatus } from '../types';
import { logInfo, logError } from '../utils/logger';

export interface NotificationData {
  type: string;
  title: string;
  message: string;
  data?: any;
  timestamp: string;
}

export interface BookingNotification extends NotificationData {
  bookingId: string;
  rideId: string;
  recipientId: string;
}

export interface RideNotification extends NotificationData {
  rideId: string;
  recipientId: string;
}

export class NotificationService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, string[]> = new Map(); // userId -> socketIds[]

  constructor(io?: SocketIOServer) {
    if (io) {
      this.io = io;
      this.setupSocketHandlers();
    }
  }

  setSocketIO(io: SocketIOServer): void {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logInfo('New socket connection', { socketId: socket.id });

      // Handle user authentication
      socket.on('authenticate', (data: { userId: string; token: string }) => {
        try {
          const { userId } = data;

          // Add user to connected users map
          if (!this.connectedUsers.has(userId)) {
            this.connectedUsers.set(userId, []);
          }
          this.connectedUsers.get(userId)!.push(socket.id);

          // Join user-specific room
          socket.join(`user_${userId}`);

          logInfo('User authenticated and joined room', { userId, socketId: socket.id });

          socket.emit('authenticated', { success: true });
        } catch (error) {
          logError('Error authenticating user', error as Error);
          socket.emit('authenticated', { success: false, error: 'Authentication failed' });
        }
      });

      // Handle joining booking room
      socket.on('join_booking', (data: { bookingId: string }) => {
        socket.join(`booking_${data.bookingId}`);
        logInfo('Socket joined booking room', { bookingId: data.bookingId, socketId: socket.id });
      });

      // Handle joining ride room
      socket.on('join_ride', (data: { rideId: string }) => {
        socket.join(`ride_${data.rideId}`);
        logInfo('Socket joined ride room', { rideId: data.rideId, socketId: socket.id });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        // Remove socket from all user connections
        for (const [userId, socketIds] of this.connectedUsers.entries()) {
          const index = socketIds.indexOf(socket.id);
          if (index !== -1) {
            socketIds.splice(index, 1);
            if (socketIds.length === 0) {
              this.connectedUsers.delete(userId);
            }
            logInfo('User socket disconnected', { userId, socketId: socket.id });
            break;
          }
        }
      });
    });
  }

  /**
   * Send notification to a specific user
   */
  async sendToUser(userId: string, notification: NotificationData): Promise<void> {
    try {
      if (!this.io) {
        logError('Socket.io not initialized', new Error('Socket.io server not available'));
        return;
      }

      this.io.to(`user_${userId}`).emit('notification', notification);

      logInfo('Notification sent to user', {
        userId,
        type: notification.type,
        title: notification.title,
      });
    } catch (error) {
      logError('Error sending notification to user', error as Error);
    }
  }

  /**
   * Send notification to all users in a booking
   */
  async sendToBooking(bookingId: string, notification: NotificationData): Promise<void> {
    try {
      if (!this.io) {
        logError('Socket.io not initialized', new Error('Socket.io server not available'));
        return;
      }

      this.io.to(`booking_${bookingId}`).emit('notification', notification);

      logInfo('Notification sent to booking room', {
        bookingId,
        type: notification.type,
        title: notification.title,
      });
    } catch (error) {
      logError('Error sending notification to booking', error as Error);
    }
  }

  /**
   * Send notification to all users in a ride
   */
  async sendToRide(rideId: string, notification: NotificationData): Promise<void> {
    try {
      if (!this.io) {
        logError('Socket.io not initialized', new Error('Socket.io server not available'));
        return;
      }

      this.io.to(`ride_${rideId}`).emit('notification', notification);

      logInfo('Notification sent to ride room', {
        rideId,
        type: notification.type,
        title: notification.title,
      });
    } catch (error) {
      logError('Error sending notification to ride', error as Error);
    }
  }

  /**
   * Notify about booking status change
   */
  async notifyBookingStatusChange(bookingId: string, newStatus: BookingStatus, updatedBy: string): Promise<void> {
    try {
      const booking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: Ride,
            as: 'ride',
            include: [
              {
                model: User,
                as: 'driver',
                attributes: ['id', 'firstName', 'lastName'],
              },
            ],
          },
          {
            model: User,
            as: 'passenger',
            attributes: ['id', 'firstName', 'lastName'],
          },
        ],
      });

      if (!booking) {
        logError('Booking not found for status change notification', new Error(`Booking ${bookingId} not found`));
        return;
      }

      const ride = booking.ride!;
      const driver = ride.driver!;
      const passenger = booking.passenger!;

      // Create notifications for different users
      const notifications = this.createBookingStatusNotifications(booking, newStatus, updatedBy);

      // Send to driver (if not the one who updated)
      if (driver.id !== updatedBy) {
        await this.sendToUser(driver.id, notifications.driver);
      }

      // Send to passenger (if not the one who updated)
      if (passenger.id !== updatedBy) {
        await this.sendToUser(passenger.id, notifications.passenger);
      }

      // Send to booking room
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

    } catch (error) {
      logError('Error sending booking status change notification', error as Error);
    }
  }

  /**
   * Notify about ride status change
   */
  async notifyRideStatusChange(rideId: string, newStatus: RideStatus, updatedBy: string): Promise<void> {
    try {
      const ride = await Ride.findByPk(rideId, {
        include: [
          {
            model: User,
            as: 'driver',
            attributes: ['id', 'firstName', 'lastName'],
          },
          {
            model: Vehicle,
            as: 'vehicle',
            attributes: ['make', 'model', 'color'],
          },
        ],
      });

      if (!ride) {
        logError('Ride not found for status change notification', new Error(`Ride ${rideId} not found`));
        return;
      }

      // Get all passengers for this ride
      const bookings = await Booking.findAll({
        where: {
          rideId,
          status: { [Op.in]: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        },
        include: [
          {
            model: User,
            as: 'passenger',
            attributes: ['id', 'firstName', 'lastName'],
          },
        ],
      });

      const notification: NotificationData = {
        type: 'ride_status_change',
        title: 'Ride Status Updated',
        message: this.getRideStatusMessage(newStatus, ride.driver!.firstName),
        data: {
          rideId,
          newStatus,
          updatedBy,
          ride: ride.toJSON(),
        },
        timestamp: new Date().toISOString(),
      };

      // Send to all passengers
      for (const booking of bookings) {
        if (booking.passenger && booking.passenger.id !== updatedBy) {
          await this.sendToUser(booking.passenger.id, notification);
        }
      }

      // Send to ride room
      await this.sendToRide(rideId, notification);

    } catch (error) {
      logError('Error sending ride status change notification', error as Error);
    }
  }

  /**
   * Notify about new booking request
   */
  async notifyNewBookingRequest(bookingId: string): Promise<void> {
    try {
      const booking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: Ride,
            as: 'ride',
            include: [
              {
                model: User,
                as: 'driver',
                attributes: ['id', 'firstName', 'lastName'],
              },
            ],
          },
          {
            model: User,
            as: 'passenger',
            attributes: ['id', 'firstName', 'lastName'],
          },
        ],
      });

      if (!booking) {
        logError('Booking not found for new booking notification', new Error(`Booking ${bookingId} not found`));
        return;
      }

      const driver = booking.ride!.driver!;
      const passenger = booking.passenger!;

      // Notify driver about new booking request
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

    } catch (error) {
      logError('Error sending new booking request notification', error as Error);
    }
  }

  /**
   * Create status-specific notifications for booking changes
   */
  private createBookingStatusNotifications(booking: any, newStatus: BookingStatus, updatedBy: string) {
    const passenger = booking.passenger;
    const driver = booking.ride.driver;

    const notifications = {
      driver: {
        type: 'booking_status_change',
        title: '',
        message: '',
        data: { bookingId: booking.id, newStatus, booking: booking.toJSON() },
        timestamp: new Date().toISOString(),
      } as NotificationData,
      passenger: {
        type: 'booking_status_change',
        title: '',
        message: '',
        data: { bookingId: booking.id, newStatus, booking: booking.toJSON() },
        timestamp: new Date().toISOString(),
      } as NotificationData,
    };

    switch (newStatus) {
      case BookingStatus.CONFIRMED:
        notifications.driver.title = 'Booking Confirmed';
        notifications.driver.message = `You confirmed ${passenger.firstName}'s booking`;
        notifications.passenger.title = 'Booking Confirmed!';
        notifications.passenger.message = `${driver.firstName} confirmed your booking`;
        break;

      case BookingStatus.CANCELLED:
        const canceledBy = updatedBy === driver.id ? driver.firstName : passenger.firstName;
        notifications.driver.title = 'Booking Cancelled';
        notifications.driver.message = `Booking cancelled by ${canceledBy}`;
        notifications.passenger.title = 'Booking Cancelled';
        notifications.passenger.message = `Booking cancelled by ${canceledBy}`;
        break;

      case BookingStatus.COMPLETED:
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

  /**
   * Get status-specific message for ride changes
   */
  private getRideStatusMessage(status: RideStatus, driverName: string): string {
    switch (status) {
      case RideStatus.CONFIRMED:
        return `${driverName} confirmed the ride`;
      case RideStatus.IN_PROGRESS:
        return `Your ride with ${driverName} has started`;
      case RideStatus.COMPLETED:
        return `Your ride with ${driverName} is completed`;
      case RideStatus.CANCELLED:
        return `${driverName} cancelled the ride`;
      default:
        return `Ride status updated to ${status}`;
    }
  }

  /**
   * Get count of connected users
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get connected socket count for a user
   */
  getUserSocketCount(userId: string): number {
    return this.connectedUsers.get(userId)?.length || 0;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.length > 0;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
