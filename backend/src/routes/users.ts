/**
 * @fileoverview User profile management API routes
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import crypto from 'crypto';
import { Router, Response } from 'express';
import { body, query, param } from 'express-validator';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { UserController } from '../controllers/UserController';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { uploadAvatar, uploadDocument, uploadVehiclePhoto, uploadVehicleDocument, handleMulterError } from '../middleware/upload';
import User from '../models/User';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';

const router = Router();
const userController = new UserController();

// Rate limiting for user operations
const userRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many user requests from this IP, please try again later',
  store: makeStore('users'),
});

const profileUpdateRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit profile updates to 5 per hour per IP
  message: 'Too many profile update attempts, please try again later',
  store: makeStore('profile-update'),
});

// Validation schemas
const updateProfileValidation = [
  body('firstName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phoneNumber')
    .optional()
    .isMobilePhone('any')
    .withMessage('Invalid phone number format'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .custom((value) => {
      const birthDate = new Date(value);
      const now = new Date();
      const age = now.getFullYear() - birthDate.getFullYear();
      if (age < 18) {
        throw new Error('User must be at least 18 years old');
      }
      return true;
    }),
  body('address')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Address cannot exceed 500 characters'),
  body('emergencyContact.name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Emergency contact name must be between 2 and 100 characters'),
  body('emergencyContact.phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Invalid emergency contact phone number'),
  body('preferences.notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be boolean'),
  body('preferences.notifications.sms')
    .optional()
    .isBoolean()
    .withMessage('SMS notification preference must be boolean'),
  body('preferences.notifications.push')
    .optional()
    .isBoolean()
    .withMessage('Push notification preference must be boolean'),
];


// Routes

/**
 * @route   GET /api/users/profile
 * @desc    Get current user's profile
 * @access  Private
 */
router.get(
  '/profile',
  userRateLimit,
  authenticateToken,
  userController.getProfile.bind(userController),
);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user's profile
 * @access  Private
 */
router.put(
  '/profile',
  profileUpdateRateLimit,
  authenticateToken,
  updateProfileValidation,
  validateInput,
  userController.updateProfile.bind(userController),
);

/**
 * @route   POST /api/users/profile/avatar
 * @desc    Upload user profile avatar (multipart/form-data, field: avatar)
 * @access  Private
 */
router.post(
  '/profile/avatar',
  userRateLimit,
  authenticateToken,
  uploadAvatar,
  handleMulterError,
  userController.uploadAvatar.bind(userController),
);

/**
 * @route   DELETE /api/users/profile/avatar
 * @desc    Delete user profile avatar
 * @access  Private
 */
router.delete(
  '/profile/avatar',
  userRateLimit,
  authenticateToken,
  userController.deleteAvatar.bind(userController),
);

/**
 * @route   POST /api/users/verify-phone
 * @desc    Send phone verification code
 * @access  Private
 */
router.post(
  '/verify-phone',
  userRateLimit,
  authenticateToken,
  [
    body('phoneNumber')
      .isMobilePhone('any')
      .withMessage('Invalid phone number format'),
  ],
  validateInput,
  userController.sendPhoneVerification.bind(userController),
);

/**
 * @route   POST /api/users/confirm-phone
 * @desc    Confirm phone verification code
 * @access  Private
 */
router.post(
  '/confirm-phone',
  userRateLimit,
  authenticateToken,
  [
    body('phoneNumber')
      .isMobilePhone('any')
      .withMessage('Invalid phone number format'),
    body('verificationCode')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('Verification code must be 6 digits'),
  ],
  validateInput,
  userController.confirmPhoneVerification.bind(userController),
);

/**
 * @route   GET /api/users/driving-license
 * @desc    Get user's driving license information
 * @access  Private
 */
router.get(
  '/driving-license',
  userRateLimit,
  authenticateToken,
  userController.getDrivingLicense.bind(userController),
);

/**
 * @route   POST /api/users/driving-license
 * @desc    Upload driving license for verification (multipart/form-data, field: document)
 * @access  Private
 */
router.post(
  '/driving-license',
  userRateLimit,
  authenticateToken,
  uploadDocument,
  handleMulterError,
  [
    body('licenseNumber')
      .isLength({ min: 5, max: 20 })
      .withMessage('License number must be between 5 and 20 characters'),
    body('expiryDate')
      .isISO8601()
      .custom((value) => {
        if (new Date(value) <= new Date()) {
          throw new Error('License expiry date must be in the future');
        }
        return true;
      }),
    body('issuingCountry')
      .isLength({ min: 2, max: 3 })
      .withMessage('Issuing country must be a valid country code'),
    body('licenseClass')
      .isIn(['A', 'B', 'C', 'D', 'BE', 'CE', 'DE'])
      .withMessage('Invalid license class'),
  ],
  validateInput,
  userController.uploadDrivingLicense.bind(userController),
);

