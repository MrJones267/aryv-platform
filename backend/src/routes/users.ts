/**
 * @fileoverview User profile management API routes
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { UserController } from '../controllers/UserController';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const userController = new UserController();

// Rate limiting for user operations
const userRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many user requests from this IP, please try again later',
});

const profileUpdateRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit profile updates to 5 per hour per IP
  message: 'Too many profile update attempts, please try again later',
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
 * @desc    Upload user profile avatar
 * @access  Private
 */
router.post(
  '/profile/avatar',
  userRateLimit,
  authenticateToken,
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
 * @desc    Upload driving license for verification
 * @access  Private
 */
router.post(
  '/driving-license',
  userRateLimit,
  authenticateToken,
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

export default router;
