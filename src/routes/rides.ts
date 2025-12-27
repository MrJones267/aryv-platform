/**
 * @fileoverview Ride API routes
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { RideController } from '../controllers/RideController';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const rideController = new RideController();

// Rate limiting for ride operations
const rideRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many ride requests from this IP, please try again later',
});

const createRideRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit ride creation to 10 per hour per IP
  message: 'Too many ride creation attempts, please try again later',
});

// Validation schemas
const createRideValidation = [
  body('originAddress')
    .isLength({ min: 10, max: 500 })
    .withMessage('Origin address must be between 10 and 500 characters'),
  body('originCoordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Origin latitude must be between -90 and 90'),
  body('originCoordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Origin longitude must be between -180 and 180'),
  body('destinationAddress')
    .isLength({ min: 10, max: 500 })
    .withMessage('Destination address must be between 10 and 500 characters'),
  body('destinationCoordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Destination latitude must be between -90 and 90'),
  body('destinationCoordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Destination longitude must be between -180 and 180'),
  body('departureTime')
    .isISO8601()
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Departure time must be in the future');
      }
      return true;
    }),
  body('availableSeats')
    .isInt({ min: 1, max: 7 })
    .withMessage('Available seats must be between 1 and 7'),
  body('pricePerSeat')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Price per seat must be between 0.01 and 10,000'),
  body('vehicleId')
    .isUUID()
    .withMessage('Vehicle ID must be a valid UUID'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('estimatedDuration')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('Estimated duration must be between 1 and 1440 minutes'),
  body('distance')
    .optional()
    .isFloat({ min: 0.1, max: 2000 })
    .withMessage('Distance must be between 0.1 and 2000 km'),
];

const updateRideValidation = [
  param('id').isUUID().withMessage('Ride ID must be a valid UUID'),
  body('originAddress')
    .optional()
    .isLength({ min: 10, max: 500 })
    .withMessage('Origin address must be between 10 and 500 characters'),
  body('destinationAddress')
    .optional()
    .isLength({ min: 10, max: 500 })
    .withMessage('Destination address must be between 10 and 500 characters'),
  body('departureTime')
    .optional()
    .isISO8601()
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Departure time must be in the future');
      }
      return true;
    }),
  body('availableSeats')
    .optional()
    .isInt({ min: 1, max: 7 })
    .withMessage('Available seats must be between 1 and 7'),
  body('pricePerSeat')
    .optional()
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Price per seat must be between 0.01 and 10,000'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
];

const searchRidesValidation = [
  query('originLat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Origin latitude must be between -90 and 90'),
  query('originLng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Origin longitude must be between -180 and 180'),
  query('destinationLat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Destination latitude must be between -90 and 90'),
  query('destinationLng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Destination longitude must be between -180 and 180'),
  query('departureDate')
    .isISO8601()
    .withMessage('Departure date must be a valid ISO 8601 date'),
  query('radius')
    .optional()
    .isFloat({ min: 1, max: 100 })
    .withMessage('Search radius must be between 1 and 100 km'),
  query('seats')
    .optional()
    .isInt({ min: 1, max: 7 })
    .withMessage('Number of seats must be between 1 and 7'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Maximum price must be greater than 0'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

const rideIdValidation = [
  param('id').isUUID().withMessage('Ride ID must be a valid UUID'),
];

// Routes

/**
 * @route   POST /api/rides
 * @desc    Create a new ride
 * @access  Private
 */
router.post(
  '/',
  createRideRateLimit,
  authenticateToken,
  createRideValidation,
  validateInput,
  rideController.createRide.bind(rideController),
);

/**
 * @route   GET /api/rides/search
 * @desc    Search for available rides
 * @access  Public
 */
router.get(
  '/search',
  rideRateLimit,
  searchRidesValidation,
  validateInput,
  rideController.searchRides.bind(rideController),
);

/**
 * @route   GET /api/rides/user/:userId
 * @desc    Get rides by user (as driver or passenger)
 * @access  Private
 */
router.get(
  '/user/:userId',
  rideRateLimit,
  authenticateToken,
  [param('userId').isUUID().withMessage('User ID must be a valid UUID')],
  validateInput,
  rideController.getUserRides.bind(rideController),
);

