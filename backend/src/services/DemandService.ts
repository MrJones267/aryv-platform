/**
 * @fileoverview Where and when people are actually travelling.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * The app's demand figures came from a service that proxied to a Python model
 * at AI_SERVICE_URL — localhost:5001 by default, and nothing is deployed there
 * — so every call failed to its fallback, which returned the constant 10 with
 * a confidence of 0.3. The router exposing it was never mounted in the first
 * place, so the endpoints did not exist either.
 *
 * Demand does not need a model here. It is a question the database can answer
 * directly: how many seats are people looking for near this place, against how
 * many are being offered. That is a real ratio a driver can act on, and it is
 * the same for everyone who asks.
 */

import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import Ride from '../models/Ride';
import Booking from '../models/Booking';
import { RideStatus, BookingStatus } from '../types';
import { logWarning } from '../utils/logger';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DemandSnapshot {
  /** Seats being offered on upcoming rides from near here. */
  seatsOffered: number;
  /** Seats already taken on those rides. */
  seatsTaken: number;
  /**
   * Taken as a share of offered, 0 to 1. Null when nothing is on offer, which
   * is not the same as a full vehicle.
   */
  occupancy: number | null;
  /** How the platform reads that, in words a driver can act on. */
  level: 'quiet' | 'steady' | 'busy' | 'very_busy' | 'unknown';
  ridesConsidered: number;
  /**
   * Bookings by hour of day over recent history, 0–23. Shows a driver when
   * people on this route actually travel.
   */
  hourlyBookings: number[];
  radiusKm: number;
  generatedAt: string;
}

/** How far around the point counts as "here". */
const DEFAULT_RADIUS_METRES = 25000;

/** Upcoming rides within this window count towards current demand. */
const LOOKAHEAD_HOURS = 24;

/** How far back the hour-of-day pattern is drawn from. */
const PATTERN_DAYS = 60;

/**
 * Below this many rides the occupancy figure is too easily swung by one
 * booking to be worth reporting as a demand level.
 */
const MIN_RIDES_FOR_LEVEL = 3;

export class DemandService {
  /**
   * A reading of demand near a point.
   *
   * Everything here is counted from real rides and real bookings, so two
   * drivers asking at the same moment see the same answer.
   */
  async getSnapshot(
    location: Coordinates,
    options: { radiusMetres?: number } = {},
  ): Promise<DemandSnapshot> {
    const radiusMetres = options.radiusMetres ?? DEFAULT_RADIUS_METRES;

    const empty: DemandSnapshot = {
      seatsOffered: 0,
      seatsTaken: 0,
      occupancy: null,
      level: 'unknown',
      ridesConsidered: 0,
      hourlyBookings: new Array(24).fill(0),
      radiusKm: Math.round(radiusMetres / 1000),
      generatedAt: new Date().toISOString(),
    };

    try {
      const until = new Date(Date.now() + LOOKAHEAD_HOURS * 60 * 60 * 1000);

      // Measured on geography, in metres: on plain 4326 geometry the unit is
      // degrees. And the column by its stored name, which col() needs.
      const nearHere = sequelize.where(
        sequelize.fn(
          'ST_DWithin',
          sequelize.cast(sequelize.col('origin_coordinates'), 'geography'),
          sequelize.cast(
            sequelize.fn(
              'ST_SetSRID',
              sequelize.fn('ST_MakePoint', location.longitude, location.latitude),
              4326,
            ),
            'geography',
          ),
          radiusMetres,
        ),
        true,
      );

      const rides = await Ride.findAll({
        attributes: ['id', 'availableSeats'],
        where: {
          status: { [Op.in]: [RideStatus.PENDING, RideStatus.CONFIRMED] },
          departureTime: { [Op.between]: [new Date(), until] },
          [Op.and]: [nearHere],
        },
        limit: 500,
        raw: true,
      }) as unknown as Array<{ id: string; availableSeats: number }>;

      if (rides.length === 0) {
        return { ...empty, hourlyBookings: await this.hourlyPattern(location, radiusMetres) };
      }

      const seatsOffered = rides.reduce((total, ride) => total + Number(ride.availableSeats), 0);

      const seatsTaken = Number(
        (await Booking.sum('seatsBooked', {
          where: {
            rideId: { [Op.in]: rides.map((ride) => ride.id) },
            status: { [Op.in]: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          },
        })) ?? 0,
      );

      const occupancy = seatsOffered > 0 ? seatsTaken / seatsOffered : null;

      return {
        seatsOffered,
        seatsTaken,
        occupancy: occupancy === null ? null : Math.round(occupancy * 100) / 100,
        level: this.describe(occupancy, rides.length),
        ridesConsidered: rides.length,
        hourlyBookings: await this.hourlyPattern(location, radiusMetres),
        radiusKm: Math.round(radiusMetres / 1000),
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      // A demand reading is informational. Failing to produce one must not
      // break the screen it sits on.
      logWarning('Could not build a demand snapshot', {
        error: error instanceof Error ? error.message : String(error),
      });

      return empty;
    }
  }

  /**
   * Bookings by hour of day, from real history near this point.
   *
   * Grouped in SQL rather than pulled into memory, because this covers two
   * months of bookings.
   */
  private async hourlyPattern(
    location: Coordinates,
    radiusMetres: number,
  ): Promise<number[]> {
    const hours = new Array(24).fill(0);

    try {
      const since = new Date();
      since.setDate(since.getDate() - PATTERN_DAYS);

      const rows = await sequelize.query<{ hour: string; total: string }>(
        `SELECT EXTRACT(HOUR FROM r.departure_time)::int AS hour,
                COALESCE(SUM(b.seats_booked), 0) AS total
           FROM bookings b
           JOIN rides r ON r.id = b.ride_id
          WHERE b.status IN (:statuses)
            AND r.departure_time >= :since
            AND ST_DWithin(
                  r.origin_coordinates::geography,
                  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                  :radius)
          GROUP BY 1`,
        {
          replacements: {
            statuses: [BookingStatus.COMPLETED, BookingStatus.CONFIRMED],
            since,
            lng: location.longitude,
            lat: location.latitude,
            radius: radiusMetres,
          },
          type: (sequelize as any).QueryTypes?.SELECT ?? 'SELECT',
        },
      ) as unknown as Array<{ hour: number; total: string }>;

      for (const row of rows) {
        const hour = Number(row.hour);

        if (hour >= 0 && hour < 24) {
          hours[hour] = Number(row.total) || 0;
        }
      }
    } catch (error) {
      // An empty pattern renders as a flat chart, which is honest when we
      // could not read the history.
      logWarning('Could not build the hourly demand pattern', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return hours;
  }

  /**
   * Turn occupancy into a word.
   *
   * Returns 'unknown' rather than 'quiet' on a thin sample: a driver told it
   * is quiet will stay home, and being wrong about that costs them a day.
   */
  private describe(occupancy: number | null, rideCount: number): DemandSnapshot['level'] {
    if (occupancy === null || rideCount < MIN_RIDES_FOR_LEVEL) {
      return 'unknown';
    }

    if (occupancy >= 0.85) {
      return 'very_busy';
    }

    if (occupancy >= 0.6) {
      return 'busy';
    }

    if (occupancy >= 0.3) {
      return 'steady';
    }

    return 'quiet';
  }
}

export const demandService = new DemandService();
export default demandService;
