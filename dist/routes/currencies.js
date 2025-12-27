"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_validator_1 = require("express-validator");
const CurrencyController_1 = require("../controllers/CurrencyController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = express_1.default.Router();
const currencyRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        error: 'Too many currency requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
router.use(currencyRateLimit);
router.get('/', (req, res) => CurrencyController_1.CurrencyController.getCurrencies(req, res));
router.get('/popular', [
    (0, express_validator_1.query)('region')
        .optional()
        .isString()
        .isIn(['north-america', 'europe', 'asia', 'africa', 'south-america', 'oceania', 'global'])
        .withMessage('Invalid region specified'),
], validation_1.validateInput, ((req, res) => CurrencyController_1.CurrencyController.getPopularCurrencies(req, res)));
router.get('/user', auth_1.authenticateToken, (req, res) => CurrencyController_1.CurrencyController.getUserCurrencies(req, res));
router.put('/user/primary', [
    (0, express_validator_1.body)('currencyCode')
        .notEmpty()
        .withMessage('Currency code is required')
        .isString()
        .withMessage('Currency code must be a string')
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency code must be exactly 3 characters')
        .matches(/^[A-Z]{3}$/)
        .withMessage('Currency code must be 3 uppercase letters'),
], auth_1.authenticateToken, validation_1.validateInput, ((req, res) => CurrencyController_1.CurrencyController.setPrimaryCurrency(req, res)));
router.post('/user/payment', [
    (0, express_validator_1.body)('currencyCode')
        .notEmpty()
        .withMessage('Currency code is required')
        .isString()
        .withMessage('Currency code must be a string')
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency code must be exactly 3 characters')
        .matches(/^[A-Z]{3}$/)
        .withMessage('Currency code must be 3 uppercase letters'),
], auth_1.authenticateToken, validation_1.validateInput, ((req, res) => CurrencyController_1.CurrencyController.addPaymentCurrency(req, res)));
router.delete('/user/payment/:currencyCode', [
    (0, express_validator_1.param)('currencyCode')
        .notEmpty()
        .withMessage('Currency code is required')
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency code must be exactly 3 characters')
        .matches(/^[A-Z]{3}$/)
        .withMessage('Currency code must be 3 uppercase letters'),
], auth_1.authenticateToken, validation_1.validateInput, ((req, res) => CurrencyController_1.CurrencyController.removePaymentCurrency(req, res)));
router.post('/convert', [
    (0, express_validator_1.body)('fromCurrency')
        .notEmpty()
        .withMessage('Source currency is required')
        .isString()
        .withMessage('Source currency must be a string')
        .isLength({ min: 3, max: 3 })
        .withMessage('Source currency must be exactly 3 characters')
        .matches(/^[A-Z]{3}$/)
        .withMessage('Source currency must be 3 uppercase letters'),
    (0, express_validator_1.body)('toCurrency')
        .notEmpty()
        .withMessage('Target currency is required')
        .isString()
        .withMessage('Target currency must be a string')
        .isLength({ min: 3, max: 3 })
        .withMessage('Target currency must be exactly 3 characters')
        .matches(/^[A-Z]{3}$/)
        .withMessage('Target currency must be 3 uppercase letters'),
    (0, express_validator_1.body)('amount')
        .notEmpty()
        .withMessage('Amount is required')
        .isNumeric()
        .withMessage('Amount must be a number')
        .custom((value) => {
        const num = parseFloat(value);
        if (num <= 0) {
            throw new Error('Amount must be positive');
        }
        if (num > 10000) {
            throw new Error('Amount exceeds maximum conversion limit');
        }
        return true;
    }),
], validation_1.validateInput, ((req, res) => CurrencyController_1.CurrencyController.convertCurrency(req, res)));
router.post('/exchange-rates/update', auth_1.authenticateToken, (req, res) => CurrencyController_1.CurrencyController.updateExchangeRates(req, res));
const conversionRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 20,
    message: {
        success: false,
        error: 'Too many conversion requests. Please try again later.',
        code: 'CONVERSION_RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
router.use('/convert', conversionRateLimit);
exports.default = router;
//# sourceMappingURL=currencies.js.map