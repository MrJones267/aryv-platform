"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const LocationController_1 = require("../controllers/LocationController");
const validation_1 = require("../middleware/validation");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const locationController = new LocationController_1.LocationController();
const locationRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 60,
    message: 'Too many location requests from this IP, please try again later',
});
const trackingRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 120,
    message: 'Too many tracking requests from this IP, please try again later',
});
const locationUpdateValidation = [
    (0, express_validator_1.body)('latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    (0, express_validator_1.body)('longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),
    (0, express_validator_1.body)('accuracy')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Accuracy must be a positive number'),
    (0, express_validator_1.body)('altitude')
        .optional()
        .isFloat()
        .withMessage('Altitude must be a number'),
    (0, express_validator_1.body)('speed')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Speed must be a positive number'),
    (0, express_validator_1.body)('heading')
        .optional()
        .isFloat({ min: 0, max: 360 })
        .withMessage('Heading must be between 0 and 360 degrees'),
];
const geoSearchValidation = [
    (0, express_validator_1.query)('latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    (0, express_validator_1.query)('longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),
    (0, express_validator_1.query)('radius')
        .optional()
        .isFloat({ min: 0.1, max: 100 })
        .withMessage('Radius must be between 0.1 and 100 km'),
    (0, express_validator_1.query)('type')
        .optional()
        .isIn(['driver', 'passenger', 'courier', 'all'])
        .withMessage('Type must be driver, passenger, courier, or all'),
];
const rideTrackingValidation = [
    (0, express_validator_1.param)('rideId').isUUID().withMessage('Ride ID must be a valid UUID'),
];
router.post('/update', trackingRateLimit, auth_1.authenticateToken, locationUpdateValidation, validation_1.validateInput, locationController.updateLocation.bind(locationController));
router.get('/current', locationRateLimit, auth_1.authenticateToken, locationController.getCurrentLocation.bind(locationController));
router.post('/start-tracking/:rideId', locationRateLimit, auth_1.authenticateToken, rideTrackingValidation, validation_1.validateInput, locationController.startRideTracking.bind(locationController));
router.post('/stop-tracking/:rideId', locationRateLimit, auth_1.authenticateToken, rideTrackingValidation, validation_1.validateInput, locationController.stopRideTracking.bind(locationController));
router.get('/track/:rideId', trackingRateLimit, auth_1.authenticateToken, rideTrackingValidation, validation_1.validateInput, locationController.getRideTracking.bind(locationController));
router.get('/nearby', locationRateLimit, auth_1.authenticateToken, geoSearchValidation, validation_1.validateInput, locationController.findNearbyUsers.bind(locationController));
router.get('/places/search', locationRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.query)('query')
        .isLength({ min: 3, max: 200 })
        .withMessage('Search query must be between 3 and 200 characters'),
    (0, express_validator_1.query)('latitude')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    (0, express_validator_1.query)('longitude')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),
    (0, express_validator_1.query)('radius')
        .optional()
        .isFloat({ min: 1, max: 50 })
        .withMessage('Search radius must be between 1 and 50 km'),
], validation_1.validateInput, locationController.searchPlaces.bind(locationController));
router.get('/places/reverse-geocode', locationRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.query)('latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    (0, express_validator_1.query)('longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),
], validation_1.validateInput, locationController.reverseGeocode.bind(locationController));
router.post('/calculate-route', locationRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('waypoints')
        .isArray({ min: 2, max: 25 })
        .withMessage('Waypoints must be an array with 2 to 25 elements'),
    (0, express_validator_1.body)('waypoints.*.latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Waypoint latitude must be between -90 and 90'),
    (0, express_validator_1.body)('waypoints.*.longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Waypoint longitude must be between -180 and 180'),
    (0, express_validator_1.body)('routeType')
        .optional()
        .isIn(['fastest', 'shortest', 'balanced'])
        .withMessage('Route type must be fastest, shortest, or balanced'),
    (0, express_validator_1.body)('avoidTolls')
        .optional()
        .isBoolean()
        .withMessage('Avoid tolls must be boolean'),
    (0, express_validator_1.body)('avoidHighways')
        .optional()
        .isBoolean()
        .withMessage('Avoid highways must be boolean'),
], validation_1.validateInput, locationController.calculateRoute.bind(locationController));
router.get('/eta/:rideId', trackingRateLimit, auth_1.authenticateToken, rideTrackingValidation, validation_1.validateInput, locationController.getETA.bind(locationController));
router.post('/emergency-alert', locationRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    (0, express_validator_1.body)('longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),
    (0, express_validator_1.body)('emergencyType')
        .isIn(['accident', 'breakdown', 'safety', 'medical', 'other'])
        .withMessage('Invalid emergency type'),
    (0, express_validator_1.body)('message')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Message cannot exceed 500 characters'),
    (0, express_validator_1.body)('rideId')
        .optional()
        .isUUID()
        .withMessage('Ride ID must be a valid UUID'),
], validation_1.validateInput, locationController.sendEmergencyAlert.bind(locationController));
router.get('/geofences', locationRateLimit, auth_1.authenticateToken, locationController.getGeofences.bind(locationController));
router.post('/geofences/check', trackingRateLimit, auth_1.authenticateToken, locationUpdateValidation, validation_1.validateInput, locationController.checkGeofences.bind(locationController));
router.get('/statistics', locationRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.query)('period')
        .optional()
        .isIn(['day', 'week', 'month', 'year'])
        .withMessage('Period must be day, week, month, or year'),
    (0, express_validator_1.query)('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date'),
], validation_1.validateInput, locationController.getLocationStatistics.bind(locationController));
exports.default = router;
//# sourceMappingURL=locations.js.map