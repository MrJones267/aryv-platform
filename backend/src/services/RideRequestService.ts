/**
 * @fileoverview Ride requests: posting, matching rides to them, and showing them to drivers
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * A request and a ride match when the ride passes near the request's pickup
 * and then near its drop-off (in that order, using the ride's stops when it
 * has any), leaves within two hours of when the passenger wants to go, has
 * the seats, and costs no more than the passenger said they would pay.
 *
 * Distances are measured as geography, in metres. The Redis version this
 * replaces passed metres to ST_DWithin on plain geometry, where the unit is
 * degrees, so "20 km" meant anywhere on Earth.
 */

import { QueryTypes, Op } from 'sequelize';
import { sequelize } from '../config/database';
import RideRequest, { RideRequestModel } from '../models/RideRequest';
import Ride from '../models/Ride';
import User from '../models/User';
import Vehicle from '../models/Vehicle';
import toRideView from '../utils/rideView';
import { notificationService } from './NotificationService';
import logger from '../utils/logger';
import type { GeoPoint } from '../types';

// Constants
const CONSTANTS = {
  MATCH_RADIUS_METRES: 20000,
  DEPARTURE_WINDOW_MS: 2 * 60 * 60 * 1000,
  EXPIRES_AFTER_DEPARTURE_MS: 2 * 60 * 60 * 1000,
  MAX_DAYS_AHEAD: 30,
  MAX_ACTIVE_PER_PASSENGER: 5,
  NEARBY_DEFAULT_KM: 30,
  NEARBY_MAX_KM: 100,
  NEARBY_LIMIT: 50,
  MATCH_LIMIT: 20,
};

export class RideRequestError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

interface Place { latitude: number; longitude: number; address?: string }

export interface CreateRideRequestInput {
  origin: Place;
  destination: Place;
  departureTime: string;
  passengers: number;
  maxPrice?: number | null;
  description?: string | null;
}

const point = (p: Place): GeoPoint => ({ type: 'Point', coordinates: [Number(p.longitude), Number(p.latitude)] });
const lngLat = (g: any): [number, number] | null => (Array.isArray(g?.coordinates) ? [Number(g.coordinates[0]), Number(g.coordinates[1])] : null);
const validPlace = (p: any): p is Place =>
  p && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
  && Math.abs(Number(p.latitude)) <= 90 && Math.abs(Number(p.longitude)) <= 180;

/** 'expired' is not stored; it is what an active request past its time is. */
const statusOf = (r: RideRequestModel): string =>
  r.status === 'active' && r.expiresAt.getTime() <= Date.now() ? 'expired' : r.status;

export interface RideRequestView {
  id: string;
  origin: { address: string; coordinates: [number, number] | null };
  destination: { address: string; coordinates: [number, number] | null };
  departureTime: Date;
  passengers: number;
  maxPrice: number | null;
  currency: string;
  description: string | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}

/** What the passenger sees of their own request. */
export const ownView = (r: RideRequestModel): RideRequestView => ({
  id: r.id,
  origin: { address: r.originAddress, coordinates: lngLat(r.originCoordinates) },
  destination: { address: r.destinationAddress, coordinates: lngLat(r.destinationCoordinates) },
  departureTime: r.departureTime,
  passengers: r.seats,
  maxPrice: r.maxPrice == null ? null : Number(r.maxPrice),
  currency: r.currency,
  description: r.note ?? null,
  status: statusOf(r),
  expiresAt: r.expiresAt,
  createdAt: r.createdAt,
});

// "Passes near A, then near B": a stop near the pickup before a stop near the
// drop-off, or for a ride without stops, its own two ends.
const RIDE_PASSES = (ride: string, pickup: string, dropoff: string) => `(
  EXISTS (
    SELECT 1 FROM ride_stops a
    JOIN ride_stops b ON b.ride_id = a.ride_id AND b.sequence > a.sequence
    WHERE a.ride_id = ${ride}.id
      AND ST_DWithin(a.coordinates::geography, ${pickup}::geography, :radius)
      AND ST_DWithin(b.coordinates::geography, ${dropoff}::geography, :radius)
  )
  OR (
    ST_DWithin(${ride}.origin_coordinates::geography, ${pickup}::geography, :radius)
    AND ST_DWithin(${ride}.destination_coordinates::geography, ${dropoff}::geography, :radius)
  )
)`;

