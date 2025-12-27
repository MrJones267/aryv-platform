"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const PredictiveAIService_1 = __importDefault(require("../services/PredictiveAIService"));
const logger_1 = __importDefault(require("../utils/logger"));
class PredictiveAIController {
    async getPredictiveInsights(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const { latitude, longitude } = req.query;
            const { basePrice } = req.body;
            const userId = req.user?.id;
            const insights = await PredictiveAIService_1.default.getPredictiveInsights(parseFloat(latitude), parseFloat(longitude), basePrice ? parseFloat(basePrice) : undefined, userId);
            res.status(200).json({
                success: true,
                message: 'Predictive insights retrieved successfully',
                data: insights,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error getting predictive insights:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get predictive insights',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async predictDemand(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const { latitude, longitude, timeHorizonMinutes, includeFactors } = req.body;
            const prediction = await PredictiveAIService_1.default.predictDemand(latitude, longitude, timeHorizonMinutes || 60, includeFactors !== false);
            res.status(200).json({
                success: true,
                message: 'Demand prediction completed',
                data: prediction,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error predicting demand:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to predict demand',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async optimizePricing(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const { basePrice, latitude, longitude, demandLevel, supplyLevel } = req.body;
            const pricing = await PredictiveAIService_1.default.optimizePricing(basePrice, latitude, longitude, demandLevel, supplyLevel);
            res.status(200).json({
                success: true,
                message: 'Pricing optimization completed',
                data: pricing,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error optimizing pricing:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to optimize pricing',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async predictWaitTime(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const { latitude, longitude, timeOfDay } = req.body;
            const waitTime = await PredictiveAIService_1.default.predictWaitTime(latitude, longitude, timeOfDay);
            res.status(200).json({
                success: true,
                message: 'Wait time prediction completed',
                data: waitTime,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error predicting wait time:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to predict wait time',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async predictUserBehavior(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const { userId } = req.params;
            const { behaviorType } = req.body;
            if (req.user?.id !== userId && req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied',
                });
                return;
            }
            const behavior = await PredictiveAIService_1.default.predictUserBehavior(userId, behaviorType);
            res.status(200).json({
                success: true,
                message: 'User behavior prediction completed',
                data: behavior,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error predicting user behavior:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to predict user behavior',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async predictChurnRisk(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const { userId } = req.params;
            if (req.user?.id !== userId && req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied',
                });
                return;
            }
            const churnRisk = await PredictiveAIService_1.default.predictChurnRisk(userId);
            res.status(200).json({
                success: true,
                message: 'Churn risk prediction completed',
                data: churnRisk,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error predicting churn risk:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to predict churn risk',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async getMarketConditions(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const { latitude, longitude } = req.query;
            const conditions = await PredictiveAIService_1.default.getMarketConditions(parseFloat(latitude), parseFloat(longitude));
            res.status(200).json({
                success: true,
                message: 'Market conditions retrieved successfully',
                data: conditions,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error getting market conditions:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get market conditions',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async getPersonalizedRecommendations(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }
            const { userId } = req.params;
            const { latitude, longitude } = req.query;
            const { preferences } = req.body;
            if (req.user?.id !== userId) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied',
                });
                return;
            }
            const recommendations = await PredictiveAIService_1.default.getPersonalizedRecommendations(userId, parseFloat(latitude), parseFloat(longitude), preferences);
            res.status(200).json({
                success: true,
                message: 'Personalized recommendations retrieved successfully',
                data: { recommendations },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error getting personalized recommendations:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get personalized recommendations',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async getHealthStatus(_req, res) {
        try {
            const health = await PredictiveAIService_1.default.healthCheck();
            const overall = health.ai_service && health.realtime_service;
            res.status(overall ? 200 : 503).json({
                success: overall,
                message: overall ? 'AI services healthy' : 'Some AI services unavailable',
                data: {
                    overall_status: overall ? 'healthy' : 'degraded',
                    services: health,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error checking AI services health:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to check AI services health',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async getCacheStats(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required',
                });
                return;
            }
            const stats = PredictiveAIService_1.default.getCacheStats();
            res.status(200).json({
                success: true,
                message: 'Cache statistics retrieved successfully',
                data: stats,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error getting cache stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get cache statistics',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async clearCache(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required',
                });
                return;
            }
            const { pattern } = req.body;
            PredictiveAIService_1.default.clearCache(pattern);
            res.status(200).json({
                success: true,
                message: pattern ? `Cache cleared for pattern: ${pattern}` : 'All cache cleared',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.default.error('Error clearing cache:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to clear cache',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    static getValidationRules() {
        return {
            insights: [
                (0, express_validator_1.query)('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
                (0, express_validator_1.query)('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
                (0, express_validator_1.body)('basePrice').optional().isFloat({ min: 0 }).withMessage('Base price must be positive'),
            ],
            demandPrediction: [
                (0, express_validator_1.body)('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
                (0, express_validator_1.body)('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
                (0, express_validator_1.body)('timeHorizonMinutes').optional().isInt({ min: 15, max: 1440 }).withMessage('Time horizon must be between 15-1440 minutes'),
                (0, express_validator_1.body)('includeFactors').optional().isBoolean().withMessage('Include factors must be boolean'),
            ],
            pricingOptimization: [
                (0, express_validator_1.body)('basePrice').isFloat({ min: 0 }).withMessage('Base price must be positive'),
                (0, express_validator_1.body)('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
                (0, express_validator_1.body)('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
                (0, express_validator_1.body)('demandLevel').isFloat({ min: 0 }).withMessage('Demand level must be positive'),
                (0, express_validator_1.body)('supplyLevel').isFloat({ min: 0 }).withMessage('Supply level must be positive'),
            ],
            waitTimePrediction: [
                (0, express_validator_1.body)('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
                (0, express_validator_1.body)('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
                (0, express_validator_1.body)('timeOfDay').optional().isInt({ min: 0, max: 23 }).withMessage('Time of day must be 0-23'),
            ],
            userBehavior: [
                (0, express_validator_1.param)('userId').isUUID().withMessage('Valid user ID required'),
                (0, express_validator_1.body)('behaviorType').optional().isIn(['ride_frequency', 'preferred_times', 'price_sensitivity']).withMessage('Invalid behavior type'),
            ],
            churnRisk: [
                (0, express_validator_1.param)('userId').isUUID().withMessage('Valid user ID required'),
            ],
            marketConditions: [
                (0, express_validator_1.query)('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
                (0, express_validator_1.query)('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
            ],
            personalizedRecommendations: [
                (0, express_validator_1.param)('userId').isUUID().withMessage('Valid user ID required'),
                (0, express_validator_1.query)('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
                (0, express_validator_1.query)('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
                (0, express_validator_1.body)('preferences').optional().isObject().withMessage('Preferences must be object'),
            ],
            clearCache: [
                (0, express_validator_1.body)('pattern').optional().isString().withMessage('Pattern must be string'),
            ],
        };
    }
}
exports.default = PredictiveAIController;
//# sourceMappingURL=PredictiveAIController.js.map