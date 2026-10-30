/**
 * @fileoverview Ride request controller — passengers post ride needs, drivers see them
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-10-30
 *
 * Requests used to be kept in Redis for a day, seen by nobody but the
 * passenger. They are now stored in ride_requests (migration 033); drivers
 * list the ones near them, and passengers are told when a fitting ride is
 * published. The logic is in RideRequestService.
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import User from '../models/User';
import { DriverVerificationStatus } from '../models/DriverDocument';
import rideRequestService, { RideRequestError, ownView } from '../services/RideRequestService';
import logger from '../utils/logger';

const now = () => new Date().toISOString();

function fail(res: Response, error: unknown, where: string): void {
  if (error instanceof RideRequestError) {
    res.status(error.status).json({ success: false, error: error.message, code: error.code, timestamp: now() });
    return;
  }
  logger.error(`${where} error`, { error: (error as Error).message });
  res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: now() });
}

export class RideRequestController {
  /** POST /ride-requests */
  async createRideRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const request = await rideRequestService.create(req.user!.id, req.body);
      res.status(201).json({ success: true, data: ownView(request), timestamp: now() });
    } catch (error) {
      fail(res, error, 'createRideRequest');
    }
  }

  /** GET /ride-requests/my-requests */
  async getMyRideRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = req.query['status'] as string | undefined;
      const requests = await rideRequestService.listMine(req.user!.id, status);
      res.json({
        success: true,
        data: { requests, pagination: { page: 1, limit: requests.length, total: requests.length, totalPages: 1 } },
        timestamp: now(),
      });
    } catch (error) {
      fail(res, error, 'getMyRideRequests');
    }
  }

  /** PATCH /ride-requests/:id/cancel */
  async cancelRideRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const request = await rideRequestService.cancel(req.user!.id, req.params['id']!);
      res.json({ success: true, data: ownView(request), message: 'Ride request cancelled', timestamp: now() });
    } catch (error) {
      fail(res, error, 'cancelRideRequest');
    }
  }

  /** GET /ride-requests/:id/matches — published rides that fit the request */
  async getMatches(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const rides = await rideRequestService.matchesFor(req.user!.id, req.params['id']!);
      res.json({ success: true, data: rides, timestamp: now() });
    } catch (error) {
      fail(res, error, 'getMatches');
    }
  }

  /**
   * GET /ride-requests/nearby?latitude&longitude&radiusKm — for drivers.
   * Only drivers whose documents are approved, the same people who can
   * publish the ride a passenger is asking for.
   */
  async getNearby(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const driver = await User.findByPk(req.user!.id);
      const verification = (driver as unknown as { driverVerificationStatus?: string })?.driverVerificationStatus;
      if (verification !== DriverVerificationStatus.VERIFIED) {
        res.status(403).json({
          success: false,
          error: 'Your driver documents must be approved before you can see ride requests',
          code: 'DRIVER_NOT_VERIFIED',
          timestamp: now(),
        });
        return;
      }
      const requests = await rideRequestService.nearby(
        req.user!.id,
        Number(req.query['latitude']),
        Number(req.query['longitude']),
        req.query['radiusKm'] ? Number(req.query['radiusKm']) : undefined,
      );
      res.json({ success: true, data: requests, timestamp: now() });
    } catch (error) {
      fail(res, error, 'getNearby');
    }
  }
}

export default RideRequestController;
