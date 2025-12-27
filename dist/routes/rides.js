"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const RideController_1 = require("../controllers/RideController");
const validation_1 = require("../middleware/validation");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const rideController = new RideController_1.RideController();
const rideRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many ride requests from this IP, please try again later',
});
const createRideRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many ride creation attempts, please try again later',
});
const createRideValidation = [
    (0, express_validator_1.body)('originAddress')
        .isLength({ min: 10, max: 500 })
        .withMessage('Origin address must be between 10 and 500 characters'),
    (0, express_validator_1.body)('originCoordinates.latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Origin latitude must be between -90 and 90'),
    (0, express_validator_1.body)('originCoordinates.longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Origin longitude must be between -180 and 180'),
    (0, express_validator_1.body)('destinationAddress')
        .isLength({ min: 10, max: 500 })
        .withMessage('Destination address must be between 10 and 500 characters'),
    (0, express_validator_1.body)('destinationCoordinates.latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Destination latitude must be between -90 and 90'),
    (0, express_validator_1.body)('destinationCoordinates.longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Destination longitude must be between -180 and 180'),
    (0, express_validator_1.body)('departureTime')
        .isISO8601()
        .custom((value) => {
        if (new Date(value) <= new Date()) {
            throw new Error('Departure time must be in the future');
        }
        return true;
    }),
    (0, express_validator_1.body)('availableSeats')
        .isInt({ min: 1, max: 7 })
        .withMessage('Available seats must be between 1 and 7'),
    (0, express_validator_1.body)('pricePerSeat')
        .isFloat({ min: 0.01, max: 10000 })
        .withMessage('Price per seat must be between 0.01 and 10,000'),
    (0, express_validator_1.body)('vehicleId')
        .isUUID()
        .withMessage('Vehicle ID must be a valid UUID'),
    (0, express_validator_1.body)('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters'),
    (0, express_validator_1.body)('estimatedDuration')
        .optional()
        .isInt({ min: 1, max: 1440 })
        .withMessage('Estimated duration must be between 1 and 1440 minutes'),
    (0, express_validator_1.body)('distance')
        .optional()
        .isFloat({ min: 0.1, max: 2000 })
        .withMessage('Distance must be between 0.1 and 2000 km'),
];
const updateRideValidation = [
    (0, express_validator_1.param)('id').isUUID().withMessage('Ride ID must be a valid UUID'),
    (0, express_validator_1.body)('originAddress')
        .optional()
        .isLength({ min: 10, max: 500 })
        .withMessage('Origin address must be between 10 and 500 characters'),
    (0, express_validator_1.body)('destinationAddress')
        .optional()
        .isLength({ min: 10, max: 500 })
        .withMessage('Destination address must be between 10 and 500 characters'),
    (0, express_validator_1.body)('departureTime')
        .optional()
        .isISO8601()
        .custom((value) => {
        if (new Date(value) <= new Date()) {
            throw new Error('Departure time must be in the future');
        }
        return true;
    }),
    (0, express_validator_1.body)('availableSeats')
        .optional()
        .isInt({ min: 1, max: 7 })
        .withMessage('Available seats must be between 1 and 7'),
    (0, express_validator_1.body)('pricePerSeat')
        .optional()
        .isFloat({ min: 0.01, max: 10000 })
        .withMessage('Price per seat must be between 0.01 and 10,000'),
    (0, express_validator_1.body)('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters'),
];
const searchRidesValidation = [
    (0, express_validator_1.query)('originLat')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Origin latitude must be between -90 and 90'),
    (0, express_validator_1.query)('originLng')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Origin longitude must be between -180 and 180'),
    (0, express_validator_1.query)('destinationLat')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Destination latitude must be between -90 and 90'),
    (0, express_validator_1.query)('destinationLng')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Destination longitude must be between -180 and 180'),
    (0, express_validator_1.query)('departureDate')
        .isISO8601()
        .withMessage('Departure date must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('radius')
        .optional()
        .isFloat({ min: 1, max: 100 })
        .withMessage('Search radius must be between 1 and 100 km'),
    (0, express_validator_1.query)('seats')
        .optional()
        .isInt({ min: 1, max: 7 })
        .withMessage('Number of seats must be between 1 and 7'),
    (0, express_validator_1.query)('maxPrice')
        .optional()
        .isFloat({ min: 0.01 })
        .withMessage('Maximum price must be greater than 0'),
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
];
const rideIdValidation = [
    (0, express_validator_1.param)('id').isUUID().withMessage('Ride ID must be a valid UUID'),
];
router.post('/', createRideRateLimit, auth_1.authenticateToken, createRideValidation, validation_1.validateInput, rideController.createRide.bind(rideController));
router.get('/search', rideRateLimit, searchRidesValidation, validation_1.validateInput, rideController.searchRides.bind(rideController));
router.get('/user/:userId', rideRateLimit, auth_1.authenticateToken, [(0, express_validator_1.param)('userId').isUUID().withMessage('User ID must be a valid UUID')], validation_1.validateInput, rideController.getUserRides.bind(rideController));
router.get('/my-rides', rideRateLimit, auth_1.authenticateToken, rideController.getMyRides.bind(rideController));
router.get('/:id', rideRateLimit, rideIdValidation, validation_1.validateInput, rideController.getRideById.bind(rideController));
router.put('/:id', rideRateLimit, auth_1.authenticateToken, updateRideValidation, validation_1.validateInput, rideController.updateRide.bind(rideController));
router.delete('/:id', rideRateLimit, auth_1.authenticateToken, rideIdValidation, validation_1.validateInput, rideController.deleteRide.bind(rideController));
router.post('/:id/book', rideRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Ride ID must be a valid UUID'),
    (0, express_validator_1.body)('seatsRequested')
        .isInt({ min: 1, max: 7 })
        .withMessage('Seats requested must be between 1 and 7'),
    (0, express_validator_1.body)('pickupAddress')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Pickup address cannot exceed 500 characters'),
    (0, express_validator_1.body)('dropoffAddress')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Dropoff address cannot exceed 500 characters'),
    (0, express_validator_1.body)('specialRequests')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Special requests cannot exceed 1000 characters'),
], validation_1.validateInput, rideController.bookRide.bind(rideController));
router.get('/:id/bookings', rideRateLimit, auth_1.authenticateToken, rideIdValidation, validation_1.validateInput, rideController.getRideBookings.bind(rideController));
router.put('/:id/status', rideRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Ride ID must be a valid UUID'),
    (0, express_validator_1.body)('status')
        .isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'])
        .withMessage('Invalid ride status'),
], validation_1.validateInput, rideController.updateRideStatus.bind(rideController));
router.post('/ai/find-matches', rideRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('originCoordinates.latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Origin latitude must be between -90 and 90'),
    (0, express_validator_1.body)('originCoordinates.longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Origin longitude must be between -180 and 180'),
    (0, express_validator_1.body)('destinationCoordinates.latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Destination latitude must be between -90 and 90'),
    (0, express_validator_1.body)('destinationCoordinates.longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Destination longitude must be between -180 and 180'),
    (0, express_validator_1.body)('departureTime')
        .isISO8601()
        .withMessage('Departure time must be a valid ISO 8601 datetime'),
    (0, express_validator_1.body)('originAddress')
        .optional()
        .isLength({ min: 5, max: 500 })
        .withMessage('Origin address must be between 5 and 500 characters'),
    (0, express_validator_1.body)('destinationAddress')
        .optional()
        .isLength({ min: 5, max: 500 })
        .withMessage('Destination address must be between 5 and 500 characters'),
    (0, express_validator_1.body)('preferences.maxDistance')
        .optional()
        .isFloat({ min: 0.1, max: 100 })
        .withMessage('Max distance must be between 0.1 and 100 km'),
    (0, express_validator_1.body)('preferences.maxTimeDifference')
        .optional()
        .isFloat({ min: 0.1, max: 24 })
        .withMessage('Max time difference must be between 0.1 and 24 hours'),
    (0, express_validator_1.body)('preferences.seatsNeeded')
        .optional()
        .isInt({ min: 1, max: 7 })
        .withMessage('Seats needed must be between 1 and 7'),
], validation_1.validateInput, rideController.findRideMatches.bind(rideController));
router.post('/ai/calculate-price', rideRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('originCoordinates.latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Origin latitude must be between -90 and 90'),
    (0, express_validator_1.body)('originCoordinates.longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Origin longitude must be between -180 and 180'),
    (0, express_validator_1.body)('destinationCoordinates.latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Destination latitude must be between -90 and 90'),
    (0, express_validator_1.body)('destinationCoordinates.longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Destination longitude must be between -180 and 180'),
    (0, express_validator_1.body)('departureTime')
        .isISO8601()
        .withMessage('Departure time must be a valid ISO 8601 datetime'),
    (0, express_validator_1.body)('distance')
        .optional()
        .isFloat({ min: 0.1, max: 1000 })
        .withMessage('Distance must be between 0.1 and 1000 km'),
    (0, express_validator_1.body)('estimatedDuration')
        .optional()
        .isInt({ min: 1, max: 1440 })
        .withMessage('Estimated duration must be between 1 and 1440 minutes'),
], validation_1.validateInput, rideController.calculateDynamicPrice.bind(rideController));
router.post('/ai/optimize-route', rideRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('waypoints')
        .isArray({ min: 2, max: 20 })
        .withMessage('Waypoints must be an array with 2 to 20 elements'),
    (0, express_validator_1.body)('waypoints.*.latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Waypoint latitude must be between -90 and 90'),
    (0, express_validator_1.body)('waypoints.*.longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Waypoint longitude must be between -180 and 180'),
    (0, express_validator_1.body)('waypoints.*.type')
        .isIn(['pickup', 'dropoff'])
        .withMessage('Waypoint type must be pickup or dropoff'),
    (0, express_validator_1.body)('waypoints.*.passenger_id')
        .isString()
        .withMessage('Passenger ID is required for each waypoint'),
    (0, express_validator_1.body)('constraints.maxPassengers')
        .optional()
        .isInt({ min: 1, max: 8 })
        .withMessage('Max passengers must be between 1 and 8'),
], validation_1.validateInput, rideController.optimizeRoute.bind(rideController));
router.post('/ai/predict-demand', rideRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('location.latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Location latitude must be between -90 and 90'),
    (0, express_validator_1.body)('location.longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Location longitude must be between -180 and 180'),
    (0, express_validator_1.body)('timeRange.start')
        .isISO8601()
        .withMessage('Start time must be a valid ISO 8601 datetime'),
    (0, express_validator_1.body)('timeRange.end')
        .isISO8601()
        .withMessage('End time must be a valid ISO 8601 datetime'),
], validation_1.validateInput, rideController.predictDemand.bind(rideController));
router.post('/ai/recommendations', rideRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('originCoordinates.latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Origin latitude must be between -90 and 90'),
    (0, express_validator_1.body)('originCoordinates.longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Origin longitude must be between -180 and 180'),
    (0, express_validator_1.body)('destinationCoordinates.latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Destination latitude must be between -90 and 90'),
    (0, express_validator_1.body)('destinationCoordinates.longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Destination longitude must be between -180 and 180'),
    (0, express_validator_1.body)('departureTime')
        .isISO8601()
        .withMessage('Departure time must be a valid ISO 8601 datetime'),
    (0, express_validator_1.body)('userPreferences.maxDistance')
        .optional()
        .isFloat({ min: 0.1, max: 100 })
        .withMessage('Max distance must be between 0.1 and 100 km'),
    (0, express_validator_1.body)('userPreferences.maxPrice')
        .optional()
        .isFloat({ min: 0.1 })
        .withMessage('Max price must be greater than 0.1'),
], validation_1.validateInput, rideController.getRideRecommendations.bind(rideController));
exports.default = router;
//# sourceMappingURL=rides.js.map