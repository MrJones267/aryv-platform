/**
 * @fileoverview Location and real-time tracking API routes
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2026-11-05
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { rateLimitKey } from '../config/rateLimitKey';
import { LocationController } from '../controllers/LocationController';
import { EmergencyController } from '../controllers/EmergencyController';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { isGoogleService, pickParams, missingParam, callGoogle } from '../services/GoogleWebServiceProxy';

const router = Router();
const locationController = new LocationController();
const emergencyController = new EmergencyController();

// Rate limiting for location operations
const locationRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Allow 60 location updates per minute
  message: 'Too many location requests from this IP, please try again later',
  store: makeStore('location'),
  keyGenerator: rateLimitKey,
});

const trackingRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // Allow 120 tracking requests per minute for real-time updates
  message: 'Too many tracking requests from this IP, please try again later',
  store: makeStore('tracking'),
  keyGenerator: rateLimitKey,
});

// Validation schemas
const locationUpdateValidation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('accuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Accuracy must be a positive number'),
  body('altitude')
    .optional()
    .isFloat()
    .withMessage('Altitude must be a number'),
  body('speed')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Speed must be a positive number'),
  body('heading')
    .optional()
    .isFloat({ min: 0, max: 360 })
    .withMessage('Heading must be between 0 and 360 degrees'),
];

const geoSearchValidation = [
  query('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  query('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  query('radius')
    .optional()
    .isFloat({ min: 0.1, max: 100 })
    .withMessage('Radius must be between 0.1 and 100 km'),
  query('type')
    .optional()
    .isIn(['driver', 'passenger', 'courier', 'all'])
    .withMessage('Type must be driver, passenger, courier, or all'),
];

const rideTrackingValidation = [
  param('rideId').isUUID().withMessage('Ride ID must be a valid UUID'),
];

// Routes

/**
 * @route   POST /api/locations/update
 * @desc    Update user's current location
 * @access  Private
 */
router.post(
  '/update',
  trackingRateLimit,
  authenticateToken,
  locationUpdateValidation,
  validateInput,
  locationController.updateLocation.bind(locationController),
);

/**
 * @route   GET /api/locations/current
 * @desc    Get user's current location
 * @access  Private
 */
router.get(
  '/current',
  locationRateLimit,
  authenticateToken,
  locationController.getCurrentLocation.bind(locationController),
);

/**
 * @route   POST /api/locations/start-tracking/:rideId
 * @desc    Start location tracking for a ride
 * @access  Private
 */
router.post(
  '/start-tracking/:rideId',
  locationRateLimit,
  authenticateToken,
  rideTrackingValidation,
  validateInput,
  locationController.startRideTracking.bind(locationController),
);

/**
 * @route   POST /api/locations/stop-tracking/:rideId
 * @desc    Stop location tracking for a ride
 * @access  Private
 */
router.post(
  '/stop-tracking/:rideId',
  locationRateLimit,
  authenticateToken,
  rideTrackingValidation,
  validateInput,
  locationController.stopRideTracking.bind(locationController),
);

/**
 * @route   GET /api/locations/track/:rideId
 * @desc    Get real-time location data for a ride
 * @access  Private
 */
router.get(
  '/track/:rideId',
  trackingRateLimit,
  authenticateToken,
  rideTrackingValidation,
  validateInput,
  locationController.getRideTracking.bind(locationController),
);

/**
 * @route   GET /api/locations/nearby
 * @desc    Find nearby users (drivers/passengers)
 * @access  Private
 */
router.get(
  '/nearby',
  locationRateLimit,
  authenticateToken,
  geoSearchValidation,
  validateInput,
  locationController.findNearbyUsers.bind(locationController),
);

/**
 * @route   GET /api/locations/places/search
 * @desc    Search for places using external geocoding service
 * @access  Private
 */
router.get(
  '/places/search',
  locationRateLimit,
  authenticateToken,
  [
    query('query')
      .isLength({ min: 3, max: 200 })
      .withMessage('Search query must be between 3 and 200 characters'),
    query('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    query('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),
    query('radius')
      .optional()
      .isFloat({ min: 1, max: 50 })
      .withMessage('Search radius must be between 1 and 50 km'),
  ],
  validateInput,
  locationController.searchPlaces.bind(locationController),
);

/**
 * @route   GET /api/locations/places/reverse-geocode
 * @desc    Get address from coordinates (reverse geocoding)
 * @access  Private
 */
router.get(
  '/places/reverse-geocode',
  locationRateLimit,
  authenticateToken,
  [
    query('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    query('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),
  ],
  validateInput,
  locationController.reverseGeocode.bind(locationController),
);

