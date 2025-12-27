/**
 * @fileoverview Courier service routes
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import courierController from '../controllers/CourierController';
import { authenticateToken } from '../middleware/auth';
import { validateInput } from '../middleware/validation';
import { CourierProfile, User, Package, DeliveryAgreement } from '../models';

const router = Router();

// Apply authentication to all courier routes
router.use(authenticateToken);

/**
 * Pricing and tier routes
 */

// Get pricing suggestions for package delivery
router.post('/pricing/suggestions',
  [
    body('pickupCoordinates')
      .isArray({ min: 2, max: 2 })
      .withMessage('Pickup coordinates must be an array of [longitude, latitude]'),

    body('pickupCoordinates.*')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Coordinates must be valid longitude/latitude values'),

    body('dropoffCoordinates')
      .isArray({ min: 2, max: 2 })
      .withMessage('Dropoff coordinates must be an array of [longitude, latitude]'),

    body('dropoffCoordinates.*')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Coordinates must be valid longitude/latitude values'),

    body('packageSize')
      .optional()
      .isIn(['small', 'medium', 'large', 'custom'])
      .withMessage('Package size must be small, medium, large, or custom'),

    body('fragile')
      .optional()
      .isBoolean()
      .withMessage('Fragile must be a boolean value'),

    body('valuable')
      .optional()
      .isBoolean()
      .withMessage('Valuable must be a boolean value'),

    body('requestedDeliveryTime')
      .optional()
      .isISO8601()
      .withMessage('Requested delivery time must be a valid ISO 8601 date'),

    validateInput,
  ],
  courierController.getPricingSuggestions as any,
);

// Get available delivery tiers
router.get('/delivery-tiers',
  courierController.getDeliveryTiers as any,
);

/**
 * Package management routes
 */

// Create a new package listing
router.post('/packages',
  [
    body('title')
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 200 })
      .withMessage('Title must be less than 200 characters'),

    body('description')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Description must be less than 2000 characters'),

    body('dimensionsLength')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Length must be a positive number'),

    body('dimensionsWidth')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Width must be a positive number'),

    body('dimensionsHeight')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Height must be a positive number'),

    body('weight')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Weight must be a positive number'),

    body('packageSize')
      .optional()
      .isIn(['small', 'medium', 'large', 'custom'])
      .withMessage('Package size must be small, medium, large, or custom'),

    body('fragile')
      .optional()
      .isBoolean()
      .withMessage('Fragile must be a boolean value'),

    body('valuable')
      .optional()
      .isBoolean()
      .withMessage('Valuable must be a boolean value'),

    body('pickupAddress')
      .notEmpty()
      .withMessage('Pickup address is required')
      .isLength({ max: 500 })
      .withMessage('Pickup address must be less than 500 characters'),

    body('pickupCoordinates')
      .isArray({ min: 2, max: 2 })
      .withMessage('Pickup coordinates must be an array of [longitude, latitude]'),

    body('pickupCoordinates.*')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Coordinates must be valid longitude/latitude values'),

    body('dropoffAddress')
      .notEmpty()
      .withMessage('Dropoff address is required')
      .isLength({ max: 500 })
      .withMessage('Dropoff address must be less than 500 characters'),

    body('dropoffCoordinates')
      .isArray({ min: 2, max: 2 })
      .withMessage('Dropoff coordinates must be an array of [longitude, latitude]'),

    body('dropoffCoordinates.*')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Coordinates must be valid longitude/latitude values'),

    body('senderPriceOffer')
      .isFloat({ min: 0.01 })
      .withMessage('Price offer must be greater than 0'),

    body('packageImages')
      .optional()
      .isArray()
      .withMessage('Package images must be an array of URLs'),

    body('packageImages.*')
      .optional()
      .isURL()
      .withMessage('Each package image must be a valid URL'),

    body('deliveryTierId')
      .optional()
      .isUUID()
      .withMessage('Delivery tier ID must be a valid UUID'),

    body('requestedDeliveryTime')
      .optional()
      .isISO8601()
      .withMessage('Requested delivery time must be a valid ISO 8601 date'),

    body('urgencyLevel')
      .optional()
      .isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
      .withMessage('Urgency level must be LOW, NORMAL, HIGH, or URGENT'),

    validateInput,
  ],
  courierController.createPackage as any,
);