class RideRequestService {
  async create(passengerId: string, input: CreateRideRequestInput): Promise<RideRequestModel> {
    if (!validPlace(input.origin) || !validPlace(input.destination)) {
      throw new RideRequestError('INVALID_LOCATION', 'Choose where you are leaving from and where you are going');
    }
    const departure = new Date(input.departureTime);
    const now = Date.now();
    if (Number.isNaN(departure.getTime()) || departure.getTime() <= now) {
      throw new RideRequestError('INVALID_DEPARTURE_TIME', 'Departure time must be in the future');
    }
    if (departure.getTime() > now + CONSTANTS.MAX_DAYS_AHEAD * 86400000) {
      throw new RideRequestError('INVALID_DEPARTURE_TIME', `Requests can be at most ${CONSTANTS.MAX_DAYS_AHEAD} days ahead`);
    }
    const seats = Number(input.passengers);
    if (!Number.isInteger(seats) || seats < 1 || seats > 8) {
      throw new RideRequestError('INVALID_PASSENGERS', 'passengers must be between 1 and 8');
    }
    const active = await RideRequest.count({
      where: { passengerId, status: 'active', expiresAt: { [Op.gt]: new Date() } },
    });
    if (active >= CONSTANTS.MAX_ACTIVE_PER_PASSENGER) {
      throw new RideRequestError('TOO_MANY_REQUESTS', `You can have at most ${CONSTANTS.MAX_ACTIVE_PER_PASSENGER} open requests`, 409);
    }

    return RideRequest.create({
      passengerId,
      originAddress: (input.origin.address || '').trim() || 'Pickup',
      originCoordinates: point(input.origin),
      destinationAddress: (input.destination.address || '').trim() || 'Destination',
      destinationCoordinates: point(input.destination),
      departureTime: departure,
      seats,
      maxPrice: input.maxPrice == null ? null : Number(input.maxPrice),
      note: input.description?.trim() || null,
      expiresAt: new Date(departure.getTime() + CONSTANTS.EXPIRES_AFTER_DEPARTURE_MS),
    });
  }

  async listMine(passengerId: string, status?: string): Promise<RideRequestView[]> {
    const rows = await RideRequest.findAll({ where: { passengerId }, order: [['departureTime', 'DESC']], limit: 50 });
    const views = rows.map(ownView);
    return status ? views.filter(v => v.status === status) : views;
  }

  async cancel(passengerId: string, id: string): Promise<RideRequestModel> {
    const request = await RideRequest.findOne({ where: { id, passengerId } });
    if (!request) {throw new RideRequestError('NOT_FOUND', 'Ride request not found', 404);}
    if (statusOf(request) !== 'active') {
      throw new RideRequestError('INVALID_STATE', `This request is already ${statusOf(request)}`);
    }
    await request.update({ status: 'cancelled' });
    return request;
  }

  /** Published rides that fit a passenger's request. */
  async matchesFor(passengerId: string, id: string): Promise<Record<string, any>[]> {
    const request = await RideRequest.findOne({ where: { id, passengerId } });
    if (!request) {throw new RideRequestError('NOT_FOUND', 'Ride request not found', 404);}
    const [olng, olat] = lngLat(request.originCoordinates)!;
    const [dlng, dlat] = lngLat(request.destinationCoordinates)!;
    const dep = request.departureTime.getTime();

    const rows = await sequelize.query<{ id: string }>(
      `SELECT r.id FROM rides r
        WHERE r.status IN ('pending', 'confirmed')
          AND r.departure_time BETWEEN :start AND :end
          AND r.departure_time > now()
          AND r.available_seats >= :seats
          AND (CAST(:maxPrice AS NUMERIC) IS NULL OR r.price_per_seat <= CAST(:maxPrice AS NUMERIC))
          AND r.driver_id <> :passengerId
          AND NOT EXISTS (SELECT 1 FROM user_blocks b
                           WHERE (b.blocker_id = :passengerId AND b.blocked_id = r.driver_id)
                              OR (b.blocker_id = r.driver_id AND b.blocked_id = :passengerId))
          AND ${RIDE_PASSES('r', 'ST_SetSRID(ST_MakePoint(:olng, :olat), 4326)', 'ST_SetSRID(ST_MakePoint(:dlng, :dlat), 4326)')}
        ORDER BY r.departure_time
        LIMIT :limit`,
      {
        type: QueryTypes.SELECT,
        replacements: {
          start: new Date(dep - CONSTANTS.DEPARTURE_WINDOW_MS), end: new Date(dep + CONSTANTS.DEPARTURE_WINDOW_MS),
          seats: request.seats, maxPrice: request.maxPrice == null ? null : Number(request.maxPrice),
          passengerId, olng, olat, dlng, dlat, radius: CONSTANTS.MATCH_RADIUS_METRES, limit: CONSTANTS.MATCH_LIMIT,
        },
      },
    );
    if (rows.length === 0) {return [];}
    const rides = await Ride.findAll({
      where: { id: rows.map(r => r.id) },
      include: [
        { model: User, as: 'driver', attributes: ['id', 'firstName', 'lastName', 'profilePicture'] },
        { model: Vehicle, as: 'vehicle', attributes: ['id', 'make', 'model', 'year', 'color'] },
      ],
      order: [['departureTime', 'ASC']],
    });
    return rides.map(ride => toRideView(ride.toJSON(), { isParticipant: false }));
  }

