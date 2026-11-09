/**
 * @fileoverview Face photos from today, exchanged between a booking's
 *               passenger and driver
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 *
 * A profile photo can be months old, so it does not show who is actually
 * getting into the car. The passenger takes a selfie when booking and the
 * driver when accepting.
 *
 * The rules:
 *  - Only the booking's passenger and its ride's driver can add one, each
 *    for their own side, while the booking is pending or confirmed. A retake
 *    replaces the earlier photo.
 *  - Each sees their own photo. The other side's appears only once the
 *    booking is confirmed: a pending request is not yet a trip, and nobody's
 *    face should travel further than the person they will ride with.
 *  - Photos are deleted, files included, a day after the trip ends
 *    (completed or cancelled, or a day past departure in any case), unless a
 *    report between the two or an SOS on the ride is still open. Admins can
 *    see them until then.
 */

import { Op } from 'sequelize';
import type { Response } from 'express';
import path from 'path';
import { fileStorageService } from './FileStorageService';
import Booking from '../models/Booking';
import Ride from '../models/Ride';
import TripPhoto, { TripPhotoRole } from '../models/TripPhoto';
import ContentReport from '../models/ContentReport';
import EmergencyAlert, { EmergencyAlertStatus } from '../models/EmergencyAlert';
import { BookingStatus } from '../types';
import { logInfo, logWarning } from '../utils/logger';

/** How long after the trip ends its photos are kept. */
export const TRIP_PHOTO_RETENTION_MS = 24 * 60 * 60 * 1000;

const UPLOADABLE: ReadonlySet<string> = new Set([BookingStatus.PENDING, BookingStatus.CONFIRMED]);

export class TripPhotoError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export interface TripPhotoSummary {
  role: TripPhotoRole;
  takenAt: string;
}

type BookingWithRide = InstanceType<typeof Booking> & { ride?: InstanceType<typeof Ride> | null };

const otherRole = (role: TripPhotoRole): TripPhotoRole => (role === 'passenger' ? 'driver' : 'passenger');

export class TripPhotoService {
  private async loadBooking(bookingId: string): Promise<BookingWithRide> {
    const booking = await Booking.findByPk(bookingId, {
      include: [{ model: Ride, as: 'ride', attributes: ['id', 'driverId', 'departureTime'] }],
    }) as BookingWithRide | null;
    if (!booking) throw new TripPhotoError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    return booking;
  }

  /** The caller's side of the booking, or a 403 when they have none. */
  private roleOf(booking: BookingWithRide, userId: string): TripPhotoRole {
    if (booking.passengerId === userId) return 'passenger';
    if (booking.ride?.driverId === userId) return 'driver';
    throw new TripPhotoError(403, 'FORBIDDEN', 'Only the passenger and driver of this booking can do this');
  }

  /** Store the caller's photo for their side, replacing any earlier one. */
  async save(bookingId: string, userId: string, image: Buffer, contentType: string): Promise<TripPhotoSummary> {
    const booking = await this.loadBooking(bookingId);
    const role = this.roleOf(booking, userId);
    if (!UPLOADABLE.has(booking.status)) {
      throw new TripPhotoError(409, 'BOOKING_CLOSED', 'This booking is no longer active');
    }

    const extension = contentType === 'image/png' ? '.png' : '.jpg';
    const stored = await fileStorageService.store(image, 'trip-photos', userId, extension, contentType);

    const existing = await TripPhoto.findOne({ where: { bookingId, role } });
    let photo;
    if (existing) {
      const previousKey = existing.storageKey;
      photo = await existing.update({ storageKey: stored.key, userId });
      await fileStorageService.remove(previousKey);
    } else {
      photo = await TripPhoto.create({ bookingId, userId, role, storageKey: stored.key });
    }

    return { role, takenAt: (photo.updatedAt ?? new Date()).toISOString() };
  }

  /**
   * Which photos the caller can see on this booking: always their own, and
   * the other side's once the booking is confirmed.
   */
  async list(bookingId: string, userId: string): Promise<{ myRole: TripPhotoRole; bookingStatus: string; photos: TripPhotoSummary[] }> {
    const booking = await this.loadBooking(bookingId);
    const myRole = this.roleOf(booking, userId);
    const visible = this.visibleRoles(booking, myRole);
    const photos = await TripPhoto.findAll({ where: { bookingId, role: { [Op.in]: visible } } });
    return {
      myRole,
      bookingStatus: booking.status,
      photos: photos.map((p) => ({ role: p.role, takenAt: (p.updatedAt ?? p.createdAt).toISOString() })),
    };
  }

