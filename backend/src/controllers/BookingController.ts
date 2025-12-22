/**
 * @fileoverview Booking controller for handling booking-related operations
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { Response } from 'express';
import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import Booking from '../models/Booking';
import Ride from '../models/Ride';
import User from '../models/User';
import Vehicle from '../models/Vehicle';
import { BookingStatus } from '../types';
import { AuthenticatedRequest } from '../types';
import { getErrorMessage, getErrorStack } from '../utils/logger';
import { paymentService } from '../services/PaymentService';
import { notificationService } from '../services/NotificationService';

export class BookingController {
  async getMyBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      const whereClause: any = {};

      if (status) {
        whereClause.status = status;
      }

      let bookings: any[] = [];

      if (type === 'passenger' || type === 'both') {
        // Get bookings as passenger
        const passengerBookings = await Booking.findAll({
          where: {
            passengerId: userId,
            ...whereClause,
          },
          include: [
            {
              model: Ride,
              as: 'ride',
              include: [
                {
                  model: User,
                  as: 'driver',
                  attributes: ['id', 'firstName', 'lastName', 'phoneNumber', 'profileImage'],
                },
                {
                  model: Vehicle,
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
        // Get bookings for rides where user is the driver
        const driverBookings = await Booking.findAll({
          where: whereClause,
          include: [
            {
              model: Ride,
              as: 'ride',
              where: { driverId: userId },
              include: [
                {
                  model: Vehicle,
                  as: 'vehicle',
                  attributes: ['id', 'make', 'model', 'year', 'color', 'licensePlate'],
                },
              ],
            },
            {
              model: User,
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

      // Sort by creation date
      bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply pagination to combined results
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
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in getMyBookings:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async getBookingById(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const booking = await Booking.findByPk(id, {
        include: [
          {
            model: Ride,
            as: 'ride',
            include: [
              {
                model: User,
                as: 'driver',
                attributes: ['id', 'firstName', 'lastName', 'phoneNumber', 'profileImage'],
              },
              {
                model: Vehicle,
                as: 'vehicle',
                attributes: ['id', 'make', 'model', 'year', 'color', 'licensePlate'],
              },
            ],
          },
          {
            model: User,
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

      // Check if user has access to this booking
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
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in getBookingById:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async updateBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

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

      const booking = await Booking.findByPk(id, {
        include: [
          {
            model: Ride,
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

      // Check if user has permission to update this booking
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

      // Check if booking can be updated
      if ([BookingStatus.CANCELLED, BookingStatus.COMPLETED].includes(booking.status)) {
        res.status(400).json({
          success: false,
          error: 'Cannot update cancelled or completed booking',
          code: 'BOOKING_NOT_UPDATABLE',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Filter allowed updates based on user role
      const allowedUpdates: any = {};

      if (isPassenger) {
        // Passengers can update pickup/dropoff addresses and special requests
        if (updateData.pickupAddress !== undefined) allowedUpdates.pickupAddress = updateData.pickupAddress;
        if (updateData.dropoffAddress !== undefined) allowedUpdates.dropoffAddress = updateData.dropoffAddress;
        if (updateData.specialRequests !== undefined) allowedUpdates.specialRequests = updateData.specialRequests;

        // Passengers can update seat count if ride allows it
        if (updateData.seatsBooked !== undefined) {
          const ride = booking.ride!;
          const existingBookings = await Booking.sum('seatsBooked', {
            where: {
              rideId: ride.id,
              id: { [Op.ne]: booking.id },
              status: { [Op.in]: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
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
          // Recalculate total amount
          allowedUpdates.totalAmount = ride.pricePerSeat * updateData.seatsBooked * 1.05; // Include platform fee
        }
      }

      if (isDriver) {
        // Drivers can update status (limited transitions)
        if (updateData.status !== undefined) {
          const validDriverUpdates: Record<BookingStatus, BookingStatus[]> = {
            [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
            [BookingStatus.CONFIRMED]: [BookingStatus.CANCELLED],
            [BookingStatus.CANCELLED]: [],
            [BookingStatus.COMPLETED]: [],
          };

          if (!validDriverUpdates[booking.status as BookingStatus]?.includes(updateData.status)) {
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

      // Send real-time notification if status changed
      if (allowedUpdates.status && allowedUpdates.status !== booking.status) {
        await notificationService.notifyBookingStatusChange(
          booking.id,
          allowedUpdates.status,
          userId,
        );
      }

      // Fetch updated booking with associations
      const updatedBooking = await Booking.findByPk(id, {
        include: [
          {
            model: Ride,
            as: 'ride',
            include: [
              {
                model: User,
                as: 'driver',
                attributes: ['id', 'firstName', 'lastName', 'phoneNumber', 'profileImage'],
              },
              {
                model: Vehicle,
                as: 'vehicle',
                attributes: ['id', 'make', 'model', 'year', 'color'],
              },
            ],
          },
          {
            model: User,
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
    } catch (error) {
      await transaction.rollback();
      console.error(`[${new Date().toISOString()}] Error in updateBooking:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async cancelBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

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

      const booking = await Booking.findByPk(id, {
        include: [
          {
            model: Ride,
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

      // Check if user can cancel this booking
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

      // Check if booking can be cancelled
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

      await booking.update(
        {
          status: BookingStatus.CANCELLED,
          cancelReason: reason,
        },
        { transaction },
      );

      await transaction.commit();

      // Send real-time notification
      await notificationService.notifyBookingStatusChange(
        booking.id,
        BookingStatus.CANCELLED,
        userId,
      );

      res.json({
        success: true,
        message: 'Booking cancelled successfully',
        data: booking,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      console.error(`[${new Date().toISOString()}] Error in cancelBooking:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async confirmBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

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

      const booking = await Booking.findByPk(id, {
        include: [
          {
            model: Ride,
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

      // Only the driver can confirm bookings
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

      // Check if booking is in pending status
      if (booking.status !== BookingStatus.PENDING) {
        res.status(400).json({
          success: false,
          error: 'Only pending bookings can be confirmed',
          code: 'BOOKING_NOT_PENDING',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      await booking.update({ status: BookingStatus.CONFIRMED }, { transaction });
      await transaction.commit();

      // Send real-time notification
      await notificationService.notifyBookingStatusChange(
        booking.id,
        BookingStatus.CONFIRMED,
        userId,
      );

      // Fetch updated booking with associations
      const updatedBooking = await Booking.findByPk(id, {
        include: [
          {
            model: Ride,
            as: 'ride',
            include: [
              {
                model: Vehicle,
                as: 'vehicle',
                attributes: ['id', 'make', 'model', 'year', 'color'],
              },
            ],
          },
          {
            model: User,
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
    } catch (error) {
      await transaction.rollback();
      console.error(`[${new Date().toISOString()}] Error in confirmBooking:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async rateBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

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

      const booking = await Booking.findByPk(id, {
        include: [
          {
            model: Ride,
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

      // Only the passenger can rate the booking
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

      // Check if booking can be rated
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

      await booking.update(
        {
          ratingGiven: rating,
          reviewText: review,
        },
        { transaction },
      );

      await transaction.commit();

      // Send notification to driver about new rating
      const bookingWithRide = await Booking.findByPk(id, {
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

      if (bookingWithRide?.ride?.driver) {
        await notificationService.sendToUser(bookingWithRide.ride.driver.id, {
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
    } catch (error) {
      await transaction.rollback();
      console.error(`[${new Date().toISOString()}] Error in rateBooking:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async createPaymentIntent(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const booking = await Booking.findByPk(id, {
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

      // Only the passenger can create payment intent
      if (booking.passengerId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Only the passenger can create payment intent',
          code: 'FORBIDDEN',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check if booking is confirmed
      if (booking.status !== BookingStatus.CONFIRMED) {
        res.status(400).json({
          success: false,
          error: 'Booking must be confirmed to create payment intent',
          code: 'BOOKING_NOT_CONFIRMED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check if payment intent already exists
      if (booking.paymentIntentId) {
        res.status(400).json({
          success: false,
          error: 'Payment intent already created for this booking',
          code: 'PAYMENT_INTENT_EXISTS',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Create payment intent using PaymentService
      const paymentData: any = {
        bookingId: booking.id,
        amount: booking.totalAmount,
        currency: 'usd',
        description: `ARYV ride booking: ${booking.ride?.originAddress} to ${booking.ride?.destinationAddress}`,
      };

      if (booking.passenger?.email) {
        paymentData.receiptEmail = booking.passenger.email;
      }

      const paymentResult = await paymentService.createPaymentIntent(paymentData);

      if (!paymentResult.success) {
        res.status(500).json({
          success: false,
          error: paymentResult.error || 'Failed to create payment intent',
          code: 'PAYMENT_SERVICE_ERROR',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Update booking with payment intent ID
      await booking.update({ paymentIntentId: paymentResult.data.id });

      res.json({
        success: true,
        data: paymentResult.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in createPaymentIntent:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async confirmPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

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

      const booking = await Booking.findByPk(id, {
        include: [
          {
            model: Ride,
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

      // Only the passenger can confirm payment
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

      // Verify payment intent ID matches
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

      // Verify payment using PaymentService
      const verificationResult = await paymentService.verifyPaymentIntent(paymentIntentId);

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

      // Update booking status to indicate payment completed
      await booking.update({
        // paymentIntentId already set during createPaymentIntent
        // Could add a paymentStatus field to track payment completion
      }, { transaction });

      // Update ride status if this was the only pending booking
      const ride = booking.ride;
      if (ride && ride.status === 'pending') {
        const otherPendingBookings = await Booking.count({
          where: {
            rideId: ride.id,
            id: { [Op.ne]: booking.id },
            status: BookingStatus.PENDING,
          },
          transaction,
        });

        if (otherPendingBookings === 0) {
          await ride.update({ status: 'confirmed' as any }, { transaction });
        }
      }

      await transaction.commit();

      // Fetch updated booking with associations
      const updatedBooking = await Booking.findByPk(id, {
        include: [
          {
            model: Ride,
            as: 'ride',
            include: [
              {
                model: User,
                as: 'driver',
                attributes: ['id', 'firstName', 'lastName', 'phoneNumber'],
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

      res.json({
        success: true,
        message: 'Payment confirmed successfully',
        data: updatedBooking,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      console.error(`[${new Date().toISOString()}] Error in confirmPayment:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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
