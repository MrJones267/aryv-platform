/**
 * @fileoverview Ride controller for handling ride-related operations
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import Ride from '../models/Ride';
import Booking from '../models/Booking';
import User from '../models/User';
import Vehicle from '../models/Vehicle';
import { RideStatus, BookingStatus, GeoPoint } from '../types';
import { AuthenticatedRequest } from '../types';
import { aiService } from '../services/AIService';
import { notificationService } from '../services/NotificationService';
import GroupChatService from '../services/GroupChatService';
import logger, { getErrorMessage, getErrorStack } from '../utils/logger';

export class RideController {
  private groupChatService: GroupChatService;

  constructor() {
    this.groupChatService = new GroupChatService();
  }
  async createRide(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const {
        originAddress,
        originCoordinates,
        destinationAddress,
        destinationCoordinates,
        departureTime,
        availableSeats,
        pricePerSeat,
        vehicleId,
        description,
        estimatedDuration,
        distance,
      } = req.body;

      const driverId = req.user?.id;

      if (!driverId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Verify vehicle ownership
      const vehicle = await Vehicle.findOne({
        where: { id: vehicleId, driverId: driverId },
        transaction,
      });

      if (!vehicle) {
        res.status(404).json({
          success: false,
          error: 'Vehicle not found or not owned by user',
          code: 'VEHICLE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Create ride
      const ride = await Ride.create(
        {
          driverId,
          vehicleId,
          originAddress,
          originCoordinates: {
            type: 'Point',
            coordinates: [originCoordinates.longitude, originCoordinates.latitude],
          } as GeoPoint,
          destinationAddress,
          destinationCoordinates: {
            type: 'Point',
            coordinates: [destinationCoordinates.longitude, destinationCoordinates.latitude],
          } as GeoPoint,
          departureTime: new Date(departureTime),
          availableSeats,
          pricePerSeat,
          description,
          estimatedDuration,
          distance,
          status: RideStatus.PENDING,
        },
        { transaction },
      );

      await transaction.commit();

      // Fetch created ride with associations
      const createdRide = await Ride.findByPk(ride.id, {
        include: [
          {
            model: User,
            as: 'driver',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'profileImage'],
          },
          {
            model: Vehicle,
            as: 'vehicle',
            attributes: ['id', 'make', 'model', 'year', 'color', 'licensePlate'],
          },
        ],
      });

      res.status(201).json({
        success: true,
        data: createdRide,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      console.error(`[${new Date().toISOString()}] Error in createRide:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create ride',
        code: 'RIDE_CREATION_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async searchRides(req: Request, res: Response): Promise<void> {
    try {
      const {
        originLat,
        originLng,
        destinationLat,
        destinationLng,
        departureDate,
        radius = 10,
        seats = 1,
        maxPrice,
        page = 1,
        limit = 20,
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);
      const searchDate = new Date(departureDate as string);
      const searchRadius = Number(radius) * 1000; // Convert km to meters

      // Build where clause
      const whereClause: any = {
        status: {
          [Op.in]: [RideStatus.PENDING, RideStatus.CONFIRMED],
        },
        availableSeats: {
          [Op.gte]: Number(seats),
        },
        departureTime: {
          [Op.gte]: searchDate,
          [Op.lt]: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000), // Same day
        },
      };

      if (maxPrice) {
        whereClause.pricePerSeat = {
          [Op.lte]: Number(maxPrice),
        };
      }

      // Use PostGIS for geospatial search
      const rides = await Ride.findAndCountAll({
        where: {
          ...whereClause,
          [Op.and]: [
            sequelize.where(
              sequelize.fn(
                'ST_DWithin',
                sequelize.col('originCoordinates'),
                sequelize.fn('ST_GeomFromText', `POINT(${originLng} ${originLat})`, 4326),
                searchRadius,
              ),
              true,
            ),
            sequelize.where(
              sequelize.fn(
                'ST_DWithin',
                sequelize.col('destinationCoordinates'),
                sequelize.fn('ST_GeomFromText', `POINT(${destinationLng} ${destinationLat})`, 4326),
                searchRadius,
              ),
              true,
            ),
          ],
        },
        include: [
          {
            model: User,
            as: 'driver',
            attributes: ['id', 'firstName', 'lastName', 'profileImage'],
          },
          {
            model: Vehicle,
            as: 'vehicle',
            attributes: ['id', 'make', 'model', 'year', 'color'],
          },
        ],
        order: [['departureTime', 'ASC']],
        limit: Number(limit),
        offset,
      });

      // Calculate distances for sorting
      const ridesWithDistance = rides.rows.map((ride) => {
        const originDistance = this.calculateDistance(
          Number(originLat),
          Number(originLng),
          ride.originCoordinates.coordinates[1],
          ride.originCoordinates.coordinates[0],
        );
        const destinationDistance = this.calculateDistance(
          Number(destinationLat),
          Number(destinationLng),
          ride.destinationCoordinates.coordinates[1],
          ride.destinationCoordinates.coordinates[0],
        );

        return {
          ...ride.toJSON(),
          originDistance,
          destinationDistance,
          totalDistance: originDistance + destinationDistance,
        };
      });

      // Sort by total distance
      ridesWithDistance.sort((a, b) => a.totalDistance - b.totalDistance);

      res.json({
        success: true,
        data: {
          rides: ridesWithDistance,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: rides.count,
            totalPages: Math.ceil(rides.count / Number(limit)),
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in searchRides:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        query: req.query,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to search rides',
        code: 'RIDE_SEARCH_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getRideById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const ride = await Ride.findByPk(id, {
        include: [
          {
            model: User,
            as: 'driver',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'profileImage'],
          },
          {
            model: Vehicle,
            as: 'vehicle',
            attributes: ['id', 'make', 'model', 'year', 'color', 'licensePlate'],
          },
        ],
      });

      if (!ride) {
        res.status(404).json({
          success: false,
          error: 'Ride not found',
          code: 'RIDE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Get booking count
      const bookingCount = await Booking.count({
        where: {
          rideId: id,
          status: {
            [Op.in]: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
          },
        },
      });

      res.json({
        success: true,
        data: {
          ...ride.toJSON(),
          bookedSeats: bookingCount,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in getRideById:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        rideId: req.params['id'],
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get ride',
        code: 'GET_RIDE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getUserRides(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const requesterId = req.user?.id;

      // Users can only view their own rides unless they're admin
      if (userId !== requesterId) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: Cannot view other users rides',
          code: 'FORBIDDEN',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Get rides as driver
      const driverRides = await Ride.findAll({
        where: { driverId: userId },
        include: [
          {
            model: Vehicle,
            as: 'vehicle',
            attributes: ['id', 'make', 'model', 'year', 'color'],
          },
        ],
        order: [['departureTime', 'ASC']],
      });

      // Get rides as passenger
      const passengerRides = await Ride.findAll({
        include: [
          {
            model: User,
            as: 'driver',
            attributes: ['id', 'firstName', 'lastName', 'profileImage'],
          },
          {
            model: Vehicle,
            as: 'vehicle',
            attributes: ['id', 'make', 'model', 'year', 'color'],
          },
          {
            model: Booking,
            where: { passengerId: userId },
            attributes: ['id', 'seatsBooked', 'status', 'totalAmount'],
          },
        ],
        order: [['departureTime', 'ASC']],
      });

      res.json({
        success: true,
        data: {
          asDriver: driverRides,
          asPassenger: passengerRides,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in getUserRides:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.params['userId'],
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get user rides',
        code: 'GET_USER_RIDES_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getMyRides(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Delegate to getUserRides
      req.params['userId'] = userId;
      await this.getUserRides(req, res);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in getMyRides:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get user rides',
        code: 'GET_MY_RIDES_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async updateRide(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const updateData = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      const ride = await Ride.findByPk(id, { transaction });

      if (!ride) {
        res.status(404).json({
          success: false,
          error: 'Ride not found',
          code: 'RIDE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      if (ride.driverId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Only the driver can update this ride',
          code: 'FORBIDDEN',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Check if ride can be updated (not in progress or completed)
      if ([RideStatus.IN_PROGRESS, RideStatus.COMPLETED].includes(ride.status)) {
        res.status(400).json({
          success: false,
          error: 'Cannot update ride that is in progress or completed',
          code: 'RIDE_NOT_UPDATABLE',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Process coordinate updates
      if (updateData.originCoordinates) {
        updateData.originCoordinates = {
          type: 'Point',
          coordinates: [
            updateData.originCoordinates.longitude,
            updateData.originCoordinates.latitude,
          ],
        };
      }

      if (updateData.destinationCoordinates) {
        updateData.destinationCoordinates = {
          type: 'Point',
          coordinates: [
            updateData.destinationCoordinates.longitude,
            updateData.destinationCoordinates.latitude,
          ],
        };
      }

      await ride.update(updateData, { transaction });
      await transaction.commit();

      // Fetch updated ride with associations
      const updatedRide = await Ride.findByPk(id, {
        include: [
          {
            model: User,
            as: 'driver',
            attributes: ['id', 'firstName', 'lastName', 'profileImage'],
          },
          {
            model: Vehicle,
            as: 'vehicle',
            attributes: ['id', 'make', 'model', 'year', 'color'],
          },
        ],
      });

      res.json({
        success: true,
        data: updatedRide,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      console.error(`[${new Date().toISOString()}] Error in updateRide:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        rideId: req.params['id'],
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update ride',
        code: 'RIDE_UPDATE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async deleteRide(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      const ride = await Ride.findByPk(id, { transaction });

      if (!ride) {
        res.status(404).json({
          success: false,
          error: 'Ride not found',
          code: 'RIDE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      if (ride.driverId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Only the driver can delete this ride',
          code: 'FORBIDDEN',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Check for confirmed bookings
      const confirmedBookings = await Booking.count({
        where: {
          rideId: id,
          status: BookingStatus.CONFIRMED,
        },
        transaction,
      });

      if (confirmedBookings > 0) {
        res.status(400).json({
          success: false,
          error: 'Cannot delete ride with confirmed bookings',
          code: 'RIDE_HAS_BOOKINGS',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Cancel pending bookings
      await Booking.update(
        { status: BookingStatus.CANCELLED, cancelReason: 'Ride cancelled by driver' },
        {
          where: {
            rideId: id,
            status: BookingStatus.PENDING,
          },
          transaction,
        },
      );

      // Soft delete the ride
      await ride.destroy({ transaction });
      await transaction.commit();

      res.json({
        success: true,
        message: 'Ride cancelled successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      console.error(`[${new Date().toISOString()}] Error in deleteRide:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        rideId: req.params['id'],
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete ride',
        code: 'RIDE_DELETE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async bookRide(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id: rideId } = req.params;
      const { seatsRequested, pickupAddress, dropoffAddress, specialRequests } = req.body;
      const passengerId = req.user?.id;

      if (!passengerId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      const ride = await Ride.findByPk(rideId, { transaction });

      if (!ride) {
        res.status(404).json({
          success: false,
          error: 'Ride not found',
          code: 'RIDE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Check if user is trying to book their own ride
      if (ride.driverId === passengerId) {
        res.status(400).json({
          success: false,
          error: 'Cannot book your own ride',
          code: 'CANNOT_BOOK_OWN_RIDE',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Check ride status
      if (ride.status !== RideStatus.PENDING && ride.status !== RideStatus.CONFIRMED) {
        res.status(400).json({
          success: false,
          error: 'Ride is not available for booking',
          code: 'RIDE_NOT_AVAILABLE',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Check available seats
      const existingBookings = await Booking.sum('seatsBooked', {
        where: {
          rideId,
          status: {
            [Op.in]: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
          },
        },
        transaction,
      });

      const bookedSeats = existingBookings || 0;
      const availableSeats = ride.availableSeats - bookedSeats;

      if (seatsRequested > availableSeats) {
        res.status(400).json({
          success: false,
          error: `Only ${availableSeats} seats available`,
          code: 'INSUFFICIENT_SEATS',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Check if user already has a booking for this ride
      const existingBooking = await Booking.findOne({
        where: {
          rideId,
          passengerId,
        },
        transaction,
      });

      if (existingBooking) {
        res.status(400).json({
          success: false,
          error: 'You already have a booking for this ride',
          code: 'BOOKING_EXISTS',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Calculate total amount (simple calculation, can be enhanced)
      const totalAmount = ride.pricePerSeat * seatsRequested;
      const platformFee = totalAmount * 0.05; // 5% platform fee

      // Create booking
      const booking = await Booking.create(
        {
          rideId,
          passengerId,
          seatsBooked: seatsRequested,
          totalAmount: totalAmount + platformFee,
          platformFee,
          pickupAddress,
          dropoffAddress,
          specialRequests,
          status: BookingStatus.PENDING,
        },
        { transaction },
      );

      await transaction.commit();

      // Send real-time notification to driver about new booking request
      await notificationService.notifyNewBookingRequest(booking.id);

      // Fetch created booking with associations
      const createdBooking = await Booking.findByPk(booking.id, {
        include: [
          {
            model: Ride,
            as: 'ride',
            include: [
              {
                model: User,
                as: 'driver',
                attributes: ['id', 'firstName', 'lastName', 'phoneNumber', 'profileImage'],
              },
            ],
          },
          {
            model: User,
            as: 'passenger',
            attributes: ['id', 'firstName', 'lastName', 'phoneNumber', 'profileImage'],
          },
        ],
      });

      res.status(201).json({
        success: true,
        data: createdBooking,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      console.error(`[${new Date().toISOString()}] Error in bookRide:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        rideId: req.params['id'],
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to book ride',
        code: 'BOOKING_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getRideBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: rideId } = req.params;
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

      if (ride.driverId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Only the driver can view ride bookings',
          code: 'FORBIDDEN',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const bookings = await Booking.findAll({
        where: { rideId },
        include: [
          {
            model: User,
            as: 'passenger',
            attributes: ['id', 'firstName', 'lastName', 'phoneNumber', 'profileImage'],
          },
        ],
        order: [['createdAt', 'ASC']],
      });

      res.json({
        success: true,
        data: bookings,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in getRideBookings:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        rideId: req.params['id'],
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get ride bookings',
        code: 'GET_BOOKINGS_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async updateRideStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id: rideId } = req.params;
      const { status } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      const ride = await Ride.findByPk(rideId, { transaction });

      if (!ride) {
        res.status(404).json({
          success: false,
          error: 'Ride not found',
          code: 'RIDE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      if (ride.driverId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Only the driver can update ride status',
          code: 'FORBIDDEN',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // Validate status transition
      const validTransitions: { [key: string]: RideStatus[] } = {
        [RideStatus.PENDING]: [RideStatus.CONFIRMED, RideStatus.CANCELLED],
        [RideStatus.CONFIRMED]: [RideStatus.IN_PROGRESS, RideStatus.CANCELLED],
        [RideStatus.IN_PROGRESS]: [RideStatus.COMPLETED],
        [RideStatus.COMPLETED]: [],
        [RideStatus.CANCELLED]: [],
      };

      if (!validTransitions[ride.status].includes(status)) {
        res.status(400).json({
          success: false,
          error: `Cannot change status from ${ride.status} to ${status}`,
          code: 'INVALID_STATUS_TRANSITION',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      await ride.update({ status }, { transaction });

      // Update booking statuses if ride is completed
      if (status === RideStatus.COMPLETED) {
        await Booking.update(
          { status: BookingStatus.COMPLETED },
          {
            where: {
              rideId,
              status: BookingStatus.CONFIRMED,
            },
            transaction,
          },
        );

        // Handle group chat completion after transaction commits
        await transaction.commit();

        // Process ride group completion (auto-disbanding)
        try {
          await this.groupChatService.handleRideCompletion(rideId);
          logger.info('Successfully processed ride group completion', { rideId });
        } catch (error) {
          // Log error but don't fail the ride completion
          logger.error('Error processing ride group completion:', { rideId, error });
        }
      } else {
        await transaction.commit();
      }

      res.json({
        success: true,
        data: { ...ride.toJSON(), status },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      console.error(`[${new Date().toISOString()}] Error in updateRideStatus:`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        rideId: req.params['id'],
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update ride status',
        code: 'STATUS_UPDATE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Utility method for distance calculation
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // AI-Powered Methods

  async findRideMatches(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        originAddress,
        originCoordinates,
        destinationAddress,
        destinationCoordinates,
        departureTime,
        preferences = {},
      } = req.body;

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

      logger.info('AI ride matching request', {
        userId,
        origin: originCoordinates,
        destination: destinationCoordinates,
        departureTime,
      });

      // Call AI service for ride matching
      const aiResult = await aiService.findRideMatches({
        origin: {
          latitude: originCoordinates.latitude,
          longitude: originCoordinates.longitude,
        },
        destination: {
          latitude: destinationCoordinates.latitude,
          longitude: destinationCoordinates.longitude,
        },
        departure_time: departureTime,
        preferences: {
          max_distance: preferences.maxDistance || 10,
          max_time_difference: preferences.maxTimeDifference || 2,
          max_price: preferences.maxPrice,
          vehicle_preferences: preferences.vehiclePreferences || {},
          seats_needed: preferences.seatsNeeded || 1,
        },
      });

      if (!aiResult.success) {
        logger.warn('AI ride matching failed', { error: aiResult.error, userId });
        res.status(500).json({
          success: false,
          error: aiResult.error || 'AI matching service unavailable',
          code: 'AI_MATCHING_FAILED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: {
          matches: aiResult.data?.matches || [],
          total_matches: aiResult.data?.total_matches || 0,
          search_params: {
            origin: { address: originAddress, coordinates: originCoordinates },
            destination: { address: destinationAddress, coordinates: destinationCoordinates },
            departure_time: departureTime,
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Error in findRideMatches', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to find ride matches',
        code: 'FIND_MATCHES_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async calculateDynamicPrice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        originCoordinates,
        destinationCoordinates,
        departureTime,
        distance,
        estimatedDuration,
        marketConditions = {},
      } = req.body;

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

      logger.info('AI pricing calculation request', {
        userId,
        origin: originCoordinates,
        destination: destinationCoordinates,
        distance,
        departureTime,
      });

      // Call AI service for dynamic pricing
      const aiResult = await aiService.calculateDynamicPrice({
        ride_data: {
          origin: {
            latitude: originCoordinates.latitude,
            longitude: originCoordinates.longitude,
          },
          destination: {
            latitude: destinationCoordinates.latitude,
            longitude: destinationCoordinates.longitude,
          },
          departure_time: departureTime,
          distance_km: distance || this.calculateDistance(
            originCoordinates.latitude,
            originCoordinates.longitude,
            destinationCoordinates.latitude,
            destinationCoordinates.longitude,
          ),
          estimated_duration_minutes: estimatedDuration || ((distance || 10) * 2),
        },
        market_conditions: marketConditions,
      });

      if (!aiResult.success) {
        logger.warn('AI pricing calculation failed', { error: aiResult.error, userId });
        res.status(500).json({
          success: false,
          error: aiResult.error || 'AI pricing service unavailable',
          code: 'AI_PRICING_FAILED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: aiResult.data,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Error in calculateDynamicPrice', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to calculate dynamic price',
        code: 'PRICING_CALCULATION_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async optimizeRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { waypoints, constraints = {} } = req.body;
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

      if (!waypoints || waypoints.length < 2) {
        res.status(400).json({
          success: false,
          error: 'At least 2 waypoints required for route optimization',
          code: 'INSUFFICIENT_WAYPOINTS',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.info('AI route optimization request', {
        userId,
        waypointCount: waypoints.length,
        constraints,
      });

      // Call AI service for route optimization
      const aiResult = await aiService.optimizeRoute({
        waypoints,
        constraints: {
          max_passengers: constraints.maxPassengers || 4,
          max_detour_factor: constraints.maxDetourFactor || 1.5,
        },
      });

      if (!aiResult.success) {
        logger.warn('AI route optimization failed', { error: aiResult.error, userId });
        res.status(500).json({
          success: false,
          error: aiResult.error || 'AI route optimization service unavailable',
          code: 'AI_ROUTE_OPTIMIZATION_FAILED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: aiResult.data,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Error in optimizeRoute', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to optimize route',
        code: 'ROUTE_OPTIMIZATION_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async predictDemand(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { location, timeRange } = req.body;
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

      if (!location || !timeRange) {
        res.status(400).json({
          success: false,
          error: 'Location and time range are required',
          code: 'MISSING_REQUIRED_PARAMETERS',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.info('AI demand prediction request', {
        userId,
        location,
        timeRange,
      });

      // Call AI service for demand prediction
      const aiResult = await aiService.predictDemand({
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        time_range: {
          start: timeRange.start,
          end: timeRange.end,
        },
      });

      if (!aiResult.success) {
        logger.warn('AI demand prediction failed', { error: aiResult.error, userId });
        res.status(500).json({
          success: false,
          error: aiResult.error || 'AI demand prediction service unavailable',
          code: 'AI_DEMAND_PREDICTION_FAILED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: aiResult.data,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Error in predictDemand', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to predict demand',
        code: 'DEMAND_PREDICTION_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getRideRecommendations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        originCoordinates,
        destinationCoordinates,
        departureTime,
        userPreferences = {},
      } = req.body;

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

      logger.info('AI ride recommendations request', {
        userId,
        origin: originCoordinates,
        destination: destinationCoordinates,
        departureTime,
      });

      // Call AI service for comprehensive ride recommendations
      const aiResult = await aiService.getRideRecommendations(
        { latitude: originCoordinates.latitude, longitude: originCoordinates.longitude },
        { latitude: destinationCoordinates.latitude, longitude: destinationCoordinates.longitude },
        departureTime,
        userPreferences,
      );

      if (!aiResult.success) {
        logger.warn('AI ride recommendations failed', { error: aiResult.error, userId });
        res.status(500).json({
          success: false,
          error: aiResult.error || 'AI recommendations service unavailable',
          code: 'AI_RECOMMENDATIONS_FAILED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: aiResult.data,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Error in getRideRecommendations', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get ride recommendations',
        code: 'RECOMMENDATIONS_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
