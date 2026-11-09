/**
 * @fileoverview The PIN a passenger reads to the driver at pickup
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 *
 * The passenger's app shows the PIN for their booking; the driver types what
 * they are told, and the server says whether it matches. The driver can never
 * read it, only check it, and five wrong tries lock the check, so a 4-digit
 * PIN cannot be found by guessing.
 *
 * It used to live only on the passenger's phone, and the driver's phone
 * checked what was typed against its own storage, so it was always "wrong".
 */

import crypto from 'crypto';
import Booking from '../models/Booking';
import Ride from '../models/Ride';
import BookingPin from '../models/BookingPin';
import { BookingStatus } from '../types';

export const MAX_PIN_ATTEMPTS = 5;

export class PickupPinError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

type BookingWithRide = InstanceType<typeof Booking> & { ride?: InstanceType<typeof Ride> | null };

/** Equal without leaking, through timing, how much of a guess was right. */
const samePin = (a: string, b: string): boolean =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export class PickupPinService {
  private async confirmedBooking(bookingId: string): Promise<BookingWithRide> {
    const booking = await Booking.findByPk(bookingId, {
      include: [{ model: Ride, as: 'ride', attributes: ['id', 'driverId'] }],
    }) as BookingWithRide | null;
    if (!booking) throw new PickupPinError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new PickupPinError(409, 'BOOKING_NOT_CONFIRMED', 'The PIN is used once the driver has accepted the booking');
    }
    return booking;
  }

  /** The passenger's PIN for their confirmed booking, made the first time it is asked for. */
  async forPassenger(bookingId: string, userId: string): Promise<{ pin: string; verified: boolean }> {
    const booking = await this.confirmedBooking(bookingId);
    if (booking.passengerId !== userId) {
      throw new PickupPinError(403, 'FORBIDDEN', 'Only the passenger can see this PIN');
    }
    const [row] = await BookingPin.findOrCreate({
      where: { bookingId },
      defaults: { bookingId, pin: String(crypto.randomInt(1000, 10000)) },
    });
    return { pin: row.pin, verified: row.verifiedAt != null };
  }

  /** The driver checks the PIN the passenger read out. */
  async verify(bookingId: string, driverId: string, entered: string): Promise<{ verified: boolean; attemptsLeft: number }> {
    const booking = await this.confirmedBooking(bookingId);
    if (booking.ride?.driverId !== driverId) {
      throw new PickupPinError(403, 'FORBIDDEN', 'Only the driver of this ride can check the PIN');
    }
    const row = await BookingPin.findByPk(bookingId);
    if (!row) {
      // The passenger has not opened their PIN yet, so there is nothing to match.
      throw new PickupPinError(409, 'PIN_NOT_ISSUED', 'Ask the passenger to open their booking to see their PIN');
    }
    if (row.verifiedAt) return { verified: true, attemptsLeft: MAX_PIN_ATTEMPTS - row.failedAttempts };
    if (row.failedAttempts >= MAX_PIN_ATTEMPTS) {
      throw new PickupPinError(423, 'PIN_LOCKED', 'Too many wrong PINs for this booking. Check the passenger against their photo instead.');
    }

    if (samePin(row.pin, String(entered ?? '').trim())) {
      await row.update({ verifiedAt: new Date() });
      return { verified: true, attemptsLeft: MAX_PIN_ATTEMPTS - row.failedAttempts };
    }
    const failed = row.failedAttempts + 1;
    await row.update({ failedAttempts: failed });
    return { verified: false, attemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - failed) };
  }

  /** Which of these bookings have had their PIN checked, for the driver's list. */
  async verifiedAmong(bookingIds: string[]): Promise<Set<string>> {
    if (bookingIds.length === 0) return new Set();
    const rows = await BookingPin.findAll({ where: { bookingId: bookingIds }, attributes: ['bookingId', 'verifiedAt'] });
    return new Set(rows.filter((r) => r.verifiedAt != null).map((r) => r.bookingId));
  }
}

export const pickupPinService = new PickupPinService();
export default pickupPinService;
