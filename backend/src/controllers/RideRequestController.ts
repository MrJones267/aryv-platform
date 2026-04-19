/**
 * @fileoverview Ride request controller — passengers broadcast ride needs, matched to existing rides
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import crypto from 'crypto';
import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthenticatedRequest } from '../types';
import { redisClient } from '../config/redis';
import Ride from '../models/Ride';
import { RideStatus } from '../types';
import logger from '../utils/logger';

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

      // Find rides with matching departure window and enough seats
      const matches = await Ride.findAll({
        where: {
          status: { [Op.in]: [RideStatus.PENDING, RideStatus.CONFIRMED] },
          departureTime: { [Op.between]: [windowStart, windowEnd] },
          availableSeats: { [Op.gte]: rideRequest['passengers'] },
          ...(rideRequest['maxPrice'] ? { pricePerSeat: { [Op.lte]: rideRequest['maxPrice'] } } : {}),
        },
        order: [['departureTime', 'ASC']],
        limit: 20,
      });

      // Filter by rough geo proximity if coordinates are present
      const reqOriginLat = rideRequest['origin']?.latitude;
      const reqOriginLng = rideRequest['origin']?.longitude;
      const reqDestLat = rideRequest['destination']?.latitude;
      const reqDestLng = rideRequest['destination']?.longitude;

      const scored = matches
        .map((ride) => {
          const r = ride.toJSON() as any;
          let score = 0;

          if (reqOriginLat && r.originLat) {
            const originDist = Math.hypot(r.originLat - reqOriginLat, r.originLng - reqOriginLng);
            const destDist = Math.hypot(r.destinationLat - reqDestLat, r.destinationLng - reqDestLng);
            score = 1 / (1 + originDist + destDist); // higher = better match
          }

          return { ...r, matchScore: Math.round(score * 100) };
        })
        .sort((a, b) => b.matchScore - a.matchScore);

      res.json({ success: true, data: scored, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('getMatches error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }
}

export default RideRequestController;