/**
 * @route   GET /api/users/vehicles
 * @desc    Get user's registered vehicles
 * @access  Private
 */
router.get(
  '/vehicles',
  userRateLimit,
  authenticateToken,
  userController.getVehicles.bind(userController),
);

/**
 * @route   POST /api/users/vehicles
 * @desc    Register a new vehicle
 * @access  Private
 */
router.post(
  '/vehicles',
  userRateLimit,
  authenticateToken,
  [
    body('make')
      .isLength({ min: 2, max: 50 })
      .withMessage('Vehicle make must be between 2 and 50 characters'),
    body('model')
      .isLength({ min: 2, max: 50 })
      .withMessage('Vehicle model must be between 2 and 50 characters'),
    body('year')
      .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
      .withMessage('Invalid vehicle year'),
    body('color')
      .isLength({ min: 3, max: 30 })
      .withMessage('Vehicle color must be between 3 and 30 characters'),
    body('licensePlate')
      .isLength({ min: 3, max: 15 })
      .withMessage('License plate must be between 3 and 15 characters'),
    body('seatingCapacity')
      .isInt({ min: 2, max: 8 })
      .withMessage('Seating capacity must be between 2 and 8'),
    body('fuelType')
      .isIn(['gasoline', 'diesel', 'hybrid', 'electric', 'cng', 'lpg'])
      .withMessage('Invalid fuel type'),
    body('vehicleType')
      .isIn(['sedan', 'hatchback', 'suv', 'van', 'pickup', 'coupe', 'convertible'])
      .withMessage('Invalid vehicle type'),
  ],
  validateInput,
  userController.registerVehicle.bind(userController),
);

/**
 * @route   PUT /api/users/vehicles/:id
 * @desc    Update vehicle information
 * @access  Private
 */
router.put(
  '/vehicles/:id',
  userRateLimit,
  authenticateToken,
  [
    param('id').isUUID().withMessage('Vehicle ID must be a valid UUID'),
    body('make')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('Vehicle make must be between 2 and 50 characters'),
    body('model')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('Vehicle model must be between 2 and 50 characters'),
    body('year')
      .optional()
      .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
      .withMessage('Invalid vehicle year'),
    body('color')
      .optional()
      .isLength({ min: 3, max: 30 })
      .withMessage('Vehicle color must be between 3 and 30 characters'),
    body('seatingCapacity')
      .optional()
      .isInt({ min: 2, max: 8 })
      .withMessage('Seating capacity must be between 2 and 8'),
  ],
  validateInput,
  userController.updateVehicle.bind(userController),
);

// PATCH alias for mobile app compatibility
router.patch(
  '/vehicles/:id',
  userRateLimit,
  authenticateToken,
  [param('id').isUUID()],
  validateInput,
  userController.updateVehicle.bind(userController),
);

/**
 * @route   DELETE /api/users/vehicles/:id
 * @desc    Remove a vehicle
 * @access  Private
 */
router.delete(
  '/vehicles/:id',
  userRateLimit,
  authenticateToken,
  [param('id').isUUID().withMessage('Vehicle ID must be a valid UUID')],
  validateInput,
  userController.deleteVehicle.bind(userController),
);

/**
 * @route   POST /api/users/vehicles/:id/verify
 * @desc    Submit vehicle for verification
 * @access  Private
 */
router.post(
  '/vehicles/:id/verify',
  userRateLimit,
  authenticateToken,
  [param('id').isUUID().withMessage('Vehicle ID must be a valid UUID')],
  validateInput,
  userController.submitVehicleVerification.bind(userController),
);

router.post(
  '/vehicles/:id/documents',
  userRateLimit,
  authenticateToken,
  [param('id').isUUID()],
  validateInput,
  uploadVehicleDocument,
  handleMulterError,
  userController.uploadVehicleDocument.bind(userController),
);

router.post(
  '/vehicles/:id/photos',
  userRateLimit,
  authenticateToken,
  [param('id').isUUID()],
  validateInput,
  uploadVehiclePhoto,
  handleMulterError,
  userController.uploadVehiclePhoto.bind(userController),
);

router.post(
  '/vehicles/:id/photos/delete',
  userRateLimit,
  authenticateToken,
  [param('id').isUUID(), body('photoUrl').notEmpty()],
  validateInput,
  userController.deleteVehiclePhoto.bind(userController),
);

