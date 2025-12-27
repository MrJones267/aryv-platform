/**
 * @fileoverview Location and real-time tracking API routes
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { LocationController } from '../controllers/LocationController';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const locationController = new LocationController();

// Rate limiting for location operations
const locationRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Allow 60 location updates per minute
  message: 'Too many location requests from this IP, please try again later',
});

const trackingRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // Allow 120 tracking requests per minute for real-time updates
  message: 'Too many tracking requests from this IP, please try again later',
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
 * @desc    Send emergency alert with location
 * @access  Private
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
  locationController.sendEmergencyAlert.bind(locationController),
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

export default router;