  private visibleRoles(booking: BookingWithRide, myRole: TripPhotoRole): TripPhotoRole[] {
    return booking.status === BookingStatus.CONFIRMED ? [myRole, otherRole(myRole)] : [myRole];
  }

  /**
   * Send one side's photo, if the caller may see it. Admins (`asAdmin`) may
   * see either side for as long as it is kept.
   *
   * @returns false when there is no such photo; nothing has been sent
   */
  async send(res: Response, bookingId: string, role: TripPhotoRole, viewer: { userId?: string; asAdmin?: boolean }): Promise<boolean> {
    const booking = await this.loadBooking(bookingId);
    if (!viewer.asAdmin) {
      const myRole = this.roleOf(booking, viewer.userId ?? '');
      if (!this.visibleRoles(booking, myRole).includes(role)) {
        throw new TripPhotoError(403, 'NOT_YET_SHARED', 'This photo is shared once the booking is confirmed');
      }
    }

    const photo = await TripPhoto.findOne({ where: { bookingId, role } });
    if (!photo) return false;

    const [category, filename] = photo.storageKey.split('/');
    if (category !== 'trip-photos' || !filename) return false;
    res.setHeader('Cache-Control', 'private, no-store');
    return fileStorageService.sendFile(res, 'trip-photos', path.basename(filename));
  }

  /**
   * Delete the photos of trips that ended more than a day ago, except where
   * a report between the two people or an SOS on the ride is still open.
   *
   * @returns how many photos were deleted
   */
  async sweep(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - TRIP_PHOTO_RETENTION_MS);
    const photos = await TripPhoto.findAll({
      include: [{
        model: Booking,
        as: 'booking',
        required: true,
        attributes: ['id', 'status', 'updatedAt', 'passengerId', 'rideId'],
        include: [{ model: Ride, as: 'ride', attributes: ['id', 'driverId', 'departureTime'] }],
      }],
    });

    let deleted = 0;
    for (const photo of photos) {
      const booking = (photo as unknown as { booking?: BookingWithRide }).booking;
      if (!booking) continue;

      const ended = [BookingStatus.COMPLETED, BookingStatus.CANCELLED].includes(booking.status as BookingStatus)
        && booking.updatedAt < cutoff;
      const departure = booking.ride?.departureTime ? new Date(booking.ride.departureTime) : null;
      const longPast = departure !== null && departure < cutoff;
      if (!ended && !longPast) continue;

      if (await this.onHold(booking)) continue;

      await fileStorageService.remove(photo.storageKey);
      await photo.destroy();
      deleted += 1;
    }

    if (deleted > 0) logInfo('Deleted expired trip photos', { count: deleted });
    return deleted;
  }

  /**
   * Erase someone's trip photos when their account is closed, except those
   * under an open report or SOS: deleting the account must not be a way to
   * remove the evidence of what happened on a trip.
   *
   * @returns how many photos were kept because of a hold
   */
  async eraseForUser(userId: string): Promise<number> {
    const photos = await TripPhoto.findAll({
      where: { userId },
      include: [{
        model: Booking,
        as: 'booking',
        attributes: ['id', 'passengerId', 'rideId'],
        include: [{ model: Ride, as: 'ride', attributes: ['id', 'driverId'] }],
      }],
    });

    let kept = 0;
    for (const photo of photos) {
      const booking = (photo as unknown as { booking?: BookingWithRide }).booking;
      if (booking && await this.onHold(booking)) {
        kept += 1;
        continue;
      }
      await fileStorageService.remove(photo.storageKey);
      await photo.destroy();
    }
    return kept;
  }

  /** Whether a report between the two, or an SOS on the ride, is still open. */
  private async onHold(booking: BookingWithRide): Promise<boolean> {
    const passengerId = booking.passengerId;
    const driverId = booking.ride?.driverId;
    try {
      if (driverId) {
        const openReport = await ContentReport.count({
          where: {
            status: 'open',
            [Op.or]: [
              { reporterId: passengerId, reportedUserId: driverId },
              { reporterId: driverId, reportedUserId: passengerId },
            ],
          },
        });
        if (openReport > 0) return true;
      }
      const openAlert = await EmergencyAlert.count({
        where: {
          rideId: booking.rideId,
          status: { [Op.in]: [EmergencyAlertStatus.RAISED, EmergencyAlertStatus.ACKNOWLEDGED] },
        },
      });
      return openAlert > 0;
    } catch (error) {
      // Unsure means keep: a photo deleted under an open report is gone.
      logWarning('Could not check trip photo holds; keeping the photo', {
        bookingId: booking.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return true;
    }
  }
}

export const tripPhotoService = new TripPhotoService();
export default tripPhotoService;
