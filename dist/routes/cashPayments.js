"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const CashPaymentController_1 = __importDefault(require("../controllers/CashPaymentController"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
const cashPaymentController = new CashPaymentController_1.default();
const cashPaymentRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many cash payment attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
const confirmationRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    max: 3,
    message: 'Too many confirmation attempts, please try again later',
});
router.use(auth_1.authenticateToken);
router.post('/create', cashPaymentRateLimit, [
    (0, express_validator_1.body)('bookingId')
        .isUUID()
        .withMessage('Valid booking ID is required'),
    (0, express_validator_1.body)('driverId')
        .isUUID()
        .withMessage('Valid driver ID is required'),
    (0, express_validator_1.body)('amount')
        .isFloat({ min: 0.01, max: 10000.00 })
        .withMessage('Amount must be between $0.01 and $10,000.00'),
    validation_1.validateInput,
], (req, res) => cashPaymentController.createCashPayment(req, res));
router.post('/:transactionId/confirm-received', confirmationRateLimit, [
    (0, express_validator_1.param)('transactionId')
        .isUUID()
        .withMessage('Valid transaction ID is required'),
    (0, express_validator_1.body)('actualAmount')
        .isFloat({ min: 0.01, max: 10000.00 })
        .withMessage('Actual amount must be between $0.01 and $10,000.00'),
    (0, express_validator_1.body)('location')
        .optional()
        .isObject()
        .withMessage('Location must be an object'),
    (0, express_validator_1.body)('location.lat')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    (0, express_validator_1.body)('location.lng')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),
    (0, express_validator_1.body)('location.accuracy')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Accuracy must be a positive number'),
    validation_1.validateInput,
], (req, res) => cashPaymentController.confirmCashReceived(req, res));
router.post('/:transactionId/confirm-paid', confirmationRateLimit, [
    (0, express_validator_1.param)('transactionId')
        .isUUID()
        .withMessage('Valid transaction ID is required'),
    (0, express_validator_1.body)('confirmationCode')
        .isLength({ min: 6, max: 6 })
        .isNumeric()
        .withMessage('Confirmation code must be a 6-digit number'),
    validation_1.validateInput,
], (req, res) => cashPaymentController.confirmCashPaid(req, res));
router.get('/:transactionId', [
    (0, express_validator_1.param)('transactionId')
        .isUUID()
        .withMessage('Valid transaction ID is required'),
    validation_1.validateInput,
], ((req, res) => cashPaymentController.getCashTransaction(req, res)));
router.get('/history', [
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be a non-negative integer'),
    (0, express_validator_1.query)('status')
        .optional()
        .isIn([
        'pending_verification',
        'driver_confirmed',
        'rider_confirmed',
        'both_confirmed',
        'disputed',
        'completed',
        'failed',
        'expired',
    ])
        .withMessage('Invalid status filter'),
    validation_1.validateInput,
], ((req, res) => cashPaymentController.getCashTransactionHistory(req, res)));
router.get('/wallet', (req, res) => cashPaymentController.getWalletInfo(req, res));
router.post('/:transactionId/dispute', [
    (0, express_validator_1.param)('transactionId')
        .isUUID()
        .withMessage('Valid transaction ID is required'),
    (0, express_validator_1.body)('reason')
        .isIn([
        'amount_discrepancy',
        'no_payment_received',
        'no_cash_provided',
        'driver_fraud',
        'rider_fraud',
        'wrong_amount',
        'driver_issue',
        'rider_issue',
        'other',
    ])
        .withMessage('Invalid dispute reason'),
    (0, express_validator_1.body)('description')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters'),
    (0, express_validator_1.body)('evidence')
        .optional()
        .isArray()
        .withMessage('Evidence must be an array'),
    validation_1.validateInput,
], ((req, res) => cashPaymentController.reportDispute(req, res)));
exports.default = router;
//# sourceMappingURL=cashPayments.js.map