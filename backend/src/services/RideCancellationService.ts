/**
 * @fileoverview Cancelling a ride, with everyone booked on it
 * @author Oabona-Majoko
 * @created 2026-11-10
 * @lastModified 2026-11-10
 *
 * A ride was cancelled in three places (the driver, an admin, an admin
 * blocking the driver) and none of them touched its bookings. Passengers
 * kept a pending or confirmed booking on a ride that would never run, and
 * nobody told them, although the app told the driver they had been.
 */

import { Op, Transaction } from 'sequelize';
import Ride from '../models/Ride';
import Booking from '../models/Booking';
import { BookingStatus, RideStatus } from '../types';
import { notificationService } from './NotificationService';
import { logError } from '../utils/logger';

/** Bookings that still expect the ride to happen. */
const LIVE_BOOKINGS = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

/**
 * Cancel the live bookings on these rides, inside the caller's transaction.
 *
 * @returns the cancelled bookings' ids, to notify once the transaction commits
 */
export const cancelBookingsOnRides = async (
  rideIds: string[],
  reason: string,
  transaction: Transaction,
): Promise<string[]> => {
  if (rideIds.length === 0) return [];
  const bookings = await Booking.findAll({
    where: { rideId: { [Op.in]: rideIds }, status: { [Op.in]: LIVE_BOOKINGS } },
    attributes: ['id'],
    transaction,
  });
  if (bookings.length === 0) return [];
  const ids = bookings.map((b) => b.id);
  await Booking.update(
    { status: BookingStatus.CANCELLED, cancelReason: reason.slice(0, 500) } as any,
    { where: { id: { [Op.in]: ids } }, transaction },
  );
  return ids;
};

/**
 * Tell each passenger their booking was cancelled. After commit: a failed
 * notification must not undo the cancellation.
 */
export const notifyCancelledBookings = async (bookingIds: string[], cancelledBy: string): Promise<void> => {
  for (const id of bookingIds) {
    try {
      await notificationService.notifyBookingStatusChange(id, BookingStatus.CANCELLED, cancelledBy);
    } catch (error) {
      logError('Could not tell a passenger their booking was cancelled', error as Error, { bookingId: id });
    }
  }
};

/**
 * Cancel the driver's upcoming rides (pending or confirmed) and their
 * bookings. Used when an account is blocked.
 *
 * @returns the cancelled bookings' ids, to notify after commit
 */
export const cancelUpcomingRidesOf = async (driverId: string, reason: string, transaction: Transaction): Promise<string[]> => {
  const rides = await Ride.findAll({
    where: { driverId, status: { [Op.in]: [RideStatus.PENDING, RideStatus.CONFIRMED] } },
    attributes: ['id'],
    transaction,
  });
  const rideIds = rides.map((r) => r.id);
  if (rideIds.length === 0) return [];
  await Ride.update({ status: RideStatus.CANCELLED }, { where: { id: { [Op.in]: rideIds } }, transaction });
  return cancelBookingsOnRides(rideIds, reason, transaction);
};