  /**
   * Open requests near a driver. Pickup and drop-off are rounded to about a
   * kilometre and only the passenger's first name is shown: enough to decide
   * whether to offer the trip, not enough to find someone's house.
   */
  async nearby(driverId: string, latitude: number, longitude: number, radiusKm?: number): Promise<Record<string, unknown>[]> {
    const km = Math.min(Math.max(Number(radiusKm) || CONSTANTS.NEARBY_DEFAULT_KM, 1), CONSTANTS.NEARBY_MAX_KM);
    const rows = await sequelize.query<any>(
      `SELECT q.id, q.origin_address, q.destination_address, q.departure_time, q.seats, q.max_price,
              q.currency, q.note, u.first_name,
              ROUND(ST_Y(q.origin_coordinates)::numeric, 2) AS olat, ROUND(ST_X(q.origin_coordinates)::numeric, 2) AS olng,
              ROUND(ST_Y(q.destination_coordinates)::numeric, 2) AS dlat, ROUND(ST_X(q.destination_coordinates)::numeric, 2) AS dlng,
              ST_Distance(q.origin_coordinates::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) AS metres
         FROM ride_requests q
         JOIN users u ON u.id = q.passenger_id
        WHERE q.status = 'active'
          AND q.expires_at > now()
          AND q.departure_time > now()
          AND q.passenger_id <> :driverId
          AND NOT EXISTS (SELECT 1 FROM user_blocks b
                           WHERE (b.blocker_id = :driverId AND b.blocked_id = q.passenger_id)
                              OR (b.blocker_id = q.passenger_id AND b.blocked_id = :driverId))
          AND ST_DWithin(q.origin_coordinates::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :metres)
        ORDER BY q.departure_time
        LIMIT :limit`,
      { type: QueryTypes.SELECT, replacements: { lat: latitude, lng: longitude, driverId, metres: km * 1000, limit: CONSTANTS.NEARBY_LIMIT } },
    );
    return rows.map(r => ({
      id: r.id,
      passengerFirstName: r.first_name,
      origin: { address: r.origin_address, coordinates: [Number(r.olng), Number(r.olat)] },
      destination: { address: r.destination_address, coordinates: [Number(r.dlng), Number(r.dlat)] },
      departureTime: r.departure_time,
      passengers: r.seats,
      maxPrice: r.max_price == null ? null : Number(r.max_price),
      currency: r.currency,
      description: r.note,
      distanceKm: Math.round(Number(r.metres) / 100) / 10,
    }));
  }

  /**
   * After a ride is published: tell every passenger whose open request it
   * fits, once per ride. Errors are logged, never thrown; publishing the
   * ride has already succeeded.
   */
  async notifyMatchesForRide(rideId: string): Promise<number> {
    try {
      const matched = await sequelize.query<{ id: string; passenger_id: string }>(
        `UPDATE ride_requests q
            SET notified_ride_ids = q.notified_ride_ids || jsonb_build_array(CAST(:rideId AS text)),
                updated_at = now()
           FROM rides r
          WHERE r.id = :rideId
            AND q.status = 'active'
            AND q.expires_at > now()
            AND q.departure_time BETWEEN r.departure_time - (:windowMs || ' milliseconds')::interval
                                     AND r.departure_time + (:windowMs || ' milliseconds')::interval
            AND q.seats <= r.available_seats
            AND (q.max_price IS NULL OR q.max_price >= r.price_per_seat)
            AND q.passenger_id <> r.driver_id
            AND NOT EXISTS (SELECT 1 FROM user_blocks b
                             WHERE (b.blocker_id = r.driver_id AND b.blocked_id = q.passenger_id)
                                OR (b.blocker_id = q.passenger_id AND b.blocked_id = r.driver_id))
            AND NOT (q.notified_ride_ids @> jsonb_build_array(CAST(:rideId AS text)))
            AND ${RIDE_PASSES('r', 'q.origin_coordinates', 'q.destination_coordinates')}
        RETURNING q.id, q.passenger_id`,
        { type: QueryTypes.SELECT, replacements: { rideId, windowMs: String(CONSTANTS.DEPARTURE_WINDOW_MS), radius: CONSTANTS.MATCH_RADIUS_METRES } },
      );
      for (const m of matched) {
        await notificationService.sendToUser(m.passenger_id, {
          type: 'ride_request_match',
          title: 'A ride for your request',
          message: 'A driver has published a ride that fits your ride request. Book a seat before it fills.',
          data: { rideId, requestId: m.id },
          timestamp: new Date().toISOString(),
        });
      }
      return matched.length;
    } catch (error) {
      logger.error('notifyMatchesForRide failed', { rideId, error: (error as Error).message });
      return 0;
    }
  }
}

export const rideRequestService = new RideRequestService();
export default rideRequestService;
