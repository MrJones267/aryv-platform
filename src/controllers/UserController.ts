/**
 * @fileoverview User controller for profile and vehicle management
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import { Response } from 'express';
import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import User from '../models/User';
import Vehicle from '../models/Vehicle';
import Ride from '../models/Ride';
import Booking from '../models/Booking';
import { AuthenticatedRequest } from '../types';
import { UserStatus, VehicleStatus, RideStatus } from '../types';
import logger, { getErrorMessage, getErrorStack } from '../utils/logger';

export class UserController {
  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password', 'refreshToken'] },
        include: [
          {
            model: Vehicle,
            as: 'vehicles',
            attributes: ['id', 'make', 'model', 'year', 'color', 'licensePlate', 'seatingCapacity', 'status'],
          },
        ],
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: user,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getProfile', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get user profile',
        code: 'GET_PROFILE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
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

      const user = await User.findByPk(userId, { transaction });

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      await user.update(updateData, { transaction });
      await transaction.commit();

      // Fetch updated user without sensitive data
      const updatedUser = await User.findByPk(userId, {
        attributes: { exclude: ['password', 'refreshToken'] },
      });

      res.json({
        success: true,
        data: updatedUser,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in updateProfile', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update profile',
        code: 'UPDATE_PROFILE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async uploadAvatar(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // TODO: Implement file upload logic with multer
      // For now, return a placeholder response
      res.json({
        success: true,
        message: 'Avatar upload functionality to be implemented',
        data: {
          profileImage: `https://api.hitch.com/uploads/avatars/${userId}.jpg`,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in uploadAvatar', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to upload avatar',
        code: 'AVATAR_UPLOAD_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async deleteAvatar(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
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

      // TODO: Add profileImage field to User model
      await User.update(
        { /* profileImage: null */ },
        { where: { id: userId }, transaction },
      );

      await transaction.commit();

      res.json({
        success: true,
        message: 'Avatar deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in deleteAvatar', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete avatar',
        code: 'DELETE_AVATAR_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async sendPhoneVerification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { phoneNumber } = req.body;
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

      // Generate 6-digit verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // TODO: Send SMS verification code using SMS service
      logger.info('Phone verification code generated', {
        userId,
        phoneNumber,
        code: verificationCode,
      });

      res.json({
        success: true,
        message: 'Verification code sent successfully',
        data: {
          phoneNumber,
          // In development, return the code for testing
          ...(process.env['NODE_ENV'] === 'development' && { verificationCode }),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in sendPhoneVerification', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to send verification code',
        code: 'PHONE_VERIFICATION_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async confirmPhoneVerification(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { phoneNumber, verificationCode } = req.body;
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

      // TODO: Verify the code against stored verification data
      // For now, accept any 6-digit code
      if (verificationCode.length !== 6) {
        res.status(400).json({
          success: false,
          error: 'Invalid verification code',
          code: 'INVALID_VERIFICATION_CODE',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      // TODO: Add phone verification fields to User model
      await User.update(
        {
          phone: phoneNumber,
          // phoneVerified: true,
          // phoneVerifiedAt: new Date()
        },
        { where: { id: userId }, transaction },
      );

      await transaction.commit();

      res.json({
        success: true,
        message: 'Phone number verified successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in confirmPhoneVerification', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to verify phone number',
        code: 'PHONE_VERIFICATION_CONFIRM_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getDrivingLicense(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const user = await User.findByPk(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: null, // TODO: Add drivingLicense field to User model
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getDrivingLicense', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get driving license',
        code: 'GET_DRIVING_LICENSE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async uploadDrivingLicense(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { licenseNumber, expiryDate, issuingCountry, licenseClass } = req.body;
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

      const drivingLicenseData = {
        licenseNumber,
        expiryDate: new Date(expiryDate),
        issuingCountry,
        licenseClass,
        status: 'pending_verification',
        uploadedAt: new Date(),
      };

      // TODO: Add drivingLicense field to User model
      // await User.update(
      //   { drivingLicense: drivingLicenseData },
      //   { where: { id: userId }, transaction }
      // );

      await transaction.commit();

      res.json({
        success: true,
        message: 'Driving license uploaded for verification',
        data: drivingLicenseData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in uploadDrivingLicense', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to upload driving license',
        code: 'DRIVING_LICENSE_UPLOAD_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getVehicles(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const vehicles = await Vehicle.findAll({
        where: { driverId: userId },
        order: [['createdAt', 'DESC']],
      });

      res.json({
        success: true,
        data: vehicles,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getVehicles', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get vehicles',
        code: 'GET_VEHICLES_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async registerVehicle(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const vehicleData = req.body;
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

      // Check if license plate already exists
      const existingVehicle = await Vehicle.findOne({
        where: { licensePlate: vehicleData.licensePlate },
        transaction,
      });

      if (existingVehicle) {
        res.status(400).json({
          success: false,
          error: 'Vehicle with this license plate already exists',
          code: 'LICENSE_PLATE_EXISTS',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      const vehicle = await Vehicle.create(
        {
          ...vehicleData,
          driverId: userId,
          status: VehicleStatus.PENDING_VERIFICATION,
        },
        { transaction },
      );

      await transaction.commit();

      res.status(201).json({
        success: true,
        data: vehicle,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in registerVehicle', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to register vehicle',
        code: 'VEHICLE_REGISTRATION_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async updateVehicle(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id: vehicleId } = req.params;
      const updateData = req.body;
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

      const vehicle = await Vehicle.findOne({
        where: { id: vehicleId, driverId: userId },
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

      await vehicle.update(updateData, { transaction });
      await transaction.commit();

      res.json({
        success: true,
        data: vehicle,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in updateVehicle', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update vehicle',
        code: 'VEHICLE_UPDATE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async deleteVehicle(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id: vehicleId } = req.params;
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

      const vehicle = await Vehicle.findOne({
        where: { id: vehicleId, driverId: userId },
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

      // Check for active rides using this vehicle
      const activeRides = await Ride.count({
        where: {
          vehicleId,
          status: {
            [Op.in]: [RideStatus.PENDING, RideStatus.CONFIRMED, RideStatus.IN_PROGRESS],
          },
        },
        transaction,
      });

      if (activeRides > 0) {
        res.status(400).json({
          success: false,
          error: 'Cannot delete vehicle with active rides',
          code: 'VEHICLE_HAS_ACTIVE_RIDES',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      await vehicle.destroy({ transaction });
      await transaction.commit();

      res.json({
        success: true,
        message: 'Vehicle deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in deleteVehicle', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete vehicle',
        code: 'VEHICLE_DELETE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async submitVehicleVerification(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const { id: vehicleId } = req.params;
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

      const vehicle = await Vehicle.findOne({
        where: { id: vehicleId, driverId: userId },
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

      await vehicle.update(
        {
          status: VehicleStatus.PENDING_VERIFICATION,
          verificationSubmittedAt: new Date(),
        },
        { transaction },
      );

      await transaction.commit();

      res.json({
        success: true,
        message: 'Vehicle submitted for verification',
        data: vehicle,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in submitVehicleVerification', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to submit vehicle for verification',
        code: 'VEHICLE_VERIFICATION_SUBMIT_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Placeholder methods for payment and other features
  async getPaymentMethods(_req: AuthenticatedRequest, res: Response): Promise<void> {
    res.json({
      success: true,
      message: 'Payment methods feature to be implemented',
      data: [],
      timestamp: new Date().toISOString(),
    });
  }

  async addPaymentMethod(_req: AuthenticatedRequest, res: Response): Promise<void> {
    res.json({
      success: true,
      message: 'Add payment method feature to be implemented',
      timestamp: new Date().toISOString(),
    });
  }

  async removePaymentMethod(_req: AuthenticatedRequest, res: Response): Promise<void> {
    res.json({
      success: true,
      message: 'Remove payment method feature to be implemented',
      timestamp: new Date().toISOString(),
    });
  }

  async getRideHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { page = 1, limit = 20, role = 'all', status } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'UNAUTHORIZED',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const offset = (Number(page) - 1) * Number(limit);
      const whereClause: any = {};

      if (status) {
        whereClause.status = status;
      }

      let rides: any[] = [];
      let totalCount = 0;

      if (role === 'driver' || role === 'all') {
        const driverRides = await Ride.findAndCountAll({
          where: { ...whereClause, driverId: userId },
          include: [
            {
              model: Vehicle,
              as: 'vehicle',
              attributes: ['make', 'model', 'year', 'color'],
            },
          ],
          order: [['departureTime', 'DESC']],
          limit: Number(limit),
          offset,
        });

        rides = [...rides, ...driverRides.rows.map(ride => ({ ...ride.toJSON(), role: 'driver' }))];
        totalCount += driverRides.count;
      }

      if (role === 'passenger' || role === 'all') {
        const passengerRides = await Ride.findAndCountAll({
          include: [
            {
              model: User,
              as: 'driver',
              attributes: ['firstName', 'lastName', 'profileImage'],
            },
            {
              model: Booking,
              where: { passengerId: userId },
              attributes: ['seatsBooked', 'totalAmount', 'status'],
            },
          ],
          where: whereClause,
          order: [['departureTime', 'DESC']],
          limit: Number(limit),
          offset,
        });

        rides = [...rides, ...passengerRides.rows.map(ride => ({ ...ride.toJSON(), role: 'passenger' }))];
        totalCount += passengerRides.count;
      }

      res.json({
        success: true,
        data: {
          rides: rides.slice(0, Number(limit)),
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: totalCount,
            totalPages: Math.ceil(totalCount / Number(limit)),
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getRideHistory', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get ride history',
        code: 'GET_RIDE_HISTORY_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getUserStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Get ride statistics
      const [asDriver, asPassenger] = await Promise.all([
        Ride.findAll({
          where: { driverId: userId },
          attributes: [
            'status',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          ],
          group: ['status'],
        }),
        Booking.findAll({
          where: { passengerId: userId },
          attributes: [
            'status',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalSpent'],
          ],
          group: ['status'],
        }),
      ]);

      const statistics = {
        asDriver: asDriver.reduce((acc: any, item: any) => {
          acc[item.status] = parseInt(item.dataValues.count);
          return acc;
        }, {}),
        asPassenger: asPassenger.reduce((acc: any, item: any) => {
          acc[item.status] = {
            count: parseInt(item.dataValues.count),
            totalSpent: parseFloat(item.dataValues.totalSpent || 0),
          };
          return acc;
        }, {}),
      };

      res.json({
        success: true,
        data: statistics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getUserStatistics', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get user statistics',
        code: 'GET_USER_STATISTICS_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async submitReport(_req: AuthenticatedRequest, res: Response): Promise<void> {
    res.json({
      success: true,
      message: 'Report submission feature to be implemented',
      timestamp: new Date().toISOString(),
    });
  }

  async deactivateAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user?.id;
      const { reason } = req.body;

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

      // Check for active rides
      const activeRides = await Ride.count({
        where: {
          driverId: userId,
          status: {
            [Op.in]: [RideStatus.PENDING, RideStatus.CONFIRMED, RideStatus.IN_PROGRESS],
          },
        },
        transaction,
      });

      if (activeRides > 0) {
        res.status(400).json({
          success: false,
          error: 'Cannot deactivate account with active rides',
          code: 'HAS_ACTIVE_RIDES',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      await User.update(
        {
          status: UserStatus.DEACTIVATED,
          deactivatedAt: new Date(),
          deactivationReason: reason,
        },
        { where: { id: userId }, transaction },
      );

      await transaction.commit();

      res.json({
        success: true,
        message: 'Account deactivated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in deactivateAccount', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to deactivate account',
        code: 'DEACTIVATE_ACCOUNT_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
