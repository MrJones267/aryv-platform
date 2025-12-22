/**
 * @fileoverview Routes for Predictive AI features
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import PredictiveAIController from '../controllers/PredictiveAIController';
import { authenticateToken } from '../middleware/auth';

// Simple role authorization middleware
const authorizeRoles = (...roles: string[]) => {
  return (req: any, res: Response, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - insufficient permissions',
      });
    }
    return next();
  };
};

const router = express.Router();
const predictiveAIController = new PredictiveAIController();

// Rate limiting for AI endpoints
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many AI requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const heavyAIRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit heavy operations
  message: {
    success: false,
    message: 'Too many heavy AI requests, please try again later',
  },
});

// Apply rate limiting to all AI routes
router.use(aiRateLimit);

/**
 * @route GET /api/predictive-ai/insights
 * @desc Get comprehensive predictive insights for a location
 * @access Private
 */
router.get(
  '/insights',
  authenticateToken,
  // Validation rules would go here
  (req: Request, res: Response) => predictiveAIController.getPredictiveInsights(req as any, res),
);

/**
 * @route POST /api/predictive-ai/predict/demand
 * @desc Predict demand for a specific location
 * @access Private
 */
router.post(
  '/predict/demand',
  authenticateToken,
  heavyAIRateLimit,
  // Validation rules would go here
  (req: Request, res: Response) => predictiveAIController.predictDemand(req as any, res),
);

/**
 * @route POST /api/predictive-ai/optimize/pricing
 * @desc Optimize pricing based on market conditions
 * @access Private
 */
router.post(
  '/optimize/pricing',
  authenticateToken,
  heavyAIRateLimit,
  // Validation rules would go here
  (req: Request, res: Response) => predictiveAIController.optimizePricing(req as any, res),
);

/**
 * @route POST /api/predictive-ai/predict/wait-time
 * @desc Predict wait time for a ride request
 * @access Private
 */
router.post(
  '/predict/wait-time',
  authenticateToken,
  // Validation rules would go here
  (req: Request, res: Response) => predictiveAIController.predictWaitTime(req as any, res),
);

/**
 * @route POST /api/predictive-ai/predict/user-behavior/:userId
 * @desc Predict user behavior patterns
 * @access Private (own data only)
 */
router.post(
  '/predict/user-behavior/:userId',
  authenticateToken,
  heavyAIRateLimit,
  // Validation rules would go here
  (req: Request, res: Response) => predictiveAIController.predictUserBehavior(req as any, res),
);

/**
 * @route GET /api/predictive-ai/predict/churn-risk/:userId
 * @desc Predict user churn risk
 * @access Private (own data only) / Admin
 */
router.get(
  '/predict/churn-risk/:userId',
  authenticateToken,
  heavyAIRateLimit,
  // Validation rules would go here
  (req: Request, res: Response) => predictiveAIController.predictChurnRisk(req as any, res),
);

/**
 * @route GET /api/predictive-ai/market/conditions
 * @desc Get real-time market conditions
 * @access Private
 */
router.get(
  '/market/conditions',
  authenticateToken,
  // Validation rules would go here
  (req: Request, res: Response) => predictiveAIController.getMarketConditions(req as any, res),
);

/**
 * @route POST /api/predictive-ai/recommendations/:userId
 * @desc Get personalized recommendations for users
 * @access Private (own data only)
 */
router.post(
  '/recommendations/:userId',
  authenticateToken,
  // Validation rules would go here
  (req: Request, res: Response) => predictiveAIController.getPersonalizedRecommendations(req as any, res),
);

/**
 * @route GET /api/predictive-ai/health
 * @desc Get AI services health status
 * @access Public
 */
router.get(
  '/health',
  (req: Request, res: Response) => predictiveAIController.getHealthStatus(req, res),
);

// Admin-only routes
/**
 * @route GET /api/predictive-ai/admin/cache/stats
 * @desc Get cache statistics
 * @access Admin
 */
router.get(
  '/admin/cache/stats',
  authenticateToken,
  authorizeRoles('admin'),
  (req: Request, res: Response) => predictiveAIController.getCacheStats(req as any, res),
);

/**
 * @route POST /api/predictive-ai/admin/cache/clear
 * @desc Clear cache
 * @access Admin
 */
router.post(
  '/admin/cache/clear',
  authenticateToken,
  authorizeRoles('admin'),
  // Validation rules would go here
  (req: Request, res: Response) => predictiveAIController.clearCache(req as any, res),
);

export default router;
