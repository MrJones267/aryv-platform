/**
 * @fileoverview Ride request controller — passengers broadcast ride needs, matched to existing rides
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import crypto from 'crypto';
import { Response } from 'express';
import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import { AuthenticatedRequest } from '../types';
import { redisClient } from '../config/redis';
import Ride from '../models/Ride';
import { RideStatus } from '../types';
import logger from '../utils/logger';

/**
 * How far either end of a ride may be from what the passenger asked for and
 * still count as a match. Twenty kilometres covers a city and its approaches
 * without pulling in a different journey.
 */
const MATCH_RADIUS_METRES = 20000;

const REQUEST_TTL = 86400; // 24 hours
const REQUEST_PREFIX = 'ride_req:';
const USER_REQUESTS_PREFIX = 'user_reqs:';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function saveRequest(req: Record<string, any>): Promise<void> {
  await redisClient.set(`${REQUEST_PREFIX}${req['id']}`, JSON.stringify(req), REQUEST_TTL);

  // Maintain user's request index
  const idxKey = `${USER_REQUESTS_PREFIX}${req['userId']}`;
  const raw = await redisClient.get(idxKey);
  const ids: string[] = raw ? JSON.parse(raw) : [];
  if (!ids.includes(req['id'])) ids.push(req['id']);
  await redisClient.set(idxKey, JSON.stringify(ids), REQUEST_TTL);
}

async function loadRequest(id: string): Promise<Record<string, any> | null> {
  const raw = await redisClient.get(`${REQUEST_PREFIX}${id}`);
  return raw ? JSON.parse(raw) : null;
}

async function loadUserRequestIds(userId: string): Promise<string[]> {
  const raw = await redisClient.get(`${USER_REQUESTS_PREFIX}${userId}`);
  return raw ? JSON.parse(raw) : [];
}

// ─── Controller ──────────────────────────────────────────────────────────────

export class RideRequestController {
  /** POST /ride-requests — create a new ride request */
  async createRideRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const { origin, destination, departureTime, passengers, maxPrice, description } = req.body;

