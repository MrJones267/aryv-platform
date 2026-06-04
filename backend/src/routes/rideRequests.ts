/**
 * @fileoverview Ride request routes — passengers broadcast ride needs
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { RideRequestController } from '../controllers/RideRequestController';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const controller = new RideRequestController();

const rideRequestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many requests, please try again later', code: 'RATE_LIMIT_EXCEEDED' },
  store: makeStore('ride-requests'),
});

router.use(authenticateToken);

router.post(
  '/',
  rideRequestRateLimit,
  [
    body('origin').notEmpty().withMessage('origin is required'),
    body('destination').notEmpty().withMessage('destination is required'),
    body('departureTime').notEmpty().withMessage('departureTime is required'),
    body('passengers').isInt({ min: 1, max: 8 }).withMessage('passengers must be between 1 and 8'),
    body('maxPrice').optional().isFloat({ min: 0 }),
    body('description').optional().isLength({ max: 500 }),
  ],
  validateInput,
  controller.createRideRequest.bind(controller),
);

router.get(
  '/my-requests',
  rideRequestRateLimit,
  [
    query('status').optional().isIn(['active', 'cancelled', 'expired']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateInput,
  controller.getMyRideRequests.bind(controller),
);

router.patch(
  '/:id/cancel',
  rideRequestRateLimit,
  [param('id').isUUID().withMessage('Ride request ID must be a valid UUID')],
  validateInput,
  controller.cancelRideRequest.bind(controller),
);

router.get(
  '/:id/matches',
  rideRequestRateLimit,
  [param('id').isUUID().withMessage('Ride request ID must be a valid UUID')],
  validateInput,
  controller.getMatches.bind(controller),
);

export default router;
