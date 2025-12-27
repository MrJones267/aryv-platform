"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const BookingController_1 = require("../controllers/BookingController");
const validation_1 = require("../middleware/validation");
const auth_1 = require("../middleware/auth");
const PaymentService_1 = require("../services/PaymentService");
const router = (0, express_1.Router)();
const bookingController = new BookingController_1.BookingController();
const bookingRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Too many booking requests from this IP, please try again later',
});
const cancelBookingRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many booking cancellation attempts, please try again later',
});
const updateBookingValidation = [
    (0, express_validator_1.param)('id').isUUID().withMessage('Booking ID must be a valid UUID'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
        .withMessage('Invalid booking status'),
    (0, express_validator_1.body)('seatsBooked')
        .optional()
        .isInt({ min: 1, max: 7 })
        .withMessage('Seats booked must be between 1 and 7'),
    (0, express_validator_1.body)('pickupAddress')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Pickup address cannot exceed 500 characters'),
    (0, express_validator_1.body)('dropoffAddress')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Dropoff address cannot exceed 500 characters'),
    (0, express_validator_1.body)('specialRequests')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Special requests cannot exceed 1000 characters'),
];
const cancelBookingValidation = [
    (0, express_validator_1.param)('id').isUUID().withMessage('Booking ID must be a valid UUID'),
    (0, express_validator_1.body)('reason')
        .isLength({ min: 5, max: 500 })
        .withMessage('Cancel reason must be between 5 and 500 characters'),
];
const rateBookingValidation = [
    (0, express_validator_1.param)('id').isUUID().withMessage('Booking ID must be a valid UUID'),
    (0, express_validator_1.body)('rating')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be between 1 and 5'),
    (0, express_validator_1.body)('review')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Review cannot exceed 1000 characters'),
];
const bookingIdValidation = [
    (0, express_validator_1.param)('id').isUUID().withMessage('Booking ID must be a valid UUID'),
];
const getUserBookingsValidation = [
    (0, express_validator_1.query)('status')
        .optional()
        .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
        .withMessage('Invalid status filter'),
    (0, express_validator_1.query)('type')
        .optional()
        .isIn(['driver', 'passenger', 'both'])
        .withMessage('Type must be driver, passenger, or both'),
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
];
router.get('/my-bookings', bookingRateLimit, auth_1.authenticateToken, getUserBookingsValidation, validation_1.validateInput, bookingController.getMyBookings.bind(bookingController));
router.get('/:id', bookingRateLimit, auth_1.authenticateToken, bookingIdValidation, validation_1.validateInput, bookingController.getBookingById.bind(bookingController));
router.put('/:id', bookingRateLimit, auth_1.authenticateToken, updateBookingValidation, validation_1.validateInput, bookingController.updateBooking.bind(bookingController));
router.post('/:id/cancel', cancelBookingRateLimit, auth_1.authenticateToken, cancelBookingValidation, validation_1.validateInput, bookingController.cancelBooking.bind(bookingController));
router.post('/:id/confirm', bookingRateLimit, auth_1.authenticateToken, bookingIdValidation, validation_1.validateInput, bookingController.confirmBooking.bind(bookingController));
router.post('/:id/rate', bookingRateLimit, auth_1.authenticateToken, rateBookingValidation, validation_1.validateInput, bookingController.rateBooking.bind(bookingController));
router.get('/:id/payment-intent', bookingRateLimit, auth_1.authenticateToken, bookingIdValidation, validation_1.validateInput, bookingController.createPaymentIntent.bind(bookingController));
router.post('/:id/payment-confirm', bookingRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Booking ID must be a valid UUID'),
    (0, express_validator_1.body)('paymentIntentId')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Payment intent ID is required'),
], validation_1.validateInput, bookingController.confirmPayment.bind(bookingController));
router.post('/stripe-webhook', (req, _res, next) => {
    if (req.headers['content-type'] === 'application/json') {
        let data = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
            data += chunk;
        });
        req.on('end', () => {
            req.rawBody = data;
            next();
        });
    }
    else {
        next();
    }
}, async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];
        const rawBody = req.rawBody || JSON.stringify(req.body);
        if (!signature) {
            res.status(400).json({
                success: false,
                error: 'Missing Stripe signature',
                code: 'MISSING_SIGNATURE',
            });
            return;
        }
        const event = PaymentService_1.paymentService.constructWebhookEvent(rawBody, signature);
        if (!event) {
            res.status(400).json({
                success: false,
                error: 'Invalid webhook signature',
                code: 'INVALID_SIGNATURE',
            });
            return;
        }
        const result = await PaymentService_1.paymentService.handleWebhookEvent(event);
        if (!result.success) {
            res.status(500).json({
                success: false,
                error: result.error,
                code: 'WEBHOOK_PROCESSING_FAILED',
            });
            return;
        }
        res.json({ received: true });
    }
    catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Webhook processing failed',
            code: 'WEBHOOK_ERROR',
        });
    }
});
router.post('/:id/refund', bookingRateLimit, auth_1.authenticateToken, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Booking ID must be a valid UUID'),
    (0, express_validator_1.body)('amount')
        .optional()
        .isFloat({ min: 0.01 })
        .withMessage('Refund amount must be greater than 0'),
    (0, express_validator_1.body)('reason')
        .isLength({ min: 5, max: 500 })
        .withMessage('Refund reason must be between 5 and 500 characters'),
], validation_1.validateInput, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, reason } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: 'User not authenticated',
                code: 'UNAUTHORIZED',
            });
            return;
        }
        const result = await PaymentService_1.paymentService.processRefund(id, amount, reason);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: result.error,
                code: 'REFUND_FAILED',
            });
            return;
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Refund processed successfully',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process refund',
            code: 'REFUND_PROCESSING_FAILED',
        });
    }
});
exports.default = router;
//# sourceMappingURL=bookings.js.map