      if (!origin || !destination || !departureTime || !passengers) {
        res.status(400).json({ success: false, error: 'origin, destination, departureTime, and passengers are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      if (passengers < 1 || passengers > 8) {
        res.status(400).json({ success: false, error: 'passengers must be between 1 and 8', code: 'INVALID_PASSENGERS', timestamp: new Date().toISOString() });
        return;
      }

      const departure = new Date(departureTime);
      if (isNaN(departure.getTime()) || departure < new Date()) {
        res.status(400).json({ success: false, error: 'departureTime must be a valid future date', code: 'INVALID_DEPARTURE_TIME', timestamp: new Date().toISOString() });
        return;
      }

      const id = `rr_${crypto.randomBytes(12).toString('hex')}`;
      const rideRequest = {
        id,
        userId,
        origin,
        destination,
        departureTime: departure.toISOString(),
        passengers,
        maxPrice: maxPrice || null,
        description: description || null,
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(departure.getTime() + 2 * 60 * 60 * 1000).toISOString(), // expires 2h after departure
      };

      await saveRequest(rideRequest);

      logger.info('Ride request created', { id, userId });

      res.status(201).json({ success: true, data: rideRequest, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('createRideRequest error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** GET /ride-requests/my-requests — list this user's requests */
  async getMyRideRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const statusFilter = req.query['status'] as string | undefined;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);

      const ids = await loadUserRequestIds(userId);
      const all: Record<string, any>[] = [];

      for (const id of ids) {
        const r = await loadRequest(id);
        if (r) {
          // Auto-expire status
          if (r['status'] === 'active' && new Date(r['expiresAt']) < new Date()) {
            r['status'] = 'expired';
            await saveRequest(r);
          }
          all.push(r);
        }
      }

      const filtered = statusFilter ? all.filter((r) => r['status'] === statusFilter) : all;
      filtered.sort((a, b) => new Date(b['createdAt']).getTime() - new Date(a['createdAt']).getTime());

      const total = filtered.length;
      const requests = filtered.slice((page - 1) * limit, page * limit);

      res.json({
        success: true,
        data: {
          requests,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('getMyRideRequests error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** PATCH /ride-requests/:id/cancel — cancel a ride request */
  async cancelRideRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const rideRequest = await loadRequest(id);
      if (!rideRequest) {
        res.status(404).json({ success: false, error: 'Ride request not found', code: 'NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      if (rideRequest['userId'] !== userId) {
        res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN', timestamp: new Date().toISOString() });
        return;
      }

      if (rideRequest['status'] !== 'active') {
        res.status(400).json({ success: false, error: `Cannot cancel a ${rideRequest['status']} request`, code: 'INVALID_STATE', timestamp: new Date().toISOString() });
        return;
      }

      rideRequest['status'] = 'cancelled';
      rideRequest['cancelledAt'] = new Date().toISOString();
      await saveRequest(rideRequest);

      res.json({ success: true, message: 'Ride request cancelled', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('cancelRideRequest error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** GET /ride-requests/:id/matches — find existing rides matching this request */
  async getMatches(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const rideRequest = await loadRequest(id);
      if (!rideRequest || rideRequest['userId'] !== userId) {
        res.status(404).json({ success: false, error: 'Ride request not found', code: 'NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const departure = new Date(rideRequest['departureTime']);
      const windowStart = new Date(departure.getTime() - 60 * 60 * 1000); // 1h before
      const windowEnd = new Date(departure.getTime() + 60 * 60 * 1000);   // 1h after

      const reqOriginLat = Number(rideRequest['origin']?.latitude);
      const reqOriginLng = Number(rideRequest['origin']?.longitude);
      const reqDestLat = Number(rideRequest['destination']?.latitude);
      const reqDestLng = Number(rideRequest['destination']?.longitude);

      const hasCoordinates = [reqOriginLat, reqOriginLng, reqDestLat, reqDestLng]
        .every((value) => Number.isFinite(value));

      // Distance in metres from the request's endpoints, computed by PostGIS.
      //
      // The scoring here used to read r.originLat and r.originLng, which the
      // Ride model does not have — coordinates live in originCoordinates as a
      // geometry. Every score therefore came out 0, the sort did nothing, and
      // rides were returned in whatever order the database gave them, with no
      // geographic filtering at all: a Maun-to-Kasane ride matched a Gaborone
      // request so long as the departure times lined up.
      const distanceTo = (column: string, lng: number, lat: number) =>
        sequelize.fn(
          'ST_Distance',
          sequelize.col(column),
          sequelize.fn('ST_SetSRID', sequelize.fn('ST_MakePoint', lng, lat), 4326),
        );

      const matches = await Ride.findAll({
        // Spread rather than set to undefined: exactOptionalPropertyTypes
        // treats an explicit undefined as a value, not an absent key.
        ...(hasCoordinates
          ? {
              attributes: {
                include: [
                  [distanceTo('originCoordinates', reqOriginLng, reqOriginLat), 'originDistance'],
                  [distanceTo('destinationCoordinates', reqDestLng, reqDestLat), 'destinationDistance'],
                ] as any,
              },
            }
          : {}),
        where: {
          status: { [Op.in]: [RideStatus.PENDING, RideStatus.CONFIRMED] },
          departureTime: { [Op.between]: [windowStart, windowEnd] },
          availableSeats: { [Op.gte]: rideRequest['passengers'] },
          ...(rideRequest['maxPrice'] ? { pricePerSeat: { [Op.lte]: rideRequest['maxPrice'] } } : {}),
          // Both ends must actually be near what was asked for.
          ...(hasCoordinates
            ? {
                [Op.and]: [
                  sequelize.where(
                    sequelize.fn(
                      'ST_DWithin',
                      sequelize.col('originCoordinates'),
                      sequelize.fn('ST_SetSRID', sequelize.fn('ST_MakePoint', reqOriginLng, reqOriginLat), 4326),
                      MATCH_RADIUS_METRES,
                    ),
                    true,
                  ),
                  sequelize.where(
                    sequelize.fn(
                      'ST_DWithin',
                      sequelize.col('destinationCoordinates'),
                      sequelize.fn('ST_SetSRID', sequelize.fn('ST_MakePoint', reqDestLng, reqDestLat), 4326),
                      MATCH_RADIUS_METRES,
                    ),
                    true,
                  ),
                ],
              }
            : {}),
        },
        order: [['departureTime', 'ASC']],
        limit: 20,
      });

      const scored = matches
        .map((ride) => {
          const r = ride.toJSON() as any;

          // 100 when both ends coincide, falling away with distance. Kept as a
          // plain reading of how far off the ride is, not a confidence score.
          const totalMetres = Number(r.originDistance ?? 0) + Number(r.destinationDistance ?? 0);
          const matchScore = hasCoordinates
            ? Math.max(0, Math.round(100 * (1 - totalMetres / (2 * MATCH_RADIUS_METRES))))
            : null;

          return { ...r, matchScore };
        })
        .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

      res.json({ success: true, data: scored, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('getMatches error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }
}

export default RideRequestController;
