/**
 * @fileoverview User controller for profile and vehicle management
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import crypto from 'crypto';
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
import smsService from '../services/SMSService';

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
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ success: false, error: 'No image file provided. Send file as multipart/form-data with field name "avatar"', code: 'NO_FILE', timestamp: new Date().toISOString() });
        return;
      }

      const baseUrl = process.env['API_BASE_URL'] || `http://localhost:${process.env['PORT'] || 3001}`;
      const profilePicture = `${baseUrl}/uploads/avatars/${file.filename}`;

      await User.update({ profilePicture }, { where: { id: userId } });

      logger.info('Avatar uploaded', { userId, filename: file.filename, size: file.size });

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: { profilePicture },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in uploadAvatar', { error: getErrorMessage(error), stack: getErrorStack(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to upload avatar', code: 'AVATAR_UPLOAD_FAILED', timestamp: new Date().toISOString() });
    }
  }

  async deleteAvatar(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      await User.update({ profilePicture: null }, { where: { id: userId } });

      res.json({ success: true, message: 'Avatar deleted successfully', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in deleteAvatar', { error: getErrorMessage(error), stack: getErrorStack(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to delete avatar', code: 'DELETE_AVATAR_FAILED', timestamp: new Date().toISOString() });
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

      const { code: verificationCode, sent } = await smsService.sendVerificationCode(phoneNumber);

      logger.info('Phone verification code dispatched', { userId, phoneNumber, sent });

      res.json({
        success: true,
        message: sent ? 'Verification code sent to your phone' : 'Verification code generated (SMS not configured)',
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

      // Verify the code against the stored OTP
      const isValid = await smsService.verifyCode(phoneNumber, verificationCode);
      if (!isValid) {
        res.status(400).json({
          success: false,
          error: 'Invalid or expired verification code',
          code: 'INVALID_VERIFICATION_CODE',
          timestamp: new Date().toISOString(),
        });
        await transaction.rollback();
        return;
      }

      await User.update(
        { phone: phoneNumber },
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

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const prefs = (user.preferences as Record<string, any>) || {};
      res.json({
        success: true,
        data: prefs['drivingLicense'] || null,
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

      // Store driving license in preferences JSONB field
      const existingUser = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      const currentPrefs = ((existingUser?.preferences as Record<string, any>) || {});
      currentPrefs['drivingLicense'] = drivingLicenseData;
      await User.update({ preferences: currentPrefs }, { where: { id: userId }, transaction });

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

  /** POST /users/vehicles/:id/documents — upload registration or insurance document */
  async uploadVehicleDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: vehicleId } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const vehicle = await Vehicle.findOne({ where: { id: vehicleId, driverId: userId } });
      if (!vehicle) {
        res.status(404).json({ success: false, error: 'Vehicle not found', code: 'VEHICLE_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const file = (req as any).file;
      const documentType = req.body.documentType as 'registration' | 'insurance';

      if (!file) {
        res.status(400).json({ success: false, error: 'No document file uploaded', code: 'NO_FILE', timestamp: new Date().toISOString() });
        return;
      }

      const documentUrl = `/uploads/documents/${file.filename}`;
      const updateData: Record<string, string> = {};

      if (documentType === 'registration') {
        updateData['registrationDocument'] = documentUrl;
      } else if (documentType === 'insurance') {
        updateData['insuranceDocument'] = documentUrl;
      } else {
        res.status(400).json({ success: false, error: 'documentType must be registration or insurance', code: 'INVALID_DOCUMENT_TYPE', timestamp: new Date().toISOString() });
        return;
      }

      await vehicle.update(updateData);

      res.json({ success: true, data: { documentUrl }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in uploadVehicleDocument', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** POST /users/vehicles/:id/photos — upload a vehicle photo */
  async uploadVehiclePhoto(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: vehicleId } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const vehicle = await Vehicle.findOne({ where: { id: vehicleId, driverId: userId } });
      if (!vehicle) {
        res.status(404).json({ success: false, error: 'Vehicle not found', code: 'VEHICLE_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ success: false, error: 'No photo file uploaded', code: 'NO_FILE', timestamp: new Date().toISOString() });
        return;
      }

      const photoUrl = `/uploads/vehicles/${file.filename}`;
      const prefs = ((vehicle as any).preferences as Record<string, any>) || {};
      const photos: string[] = prefs['photos'] || [];
      photos.push(photoUrl);
      await vehicle.update({ preferences: { ...prefs, photos } } as any);

      res.json({ success: true, data: { photoUrl }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in uploadVehiclePhoto', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** POST /users/vehicles/:id/photos/delete — remove a vehicle photo */
  async deleteVehiclePhoto(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: vehicleId } = req.params;
      const { photoUrl } = req.body as { photoUrl: string };

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      if (!photoUrl) {
        res.status(400).json({ success: false, error: 'photoUrl is required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const vehicle = await Vehicle.findOne({ where: { id: vehicleId, driverId: userId } });
      if (!vehicle) {
        res.status(404).json({ success: false, error: 'Vehicle not found', code: 'VEHICLE_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const prefs = ((vehicle as any).preferences as Record<string, any>) || {};
      const photos: string[] = (prefs['photos'] || []).filter((p: string) => p !== photoUrl);
      await vehicle.update({ preferences: { ...prefs, photos } } as any);

      res.json({ success: true, message: 'Photo deleted', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in deleteVehiclePhoto', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  // Payment methods — read/write from user.preferences.paymentMethods
  async getPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }
      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }
      const prefs = (user.preferences as Record<string, any>) || {};
      res.json({ success: true, data: prefs['paymentMethods'] || [], timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in getPaymentMethods', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async addPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }
      const user = await User.findByPk(userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }
      const prefs = (user.preferences as Record<string, any>) || {};
      const methods: any[] = prefs['paymentMethods'] || [];
      const newMethod = {
        id: `pm_${require('crypto').randomBytes(8).toString('hex')}`,
        ...req.body,
        createdAt: new Date().toISOString(),
        isDefault: methods.length === 0,
      };
      methods.push(newMethod);
      await user.update({ preferences: { ...prefs, paymentMethods: methods } });
      res.status(201).json({ success: true, data: newMethod, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in addPaymentMethod', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async removePaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: methodId } = req.params;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }
      const user = await User.findByPk(userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }
      const prefs = (user.preferences as Record<string, any>) || {};
      const methods: any[] = (prefs['paymentMethods'] || []).filter((m: any) => m.id !== methodId);
      await user.update({ preferences: { ...prefs, paymentMethods: methods } });
      res.json({ success: true, message: 'Payment method removed', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in removePaymentMethod', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
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

  async submitReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const reporterId = req.user?.id;
      if (!reporterId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const { userId: reportedUserId, reason, description, rideId } = req.body;

      if (!reportedUserId || !reason || !description) {
        res.status(400).json({ success: false, error: 'userId, reason, and description are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      if (reportedUserId === reporterId) {
        res.status(400).json({ success: false, error: 'Cannot report yourself', code: 'SELF_REPORT', timestamp: new Date().toISOString() });
        return;
      }

      const reportedUser = await User.findByPk(reportedUserId);
      if (!reportedUser) {
        res.status(404).json({ success: false, error: 'Reported user not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      // Store report in reported user's preferences under 'reports' array
      const prefs = (reportedUser.preferences as Record<string, any>) || {};
      const reports: any[] = prefs['reports'] || [];
      const report = {
        id: `rpt_${require('crypto').randomBytes(8).toString('hex')}`,
        reporterId,
        reason,
        description,
        rideId: rideId || null,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      reports.push(report);
      await reportedUser.update({ preferences: { ...prefs, reports } });

      logger.info('User report submitted', { reportId: report.id, reporterId, reportedUserId });

      res.status(201).json({ success: true, message: 'Report submitted successfully', data: { reportId: report.id }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in submitReport', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences', 'countryCode', 'timezone'] });
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const preferences = (user.preferences as Record<string, any>) || {};
      res.json({
        success: true,
        data: {
          settings: {
            language: preferences['language'] || 'en',
            theme: preferences['theme'] || 'light',
            currency: preferences['currency'] || 'BWP',
            timezone: user.timezone || 'Africa/Gaborone',
            countryCode: user.countryCode || 'BW',
            notifications: preferences['notifications'] || { push: true, email: true, sms: false },
            privacy: preferences['privacy'] || { shareLocation: true, showOnline: true },
            dataUsage: preferences['dataUsage'] || { autoDownload: false, highQualityMaps: true },
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getSettings', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to get settings', code: 'GET_SETTINGS_FAILED', timestamp: new Date().toISOString() });
    }
  }

  async updateSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const currentPreferences = (user.preferences as Record<string, any>) || {};
      const { language, theme, currency, timezone, countryCode, notifications, privacy, dataUsage } = req.body;

      const updates: Record<string, any> = {
        preferences: { ...currentPreferences },
      };

      if (language) updates['preferences']['language'] = language;
      if (theme) updates['preferences']['theme'] = theme;
      if (currency) updates['preferences']['currency'] = currency;
      if (notifications) updates['preferences']['notifications'] = { ...(currentPreferences['notifications'] || {}), ...notifications };
      if (privacy) updates['preferences']['privacy'] = { ...(currentPreferences['privacy'] || {}), ...privacy };
      if (dataUsage) updates['preferences']['dataUsage'] = { ...(currentPreferences['dataUsage'] || {}), ...dataUsage };
      if (timezone) (updates as any).timezone = timezone;
      if (countryCode) (updates as any).countryCode = countryCode;

      await user.update(updates);

      res.json({ success: true, message: 'Settings updated', data: { settings: updates['preferences'] }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in updateSettings', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to update settings', code: 'UPDATE_SETTINGS_FAILED', timestamp: new Date().toISOString() });
    }
  }

  async getPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const preferences = (user.preferences as Record<string, any>) || {};
      res.json({
        success: true,
        data: {
          preferences: {
            ridePreferences: preferences['ridePreferences'] || { smokingAllowed: false, petsAllowed: false, musicAllowed: true, maxDetour: 5 },
            driverPreferences: preferences['driverPreferences'] || { acceptCash: true, acceptCard: true, maxPassengers: 4 },
            searchPreferences: preferences['searchPreferences'] || { defaultRadius: 10, defaultSeats: 1, sortBy: 'time' },
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getPreferences', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to get preferences', code: 'GET_PREFS_FAILED', timestamp: new Date().toISOString() });
    }
  }

  async updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const currentPreferences = (user.preferences as Record<string, any>) || {};
      const { ridePreferences, driverPreferences, searchPreferences } = req.body;

      const updatedPreferences = { ...currentPreferences };
      if (ridePreferences) updatedPreferences['ridePreferences'] = { ...(currentPreferences['ridePreferences'] || {}), ...ridePreferences };
      if (driverPreferences) updatedPreferences['driverPreferences'] = { ...(currentPreferences['driverPreferences'] || {}), ...driverPreferences };
      if (searchPreferences) updatedPreferences['searchPreferences'] = { ...(currentPreferences['searchPreferences'] || {}), ...searchPreferences };

      await user.update({ preferences: updatedPreferences });

      res.json({ success: true, message: 'Preferences updated', data: { preferences: updatedPreferences }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in updatePreferences', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to update preferences', code: 'UPDATE_PREFS_FAILED', timestamp: new Date().toISOString() });
    }
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

  /** Get public profile of any user by ID */
  async getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = await User.findByPk(id, {
        attributes: ['id', 'firstName', 'lastName', 'profilePicture', 'rating', 'totalRides', 'isEmailVerified', 'isPhoneVerified', 'createdAt'],
      });

      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const u = user.toJSON() as any;
      res.json({
        success: true,
        data: {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          profilePicture: u.profilePicture || null,
          rating: u.rating || 0,
          totalRides: u.totalRides || 0,
          joinDate: u.createdAt,
          verifications: {
            email: u.isEmailVerified,
            phone: u.isPhoneVerified,
            identity: false,
            driver: false,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getUserById', { error: getErrorMessage(error) });
      res.status(500).json({ success: false, error: 'Failed to get user', code: 'GET_USER_FAILED', timestamp: new Date().toISOString() });
    }
  }

  /** Get user stats — alias for /auth/stats shape */
  async getUserStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId, { attributes: ['id', 'rating', 'totalRides', 'createdAt'] });
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const [ridesOffered, ridesCompleted, ridesAsPassenger] = await Promise.all([
        Ride.count({ where: { driverId: userId } }),
        Ride.count({ where: { driverId: userId, status: RideStatus.COMPLETED } }),
        Booking.count({ where: { passengerId: userId } }),
      ]);

      const u = user.toJSON() as any;
      res.json({
        success: true,
        data: {
          ridesCompleted,
          ridesOffered,
          ridesAsPassenger,
          totalDistance: 0,
          totalSavings: 0,
          co2Saved: 0,
          rating: u.rating || 0,
          reviewCount: 0,
          joinDate: u.createdAt,
          achievements: [],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getUserStats', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Failed to get user stats', code: 'GET_STATS_FAILED', timestamp: new Date().toISOString() });
    }
  }

  /** Get reviews for authenticated user (or a specific user) */
  async getReviews(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const targetUserId = req.params['userId'] || req.user?.id;
      if (!targetUserId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const page = parseInt(req.query['page'] as string) || 1;
      const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);

      const user = await User.findByPk(targetUserId, { attributes: ['id', 'preferences'] });
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const prefs = ((user.toJSON() as any).preferences as Record<string, any>) || {};
      const allReviews: any[] = prefs['receivedReviews'] || [];
      const total = allReviews.length;
      const reviews = allReviews.slice((page - 1) * limit, page * limit);

      res.json({
        success: true,
        data: {
          reviews,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getReviews', { error: getErrorMessage(error) });
      res.status(500).json({ success: false, error: 'Failed to get reviews', code: 'GET_REVIEWS_FAILED', timestamp: new Date().toISOString() });
    }
  }

  /** Submit a review for another user */
  async submitReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const reviewerId = req.user?.id;
      if (!reviewerId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const { toUserId, rideId, rating, comment } = req.body as { toUserId: string; rideId: string; rating: number; comment?: string };

      if (!toUserId || !rideId || !rating) {
        res.status(400).json({ success: false, error: 'toUserId, rideId, and rating are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      if (toUserId === reviewerId) {
        res.status(400).json({ success: false, error: 'Cannot review yourself', code: 'SELF_REVIEW', timestamp: new Date().toISOString() });
        return;
      }

      if (rating < 1 || rating > 5) {
        res.status(400).json({ success: false, error: 'Rating must be 1-5', code: 'INVALID_RATING', timestamp: new Date().toISOString() });
        return;
      }

      const [targetUser, reviewer] = await Promise.all([
        User.findByPk(toUserId, { attributes: ['id', 'preferences', 'rating', 'totalRides', 'firstName', 'lastName'] }),
        User.findByPk(reviewerId, { attributes: ['id', 'firstName', 'lastName', 'profilePicture'] }),
      ]);

      if (!targetUser || !reviewer) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const targetPrefs = ((targetUser.toJSON() as any).preferences as Record<string, any>) || {};
      const existingReviews: any[] = targetPrefs['receivedReviews'] || [];

      // Prevent duplicate review for same ride
      if (existingReviews.some((r: any) => r.rideId === rideId && r.fromUserId === reviewerId)) {
        res.status(409).json({ success: false, error: 'Already reviewed for this ride', code: 'DUPLICATE_REVIEW', timestamp: new Date().toISOString() });
        return;
      }

      const rev = reviewer.toJSON() as any;
      const newReview = {
        id: `review_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
        fromUserId: reviewerId,
        toUserId,
        rideId,
        rating,
        comment: comment || null,
        createdAt: new Date().toISOString(),
        fromUser: { firstName: rev.firstName, lastName: rev.lastName, profilePicture: rev.profilePicture || null },
      };

      existingReviews.push(newReview);

      // Recalculate average rating
      const avgRating = existingReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / existingReviews.length;

      await targetUser.update({
        preferences: { ...targetPrefs, receivedReviews: existingReviews },
        rating: Math.round(avgRating * 10) / 10,
      });

      res.status(201).json({ success: true, data: newReview, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in submitReview', { error: getErrorMessage(error) });
      res.status(500).json({ success: false, error: 'Failed to submit review', code: 'SUBMIT_REVIEW_FAILED', timestamp: new Date().toISOString() });
    }
  }

  /** Block a user */
  async blockUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: targetId } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      if (userId === targetId) {
        res.status(400).json({ success: false, error: 'Cannot block yourself', code: 'SELF_BLOCK', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      const target = await User.findByPk(targetId, { attributes: ['id', 'firstName', 'lastName', 'profilePicture'] });

      if (!user || !target) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const prefs = ((user.toJSON() as any).preferences as Record<string, any>) || {};
      const blocked: any[] = prefs['blocked'] || [];

      if (blocked.some((b: any) => b.id === targetId)) {
        res.json({ success: true, message: 'User already blocked', timestamp: new Date().toISOString() });
        return;
      }

      const t = target.toJSON() as any;
      blocked.push({ id: targetId, firstName: t.firstName, lastName: t.lastName, profilePicture: t.profilePicture || null, blockedAt: new Date().toISOString() });

      await user.update({ preferences: { ...prefs, blocked } });

      res.json({ success: true, message: 'User blocked', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in blockUser', { error: getErrorMessage(error) });
      res.status(500).json({ success: false, error: 'Failed to block user', code: 'BLOCK_USER_FAILED', timestamp: new Date().toISOString() });
    }
  }

  /** Unblock a user */
  async unblockUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id: targetId } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const prefs = ((user.toJSON() as any).preferences as Record<string, any>) || {};
      const blocked: any[] = (prefs['blocked'] || []).filter((b: any) => b.id !== targetId);

      await user.update({ preferences: { ...prefs, blocked } });

      res.json({ success: true, message: 'User unblocked', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in unblockUser', { error: getErrorMessage(error) });
      res.status(500).json({ success: false, error: 'Failed to unblock user', code: 'UNBLOCK_USER_FAILED', timestamp: new Date().toISOString() });
    }
  }

  /** Get blocked users list */
  async getBlockedUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const prefs = ((user.toJSON() as any).preferences as Record<string, any>) || {};
      const blocked: any[] = prefs['blocked'] || [];

      res.json({ success: true, data: blocked, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in getBlockedUsers', { error: getErrorMessage(error) });
      res.status(500).json({ success: false, error: 'Failed to get blocked users', code: 'GET_BLOCKED_FAILED', timestamp: new Date().toISOString() });
    }
  }

  /** Get emergency contact */
  async getEmergencyContact(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId, { attributes: ['id', 'emergencyContactName', 'emergencyContactPhone', 'preferences'] });
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const u = user.toJSON() as any;
      const prefs = (u.preferences as Record<string, any>) || {};

      res.json({
        success: true,
        data: {
          name: u.emergencyContactName || null,
          phone: u.emergencyContactPhone || null,
          relationship: prefs['emergencyContactRelationship'] || null,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getEmergencyContact', { error: getErrorMessage(error) });
      res.status(500).json({ success: false, error: 'Failed to get emergency contact', code: 'GET_EMERGENCY_FAILED', timestamp: new Date().toISOString() });
    }
  }

  /** Update emergency contact */
  async updateEmergencyContact(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const { name, phone, relationship } = req.body as { name: string; phone: string; relationship?: string };

      if (!name || !phone) {
        res.status(400).json({ success: false, error: 'name and phone are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const prefs = ((user.toJSON() as any).preferences as Record<string, any>) || {};

      await user.update({
        emergencyContactName: name,
        emergencyContactPhone: phone,
        preferences: { ...prefs, emergencyContactRelationship: relationship || null },
      });

      res.json({ success: true, message: 'Emergency contact updated', data: { name, phone, relationship: relationship || null }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in updateEmergencyContact', { error: getErrorMessage(error) });
      res.status(500).json({ success: false, error: 'Failed to update emergency contact', code: 'UPDATE_EMERGENCY_FAILED', timestamp: new Date().toISOString() });
    }
  }

  /** Submit driver verification documents */
  async submitDriverVerification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
      const getUrl = (field: string): string | null => {
        const file = files?.[field]?.[0];
        if (!file) return null;
        const baseUrl = process.env['API_BASE_URL'] || `http://localhost:${process.env['PORT'] || 3001}`;
        return `${baseUrl}/uploads/documents/${file.filename}`;
      };

      const driverLicenseUrl = getUrl('driverLicense');
      const vehicleRegistrationUrl = getUrl('vehicleRegistration');
      const insuranceUrl = getUrl('insurance');

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const prefs = ((user.toJSON() as any).preferences as Record<string, any>) || {};
      await user.update({
        preferences: {
          ...prefs,
          driverVerification: {
            status: 'pending',
            submittedAt: new Date().toISOString(),
            driverLicenseUrl,
            vehicleRegistrationUrl,
            insuranceUrl,
          },
        },
      });

      logger.info('Driver verification submitted', { userId });

      res.json({ success: true, message: 'Driver verification documents submitted for review', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in submitDriverVerification', { error: getErrorMessage(error) });
      res.status(500).json({ success: false, error: 'Failed to submit verification', code: 'SUBMIT_VERIFICATION_FAILED', timestamp: new Date().toISOString() });
    }
  }

  /** Change password (alias for AuthController.changePassword, re-implemented here for /users path) */
  async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

      if (!currentPassword || !newPassword) {
        res.status(400).json({ success: false, error: 'currentPassword and newPassword are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({ success: false, error: 'New password must be at least 8 characters', code: 'PASSWORD_TOO_SHORT', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const isValid = await user.comparePassword(currentPassword);
      if (!isValid) {
        res.status(400).json({ success: false, error: 'Current password is incorrect', code: 'INVALID_CURRENT_PASSWORD', timestamp: new Date().toISOString() });
        return;
      }

      await user.update({ password: newPassword });

      res.json({ success: true, message: 'Password changed successfully', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in changePassword', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  /** Delete account (alias — same behavior as deactivateAccount but simpler) */
  async deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
        return;
      }

      const { password } = req.body as { password: string };
      if (!password) {
        res.status(400).json({ success: false, error: 'Password is required', code: 'PASSWORD_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const isValid = await user.comparePassword(password);
      if (!isValid) {
        res.status(400).json({ success: false, error: 'Incorrect password', code: 'INVALID_PASSWORD', timestamp: new Date().toISOString() });
        return;
      }

      await user.update({ status: UserStatus.DEACTIVATED, deactivatedAt: new Date(), refreshToken: null });

      res.json({ success: true, message: 'Account deleted successfully', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error in deleteAccount', { error: getErrorMessage(error), userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }
}
