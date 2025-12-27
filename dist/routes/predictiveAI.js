"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const PredictiveAIController_1 = __importDefault(require("../controllers/PredictiveAIController"));
const auth_1 = require("../middleware/auth");
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied - insufficient permissions',
            });
        }
        return next();
    };
};
const router = express_1.default.Router();
const predictiveAIController = new PredictiveAIController_1.default();
const aiRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many AI requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
const heavyAIRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: {
        success: false,
        message: 'Too many heavy AI requests, please try again later',
    },
});
router.use(aiRateLimit);
router.get('/insights', auth_1.authenticateToken, (req, res) => predictiveAIController.getPredictiveInsights(req, res));
router.post('/predict/demand', auth_1.authenticateToken, heavyAIRateLimit, (req, res) => predictiveAIController.predictDemand(req, res));
router.post('/optimize/pricing', auth_1.authenticateToken, heavyAIRateLimit, (req, res) => predictiveAIController.optimizePricing(req, res));
router.post('/predict/wait-time', auth_1.authenticateToken, (req, res) => predictiveAIController.predictWaitTime(req, res));
router.post('/predict/user-behavior/:userId', auth_1.authenticateToken, heavyAIRateLimit, (req, res) => predictiveAIController.predictUserBehavior(req, res));
router.get('/predict/churn-risk/:userId', auth_1.authenticateToken, heavyAIRateLimit, (req, res) => predictiveAIController.predictChurnRisk(req, res));
router.get('/market/conditions', auth_1.authenticateToken, (req, res) => predictiveAIController.getMarketConditions(req, res));
router.post('/recommendations/:userId', auth_1.authenticateToken, (req, res) => predictiveAIController.getPersonalizedRecommendations(req, res));
router.get('/health', (req, res) => predictiveAIController.getHealthStatus(req, res));
router.get('/admin/cache/stats', auth_1.authenticateToken, authorizeRoles('admin'), (req, res) => predictiveAIController.getCacheStats(req, res));
router.post('/admin/cache/clear', auth_1.authenticateToken, authorizeRoles('admin'), (req, res) => predictiveAIController.clearCache(req, res));
exports.default = router;
//# sourceMappingURL=predictiveAI.js.map