/**
 * @route   GET /api/rides/my-rides
 * @desc    Get current user's rides
 * @access  Private
 */
router.get(
  '/my-rides',
  rideRateLimit,
  authenticateToken,
  rideController.getMyRides.bind(rideController),
);

/**
 * @route   GET /api/rides/:id
 * @desc    Get ride by ID
 * @access  Public
 */
router.get(
  '/:id',
  rideRateLimit,
  rideIdValidation,
  validateInput,
  rideController.getRideById.bind(rideController),
);

/**
 * @route   PUT /api/rides/:id
 * @desc    Update ride (driver only)
 * @access  Private
 */
router.put(
  '/:id',
  rideRateLimit,
  authenticateToken,
  updateRideValidation,
  validateInput,
  rideController.updateRide.bind(rideController),
);

/**
 * @route   DELETE /api/rides/:id
 * @desc    Cancel/delete ride (driver only)
 * @access  Private
 */
router.delete(
  '/:id',
  rideRateLimit,
  authenticateToken,
  rideIdValidation,
  validateInput,
  rideController.deleteRide.bind(rideController),
);

/**
 * @route   POST /api/rides/:id/book
 * @desc    Book a ride
 * @access  Private
 */
router.post(
  '/:id/book',
  rideRateLimit,
  authenticateToken,
  [
    param('id').isUUID().withMessage('Ride ID must be a valid UUID'),
    body('seatsRequested')
      .isInt({ min: 1, max: 7 })
      .withMessage('Seats requested must be between 1 and 7'),
    body('pickupAddress')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Pickup address cannot exceed 500 characters'),
    body('dropoffAddress')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Dropoff address cannot exceed 500 characters'),
    body('specialRequests')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Special requests cannot exceed 1000 characters'),
  ],
  validateInput,
  rideController.bookRide.bind(rideController),
);

/**
 * @route   GET /api/rides/:id/bookings
 * @desc    Get ride bookings (driver only)
 * @access  Private
 */
router.get(
  '/:id/bookings',
  rideRateLimit,
  authenticateToken,
  rideIdValidation,
  validateInput,
  rideController.getRideBookings.bind(rideController),
);

/**
 * @route   PUT /api/rides/:id/status
 * @desc    Update ride status (driver only)
 * @access  Private
 */
router.put(
  '/:id/status',
  rideRateLimit,
  authenticateToken,
  [
    param('id').isUUID().withMessage('Ride ID must be a valid UUID'),
    body('status')
      .isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'])
      .withMessage('Invalid ride status'),
  ],
  validateInput,
  rideController.updateRideStatus.bind(rideController),
);

// AI-Powered Routes

/**
 * @route   POST /api/rides/ai/find-matches
 * @desc    Find compatible rides using AI matching algorithm
 * @access  Private
 */
router.post(
  '/ai/find-matches',
  rideRateLimit,
  authenticateToken,
  [
    body('originCoordinates.latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Origin latitude must be between -90 and 90'),
    body('originCoordinates.longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Origin longitude must be between -180 and 180'),
    body('destinationCoordinates.latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Destination latitude must be between -90 and 90'),
    body('destinationCoordinates.longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Destination longitude must be between -180 and 180'),
    body('departureTime')
      .isISO8601()
      .withMessage('Departure time must be a valid ISO 8601 datetime'),
    body('originAddress')
      .optional()
      .isLength({ min: 5, max: 500 })
      .withMessage('Origin address must be between 5 and 500 characters'),
    body('destinationAddress')
      .optional()
      .isLength({ min: 5, max: 500 })
      .withMessage('Destination address must be between 5 and 500 characters'),
    body('preferences.maxDistance')
      .optional()
      .isFloat({ min: 0.1, max: 100 })
      .withMessage('Max distance must be between 0.1 and 100 km'),
    body('preferences.maxTimeDifference')
      .optional()
      .isFloat({ min: 0.1, max: 24 })
      .withMessage('Max time difference must be between 0.1 and 24 hours'),
    body('preferences.seatsNeeded')
      .optional()
      .isInt({ min: 1, max: 7 })
      .withMessage('Seats needed must be between 1 and 7'),
  ],
  validateInput,
  rideController.findRideMatches.bind(rideController),
);

