/**
 * @fileoverview Booking controller for handling booking-related operations
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import Booking from '../models/Booking';
import Ride from '../models/Ride';
import User from '../models/User';
import Vehicle from '../models/Vehicle';
import { BookingStatus } from '../types';
import { AuthenticatedRequest } from '../types';
import logger, { getErrorMessage, getErrorStack } from '../utils/logger';
import { paymentService } from '../services/PaymentService';
import { notificationService } from '../services/NotificationService';
import { rideSegmentService } from '../services/RideSegmentService';
import { BOOKING_PLATFORM_FEE_RATE } from '../utils/fees';

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

      const pageNumber = Math.max(1, Number(page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

      // One ordered, counted query for whichever side was asked for. Each
      // side used to be fetched and paged on its own, then merged and cut to
      // one page: with both sides, up to a page of bookings was dropped and
      // never shown, and the total was only ever the size of that page.
      const asPassenger = type === 'passenger' || type === 'both';
      const asDriver = type === 'driver' || type === 'both';
      const roleClause = [
        asPassenger ? 'b.passenger_id = :userId' : '',
        asDriver ? 'r.driver_id = :userId' : '',
      ].filter(Boolean).join(' OR ');
      const statusClause = status ? 'AND b.status::text = :status' : '';
      const from = `FROM bookings b LEFT JOIN rides r ON r.id = b.ride_id WHERE (${roleClause}) ${statusClause}`;
      const replacements = { userId, status: String(status ?? ''), limit: pageSize, offset: (pageNumber - 1) * pageSize };

      const [pageRows, countRows] = await Promise.all([
        sequelize.query<{ id: string }>(
          `SELECT b.id ${from} ORDER BY b.created_at DESC, b.id LIMIT :limit OFFSET :offset`,
          { type: QueryTypes.SELECT, replacements },
        ),
        sequelize.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total ${from}`,
          { type: QueryTypes.SELECT, replacements },
        ),
      ]);
      const ids = pageRows.map((row) => row.id);
      const total = countRows[0]?.total ?? 0;

      const found = ids.length === 0 ? [] : await Booking.findAll({
        where: { id: { [Op.in]: ids } },
        include: [
          {
            model: Ride,
            as: 'ride',
            include: [
              {
                model: User,
                as: 'driver',
                attributes: ['id', 'firstName', 'lastName', 'phone', 'profilePicture'],
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
            attributes: ['id', 'firstName', 'lastName', 'phone', 'profilePicture'],
          },
        ],
      });
      const order = new Map(ids.map((id, index) => [id, index]));
      const bookings = found
        .sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0))
        .map((b) => ({ ...b.toJSON(), userType: b.passengerId === userId && asPassenger ? 'passenger' : 'driver' }));

      res.json({
        success: true,
        data: {
          bookings,
          pagination: {
            page: pageNumber,
            limit: pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getMyBookings', {
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
                attributes: ['id', 'firstName', 'lastName', 'phone', 'profilePicture'],
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
            attributes: ['id', 'firstName', 'lastName', 'phone', 'profilePicture'],
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
      logger.error('Error in getBookingById', {
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
          const seats = Number(updateData.seatsBooked);
          if (!Number.isInteger(seats) || seats < 1) {
            res.status(400).json({
              success: false,
              error: 'Seats must be a whole number of at least 1',
              code: 'INVALID_SEATS',
              timestamp: new Date().toISOString(),
            });
            await transaction.rollback();
            return;
          }

          // Counted and priced as booking does: per leg of this booking's own
          // part of the journey, at that part's fare. It was counted against
          // the whole ride and priced at the full fare, so a passenger riding
          // one leg of a multi-stop ride was charged end to end, and any promo
          // discount on the booking was dropped.
          const stops = await rideSegmentService.getStops(ride as any, transaction);
          const whole = rideSegmentService.wholeJourney(stops);
          const boardingSequence = booking.boardingSequence ?? whole.boardingSequence;
          const alightingSequence = booking.alightingSequence ?? whole.alightingSequence;
          const availability = await rideSegmentService.getSegmentAvailability(
            ride.id,
            ride.availableSeats,
            boardingSequence,
            alightingSequence,
            transaction,
          );
          // This booking's own seats are part of what is taken.
          const availableSeats = availability.available + Number(booking.seatsBooked);

          if (seats > availableSeats) {
            res.status(400).json({
              success: false,
              error: `Only ${availableSeats} seats available`,
              code: 'INSUFFICIENT_SEATS',
              timestamp: new Date().toISOString(),
            });
            await transaction.rollback();
            return;
          }

          const fare = rideSegmentService.fareForSegment(stops, boardingSequence, alightingSequence) * seats;
          const platformFee = fare * BOOKING_PLATFORM_FEE_RATE;
          const discount = Math.min(Number(booking.discountAmount ?? 0), platformFee);

          allowedUpdates.seatsBooked = seats;
          allowedUpdates.platformFee = platformFee;
          allowedUpdates.totalAmount = Math.round((fare + platformFee - discount) * 100) / 100;
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
          // The model refuses a cancellation without a reason, so cancelling
          // through this route failed.
          if (updateData.status === BookingStatus.CANCELLED) {
            allowedUpdates.cancelReason = typeof updateData.reason === 'string' && updateData.reason.trim()
              ? updateData.reason.trim().slice(0, 500)
              : 'Cancelled by the driver';
          }
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

      // Read before the update: afterwards booking.status is already the new
      // one, so the comparison below never held and nobody was notified.
      const previousStatus = booking.status;
      await booking.update(allowedUpdates, { transaction });
      // As confirming through POST /:id/confirm does.
      if (allowedUpdates.status === BookingStatus.CONFIRMED && booking.ride && booking.ride.status === 'pending') {
        await booking.ride.update({ status: 'confirmed' as any }, { transaction });
      }
      await transaction.commit();

      if (allowedUpdates.status && allowedUpdates.status !== previousStatus) {
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
                attributes: ['id', 'firstName', 'lastName', 'phone', 'profilePicture'],
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
            attributes: ['id', 'firstName', 'lastName', 'phone', 'profilePicture'],
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
      logger.error('Error in updateBooking', {
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

      const cancelledByDriver = booking.ride?.driverId === userId;
      const wasPaid = Boolean(booking.paymentIntentId);

      // A paid booking has to give the money back, not just change status.
      // Cancelling used to do neither — it flipped the row to CANCELLED and
      // kept the passenger's payment, with the only refund path being an
      // endpoint anyone could call for any amount. Refunding here is what makes
      // it safe to have closed that endpoint.
      //
      // processRefund owns the cancellation for paid bookings: it cancels and
      // refunds inside one transaction, so the two can never disagree. This
      // transaction is released first so the two do not contend on the row.
      if (wasPaid) {
        await transaction.rollback();

        const refund = await paymentService.processRefund(
          booking.id,
          undefined, // always the full amount — partial refunds are a staff decision
          reason || 'Cancelled by user',
          {
            // A driver cancelling strands the passenger, so they are made whole
            // whether or not the departure time has passed. A passenger
            // cancelling after departure is refused here and told to contact
            // support, which is the anti-fraud case.
            allowAfterDeparture: cancelledByDriver,
            requestedBy: `${cancelledByDriver ? 'driver' : 'passenger'}:${userId}`,
          },
        );

        if (!refund.success) {
          logger.warn('Cancellation refused because the refund could not be issued', {
            bookingId: booking.id,
            userId,
            reason: refund.error,
          });
          res.status(400).json({
            success: false,
            error: refund.error || 'This booking could not be cancelled',
            code: 'BOOKING_REFUND_FAILED',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        await booking.reload();

        await notificationService.notifyBookingStatusChange(
          booking.id,
          BookingStatus.CANCELLED,
          userId,
        );

        res.json({
          success: true,
          message: 'Booking cancelled and payment refunded',
          data: booking,
          refund: refund.data,
          timestamp: new Date().toISOString(),
        });
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
      // The paid-booking path releases this transaction before handing off to
      // processRefund, so by the time an error lands here it may already be
      // finished. Rolling back a finished transaction throws, and that throw
      // would replace the real error with a misleading one.
      if (!(transaction as unknown as { finished?: string }).finished) {
        await transaction.rollback();
      }
      logger.error('Error in cancelBooking', {
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

      // A ride with an accepted passenger is confirmed. Nothing did this but a
      // card payment, and a ride can only be started from confirmed, so a
      // driver with cash passengers could never start (or finish) the ride.
      if (booking.ride && booking.ride.status === 'pending') {
        await booking.ride.update({ status: 'confirmed' as any }, { transaction });
      }
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
            attributes: ['id', 'firstName', 'lastName', 'phone', 'profilePicture'],
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
      logger.error('Error in confirmBooking', {
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

  async rejectBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        await transaction.rollback();
        return;
      }

      const booking = await Booking.findByPk(id, {
        include: [{ model: Ride, as: 'ride' }],
        transaction,
      });

      if (!booking) {
        res.status(404).json({ success: false, error: 'Booking not found', code: 'BOOKING_NOT_FOUND', timestamp: new Date().toISOString() });
        await transaction.rollback();
        return;
      }

      if (booking.ride?.driverId !== userId) {
        res.status(403).json({ success: false, error: 'Only the driver can reject bookings', code: 'FORBIDDEN', timestamp: new Date().toISOString() });
        await transaction.rollback();
        return;
      }

      if (booking.status !== BookingStatus.PENDING) {
        res.status(400).json({ success: false, error: 'Only pending bookings can be rejected', code: 'BOOKING_NOT_PENDING', timestamp: new Date().toISOString() });
        await transaction.rollback();
        return;
      }

      await booking.update({ status: BookingStatus.CANCELLED }, { transaction });

      await transaction.commit();

      await notificationService.notifyBookingStatusChange(booking.id, BookingStatus.CANCELLED, userId);

      res.json({
        success: true,
        message: reason ? `Booking rejected: ${reason}` : 'Booking rejected',
        data: { bookingId: id, status: BookingStatus.CANCELLED },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in rejectBooking', { error: getErrorMessage(error), bookingId: req.params['id'], userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to reject booking', code: 'BOOKING_REJECT_FAILED', timestamp: new Date().toISOString() });
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
      logger.error('Error in rateBooking', {
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

  async ratePassenger(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { rating, review } = req.body as { rating: number; review?: string };
      const userId = req.user?.id;

      if (!userId) {
        await transaction.rollback();
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const booking = await Booking.findByPk(id, {
        include: [{ model: Ride, as: 'ride' }],
        transaction,
      });

      if (!booking) {
        await transaction.rollback();
        res.status(404).json({ success: false, error: 'Booking not found', code: 'BOOKING_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      if (booking.status !== 'completed') {
        await transaction.rollback();
        res.status(400).json({ success: false, error: 'Can only rate passenger on a completed booking', code: 'BOOKING_NOT_RATABLE', timestamp: new Date().toISOString() });
        return;
      }

      // Only the driver of the ride can rate the passenger
      if (booking.ride?.driverId !== userId) {
        await transaction.rollback();
        res.status(403).json({ success: false, error: 'Only the driver can rate the passenger', code: 'FORBIDDEN', timestamp: new Date().toISOString() });
        return;
      }

      if (booking.passengerRatingGiven !== null && booking.passengerRatingGiven !== undefined) {
        await transaction.rollback();
        res.status(409).json({ success: false, error: 'Passenger already rated for this booking', code: 'ALREADY_RATED', timestamp: new Date().toISOString() });
        return;
      }

      await booking.update({ passengerRatingGiven: rating, passengerReviewText: review ?? null }, { transaction });

      // Update passenger's aggregate rating
      const passenger = await User.findByPk(booking.passengerId, { transaction });
      if (passenger) {
        const currentTotal = passenger.totalPassengerRatings ?? 0;
        const currentRating = passenger.passengerRating ?? 5.0;
        const newTotal = currentTotal + 1;
        const newRating = ((currentRating * currentTotal) + rating) / newTotal;
        await passenger.update({ passengerRating: Math.round(newRating * 100) / 100, totalPassengerRatings: newTotal }, { transaction });
      }

      await transaction.commit();

      logger.info('Passenger rated', { bookingId: id, driverId: userId, passengerId: booking.passengerId, rating });

      res.json({ success: true, message: 'Passenger rated successfully', data: { rating, review }, timestamp: new Date().toISOString() });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in ratePassenger', { error: getErrorMessage(error), bookingId: req.params['id'], userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to rate passenger', code: 'RATE_PASSENGER_FAILED', timestamp: new Date().toISOString() });
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
      logger.error('Error in createPaymentIntent', {
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

      // Record that the money arrived. This used to be an empty update with a
      // note about someday tracking payment state, so a verified, settled
      // payment left the booking exactly as it found it — PENDING, and
      // indistinguishable from one nobody had paid for.
      if (booking.status === BookingStatus.PENDING) {
        await booking.update({ status: BookingStatus.CONFIRMED }, { transaction });
      }

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
                attributes: ['id', 'firstName', 'lastName', 'phone'],
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
      logger.error('Error in confirmPayment', {
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