/**
 * @route   GET /api/users/payment-methods
 * @desc    Get user's payment methods
 * @access  Private
 */
router.get(
  '/payment-methods',
  userRateLimit,
  authenticateToken,
  userController.getPaymentMethods.bind(userController),
);

/**
 * @route   POST /api/users/payment-methods
 * @desc    Add a new payment method
 * @access  Private
 */
router.post(
  '/payment-methods',
  userRateLimit,
  authenticateToken,
  [
    body('type')
      .isIn(['credit_card', 'debit_card', 'paypal', 'bank_account'])
      .withMessage('Invalid payment method type'),
    body('cardNumber')
      .optional()
      .isCreditCard()
      .withMessage('Invalid card number'),
    body('expiryMonth')
      .optional()
      .isInt({ min: 1, max: 12 })
      .withMessage('Invalid expiry month'),
    body('expiryYear')
      .optional()
      .isInt({ min: new Date().getFullYear(), max: new Date().getFullYear() + 20 })
      .withMessage('Invalid expiry year'),
    body('cvv')
      .optional()
      .isLength({ min: 3, max: 4 })
      .isNumeric()
      .withMessage('Invalid CVV'),
    body('holderName')
      .isLength({ min: 2, max: 100 })
      .withMessage('Card holder name must be between 2 and 100 characters'),
  ],
  validateInput,
  userController.addPaymentMethod.bind(userController),
);

/**
 * @route   DELETE /api/users/payment-methods/:id
 * @desc    Remove a payment method
 * @access  Private
 */
router.delete(
  '/payment-methods/:id',
  userRateLimit,
  authenticateToken,
  [param('id').isUUID().withMessage('Payment method ID must be a valid UUID')],
  validateInput,
  userController.removePaymentMethod.bind(userController),
);

/**
 * @route   GET /api/users/ride-history
 * @desc    Get user's ride history with pagination
 * @access  Private
 */
router.get(
  '/ride-history',
  userRateLimit,
  authenticateToken,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('role')
      .optional()
      .isIn(['driver', 'passenger', 'all'])
      .withMessage('Role must be driver, passenger, or all'),
    query('status')
      .optional()
      .isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'])
      .withMessage('Invalid status filter'),
  ],
  validateInput,
  userController.getRideHistory.bind(userController),
);

/**
 * @route   GET /api/users/statistics
 * @desc    Get user's ride statistics
 * @access  Private
 */
router.get(
  '/statistics',
  userRateLimit,
  authenticateToken,
  userController.getUserStatistics.bind(userController),
);

/**
 * @route   POST /api/users/report
 * @desc    Report a user or ride issue
 * @access  Private
 */
router.post(
  '/report',
  userRateLimit,
  authenticateToken,
  [
    body('type')
      .isIn(['user', 'ride', 'payment', 'safety', 'other'])
      .withMessage('Invalid report type'),
    body('reportedUserId')
      .optional()
      .isUUID()
      .withMessage('Reported user ID must be a valid UUID'),
    body('rideId')
      .optional()
      .isUUID()
      .withMessage('Ride ID must be a valid UUID'),
    body('reason')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Reason must be between 10 and 1000 characters'),
    body('severity')
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid severity level'),
  ],
  validateInput,
  userController.submitReport.bind(userController),
);

/**
 * @route   GET /api/users/settings
 * @desc    Get user app settings
 * @access  Private
 */
router.get(
  '/settings',
  userRateLimit,
  authenticateToken,
  userController.getSettings.bind(userController),
);

/**
 * @route   PUT /api/users/settings
 * @desc    Update user app settings
 * @access  Private
 */
router.put(
  '/settings',
  userRateLimit,
  authenticateToken,
  [
    body('language').optional().isLength({ min: 2, max: 10 }).withMessage('Language must be a valid locale code'),
    body('theme').optional().isIn(['light', 'dark', 'system']).withMessage('Theme must be light, dark, or system'),
    body('currency').optional().isLength({ min: 3, max: 3 }).isAlpha().withMessage('Currency must be a 3-letter ISO code'),
    body('timezone').optional().isString().isLength({ max: 60 }).withMessage('Timezone must be a valid string'),
    body('countryCode').optional().isLength({ min: 2, max: 3 }).isAlpha().withMessage('Country code must be 2-3 letters'),
    body('notifications').optional().isObject().withMessage('Notifications must be an object'),
    body('notifications.push').optional().isBoolean().withMessage('Push must be boolean'),
    body('notifications.email').optional().isBoolean().withMessage('Email must be boolean'),
    body('notifications.sms').optional().isBoolean().withMessage('SMS must be boolean'),
    body('privacy').optional().isObject().withMessage('Privacy must be an object'),
    body('privacy.shareLocation').optional().isBoolean().withMessage('shareLocation must be boolean'),
    body('privacy.showOnline').optional().isBoolean().withMessage('showOnline must be boolean'),
    body('dataUsage').optional().isObject().withMessage('dataUsage must be an object'),
  ],
  validateInput,
  userController.updateSettings.bind(userController),
);

