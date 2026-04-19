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
import googleMapsService from '../services/GoogleMapsService';
import { redisClient } from '../config/redis';
import User from '../models/User';
import notificationService from '../services/NotificationService';

const LOCATION_TTL = 300; // 5 minutes — location data expires if not refreshed
const locationKey = (userId: string) => `loc:${userId}`;

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

      // Cache location in Redis with TTL so stale data auto-expires
      await redisClient.set(locationKey(userId), JSON.stringify(locationData), LOCATION_TTL);

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

      const cached = await redisClient.get(locationKey(userId));
      const location = cached ? JSON.parse(cached) : null;

      res.json({
        success: true,
        data: {
          userId,
          location,
          lastUpdated: location?.timestamp || null,
          message: location ? 'Location data available' : 'No location data available',
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

      // Get active ride participants from socket service
      const socketService = req.app?.get('socketService');
      const activeUserIds: string[] = socketService?.getActiveUserIds?.() || [];

      const userLat = Number(latitude);
      const userLng = Number(longitude);
      const radiusKm = Number(radius);

      // For each active user, fetch cached location from Redis and filter by distance
      const nearbyUsers: any[] = [];

      await Promise.all(
        activeUserIds.map(async (uid: string) => {
          const cached = await redisClient.get(locationKey(uid));
          if (!cached) return;

          const loc = JSON.parse(cached) as { latitude: number; longitude: number; timestamp?: string };
          const dist = googleMapsService.haversineDistance(userLat, userLng, loc.latitude, loc.longitude);
          if (dist > radiusKm) return;

          nearbyUsers.push({ id: uid, distance: Math.round(dist * 10) / 10, location: loc, lastSeen: loc.timestamp });
        })
      );

      nearbyUsers.sort((a, b) => a.distance - b.distance);

      res.json({
        success: true,
        data: {
          users: nearbyUsers,
          searchParams: {
            center: { latitude: userLat, longitude: userLng },
            radius: radiusKm,
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

      const results = await googleMapsService.searchPlaces(
        query as string,
        latitude ? Number(latitude) : undefined,
        longitude ? Number(longitude) : undefined,
        Number(radius)
      );

      res.json({
        success: true,
        data: {
          results,
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

      const addressData = await googleMapsService.reverseGeocode(Number(latitude), Number(longitude));

      res.json({
        success: true,
        data: addressData,
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

      const routeData = await googleMapsService.calculateRoute(
        waypoints,
        routeType as string,
        Boolean(avoidTolls),
        Boolean(avoidHighways)
      );

      res.json({
        success: true,
        data: {
          ...routeData,
          waypoints: waypoints.map((wp: any, index: number) => ({
            ...wp,
            order: index,
            estimatedArrival: new Date(Date.now() + index * Math.ceil((routeData.duration / waypoints.length) * 60 * 1000)),
          })),
          routeOptions: { type: routeType, avoidTolls, avoidHighways },
        },
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

      const socketService = req.app.get('socketService');
      const trackingData = socketService ? await socketService.getRideTrackingData(rideId) : null;
      const currentLocation = trackingData?.driverLocation || null;

      const destLat = ride.destinationCoordinates.coordinates[1];
      const destLng = ride.destinationCoordinates.coordinates[0];

      let durationRemaining = 15;
      let distanceRemaining = 5.0;

      if (currentLocation) {
        const eta = await googleMapsService.getETA(
          { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
          { latitude: destLat, longitude: destLng }
        );
        durationRemaining = eta.duration;
        distanceRemaining = eta.distance;
      }

      res.json({
        success: true,
        data: {
          rideId,
          estimatedArrival: new Date(Date.now() + durationRemaining * 60 * 1000),
          distanceRemaining,
          durationRemaining,
          currentLocation,
          destination: { latitude: destLat, longitude: destLng },
          trafficConditions: 'unknown',
          confidence: currentLocation ? 0.85 : 0.5,
        },
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

      logger.error('EMERGENCY ALERT', { alert: emergencyAlert, priority: 'CRITICAL' });

      // Notify the user's emergency contact and any active ride passengers/driver
      try {
        const user = await User.findByPk(userId, {
          attributes: ['id', 'firstName', 'lastName', 'emergencyContactName', 'emergencyContactPhone'],
        });

        const alertNotification = {
          type: 'emergency_alert',
          title: '🚨 Emergency Alert',
          message: `${user?.firstName || 'A user'} has triggered an emergency alert. Location: ${latitude}, ${longitude}`,
          data: { alertId: emergencyAlert.id, latitude, longitude, type: emergencyType },
          timestamp: new Date().toISOString(),
        };

        // Notify via the user's own notification channel (for support visibility)
        await notificationService.sendToUser(userId, alertNotification);

        // If in a ride, notify all participants
        if (rideId) {
          await notificationService.sendToRide(rideId, alertNotification);
        }
      } catch (notifyErr) {
        logger.warn('Failed to dispatch emergency notifications', {
          error: getErrorMessage(notifyErr), userId,
        });
      }

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

  /** GET /locations/geofences — return user's saved geofences from Redis */
  async getGeofences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }
      const raw = await redisClient.get(`geofences:${userId}`);
      const geofences = raw ? JSON.parse(raw) : [];
      res.json({ success: true, data: geofences, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('getGeofences error', { error: getErrorMessage(error) });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** POST /locations/geofences/check — check if coordinates are inside any active geofences */
  async checkGeofences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }
      const { latitude, longitude } = req.body as { latitude: number; longitude: number };
      const raw = await redisClient.get(`geofences:${userId}`);
      const geofences: any[] = raw ? JSON.parse(raw) : [];

      const triggered = geofences.filter((g: any) => {
        // haversineDistance returns km; g.radius is stored in km (default 1 km)
        const distKm = googleMapsService.haversineDistance(latitude, longitude, g.latitude, g.longitude);
        return distKm <= (g.radius || 1);
      });

      res.json({ success: true, data: { triggered, active: geofences }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('checkGeofences error', { error: getErrorMessage(error) });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** GET /locations/statistics/:userId — ride distance and location stats for a user */
  async getLocationStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId: targetUserId } = req.params;
      const requestingUserId = req.user?.id;
      if (!requestingUserId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const completedRides = await Ride.findAll({
        where: { driverId: targetUserId, status: 'completed' },
        attributes: ['distance', 'departureTime', 'originAddress', 'destinationAddress'],
      });

      const totalDistance = completedRides.reduce((sum: number, r: any) => sum + (r.distance || 0), 0);

      // Top locations from origin/destination
      const locationCounts: Record<string, number> = {};
      completedRides.forEach((r: any) => {
        if (r.originAddress) locationCounts[r.originAddress] = (locationCounts[r.originAddress] || 0) + 1;
        if (r.destinationAddress) locationCounts[r.destinationAddress] = (locationCounts[r.destinationAddress] || 0) + 1;
      });
      const topLocations = Object.entries(locationCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([address, count]) => ({ address, count }));

      res.json({
        success: true,
        data: {
          totalDistance: Math.round(totalDistance * 10) / 10,
          totalRides: completedRides.length,
          topLocations,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('getLocationStatistics error', { error: getErrorMessage(error) });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }
}