// Get available packages for couriers
router.get('/packages/available',
  [
    query('lat')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),

    query('lng')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),

    query('radius')
      .optional()
      .isFloat({ min: 1, max: 200 })
      .withMessage('Radius must be between 1 and 200 km'),

    query('packageSizes')
      .optional()
      .custom((value) => {
        const validSizes = ['small', 'medium', 'large', 'custom'];
        const sizes = Array.isArray(value) ? value : [value];
        return sizes.every(size => validSizes.includes(size));
      })
      .withMessage('Package sizes must be valid values'),

    query('minPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum price must be a positive number'),

    query('maxPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum price must be a positive number'),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),

    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),

    validateInput,
  ],
  courierController.getAvailablePackages as any,
);

// Get user's packages (sent packages)
router.get('/packages/user', async (req: any, res: any): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const packages = await Package.findAll({
      where: { senderId: userId },
      include: [{
        model: DeliveryAgreement,
        as: 'deliveryAgreements',
        include: [{
          model: User,
          as: 'courier',
          attributes: ['id', 'firstName', 'lastName', 'phone'],
        }],
      }],
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: packages,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching user packages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user packages',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Get package tracking information
router.get('/packages/:packageId/tracking',
  [
    param('packageId')
      .isUUID()
      .withMessage('Package ID must be a valid UUID'),

    validateInput,
  ],
  courierController.getPackageTracking as any,
);

/**
 * Delivery management routes
 */

// Accept a delivery request (mobile app compatibility)
router.post('/packages/:packageId/accept',
  [
    param('packageId')
      .isUUID()
      .withMessage('Package ID must be a valid UUID'),

    validateInput,
  ],
  courierController.acceptDelivery as any,
);

// Accept a delivery request
router.post('/deliveries/:packageId/accept',
  [
    param('packageId')
      .isUUID()
      .withMessage('Package ID must be a valid UUID'),

    validateInput,
  ],
  courierController.acceptDelivery as any,
);

// Confirm package pickup (mobile app compatibility)
router.post('/agreements/:agreementId/pickup',
  [
    param('agreementId')
      .isUUID()
      .withMessage('Agreement ID must be a valid UUID'),

    body('location')
      .optional()
      .isArray({ min: 2, max: 2 })
      .withMessage('Location must be an array of [longitude, latitude]'),

    body('location.*')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Coordinates must be valid longitude/latitude values'),

    validateInput,
  ],
  courierController.confirmPickup as any,
);

// Confirm package pickup
router.post('/deliveries/:agreementId/pickup',
  [
    param('agreementId')
      .isUUID()
      .withMessage('Agreement ID must be a valid UUID'),

    body('location')
      .optional()
      .isArray({ min: 2, max: 2 })
      .withMessage('Location must be an array of [longitude, latitude]'),

    body('location.*')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Coordinates must be valid longitude/latitude values'),

    validateInput,
  ],
  courierController.confirmPickup as any,
);

// Verify delivery QR code (mobile app compatibility)
router.post('/verify-qr/:qrToken',
  [
    param('qrToken')
      .notEmpty()
      .withMessage('QR token is required')
      .isLength({ min: 8, max: 100 })
      .withMessage('QR token must be between 8 and 100 characters'),

    body('location')
      .optional()
      .isArray({ min: 2, max: 2 })
      .withMessage('Location must be an array of [longitude, latitude]'),

    body('location.*')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Coordinates must be valid longitude/latitude values'),

    validateInput,
  ],
  courierController.verifyDeliveryQR as any,
);

// Verify delivery QR code
router.post('/deliveries/verify/:qrToken',
  [
    param('qrToken')
      .notEmpty()
      .withMessage('QR token is required')
      .isLength({ min: 8, max: 100 })
      .withMessage('QR token must be between 8 and 100 characters'),

    body('location')
      .optional()
      .isArray({ min: 2, max: 2 })
      .withMessage('Location must be an array of [longitude, latitude]'),

    body('location.*')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Coordinates must be valid longitude/latitude values'),

    validateInput,
  ],
  courierController.verifyDeliveryQR as any,
);

// Update courier location during delivery (mobile app compatibility)
router.post('/agreements/:agreementId/location',
  [
    param('agreementId')
      .isUUID()
      .withMessage('Agreement ID must be a valid UUID'),

    body('location')
      .isArray({ min: 2, max: 2 })
      .withMessage('Location must be an array of [longitude, latitude]'),

    body('location.*')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Coordinates must be valid longitude/latitude values'),

    body('accuracy')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Accuracy must be a positive number'),

    body('speed')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Speed must be a positive number'),

    body('heading')
      .optional()
      .isFloat({ min: 0, max: 360 })
      .withMessage('Heading must be between 0 and 360 degrees'),

    validateInput,
  ],
  courierController.updateCourierLocation as any,
);

// Update courier location during delivery
router.post('/deliveries/:agreementId/location',
  [
    param('agreementId')
      .isUUID()
      .withMessage('Agreement ID must be a valid UUID'),

    body('location')
      .isArray({ min: 2, max: 2 })
      .withMessage('Location must be an array of [longitude, latitude]'),

    body('location.*')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Coordinates must be valid longitude/latitude values'),

    body('accuracy')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Accuracy must be a positive number'),

    body('speed')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Speed must be a positive number'),

    body('heading')
      .optional()
      .isFloat({ min: 0, max: 360 })
      .withMessage('Heading must be between 0 and 360 degrees'),

    validateInput,
  ],
  courierController.updateCourierLocation as any,
);

// Get courier's deliveries
router.get('/deliveries',
  courierController.getCourierDeliveries as any,
);

/**
 * Courier profile routes (placeholder for profile management)
 */

// Get courier profile
router.get('/profile', async (req: any, res: any): Promise<void> => {
  try {
    const userId = req.user?.id;

    const profile = await CourierProfile.findOne({
      where: { userId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
      }],
    });

    if (!profile) {
      res.status(404).json({
        success: false,
        error: 'Courier profile not found',
        code: 'PROFILE_NOT_FOUND',
      });
      return;
    }

    res.json({
      success: true,
      data: profile,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching courier profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch courier profile',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Update courier profile
router.put('/profile',
  [
    body('isCourierActive')
      .optional()
      .isBoolean()
      .withMessage('Courier active status must be a boolean'),

    body('preferredPackageSizes')
      .optional()
      .isArray()
      .withMessage('Preferred package sizes must be an array'),

    body('preferredPackageSizes.*')
      .optional()
      .isIn(['small', 'medium', 'large', 'custom'])
      .withMessage('Package sizes must be valid values'),

    body('maxPackageWeight')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Max package weight must be a positive number'),

    body('deliveryRadius')
      .optional()
      .isFloat({ min: 1, max: 200 })
      .withMessage('Delivery radius must be between 1 and 200 km'),

    body('isAvailableForDeliveries')
      .optional()
      .isBoolean()
      .withMessage('Availability status must be a boolean'),

    validateInput,
  ],
  async (req: any, res: any): Promise<void> => {
    try {
      const userId = req.user?.id;
      const updateData = req.body;

      let profile = await CourierProfile.findOne({ where: { userId } });

      if (!profile) {
        // Create new courier profile
        profile = await CourierProfile.create({
          userId,
          ...updateData,
        });
      } else {
        // Update existing profile
        await profile.update(updateData);
      }

      res.json({
        success: true,
        data: profile,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error updating courier profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update courier profile',
        code: 'INTERNAL_ERROR',
      });
    }
  },
);

export default router;
