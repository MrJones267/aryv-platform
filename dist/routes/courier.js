"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const CourierController_1 = __importDefault(require("../controllers/CourierController"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const models_1 = require("../models");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/pricing/suggestions', [
    (0, express_validator_1.body)('pickupCoordinates')
        .isArray({ min: 2, max: 2 })
        .withMessage('Pickup coordinates must be an array of [longitude, latitude]'),
    (0, express_validator_1.body)('pickupCoordinates.*')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Coordinates must be valid longitude/latitude values'),
    (0, express_validator_1.body)('dropoffCoordinates')
        .isArray({ min: 2, max: 2 })
        .withMessage('Dropoff coordinates must be an array of [longitude, latitude]'),
    (0, express_validator_1.body)('dropoffCoordinates.*')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Coordinates must be valid longitude/latitude values'),
    (0, express_validator_1.body)('packageSize')
        .optional()
        .isIn(['small', 'medium', 'large', 'custom'])
        .withMessage('Package size must be small, medium, large, or custom'),
    (0, express_validator_1.body)('fragile')
        .optional()
        .isBoolean()
        .withMessage('Fragile must be a boolean value'),
    (0, express_validator_1.body)('valuable')
        .optional()
        .isBoolean()
        .withMessage('Valuable must be a boolean value'),
    (0, express_validator_1.body)('requestedDeliveryTime')
        .optional()
        .isISO8601()
        .withMessage('Requested delivery time must be a valid ISO 8601 date'),
    validation_1.validateInput,
], CourierController_1.default.getPricingSuggestions);
router.get('/delivery-tiers', CourierController_1.default.getDeliveryTiers);
router.post('/packages', [
    (0, express_validator_1.body)('title')
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ max: 200 })
        .withMessage('Title must be less than 200 characters'),
    (0, express_validator_1.body)('description')
        .optional()
        .isLength({ max: 2000 })
        .withMessage('Description must be less than 2000 characters'),
    (0, express_validator_1.body)('dimensionsLength')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Length must be a positive number'),
    (0, express_validator_1.body)('dimensionsWidth')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Width must be a positive number'),
    (0, express_validator_1.body)('dimensionsHeight')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Height must be a positive number'),
    (0, express_validator_1.body)('weight')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Weight must be a positive number'),
    (0, express_validator_1.body)('packageSize')
        .optional()
        .isIn(['small', 'medium', 'large', 'custom'])
        .withMessage('Package size must be small, medium, large, or custom'),
    (0, express_validator_1.body)('fragile')
        .optional()
        .isBoolean()
        .withMessage('Fragile must be a boolean value'),
    (0, express_validator_1.body)('valuable')
        .optional()
        .isBoolean()
        .withMessage('Valuable must be a boolean value'),
    (0, express_validator_1.body)('pickupAddress')
        .notEmpty()
        .withMessage('Pickup address is required')
        .isLength({ max: 500 })
        .withMessage('Pickup address must be less than 500 characters'),
    (0, express_validator_1.body)('pickupCoordinates')
        .isArray({ min: 2, max: 2 })
        .withMessage('Pickup coordinates must be an array of [longitude, latitude]'),
    (0, express_validator_1.body)('pickupCoordinates.*')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Coordinates must be valid longitude/latitude values'),
    (0, express_validator_1.body)('dropoffAddress')
        .notEmpty()
        .withMessage('Dropoff address is required')
        .isLength({ max: 500 })
        .withMessage('Dropoff address must be less than 500 characters'),
    (0, express_validator_1.body)('dropoffCoordinates')
        .isArray({ min: 2, max: 2 })
        .withMessage('Dropoff coordinates must be an array of [longitude, latitude]'),
    (0, express_validator_1.body)('dropoffCoordinates.*')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Coordinates must be valid longitude/latitude values'),
    (0, express_validator_1.body)('senderPriceOffer')
        .isFloat({ min: 0.01 })
        .withMessage('Price offer must be greater than 0'),
    (0, express_validator_1.body)('packageImages')
        .optional()
        .isArray()
        .withMessage('Package images must be an array of URLs'),
    (0, express_validator_1.body)('packageImages.*')
        .optional()
        .isURL()
        .withMessage('Each package image must be a valid URL'),
    (0, express_validator_1.body)('deliveryTierId')
        .optional()
        .isUUID()
        .withMessage('Delivery tier ID must be a valid UUID'),
    (0, express_validator_1.body)('requestedDeliveryTime')
        .optional()
        .isISO8601()
        .withMessage('Requested delivery time must be a valid ISO 8601 date'),
    (0, express_validator_1.body)('urgencyLevel')
        .optional()
        .isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
        .withMessage('Urgency level must be LOW, NORMAL, HIGH, or URGENT'),
    validation_1.validateInput,
], CourierController_1.default.createPackage);
router.get('/packages/available', [
    (0, express_validator_1.query)('lat')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    (0, express_validator_1.query)('lng')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),
    (0, express_validator_1.query)('radius')
        .optional()
        .isFloat({ min: 1, max: 200 })
        .withMessage('Radius must be between 1 and 200 km'),
    (0, express_validator_1.query)('packageSizes')
        .optional()
        .custom((value) => {
        const validSizes = ['small', 'medium', 'large', 'custom'];
        const sizes = Array.isArray(value) ? value : [value];
        return sizes.every(size => validSizes.includes(size));
    })
        .withMessage('Package sizes must be valid values'),
    (0, express_validator_1.query)('minPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Minimum price must be a positive number'),
    (0, express_validator_1.query)('maxPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Maximum price must be a positive number'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be a non-negative integer'),
    validation_1.validateInput,
], CourierController_1.default.getAvailablePackages);
router.get('/packages/user', async (req, res) => {
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
        const packages = await models_1.Package.findAll({
            where: { senderId: userId },
            include: [{
                    model: models_1.DeliveryAgreement,
                    as: 'deliveryAgreements',
                    include: [{
                            model: models_1.User,
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
    }
    catch (error) {
        console.error('Error fetching user packages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user packages',
            code: 'INTERNAL_ERROR',
        });
    }
});
router.get('/packages/:packageId/tracking', [
    (0, express_validator_1.param)('packageId')
        .isUUID()
        .withMessage('Package ID must be a valid UUID'),
    validation_1.validateInput,
], CourierController_1.default.getPackageTracking);
router.post('/packages/:packageId/accept', [
    (0, express_validator_1.param)('packageId')
        .isUUID()
        .withMessage('Package ID must be a valid UUID'),
    validation_1.validateInput,
], CourierController_1.default.acceptDelivery);
router.post('/deliveries/:packageId/accept', [
    (0, express_validator_1.param)('packageId')
        .isUUID()
        .withMessage('Package ID must be a valid UUID'),
    validation_1.validateInput,
], CourierController_1.default.acceptDelivery);
router.post('/agreements/:agreementId/pickup', [
    (0, express_validator_1.param)('agreementId')
        .isUUID()
        .withMessage('Agreement ID must be a valid UUID'),
    (0, express_validator_1.body)('location')
        .optional()
        .isArray({ min: 2, max: 2 })
        .withMessage('Location must be an array of [longitude, latitude]'),
    (0, express_validator_1.body)('location.*')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Coordinates must be valid longitude/latitude values'),
    validation_1.validateInput,
], CourierController_1.default.confirmPickup);
router.post('/deliveries/:agreementId/pickup', [
    (0, express_validator_1.param)('agreementId')
        .isUUID()
        .withMessage('Agreement ID must be a valid UUID'),
    (0, express_validator_1.body)('location')
        .optional()
        .isArray({ min: 2, max: 2 })
        .withMessage('Location must be an array of [longitude, latitude]'),
    (0, express_validator_1.body)('location.*')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Coordinates must be valid longitude/latitude values'),
    validation_1.validateInput,
], CourierController_1.default.confirmPickup);
router.post('/verify-qr/:qrToken', [
    (0, express_validator_1.param)('qrToken')
        .notEmpty()
        .withMessage('QR token is required')
        .isLength({ min: 8, max: 100 })
        .withMessage('QR token must be between 8 and 100 characters'),
    (0, express_validator_1.body)('location')
        .optional()
        .isArray({ min: 2, max: 2 })
        .withMessage('Location must be an array of [longitude, latitude]'),
    (0, express_validator_1.body)('location.*')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Coordinates must be valid longitude/latitude values'),
    validation_1.validateInput,
], CourierController_1.default.verifyDeliveryQR);
router.post('/deliveries/verify/:qrToken', [
    (0, express_validator_1.param)('qrToken')
        .notEmpty()
        .withMessage('QR token is required')
        .isLength({ min: 8, max: 100 })
        .withMessage('QR token must be between 8 and 100 characters'),
    (0, express_validator_1.body)('location')
        .optional()
        .isArray({ min: 2, max: 2 })
        .withMessage('Location must be an array of [longitude, latitude]'),
    (0, express_validator_1.body)('location.*')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Coordinates must be valid longitude/latitude values'),
    validation_1.validateInput,
], CourierController_1.default.verifyDeliveryQR);
router.post('/agreements/:agreementId/location', [
    (0, express_validator_1.param)('agreementId')
        .isUUID()
        .withMessage('Agreement ID must be a valid UUID'),
    (0, express_validator_1.body)('location')
        .isArray({ min: 2, max: 2 })
        .withMessage('Location must be an array of [longitude, latitude]'),
    (0, express_validator_1.body)('location.*')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Coordinates must be valid longitude/latitude values'),
    (0, express_validator_1.body)('accuracy')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Accuracy must be a positive number'),
    (0, express_validator_1.body)('speed')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Speed must be a positive number'),
    (0, express_validator_1.body)('heading')
        .optional()
        .isFloat({ min: 0, max: 360 })
        .withMessage('Heading must be between 0 and 360 degrees'),
    validation_1.validateInput,
], CourierController_1.default.updateCourierLocation);
router.post('/deliveries/:agreementId/location', [
    (0, express_validator_1.param)('agreementId')
        .isUUID()
        .withMessage('Agreement ID must be a valid UUID'),
    (0, express_validator_1.body)('location')
        .isArray({ min: 2, max: 2 })
        .withMessage('Location must be an array of [longitude, latitude]'),
    (0, express_validator_1.body)('location.*')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Coordinates must be valid longitude/latitude values'),
    (0, express_validator_1.body)('accuracy')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Accuracy must be a positive number'),
    (0, express_validator_1.body)('speed')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Speed must be a positive number'),
    (0, express_validator_1.body)('heading')
        .optional()
        .isFloat({ min: 0, max: 360 })
        .withMessage('Heading must be between 0 and 360 degrees'),
    validation_1.validateInput,
], CourierController_1.default.updateCourierLocation);
router.get('/deliveries', CourierController_1.default.getCourierDeliveries);
router.get('/profile', async (req, res) => {
    try {
        const userId = req.user?.id;
        const profile = await models_1.CourierProfile.findOne({
            where: { userId },
            include: [{
                    model: models_1.User,
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
    }
    catch (error) {
        console.error('Error fetching courier profile:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch courier profile',
            code: 'INTERNAL_ERROR',
        });
    }
});
router.put('/profile', [
    (0, express_validator_1.body)('isCourierActive')
        .optional()
        .isBoolean()
        .withMessage('Courier active status must be a boolean'),
    (0, express_validator_1.body)('preferredPackageSizes')
        .optional()
        .isArray()
        .withMessage('Preferred package sizes must be an array'),
    (0, express_validator_1.body)('preferredPackageSizes.*')
        .optional()
        .isIn(['small', 'medium', 'large', 'custom'])
        .withMessage('Package sizes must be valid values'),
    (0, express_validator_1.body)('maxPackageWeight')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Max package weight must be a positive number'),
    (0, express_validator_1.body)('deliveryRadius')
        .optional()
        .isFloat({ min: 1, max: 200 })
        .withMessage('Delivery radius must be between 1 and 200 km'),
    (0, express_validator_1.body)('isAvailableForDeliveries')
        .optional()
        .isBoolean()
        .withMessage('Availability status must be a boolean'),
    validation_1.validateInput,
], async (req, res) => {
    try {
        const userId = req.user?.id;
        const updateData = req.body;
        let profile = await models_1.CourierProfile.findOne({ where: { userId } });
        if (!profile) {
            profile = await models_1.CourierProfile.create({
                userId,
                ...updateData,
            });
        }
        else {
            await profile.update(updateData);
        }
        res.json({
            success: true,
            data: profile,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('Error updating courier profile:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update courier profile',
            code: 'INTERNAL_ERROR',
        });
    }
});
exports.default = router;
//# sourceMappingURL=courier.js.map