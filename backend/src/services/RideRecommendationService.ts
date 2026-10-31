/**
 * @fileoverview Suggesting rides from where someone has actually travelled.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * The app's recommendation service fabricated its own input. It generated
 * between ten and thirty past rides for the user, with coordinates scattered
 * around latitude 37.77, longitude -122.41 — San Francisco — and then produced
 * recommendations from that invented history, including an "expected savings"
 * figure that was a random number rendered as money.
 *
 * The real version is simpler and needs no model. A carpooling passenger tends
 * to make the same journey repeatedly: home to work, or their town to the
 * city. So look at the routes they have actually booked, find the ones they
 * repeat, and show upcoming rides on those routes. If they have not travelled
 * with us yet, there is nothing to recommend, and saying so is correct.
 */

import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import Booking from '../models/Booking';
import Ride from '../models/Ride';
import { BookingStatus, RideStatus, GeoPoint } from '../types';
import { logWarning } from '../utils/logger';

export interface FrequentRoute {
  originAddress: string;
  destinationAddress: string;
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  /** How many times they have made this journey. */
  tripCount: number;
  lastTravelled: Date;
}

export interface RideRecommendation {
  route: FrequentRoute;
  /** Upcoming rides on that route. Empty means none are listed yet. */
  upcoming: unknown[];
}

/** Two journeys are the same route if both ends are within this distance. */
const SAME_ROUTE_RADIUS_METRES = 15000;

/**
 * Travelled at least twice before it counts as a habit. Once is a trip; twice
 * is a pattern worth acting on.
 */
const MIN_TRIPS_FOR_ROUTE = 2;

/** How far back to look for habits. */
const HISTORY_DAYS = 180;

const toLatLng = (point: GeoPoint | null | undefined) =>
  point?.coordinates
    ? { latitude: point.coordinates[1]!, longitude: point.coordinates[0]! }
    : null;

export class RideRecommendationService {
  /**
   * Routes this passenger travels repeatedly.
   *
   * Only completed bookings count: a cancelled one is evidence they did not
   * make the journey, and recommending against it would be backwards.
   */
  async getFrequentRoutes(userId: string, limit = 3): Promise<FrequentRoute[]> {
    const since = new Date();
    since.setDate(since.getDate() - HISTORY_DAYS);

    const bookings = await Booking.findAll({
      where: {
        passengerId: userId,
        status: BookingStatus.COMPLETED,
        createdAt: { [Op.gte]: since },
      },
      include: [
        {
          model: Ride,
          as: 'ride',
          attributes: [
            'originAddress', 'destinationAddress',
            'originCoordinates', 'destinationCoordinates',
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });

    // Group journeys that start and end in roughly the same places. Addresses
    // are free text — "Main Mall" and "Main Mall, Gaborone" are the same
    // place — so grouping is by distance, not by string.
    const groups: Array<{
      origin: { latitude: number; longitude: number };
      destination: { latitude: number; longitude: number };
      originAddress: string;
      destinationAddress: string;
      tripCount: number;
      lastTravelled: Date;
    }> = [];

    for (const booking of bookings) {
      const ride = (booking as unknown as { ride?: any }).ride;

      if (!ride) {
        continue;
      }

      const origin = toLatLng(ride.originCoordinates);
      const destination = toLatLng(ride.destinationCoordinates);

      if (!origin || !destination) {
        continue;
      }

      const existing = groups.find(
        (group) =>
          this.metresBetween(group.origin, origin) <= SAME_ROUTE_RADIUS_METRES
          && this.metresBetween(group.destination, destination) <= SAME_ROUTE_RADIUS_METRES,
      );

      if (existing) {
        existing.tripCount += 1;
        continue;
      }

      groups.push({
        origin,
        destination,
        originAddress: ride.originAddress,
        destinationAddress: ride.destinationAddress,
        tripCount: 1,
        // Bookings arrive newest first, so the first of a group is the latest.
        lastTravelled: booking.createdAt,
      });
    }

    return groups
      .filter((group) => group.tripCount >= MIN_TRIPS_FOR_ROUTE)
      .sort((a, b) => b.tripCount - a.tripCount)
      .slice(0, limit);
  }

  /**
   * Upcoming rides on the routes this passenger travels.
   *
   * Returns an empty list for someone with no history. That is the honest
   * answer for a new user, and the screen should say so rather than being
   * filled with invented journeys.
   */
  async getRecommendations(userId: string, limit = 3): Promise<RideRecommendation[]> {
    try {
      const routes = await this.getFrequentRoutes(userId, limit);

      return await Promise.all(
        routes.map(async (route) => ({
          route,
          upcoming: await this.findUpcomingOnRoute(route, userId),
        })),
      );
    } catch (error) {
      // Recommendations are a convenience; failing to build them must not
      // break the screen they sit on.
      logWarning('Could not build ride recommendations', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  /** Rides departing soon that run this route, excluding the user's own. */
  private async findUpcomingOnRoute(
    route: FrequentRoute,
    userId: string,
  ): Promise<unknown[]> {
    // In metres on geography (4326 geometry counts degrees). The column is
    // named as stored, since col() does not translate attribute names.
    const near = (column: string, lng: number, lat: number) =>
      sequelize.where(
        sequelize.fn(
          'ST_DWithin',
          sequelize.cast(sequelize.col(column), 'geography'),
          sequelize.cast(sequelize.fn('ST_SetSRID', sequelize.fn('ST_MakePoint', lng, lat), 4326), 'geography'),
          SAME_ROUTE_RADIUS_METRES,
        ),
        true,
      );

    const rides = await Ride.findAll({
      where: {
        status: { [Op.in]: [RideStatus.PENDING, RideStatus.CONFIRMED] },
        departureTime: { [Op.gt]: new Date() },
        // Recommending someone their own ride would be nonsense.
        driverId: { [Op.ne]: userId },
        [Op.and]: [
          near('origin_coordinates', route.origin.longitude, route.origin.latitude),
          near('destination_coordinates', route.destination.longitude, route.destination.latitude),
        ],
      },
      order: [['departureTime', 'ASC']],
      limit: 5,
    });

    return rides.map((ride) => ride.toJSON());
  }

  /**
   * Great-circle distance in metres.
   *
   * Grouping happens in memory over at most a couple of hundred bookings, so
   * this is cheaper than a round trip to PostGIS per comparison.
   */
  private metresBetween(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ): number {
    const EARTH_RADIUS_METRES = 6371000;
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

    const dLat = toRadians(b.latitude - a.latitude);
    const dLng = toRadians(b.longitude - a.longitude);

    const h =
      Math.sin(dLat / 2) ** 2
      + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
  }
}

export const rideRecommendationService = new RideRecommendationService();
export default rideRecommendationService;
