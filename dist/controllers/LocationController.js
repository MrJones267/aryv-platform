"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationController = void 0;
const sequelize_1 = require("sequelize");
const Ride_1 = __importDefault(require("../models/Ride"));
const Booking_1 = __importDefault(require("../models/Booking"));
const types_1 = require("../types");
const logger_1 = __importStar(require("../utils/logger"));
class LocationController {
    async updateLocation(req, res) {
        try {
            const { latitude, longitude, accuracy, altitude, speed, heading } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const locationData = {
                latitude,
                longitude,
                accuracy,
                altitude,
                speed,
                heading,
                timestamp: new Date(),
            };
            logger_1.default.info('Location updated', {
                userId,
                location: { latitude, longitude },
                accuracy,
                timestamp: locationData.timestamp,
            });
            const socketService = req.app.get('socketService');
            if (socketService) {
                await socketService.updateUserLocation(userId, locationData);
            }
            res.json({
                success: true,
                message: 'Location updated successfully',
                data: {
                    latitude,
                    longitude,
                    timestamp: locationData.timestamp,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in updateLocation', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to update location',
                code: 'LOCATION_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getCurrentLocation(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            res.json({
                success: true,
                data: {
                    userId,
                    location: null,
                    lastUpdated: null,
                    message: 'No location data available',
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in getCurrentLocation', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get current location',
                code: 'GET_LOCATION_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async startRideTracking(req, res) {
        try {
            const { rideId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const ride = await Ride_1.default.findByPk(rideId);
            if (!ride) {
                res.status(404).json({
                    success: false,
                    error: 'Ride not found',
                    code: 'RIDE_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const isDriver = ride.driverId === userId;
            const userBooking = await Booking_1.default.findOne({
                where: {
                    rideId,
                    passengerId: userId,
                    status: {
                        [sequelize_1.Op.in]: [types_1.BookingStatus.CONFIRMED, types_1.BookingStatus.PENDING],
                    },
                },
            });
            const isPassenger = !!userBooking;
            if (!isDriver && !isPassenger) {
                res.status(403).json({
                    success: false,
                    error: 'User not authorized to track this ride',
                    code: 'TRACKING_FORBIDDEN',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const socketService = req.app.get('socketService');
            if (socketService) {
                await socketService.startRideTracking(rideId, userId);
            }
            logger_1.default.info('Ride tracking started', {
                rideId,
                userId,
                role: isDriver ? 'driver' : 'passenger',
            });
            res.json({
                success: true,
                message: 'Ride tracking started',
                data: {
                    rideId,
                    trackingActive: true,
                    role: isDriver ? 'driver' : 'passenger',
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in startRideTracking', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                rideId: req.params['rideId'],
            });
            res.status(500).json({
                success: false,
                error: 'Failed to start ride tracking',
                code: 'START_TRACKING_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async stopRideTracking(req, res) {
        try {
            const { rideId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const socketService = req.app.get('socketService');
            if (socketService) {
                await socketService.stopRideTracking(rideId, userId);
            }
            logger_1.default.info('Ride tracking stopped', {
                rideId,
                userId,
            });
            res.json({
                success: true,
                message: 'Ride tracking stopped',
                data: {
                    rideId,
                    trackingActive: false,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in stopRideTracking', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                rideId: req.params['rideId'],
            });
            res.status(500).json({
                success: false,
                error: 'Failed to stop ride tracking',
                code: 'STOP_TRACKING_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getRideTracking(req, res) {
        try {
            const { rideId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const socketService = req.app.get('socketService');
            let trackingData = null;
            if (socketService) {
                trackingData = await socketService.getRideTrackingData(rideId);
            }
            res.json({
                success: true,
                data: trackingData || {
                    rideId,
                    participants: [],
                    locations: [],
                    lastUpdated: null,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in getRideTracking', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                rideId: req.params['rideId'],
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get ride tracking data',
                code: 'GET_TRACKING_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async findNearbyUsers(req, res) {
        try {
            const { latitude, longitude, radius = 5, type = 'all' } = req.query;
            const nearbyUsers = [
                {
                    id: 'user-1',
                    firstName: 'John',
                    lastName: 'D.',
                    type: 'driver',
                    distance: 0.5,
                    location: {
                        latitude: Number(latitude) + 0.001,
                        longitude: Number(longitude) + 0.001,
                    },
                    lastSeen: new Date(),
                },
                {
                    id: 'user-2',
                    firstName: 'Jane',
                    lastName: 'S.',
                    type: 'passenger',
                    distance: 1.2,
                    location: {
                        latitude: Number(latitude) - 0.002,
                        longitude: Number(longitude) + 0.002,
                    },
                    lastSeen: new Date(),
                },
            ];
            res.json({
                success: true,
                data: {
                    users: nearbyUsers,
                    searchParams: {
                        center: { latitude: Number(latitude), longitude: Number(longitude) },
                        radius: Number(radius),
                        type,
                    },
                    total: nearbyUsers.length,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in findNearbyUsers', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                query: req.query,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to find nearby users',
                code: 'FIND_NEARBY_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async searchPlaces(req, res) {
        try {
            const { query, latitude, longitude, radius = 10 } = req.query;
            const mockResults = [
                {
                    placeId: 'place-1',
                    name: `${query} - Restaurant`,
                    address: '123 Main St, City, Country',
                    location: {
                        latitude: Number(latitude || 40.7128) + 0.001,
                        longitude: Number(longitude || -74.0060) + 0.001,
                    },
                    types: ['restaurant', 'food', 'establishment'],
                    rating: 4.5,
                    distance: 0.8,
                },
                {
                    placeId: 'place-2',
                    name: `${query} - Shopping Mall`,
                    address: '456 Oak Ave, City, Country',
                    location: {
                        latitude: Number(latitude || 40.7128) - 0.002,
                        longitude: Number(longitude || -74.0060) - 0.002,
                    },
                    types: ['shopping_mall', 'establishment'],
                    rating: 4.2,
                    distance: 1.5,
                },
            ];
            res.json({
                success: true,
                data: {
                    results: mockResults,
                    query: query,
                    searchCenter: latitude && longitude ? {
                        latitude: Number(latitude),
                        longitude: Number(longitude),
                    } : null,
                    radius: Number(radius),
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in searchPlaces', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                query: req.query,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to search places',
                code: 'PLACE_SEARCH_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async reverseGeocode(req, res) {
        try {
            const { latitude, longitude } = req.query;
            const mockAddress = {
                formattedAddress: '123 Main St, Downtown, City, State 12345, Country',
                components: {
                    streetNumber: '123',
                    streetName: 'Main St',
                    neighborhood: 'Downtown',
                    city: 'City',
                    state: 'State',
                    postalCode: '12345',
                    country: 'Country',
                    countryCode: 'CC',
                },
                location: {
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                },
                accuracy: 'ROOFTOP',
                locationType: 'GEOMETRIC_CENTER',
            };
            res.json({
                success: true,
                data: mockAddress,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in reverseGeocode', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                query: req.query,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to reverse geocode location',
                code: 'REVERSE_GEOCODE_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async calculateRoute(req, res) {
        try {
            const { waypoints, routeType = 'fastest', avoidTolls = false, avoidHighways = false } = req.body;
            if (!waypoints || waypoints.length < 2) {
                res.status(400).json({
                    success: false,
                    error: 'At least 2 waypoints required',
                    code: 'INSUFFICIENT_WAYPOINTS',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const mockRoute = {
                distance: 15.2,
                duration: 18,
                waypoints: waypoints.map((wp, index) => ({
                    ...wp,
                    order: index,
                    estimatedArrival: new Date(Date.now() + index * 5 * 60 * 1000),
                })),
                polyline: 'encoded_polyline_string_here',
                legs: [
                    {
                        distance: 8.5,
                        duration: 10,
                        startLocation: waypoints[0],
                        endLocation: waypoints[1],
                        steps: [
                            {
                                instruction: 'Head north on Main St',
                                distance: 2.1,
                                duration: 3,
                                polyline: 'leg_polyline_string',
                            },
                        ],
                    },
                ],
                routeOptions: {
                    type: routeType,
                    avoidTolls,
                    avoidHighways,
                },
                traffic: {
                    currentConditions: 'light',
                    delayMinutes: 2,
                },
            };
            res.json({
                success: true,
                data: mockRoute,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in calculateRoute', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                body: req.body,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to calculate route',
                code: 'ROUTE_CALCULATION_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getETA(req, res) {
        try {
            const { rideId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const ride = await Ride_1.default.findByPk(rideId);
            if (!ride) {
                res.status(404).json({
                    success: false,
                    error: 'Ride not found',
                    code: 'RIDE_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const mockETA = {
                rideId,
                estimatedArrival: new Date(Date.now() + 15 * 60 * 1000),
                distanceRemaining: 5.2,
                durationRemaining: 15,
                currentLocation: {
                    latitude: 40.7128,
                    longitude: -74.0060,
                },
                destination: {
                    latitude: ride.destinationCoordinates.coordinates[1],
                    longitude: ride.destinationCoordinates.coordinates[0],
                },
                trafficConditions: 'moderate',
                confidence: 0.85,
            };
            res.json({
                success: true,
                data: mockETA,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in getETA', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                rideId: req.params['rideId'],
            });
            res.status(500).json({
                success: false,
                error: 'Failed to get ETA',
                code: 'GET_ETA_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async sendEmergencyAlert(req, res) {
        try {
            const { latitude, longitude, emergencyType, message, rideId } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'UNAUTHORIZED',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const emergencyAlert = {
                id: `emergency-${Date.now()}`,
                userId,
                location: { latitude, longitude },
                type: emergencyType,
                message,
                rideId,
                timestamp: new Date(),
                status: 'active',
            };
            logger_1.default.error('EMERGENCY ALERT', {
                alert: emergencyAlert,
                priority: 'CRITICAL',
            });
            const socketService = req.app.get('socketService');
            if (socketService && rideId) {
                await socketService.sendEmergencyAlert(rideId, emergencyAlert);
            }
            res.json({
                success: true,
                message: 'Emergency alert sent successfully',
                data: {
                    alertId: emergencyAlert.id,
                    status: 'sent',
                    timestamp: emergencyAlert.timestamp,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error in sendEmergencyAlert', {
                error: (0, logger_1.getErrorMessage)(error),
                stack: (0, logger_1.getErrorStack)(error),
                userId: req.user?.id,
                body: req.body,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to send emergency alert',
                code: 'EMERGENCY_ALERT_FAILED',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async getGeofences(_req, res) {
        res.json({
            success: true,
            message: 'Geofences feature to be implemented',
            data: [],
            timestamp: new Date().toISOString(),
        });
    }
    async checkGeofences(_req, res) {
        res.json({
            success: true,
            message: 'Geofence checking feature to be implemented',
            data: { triggered: [], active: [] },
            timestamp: new Date().toISOString(),
        });
    }
    async getLocationStatistics(_req, res) {
        res.json({
            success: true,
            message: 'Location statistics feature to be implemented',
            data: {
                totalDistance: 0,
                totalTime: 0,
                averageSpeed: 0,
                topLocations: [],
            },
            timestamp: new Date().toISOString(),
        });
    }
}
exports.LocationController = LocationController;
//# sourceMappingURL=LocationController.js.map