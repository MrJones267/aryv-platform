/**
 * @fileoverview Predictive AI Controller for enhanced AI features
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import PredictiveAIService from '../services/PredictiveAIService';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../types';

export default class PredictiveAIController {
  /**
   * Get comprehensive predictive insights for a location
   */
  async getPredictiveInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
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

      const insights = await PredictiveAIService.getPredictiveInsights(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        basePrice ? parseFloat(basePrice) : undefined,
        userId,
      );

      res.status(200).json({
        success: true,
        message: 'Predictive insights retrieved successfully',
        data: insights,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting predictive insights:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get predictive insights',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Predict demand for a specific location
   */
  async predictDemand(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { latitude, longitude, timeHorizonMinutes, includeFactors } = req.body;

      const prediction = await PredictiveAIService.predictDemand(
        latitude,
        longitude,
        timeHorizonMinutes || 60,
        includeFactors !== false,
      );

      res.status(200).json({
        success: true,
        message: 'Demand prediction completed',
        data: prediction,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error predicting demand:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to predict demand',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Optimize pricing based on market conditions
   */
  async optimizePricing(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { basePrice, latitude, longitude, demandLevel, supplyLevel } = req.body;

      const pricing = await PredictiveAIService.optimizePricing(
        basePrice,
        latitude,
        longitude,
        demandLevel,
        supplyLevel,
      );

      res.status(200).json({
        success: true,
        message: 'Pricing optimization completed',
        data: pricing,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error optimizing pricing:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to optimize pricing',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Predict wait time for a ride request
   */
  async predictWaitTime(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { latitude, longitude, timeOfDay } = req.body;

      const waitTime = await PredictiveAIService.predictWaitTime(
        latitude,
        longitude,
        timeOfDay,
      );

      res.status(200).json({
        success: true,
        message: 'Wait time prediction completed',
        data: waitTime,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error predicting wait time:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to predict wait time',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Predict user behavior patterns
   */
  async predictUserBehavior(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
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

      // Ensure user can only access their own data or admin access
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        });
        return;
      }

      const behavior = await PredictiveAIService.predictUserBehavior(
        userId,
        behaviorType,
      );

      res.status(200).json({
        success: true,
        message: 'User behavior prediction completed',
        data: behavior,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error predicting user behavior:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to predict user behavior',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Predict user churn risk
   */
  async predictChurnRisk(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { userId } = req.params;

      // Ensure user can only access their own data or admin access
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        });
        return;
      }

      const churnRisk = await PredictiveAIService.predictChurnRisk(userId);

      res.status(200).json({
        success: true,
        message: 'Churn risk prediction completed',
        data: churnRisk,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error predicting churn risk:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to predict churn risk',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get real-time market conditions
   */
  async getMarketConditions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { latitude, longitude } = req.query;

      const conditions = await PredictiveAIService.getMarketConditions(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
      );

      res.status(200).json({
        success: true,
        message: 'Market conditions retrieved successfully',
        data: conditions,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting market conditions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get market conditions',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get personalized recommendations for users
   */
  async getPersonalizedRecommendations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
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

      // Ensure user can only access their own data
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        });
        return;
      }

      const recommendations = await PredictiveAIService.getPersonalizedRecommendations(
        userId,
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        preferences,
      );

      res.status(200).json({
        success: true,
        message: 'Personalized recommendations retrieved successfully',
        data: { recommendations },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting personalized recommendations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get personalized recommendations',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get AI services health status
   */
  async getHealthStatus(_req: Request, res: Response): Promise<void> {
    try {
      const health = await PredictiveAIService.healthCheck();
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

    } catch (error) {
      logger.error('Error checking AI services health:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check AI services health',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get cache statistics (admin only)
   */
  async getCacheStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check admin access
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
        return;
      }

      const stats = PredictiveAIService.getCacheStats();

      res.status(200).json({
        success: true,
        message: 'Cache statistics retrieved successfully',
        data: stats,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting cache stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get cache statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Clear cache (admin only)
   */
  async clearCache(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check admin access
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
        return;
      }

      const { pattern } = req.body;
      PredictiveAIService.clearCache(pattern);

      res.status(200).json({
        success: true,
        message: pattern ? `Cache cleared for pattern: ${pattern}` : 'All cache cleared',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error clearing cache:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Validation rules for different endpoints
   */
  static getValidationRules() {
    return {
      insights: [
        query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
        query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
        body('basePrice').optional().isFloat({ min: 0 }).withMessage('Base price must be positive'),
      ],

      demandPrediction: [
        body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
        body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
        body('timeHorizonMinutes').optional().isInt({ min: 15, max: 1440 }).withMessage('Time horizon must be between 15-1440 minutes'),
        body('includeFactors').optional().isBoolean().withMessage('Include factors must be boolean'),
      ],

      pricingOptimization: [
        body('basePrice').isFloat({ min: 0 }).withMessage('Base price must be positive'),
        body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
        body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
        body('demandLevel').isFloat({ min: 0 }).withMessage('Demand level must be positive'),
        body('supplyLevel').isFloat({ min: 0 }).withMessage('Supply level must be positive'),
      ],

      waitTimePrediction: [
        body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
        body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
        body('timeOfDay').optional().isInt({ min: 0, max: 23 }).withMessage('Time of day must be 0-23'),
      ],

      userBehavior: [
        param('userId').isUUID().withMessage('Valid user ID required'),
        body('behaviorType').optional().isIn(['ride_frequency', 'preferred_times', 'price_sensitivity']).withMessage('Invalid behavior type'),
      ],

      churnRisk: [
        param('userId').isUUID().withMessage('Valid user ID required'),
      ],

      marketConditions: [
        query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
        query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
      ],

      personalizedRecommendations: [
        param('userId').isUUID().withMessage('Valid user ID required'),
        query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
        query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
        body('preferences').optional().isObject().withMessage('Preferences must be object'),
      ],

      clearCache: [
        body('pattern').optional().isString().withMessage('Pattern must be string'),
      ],
    };
  }
}

// Export instance for static-like usage if needed
// export const predictiveAIController = new PredictiveAIController();
