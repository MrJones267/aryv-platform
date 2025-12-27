"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const UserController_1 = require("../controllers/UserController");
const validation_1 = require("../middleware/validation");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const userController = new UserController_1.UserController();
const userRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many user requests from this IP, please try again later',
});
const profileUpdateRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many profile update attempts, please try again later',
});
const updateProfileValidation = [
    (0, express_validator_1.body)('firstName')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),
    (0, express_validator_1.body)('lastName')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),
    (0, express_validator_1.body)('phoneNumber')
        .optional()
        .isMobilePhone('any')
        .withMessage('Invalid phone number format'),
    (0, express_validator_1.body)('dateOfBirth')
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
    (0, express_validator_1.body)('address')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Address cannot exceed 500 characters'),
    (0, express_validator_1.body)('emergencyContact.name')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Emergency contact name must be between 2 and 100 characters'),
    (0, express_validator_1.body)('emergencyContact.phone')
        .optional()
        .isMobilePhone('any')
        .withMessage('Invalid emergency contact phone number'),
    (0, express_validator_1.body)('preferences.notifications.email')
        .optional()
        .isBoolean()
        .withMessage('Email notification preference must be boolean'),
    (0, express_validator_1.body)('preferences.notifications.sms')
        .optional()
        .isBoolean()
        .withMessage('SMS notification preference must be boolean'),
    (0, express_validator_1.body)('preferences.notifications.push')
        .optional()
        .isBoolean()
        .withMessage('Push notification preference must be boolean'),
];
router.get('/profile', userRateLimit, auth_1.authenticateToken, userController.getProfile.bind(userController));
router.put('/profile', profileUpdateRateLimit, auth_1.authenticateToken, updateProfileValidation, validation_1.validateInput, userController.updateProfile.bind(userController));
router.post('/profile/avatar', userRateLimit, auth_1.authenticateToken, userController.uploadAvatar.bind(userController));
router.delete('/profile/avatar', userRateLimit, auth_1.authenticateToken, userController.deleteAvatar.bind(userController));
router.post('/verify-phone', userRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('phoneNumber')
        .isMobilePhone('any')
        .withMessage('Invalid phone number format'),
], validation_1.validateInput, userController.sendPhoneVerification.bind(userController));
router.post('/confirm-phone', userRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('phoneNumber')
        .isMobilePhone('any')
        .withMessage('Invalid phone number format'),
    (0, express_validator_1.body)('verificationCode')
        .isLength({ min: 6, max: 6 })
        .isNumeric()
        .withMessage('Verification code must be 6 digits'),
], validation_1.validateInput, userController.confirmPhoneVerification.bind(userController));
router.get('/driving-license', userRateLimit, auth_1.authenticateToken, userController.getDrivingLicense.bind(userController));
router.post('/driving-license', userRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('licenseNumber')
        .isLength({ min: 5, max: 20 })
        .withMessage('License number must be between 5 and 20 characters'),
    (0, express_validator_1.body)('expiryDate')
        .isISO8601()
        .custom((value) => {
        if (new Date(value) <= new Date()) {
            throw new Error('License expiry date must be in the future');
        }
        return true;
    }),
    (0, express_validator_1.body)('issuingCountry')
        .isLength({ min: 2, max: 3 })
        .withMessage('Issuing country must be a valid country code'),
    (0, express_validator_1.body)('licenseClass')
        .isIn(['A', 'B', 'C', 'D', 'BE', 'CE', 'DE'])
        .withMessage('Invalid license class'),
], validation_1.validateInput, userController.uploadDrivingLicense.bind(userController));
router.get('/vehicles', userRateLimit, auth_1.authenticateToken, userController.getVehicles.bind(userController));
router.post('/vehicles', userRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('make')
        .isLength({ min: 2, max: 50 })
        .withMessage('Vehicle make must be between 2 and 50 characters'),
    (0, express_validator_1.body)('model')
        .isLength({ min: 2, max: 50 })
        .withMessage('Vehicle model must be between 2 and 50 characters'),
    (0, express_validator_1.body)('year')
        .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
        .withMessage('Invalid vehicle year'),
    (0, express_validator_1.body)('color')
        .isLength({ min: 3, max: 30 })
        .withMessage('Vehicle color must be between 3 and 30 characters'),
    (0, express_validator_1.body)('licensePlate')
        .isLength({ min: 3, max: 15 })
        .withMessage('License plate must be between 3 and 15 characters'),
    (0, express_validator_1.body)('seatingCapacity')
        .isInt({ min: 2, max: 8 })
        .withMessage('Seating capacity must be between 2 and 8'),
    (0, express_validator_1.body)('fuelType')
        .isIn(['gasoline', 'diesel', 'hybrid', 'electric', 'cng', 'lpg'])
        .withMessage('Invalid fuel type'),
    (0, express_validator_1.body)('vehicleType')
        .isIn(['sedan', 'hatchback', 'suv', 'van', 'pickup', 'coupe', 'convertible'])
        .withMessage('Invalid vehicle type'),
], validation_1.validateInput, userController.registerVehicle.bind(userController));
router.put('/vehicles/:id', userRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Vehicle ID must be a valid UUID'),
    (0, express_validator_1.body)('make')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('Vehicle make must be between 2 and 50 characters'),
    (0, express_validator_1.body)('model')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('Vehicle model must be between 2 and 50 characters'),
    (0, express_validator_1.body)('year')
        .optional()
        .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
        .withMessage('Invalid vehicle year'),
    (0, express_validator_1.body)('color')
        .optional()
        .isLength({ min: 3, max: 30 })
        .withMessage('Vehicle color must be between 3 and 30 characters'),
    (0, express_validator_1.body)('seatingCapacity')
        .optional()
        .isInt({ min: 2, max: 8 })
        .withMessage('Seating capacity must be between 2 and 8'),
], validation_1.validateInput, userController.updateVehicle.bind(userController));
router.delete('/vehicles/:id', userRateLimit, auth_1.authenticateToken, [(0, express_validator_1.param)('id').isUUID().withMessage('Vehicle ID must be a valid UUID')], validation_1.validateInput, userController.deleteVehicle.bind(userController));
router.post('/vehicles/:id/verify', userRateLimit, auth_1.authenticateToken, [(0, express_validator_1.param)('id').isUUID().withMessage('Vehicle ID must be a valid UUID')], validation_1.validateInput, userController.submitVehicleVerification.bind(userController));
router.get('/payment-methods', userRateLimit, auth_1.authenticateToken, userController.getPaymentMethods.bind(userController));
router.post('/payment-methods', userRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('type')
        .isIn(['credit_card', 'debit_card', 'paypal', 'bank_account'])
        .withMessage('Invalid payment method type'),
    (0, express_validator_1.body)('cardNumber')
        .optional()
        .isCreditCard()
        .withMessage('Invalid card number'),
    (0, express_validator_1.body)('expiryMonth')
        .optional()
        .isInt({ min: 1, max: 12 })
        .withMessage('Invalid expiry month'),
    (0, express_validator_1.body)('expiryYear')
        .optional()
        .isInt({ min: new Date().getFullYear(), max: new Date().getFullYear() + 20 })
        .withMessage('Invalid expiry year'),
    (0, express_validator_1.body)('cvv')
        .optional()
        .isLength({ min: 3, max: 4 })
        .isNumeric()
        .withMessage('Invalid CVV'),
    (0, express_validator_1.body)('holderName')
        .isLength({ min: 2, max: 100 })
        .withMessage('Card holder name must be between 2 and 100 characters'),
], validation_1.validateInput, userController.addPaymentMethod.bind(userController));
router.delete('/payment-methods/:id', userRateLimit, auth_1.authenticateToken, [(0, express_validator_1.param)('id').isUUID().withMessage('Payment method ID must be a valid UUID')], validation_1.validateInput, userController.removePaymentMethod.bind(userController));
router.get('/ride-history', userRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('role')
        .optional()
        .isIn(['driver', 'passenger', 'all'])
        .withMessage('Role must be driver, passenger, or all'),
    (0, express_validator_1.query)('status')
        .optional()
        .isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'])
        .withMessage('Invalid status filter'),
], validation_1.validateInput, userController.getRideHistory.bind(userController));
router.get('/statistics', userRateLimit, auth_1.authenticateToken, userController.getUserStatistics.bind(userController));
router.post('/report', userRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('type')
        .isIn(['user', 'ride', 'payment', 'safety', 'other'])
        .withMessage('Invalid report type'),
    (0, express_validator_1.body)('reportedUserId')
        .optional()
        .isUUID()
        .withMessage('Reported user ID must be a valid UUID'),
    (0, express_validator_1.body)('rideId')
        .optional()
        .isUUID()
        .withMessage('Ride ID must be a valid UUID'),
    (0, express_validator_1.body)('reason')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Reason must be between 10 and 1000 characters'),
    (0, express_validator_1.body)('severity')
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Invalid severity level'),
], validation_1.validateInput, userController.submitReport.bind(userController));
router.post('/deactivate', userRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.body)('reason')
        .isLength({ min: 10, max: 500 })
        .withMessage('Deactivation reason must be between 10 and 500 characters'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('Password confirmation required'),
], validation_1.validateInput, userController.deactivateAccount.bind(userController));
exports.default = router;
//# sourceMappingURL=users.js.map