"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const AuthController_1 = require("../controllers/AuthController");
const validation_1 = require("../middleware/validation");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: 'Too many authentication attempts, please try again later',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        error: 'Too many login attempts, please try again later',
        code: 'LOGIN_RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
router.post('/register', authLimiter, (0, validation_1.validateRequest)({ body: validation_1.authSchemas.register }), AuthController_1.AuthController.register);
router.post('/login', loginLimiter, (0, validation_1.validateRequest)({ body: validation_1.authSchemas.login }), AuthController_1.AuthController.login);
router.post('/refresh', authLimiter, (0, validation_1.validateRequest)({ body: validation_1.authSchemas.refreshToken }), AuthController_1.AuthController.refreshToken);
router.post('/logout', auth_1.authenticateToken, AuthController_1.AuthController.logout);
router.get('/profile', auth_1.authenticateToken, AuthController_1.AuthController.getProfile);
router.get('/verify', auth_1.authenticateToken, AuthController_1.AuthController.verifyToken);
exports.default = router;
//# sourceMappingURL=auth.js.map