/**
 * @route   GET /api/users/preferences
 * @desc    Get user ride/app preferences
 * @access  Private
 */
router.get(
  '/preferences',
  userRateLimit,
  authenticateToken,
  userController.getPreferences.bind(userController),
);

/**
 * @route   PUT /api/users/preferences
 * @desc    Update user ride/app preferences
 * @access  Private
 */
router.put(
  '/preferences',
  userRateLimit,
  authenticateToken,
  [
    body('ridePreferences').optional().isObject().withMessage('ridePreferences must be an object'),
    body('ridePreferences.smokingAllowed').optional().isBoolean().withMessage('smokingAllowed must be boolean'),
    body('ridePreferences.petsAllowed').optional().isBoolean().withMessage('petsAllowed must be boolean'),
    body('ridePreferences.musicAllowed').optional().isBoolean().withMessage('musicAllowed must be boolean'),
    body('ridePreferences.maxDetour').optional().isInt({ min: 0, max: 50 }).withMessage('maxDetour must be 0-50 km'),
    body('driverPreferences').optional().isObject().withMessage('driverPreferences must be an object'),
    body('driverPreferences.acceptCash').optional().isBoolean().withMessage('acceptCash must be boolean'),
    body('driverPreferences.acceptCard').optional().isBoolean().withMessage('acceptCard must be boolean'),
    body('driverPreferences.maxPassengers').optional().isInt({ min: 1, max: 8 }).withMessage('maxPassengers must be 1-8'),
    body('searchPreferences').optional().isObject().withMessage('searchPreferences must be an object'),
    body('searchPreferences.defaultRadius').optional().isInt({ min: 1, max: 100 }).withMessage('defaultRadius must be 1-100 km'),
    body('searchPreferences.defaultSeats').optional().isInt({ min: 1, max: 8 }).withMessage('defaultSeats must be 1-8'),
    body('searchPreferences.sortBy').optional().isIn(['time', 'price', 'rating', 'distance']).withMessage('sortBy must be time, price, rating, or distance'),
  ],
  validateInput,
  userController.updatePreferences.bind(userController),
);

// PATCH alias for mobile app compatibility
router.patch('/preferences', userRateLimit, authenticateToken, userController.updatePreferences.bind(userController));

/**
 * @route   POST /api/users/deactivate
 * @desc    Deactivate user account
 * @access  Private
 */
router.post(
  '/deactivate',
  userRateLimit,
  authenticateToken,
  [
    body('reason')
      .isLength({ min: 10, max: 500 })
      .withMessage('Deactivation reason must be between 10 and 500 characters'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password confirmation required'),
  ],
  validateInput,
  userController.deactivateAccount.bind(userController),
);

// ─── Additional routes expected by mobile app ───────────────────────────────

/** PATCH /profile — same handler as PUT (mobile app uses PATCH) */
router.patch('/profile', userRateLimit, authenticateToken, updateProfileValidation, validateInput, userController.updateProfile.bind(userController));

/** POST /upload-avatar — mobile app uses this path (same as /profile/avatar) */
router.post('/upload-avatar', userRateLimit, authenticateToken, uploadAvatar, handleMulterError, userController.uploadAvatar.bind(userController));

/** POST /change-password */
router.post(
  '/change-password',
  userRateLimit,
  authenticateToken,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 8 })],
  validateInput,
  userController.changePassword.bind(userController),
);

/** DELETE /account */
router.delete('/account', userRateLimit, authenticateToken, [body('password').notEmpty()], validateInput, userController.deleteAccount.bind(userController));

/** GET /stats */
router.get('/stats', userRateLimit, authenticateToken, userController.getUserStats.bind(userController));

/** GET/PATCH /emergency-contact */
router.get('/emergency-contact', userRateLimit, authenticateToken, userController.getEmergencyContact.bind(userController));
router.patch(
  '/emergency-contact',
  userRateLimit,
  authenticateToken,
  [body('name').notEmpty(), body('phone').isMobilePhone('any')],
  validateInput,
  userController.updateEmergencyContact.bind(userController),
);