/**
 * @route   POST /api/rides/ai/calculate-price
 * @desc    Calculate dynamic pricing using AI algorithm
 * @access  Private
 */
router.post(
  '/ai/calculate-price',
  rideRateLimit,
  authenticateToken,
  [
    body('originCoordinates.latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Origin latitude must be between -90 and 90'),
    body('originCoordinates.longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Origin longitude must be between -180 and 180'),
    body('destinationCoordinates.latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Destination latitude must be between -90 and 90'),
    body('destinationCoordinates.longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Destination longitude must be between -180 and 180'),
    body('departureTime')
      .isISO8601()
      .withMessage('Departure time must be a valid ISO 8601 datetime'),
    body('distance')
      .optional()
      .isFloat({ min: 0.1, max: 1000 })
      .withMessage('Distance must be between 0.1 and 1000 km'),
    body('estimatedDuration')
      .optional()
      .isInt({ min: 1, max: 1440 })
      .withMessage('Estimated duration must be between 1 and 1440 minutes'),
  ],
  validateInput,
  rideController.calculateDynamicPrice.bind(rideController),
);

/**
 * @route   POST /api/rides/ai/optimize-route
 * @desc    Optimize route for multiple passengers using AI
 * @access  Private
 */
router.post(
  '/ai/optimize-route',
  rideRateLimit,
  authenticateToken,
  [
    body('waypoints')
      .isArray({ min: 2, max: 20 })
      .withMessage('Waypoints must be an array with 2 to 20 elements'),
    body('waypoints.*.latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Waypoint latitude must be between -90 and 90'),
    body('waypoints.*.longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Waypoint longitude must be between -180 and 180'),
    body('waypoints.*.type')
      .isIn(['pickup', 'dropoff'])
      .withMessage('Waypoint type must be pickup or dropoff'),
    body('waypoints.*.passenger_id')
      .isString()
      .withMessage('Passenger ID is required for each waypoint'),
    body('constraints.maxPassengers')
      .optional()
      .isInt({ min: 1, max: 8 })
      .withMessage('Max passengers must be between 1 and 8'),
  ],
  validateInput,
  rideController.optimizeRoute.bind(rideController),
);

/**
 * @route   POST /api/rides/ai/predict-demand
 * @desc    Predict ride demand for location and time range
 * @access  Private
 */
router.post(
  '/ai/predict-demand',
  rideRateLimit,
  authenticateToken,
  [
    body('location.latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Location latitude must be between -90 and 90'),
    body('location.longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Location longitude must be between -180 and 180'),
    body('timeRange.start')
      .isISO8601()
      .withMessage('Start time must be a valid ISO 8601 datetime'),
    body('timeRange.end')
      .isISO8601()
      .withMessage('End time must be a valid ISO 8601 datetime'),
  ],
  validateInput,
  rideController.predictDemand.bind(rideController),
);

/**
 * @route   POST /api/rides/ai/recommendations
 * @desc    Get comprehensive ride recommendations with AI analysis
 * @access  Private
 */
router.post(
  '/ai/recommendations',
  rideRateLimit,
  authenticateToken,
  [
    body('originCoordinates.latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Origin latitude must be between -90 and 90'),
    body('originCoordinates.longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Origin longitude must be between -180 and 180'),
    body('destinationCoordinates.latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Destination latitude must be between -90 and 90'),
    body('destinationCoordinates.longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Destination longitude must be between -180 and 180'),
    body('departureTime')
      .isISO8601()
      .withMessage('Departure time must be a valid ISO 8601 datetime'),
    body('userPreferences.maxDistance')
      .optional()
      .isFloat({ min: 0.1, max: 100 })
      .withMessage('Max distance must be between 0.1 and 100 km'),
    body('userPreferences.maxPrice')
      .optional()
      .isFloat({ min: 0.1 })
      .withMessage('Max price must be greater than 0.1'),
  ],
  validateInput,
  rideController.getRideRecommendations.bind(rideController),
);

export default router;
