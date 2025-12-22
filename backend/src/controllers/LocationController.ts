/**
 * @fileoverview Location controller for real-time tracking and geospatial operations
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import { Response } from 'express';
import { Op } from 'sequelize';
import Ride from '../models/Ride';
import Booking from '../models/Booking';
import { AuthenticatedRequest } from '../types';
import { BookingStatus } from '../types';
import logger, { getErrorMessage, getErrorStack } from '../utils/logger';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp?: Date;
}

export class LocationController {
  async updateLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const locationData: LocationData = {
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        heading,
        timestamp: new Date(),
      };

      // Store in Redis or database for real-time access
      // For now, we'll simulate storing in memory
      logger.info('Location updated', {
        userId,
        location: { latitude, longitude },
        accuracy,
        timestamp: locationData.timestamp,
      });

      // Emit location update via Socket.io if user is in an active ride
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
    } catch (error) {
      logger.error('Error in updateLocation', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async getCurrentLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // TODO: Get location from Redis/cache
      // For now, return placeholder data
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
    } catch (error) {
      logger.error('Error in getCurrentLocation', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async startRideTracking(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const ride = await Ride.findByPk(rideId);

      if (!ride) {
        res.status(404).json({
          success: false,
          error: 'Ride not found',
          code: 'RIDE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check if user is driver or passenger in this ride
      const isDriver = ride.driverId === userId;

      const userBooking = await Booking.findOne({
        where: {
          rideId,
          passengerId: userId,
          status: {
            [Op.in]: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
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

      // Start tracking session
      const socketService = req.app.get('socketService');
      if (socketService) {
        await socketService.startRideTracking(rideId, userId);
      }

      logger.info('Ride tracking started', {
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
    } catch (error) {
      logger.error('Error in startRideTracking', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async stopRideTracking(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Stop tracking session
      const socketService = req.app.get('socketService');
      if (socketService) {
        await socketService.stopRideTracking(rideId, userId);
      }

      logger.info('Ride tracking stopped', {
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
    } catch (error) {
      logger.error('Error in stopRideTracking', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async getRideTracking(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Get tracking data from Socket.io service
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
    } catch (error) {
      logger.error('Error in getRideTracking', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async findNearbyUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { latitude, longitude, radius = 5, type = 'all' } = req.query;

      // Use PostGIS for geospatial search
      // TODO: Implement actual nearby user search with real-time location data
      // For now, return mock data

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
    } catch (error) {
      logger.error('Error in findNearbyUsers', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async searchPlaces(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { query, latitude, longitude, radius = 10 } = req.query;

      // TODO: Integrate with external geocoding service (Google Places, Mapbox, etc.)
      // For now, return mock search results

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
          query: query as string,
          searchCenter: latitude && longitude ? {
            latitude: Number(latitude),
            longitude: Number(longitude),
          } : null,
          radius: Number(radius),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in searchPlaces', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async reverseGeocode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { latitude, longitude } = req.query;

      // TODO: Integrate with external geocoding service
      // For now, return mock address data

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
    } catch (error) {
      logger.error('Error in reverseGeocode', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async calculateRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // TODO: Integrate with routing service (Google Directions, Mapbox, OSRM, etc.)
      // For now, return mock route data

      const mockRoute = {
        distance: 15.2, // km
        duration: 18, // minutes
        waypoints: waypoints.map((wp: any, index: number) => ({
          ...wp,
          order: index,
          estimatedArrival: new Date(Date.now() + index * 5 * 60 * 1000), // 5 min intervals
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
    } catch (error) {
      logger.error('Error in calculateRoute', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async getETA(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const ride = await Ride.findByPk(rideId);

      if (!ride) {
        res.status(404).json({
          success: false,
          error: 'Ride not found',
          code: 'RIDE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // TODO: Calculate real ETA based on current location and traffic
      const mockETA = {
        rideId,
        estimatedArrival: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        distanceRemaining: 5.2, // km
        durationRemaining: 15, // minutes
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
    } catch (error) {
      logger.error('Error in getETA', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  async sendEmergencyAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // TODO: Send alert to emergency services, contacts, and support team
      logger.error('EMERGENCY ALERT', {
        alert: emergencyAlert,
        priority: 'CRITICAL',
      });

      // Notify via Socket.io if in a ride
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
    } catch (error) {
      logger.error('Error in sendEmergencyAlert', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
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

  // Placeholder methods for additional location features
  async getGeofences(_req: AuthenticatedRequest, res: Response): Promise<void> {
    res.json({
      success: true,
      message: 'Geofences feature to be implemented',
      data: [],
      timestamp: new Date().toISOString(),
    });
  }

  async checkGeofences(_req: AuthenticatedRequest, res: Response): Promise<void> {
    res.json({
      success: true,
      message: 'Geofence checking feature to be implemented',
      data: { triggered: [], active: [] },
      timestamp: new Date().toISOString(),
    });
  }

  async getLocationStatistics(_req: AuthenticatedRequest, res: Response): Promise<void> {
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