/** GET /blocked — list blocked users */
router.get('/blocked', userRateLimit, authenticateToken, userController.getBlockedUsers.bind(userController));

/** GET /reviews — authenticated user's received reviews */
router.get(
  '/reviews',
  userRateLimit,
  authenticateToken,
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  validateInput,
  userController.getReviews.bind(userController),
);

/** POST /reviews — submit a review */
router.post(
  '/reviews',
  userRateLimit,
  authenticateToken,
  [
    body('toUserId').isUUID(),
    body('rideId').isUUID(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().isLength({ max: 1000 }),
  ],
  validateInput,
  userController.submitReview.bind(userController),
);

/** POST /driver-verification — upload docs for driver verification */
const ALLOWED_DV_FIELDS = new Set(['driverLicense', 'vehicleRegistration', 'insurance']);
const driverVerificationUpload = multer({ storage: multer.diskStorage({
  destination: './uploads/documents',
  filename: (req: any, _file, cb) => {
    const uid = (req.user?.id || 'unknown').replace(/[^a-zA-Z0-9-]/g, '');
    cb(null, `${uid}-dv-${crypto.randomBytes(8).toString('hex')}.jpg`);
  },
}), limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_DV_FIELDS.has(file.fieldname));
  },
}).fields([
  { name: 'driverLicense', maxCount: 1 },
  { name: 'vehicleRegistration', maxCount: 1 },
  { name: 'insurance', maxCount: 1 },
]);
router.post('/driver-verification', userRateLimit, authenticateToken, driverVerificationUpload, handleMulterError, userController.submitDriverVerification.bind(userController));

// ─── Parameterised routes (must come after static routes) ────────────────────

/** GET /users/:id — public profile */
router.get('/:id', userRateLimit, [param('id').isUUID()], validateInput, userController.getUserById.bind(userController));

/** GET /users/:id/reviews */
router.get(
  '/:id/reviews',
  userRateLimit,
  [param('id').isUUID(), query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  validateInput,
  userController.getReviews.bind(userController),
);

/** POST /users/:id/block */
router.post('/:id/block', userRateLimit, authenticateToken, [param('id').isUUID()], validateInput, userController.blockUser.bind(userController));

/** DELETE /users/:id/block */
router.delete('/:id/block', userRateLimit, authenticateToken, [param('id').isUUID()], validateInput, userController.unblockUser.bind(userController));


// ─── Referral System ─────────────────────────────────────────────────────────

/** GET /users/me/referral — get my referral code (generate if missing) */
router.get(
  '/me/referral',
  userRateLimit,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const user = await User.findByPk(userId, { attributes: ['id', 'referralCode', 'referralCredits'] });
      if (!user) { res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      if (!user.referralCode) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        await user.update({ referralCode: code });
        user.referralCode = code;
      }

      res.json({
        success: true,
        data: { referralCode: user.referralCode, referralCredits: user.referralCredits ?? 0 },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting referral code', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  },
);

/** POST /users/me/referral/apply — apply a referral code */
router.post(
  '/me/referral/apply',
  userRateLimit,
  authenticateToken,
  [body('referralCode').notEmpty().isLength({ min: 8, max: 8 }).withMessage('Invalid referral code format')],
  validateInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { referralCode } = req.body as { referralCode: string };

      const me = await User.findByPk(userId);
      if (!me) { res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      if (me.referredBy) {
        res.status(400).json({ success: false, error: 'You have already applied a referral code', code: 'REFERRAL_ALREADY_APPLIED', timestamp: new Date().toISOString() });
        return;
      }

      const referrer = await User.findOne({ where: { referralCode: referralCode.toUpperCase() } });
      if (!referrer) {
        res.status(404).json({ success: false, error: 'Invalid referral code', code: 'REFERRAL_INVALID', timestamp: new Date().toISOString() });
        return;
      }

      if (referrer.id === userId) {
        res.status(400).json({ success: false, error: 'You cannot use your own referral code', code: 'REFERRAL_SELF', timestamp: new Date().toISOString() });
        return;
      }

      // Credit the referrer (BWP 10 per successful referral)
      const REFERRAL_BONUS = 10;
      await me.update({ referredBy: referrer.id });
      await referrer.update({ referralCredits: (referrer.referralCredits ?? 0) + REFERRAL_BONUS });

      logger.info('Referral applied', { userId, referrerId: referrer.id, bonus: REFERRAL_BONUS });

      res.json({
        success: true,
        message: 'Referral code applied successfully',
        data: { referrerName: referrer.firstName, bonus: REFERRAL_BONUS },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error applying referral code', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  },
);

export default router;