/**
 * @route   POST /api/locations/calculate-route
 * @desc    Calculate route between two or more points
 * @access  Private
 */
router.post(
  '/calculate-route',
  locationRateLimit,
  authenticateToken,
  [
    body('waypoints')
      .isArray({ min: 2, max: 25 })
      .withMessage('Waypoints must be an array with 2 to 25 elements'),
    body('waypoints.*.latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Waypoint latitude must be between -90 and 90'),
    body('waypoints.*.longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Waypoint longitude must be between -180 and 180'),
    body('routeType')
      .optional()
      .isIn(['fastest', 'shortest', 'balanced'])
      .withMessage('Route type must be fastest, shortest, or balanced'),
    body('avoidTolls')
      .optional()
      .isBoolean()
      .withMessage('Avoid tolls must be boolean'),
    body('avoidHighways')
      .optional()
      .isBoolean()
      .withMessage('Avoid highways must be boolean'),
  ],
  validateInput,
  locationController.calculateRoute.bind(locationController),
);

/**
 * @route   GET /api/locations/eta/:rideId
 * @desc    Get estimated time of arrival for a ride
 * @access  Private
 */
router.get(
  '/eta/:rideId',
  trackingRateLimit,
  authenticateToken,
  rideTrackingValidation,
  validateInput,
  locationController.getETA.bind(locationController),
);

/**
 * @route   POST /api/locations/emergency-alert
 * @desc    Legacy SOS address, kept for app builds already installed. It now
 *          raises the alert through /api/emergency, the same as the app does.
 * @access  Private
 *
 * This used to have its own handler. It saved nothing, so admins never saw
 * the alert, and it sent the caller's ID and exact location over the socket
 * to every connected user. Now it fills in `alertType` from the old
 * `emergencyType` field and hands the request to the real controller, which
 * saves the alert, notifies emergency contacts and alerts operators.
 */
router.post(
  '/emergency-alert',
  locationRateLimit,
  authenticateToken,
  [
    body('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    body('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),
    body('emergencyType')
      .isIn(['accident', 'breakdown', 'safety', 'medical', 'other'])
      .withMessage('Invalid emergency type'),
    body('message')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Message cannot exceed 500 characters'),
    body('rideId')
      .optional()
      .isUUID()
      .withMessage('Ride ID must be a valid UUID'),
  ],
  validateInput,
  (req: Request, _res: Response, next: NextFunction): void => {
    req.body.alertType = req.body.emergencyType;
    next();
  },
  emergencyController.raiseAlert.bind(emergencyController),
);

/**
 * @route   GET /api/locations/geofences
 * @desc    Get active geofences for user
 * @access  Private
 */
router.get(
  '/geofences',
  locationRateLimit,
  authenticateToken,
  locationController.getGeofences.bind(locationController),
);

/**
 * @route   POST /api/locations/geofences/check
 * @desc    Check if location is within any geofences
 * @access  Private
 */
router.post(
  '/geofences/check',
  trackingRateLimit,
  authenticateToken,
  locationUpdateValidation,
  validateInput,
  locationController.checkGeofences.bind(locationController),
);

/**
 * @route   GET /api/locations/statistics
 * @desc    Get location tracking statistics for user
 * @access  Private
 */
router.get(
  '/statistics',
  locationRateLimit,
  authenticateToken,
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month', 'year'])
      .withMessage('Period must be day, week, month, or year'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
  ],
  validateInput,
  locationController.getLocationStatistics.bind(locationController),
);

/**
 * Google's own geocoding, place-search and directions replies, fetched with
 * the server's key, for the app. See services/GoogleWebServiceProxy.ts.
 * A place search sends a request per keystroke, so the limit is generous.
 */
const googleRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: {
    success: false,
    error: 'Too many map searches, please slow down',
    code: 'GOOGLE_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('google-proxy'),
  keyGenerator: rateLimitKey,
});

/**
 * @route   GET /api/locations/google/:service
 * @desc    geocode | autocomplete | details | directions, answered by Google
 * @access  Private
 */
router.get(
  '/google/:service',
  googleRateLimit,
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    const service = String(req.params['service'] ?? '');
    if (!isGoogleService(service)) {
      res.status(404).json({ success: false, error: 'Unknown map service', code: 'UNKNOWN_MAP_SERVICE', timestamp: new Date().toISOString() });
      return;
    }

    const params = pickParams(service, req.query as Record<string, unknown>);
    const missing = missingParam(service, params);
    if (missing) {
      res.status(400).json({ success: false, error: `Missing ${missing}`, code: 'MAP_PARAMS_MISSING', timestamp: new Date().toISOString() });
      return;
    }

    const data = await callGoogle(service, params);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  },
);

export default router;
