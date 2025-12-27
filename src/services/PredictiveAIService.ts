/**
 * @fileoverview Enhanced Predictive AI Service for backend integration
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import axios, { AxiosResponse } from 'axios';
import NodeCache from 'node-cache';
import logger from '../utils/logger';

export interface PredictionResult {
  prediction: number;
  confidence: number;
  factors: Record<string, number>;
  timestamp: string;
  model_version: string;
}

export interface DemandPrediction extends PredictionResult {
  prediction: number; // Expected number of ride requests
}

export interface PricePrediction extends PredictionResult {
  prediction: number; // Optimized price
}

export interface WaitTimePrediction extends PredictionResult {
  prediction: number; // Expected wait time in minutes
}

export interface UserBehaviorPrediction extends PredictionResult {
  prediction: number; // Behavior metric value
}

export interface ChurnRiskPrediction extends PredictionResult {
  prediction: number; // Churn probability (0-1)
}

export interface MarketConditions {
  weather: {
    temperature: number;
    precipitation_probability: number;
    severity_score: number;
    condition: string;
  };
  traffic: {
    density: number;
    congestion_level: string;
    incidents_count: number;
    estimated_delay: number;
  };
  events: {
    count: number;
    max_impact: number;
    total_attendees: number;
  };
  composite_scores: {
    demand_multiplier: number;
    price_impact: number;
    wait_time_impact: number;
  };
  timestamp: string;
}

export interface PredictiveInsights {
  demand_forecast: DemandPrediction;
  optimal_pricing: PricePrediction;
  wait_time_estimate: WaitTimePrediction;
  market_conditions: MarketConditions;
  recommendations: string[];
}

class PredictiveAIService {
  private aiServiceUrl: string;
  private realTimeServiceUrl: string;
  private cache: NodeCache;
  private timeout: number;

  constructor() {
    this.aiServiceUrl = process.env['AI_SERVICE_URL'] || 'http://localhost:5001';
    this.realTimeServiceUrl = process.env['REALTIME_DATA_URL'] || 'http://localhost:5002';
    this.timeout = 10000; // 10 seconds

    // Initialize cache with TTL
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes default
      checkperiod: 60, // Check for expired keys every 60 seconds
      useClones: false,
    });
  }

  /**
   * Get comprehensive predictive insights for a location
   */
  async getPredictiveInsights(
    latitude: number,
    longitude: number,
    basePrice?: number,
    _userId?: string,
  ): Promise<PredictiveInsights> {
    try {
      const cacheKey = `insights:${latitude}:${longitude}:${basePrice || 'default'}`;
      const cached = this.cache.get<PredictiveInsights>(cacheKey);

      if (cached) {
        return cached;
      }

      // Get all predictions in parallel
      const [
        demandResult,
        marketConditions,
        waitTimeResult,
      ] = await Promise.allSettled([
        this.predictDemand(latitude, longitude, 60),
        this.getMarketConditions(latitude, longitude),
        this.predictWaitTime(latitude, longitude),
      ]);

      const demand = demandResult.status === 'fulfilled' ? demandResult.value : this.getFallbackDemand();
      const market = marketConditions.status === 'fulfilled' ? marketConditions.value : this.getFallbackMarket();
      const waitTime = waitTimeResult.status === 'fulfilled' ? waitTimeResult.value : this.getFallbackWaitTime();

      // Get pricing optimization if base price provided
      let pricing = this.getFallbackPricing();
      if (basePrice) {
        try {
          pricing = await this.optimizePricing(
            basePrice,
            latitude,
            longitude,
            demand.prediction,
            market.composite_scores.demand_multiplier,
          );
        } catch (error) {
          logger.warn('Failed to get pricing optimization, using fallback');
        }
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        demand,
        pricing,
        waitTime,
        market,
      );

      const insights: PredictiveInsights = {
        demand_forecast: demand,
        optimal_pricing: pricing,
        wait_time_estimate: waitTime,
        market_conditions: market,
        recommendations,
      };

      // Cache for 3 minutes
      this.cache.set(cacheKey, insights, 180);

      return insights;

    } catch (error) {
      logger.error('Error getting predictive insights:', error);
      return this.getFallbackInsights();
    }
  }

  /**
   * Predict demand for a specific location and time horizon
   */
  async predictDemand(
    latitude: number,
    longitude: number,
    timeHorizonMinutes: number = 60,
    includeFactors: boolean = true,
  ): Promise<DemandPrediction> {
    try {
      const cacheKey = `demand:${latitude}:${longitude}:${timeHorizonMinutes}`;
      const cached = this.cache.get<DemandPrediction>(cacheKey);

      if (cached) {
        return cached;
      }

      const response: AxiosResponse<DemandPrediction> = await axios.post(
        `${this.aiServiceUrl}/predict/demand`,
        {
          latitude,
          longitude,
          time_horizon: timeHorizonMinutes,
          include_factors: includeFactors,
        },
        { timeout: this.timeout },
      );

      const result = response.data;
      this.cache.set(cacheKey, result, 300); // Cache for 5 minutes

      return result;

    } catch (error) {
      logger.error('Error predicting demand:', error);
      return this.getFallbackDemand();
    }
  }

  /**
   * Optimize pricing based on market conditions
   */
  async optimizePricing(
    basePrice: number,
    latitude: number,
    longitude: number,
    demandLevel: number,
    supplyLevel: number,
  ): Promise<PricePrediction> {
    try {
      const cacheKey = `pricing:${basePrice}:${latitude}:${longitude}:${demandLevel}:${supplyLevel}`;
      const cached = this.cache.get<PricePrediction>(cacheKey);

      if (cached) {
        return cached;
      }

      const response: AxiosResponse<PricePrediction> = await axios.post(
        `${this.aiServiceUrl}/optimize/pricing`,
        {
          base_price: basePrice,
          latitude,
          longitude,
          demand_level: demandLevel,
          supply_level: supplyLevel,
        },
        { timeout: this.timeout },
      );

      const result = response.data;
      this.cache.set(cacheKey, result, 180); // Cache for 3 minutes

      return result;

    } catch (error) {
      logger.error('Error optimizing pricing:', error);
      return this.getFallbackPricing();
    }
  }

  /**
   * Predict wait time for a ride request
   */
  async predictWaitTime(
    latitude: number,
    longitude: number,
    timeOfDay?: number,
  ): Promise<WaitTimePrediction> {
    try {
      const cacheKey = `waittime:${latitude}:${longitude}:${timeOfDay || 'current'}`;
      const cached = this.cache.get<WaitTimePrediction>(cacheKey);

      if (cached) {
        return cached;
      }

      const response: AxiosResponse<WaitTimePrediction> = await axios.post(
        `${this.aiServiceUrl}/predict/wait-time`,
        {
          latitude,
          longitude,
          time_of_day: timeOfDay,
        },
        { timeout: this.timeout },
      );

      const result = response.data;
      this.cache.set(cacheKey, result, 240); // Cache for 4 minutes

      return result;

    } catch (error) {
      logger.error('Error predicting wait time:', error);
      return this.getFallbackWaitTime();
    }
  }

  /**
   * Predict user behavior patterns
   */
  async predictUserBehavior(
    userId: string,
    behaviorType: 'ride_frequency' | 'preferred_times' | 'price_sensitivity' = 'ride_frequency',
  ): Promise<UserBehaviorPrediction> {
    try {
      const cacheKey = `behavior:${userId}:${behaviorType}`;
      const cached = this.cache.get<UserBehaviorPrediction>(cacheKey);

      if (cached) {
        return cached;
      }

      const response: AxiosResponse<UserBehaviorPrediction> = await axios.post(
        `${this.aiServiceUrl}/predict/user-behavior`,
        {
          user_id: userId,
          behavior_type: behaviorType,
        },
        { timeout: this.timeout },
      );

      const result = response.data;
      this.cache.set(cacheKey, result, 1800); // Cache for 30 minutes

      return result;

    } catch (error) {
      logger.error('Error predicting user behavior:', error);
      return this.getFallbackUserBehavior();
    }
  }

  /**
   * Predict user churn risk
   */
  async predictChurnRisk(userId: string): Promise<ChurnRiskPrediction> {
    try {
      const cacheKey = `churn:${userId}`;
      const cached = this.cache.get<ChurnRiskPrediction>(cacheKey);

      if (cached) {
        return cached;
      }

      const response: AxiosResponse<ChurnRiskPrediction> = await axios.post(
        `${this.aiServiceUrl}/predict/churn-risk`,
        {
          user_id: userId,
        },
        { timeout: this.timeout },
      );

      const result = response.data;
      this.cache.set(cacheKey, result, 3600); // Cache for 1 hour

      return result;

    } catch (error) {
      logger.error('Error predicting churn risk:', error);
      return this.getFallbackChurnRisk();
    }
  }

  /**
   * Get real-time market conditions
   */
  async getMarketConditions(
    latitude: number,
    longitude: number,
  ): Promise<MarketConditions> {
    try {
      const cacheKey = `market:${latitude}:${longitude}`;
      const cached = this.cache.get<MarketConditions>(cacheKey);

      if (cached) {
        return cached;
      }

      const response: AxiosResponse<MarketConditions> = await axios.get(
        `${this.realTimeServiceUrl}/conditions/aggregated`,
        {
          params: { latitude, longitude },
          timeout: this.timeout,
        },
      );

      const result = response.data;
      this.cache.set(cacheKey, result, 120); // Cache for 2 minutes

      return result;

    } catch (error) {
      logger.error('Error getting market conditions:', error);
      return this.getFallbackMarket();
    }
  }

  /**
   * Get personalized recommendations for users
   */
  async getPersonalizedRecommendations(
    userId: string,
    latitude: number,
    longitude: number,
    _preferences?: Record<string, any>,
  ): Promise<string[]> {
    try {
      // Get user behavior and market conditions
      const [behaviorResult, marketResult, churnResult] = await Promise.allSettled([
        this.predictUserBehavior(userId, 'ride_frequency'),
        this.getMarketConditions(latitude, longitude),
        this.predictChurnRisk(userId),
      ]);

      const behavior = behaviorResult.status === 'fulfilled' ? behaviorResult.value : null;
      const market = marketResult.status === 'fulfilled' ? marketResult.value : null;
      const churn = churnResult.status === 'fulfilled' ? churnResult.value : null;

      const recommendations: string[] = [];

      // Behavior-based recommendations
      if (behavior && behavior.prediction < 2) {
        recommendations.push('Consider booking rides in advance for better pricing');
      }

      // Market-based recommendations
      if (market && market.composite_scores.demand_multiplier > 1.5) {
        recommendations.push('High demand expected - book soon or consider alternative times');
      }

      if (market && market.weather.severity_score > 0.5) {
        recommendations.push('Weather may affect your ride - allow extra time');
      }

      if (market && market.traffic.congestion_level === 'severe') {
        recommendations.push('Heavy traffic expected - consider public transport alternatives');
      }

      // Churn prevention recommendations
      if (churn && churn.prediction > 0.6) {
        recommendations.push('Check out our latest features and promotions');
        recommendations.push('Share feedback to help us improve your experience');
      }

      return recommendations;

    } catch (error) {
      logger.error('Error getting personalized recommendations:', error);
      return ['Book your ride and enjoy the journey!'];
    }
  }

  /**
   * Generate recommendations based on predictions
   */
  private generateRecommendations(
    demand: DemandPrediction,
    pricing: PricePrediction,
    waitTime: WaitTimePrediction,
    market: MarketConditions,
  ): string[] {
    const recommendations: string[] = [];

    // Demand-based recommendations
    if (demand.prediction > 20) {
      recommendations.push('High demand expected - book early for best availability');
    } else if (demand.prediction < 5) {
      recommendations.push('Low demand period - great time for quick rides');
    }

    // Pricing recommendations
    if (pricing.prediction > pricing.prediction * 1.5) {
      recommendations.push('Consider booking later for potentially lower prices');
    }

    // Wait time recommendations
    if (waitTime.prediction > 15) {
      recommendations.push('Longer wait times expected - plan accordingly');
    } else if (waitTime.prediction < 5) {
      recommendations.push('Fast pickup times available');
    }

    // Weather recommendations
    if (market.weather.severity_score > 0.6) {
      recommendations.push('Weather conditions may affect your ride - stay flexible');
    }

    // Traffic recommendations
    if (market.traffic.density > 0.8) {
      recommendations.push('Heavy traffic expected - allow extra travel time');
    }

    // Events recommendations
    if (market.events.count > 0) {
      recommendations.push('Local events may affect routes and timing');
    }

    return recommendations.length > 0 ? recommendations : ['All conditions normal - enjoy your ride!'];
  }

  // Fallback methods for error scenarios
  private getFallbackDemand(): DemandPrediction {
    return {
      prediction: 10,
      confidence: 0.3,
      factors: {},
      timestamp: new Date().toISOString(),
      model_version: 'fallback',
    };
  }

  private getFallbackPricing(): PricePrediction {
    return {
      prediction: 25.0,
      confidence: 0.3,
      factors: {},
      timestamp: new Date().toISOString(),
      model_version: 'fallback',
    };
  }

  private getFallbackWaitTime(): WaitTimePrediction {
    return {
      prediction: 8.0,
      confidence: 0.3,
      factors: {},
      timestamp: new Date().toISOString(),
      model_version: 'fallback',
    };
  }

  private getFallbackUserBehavior(): UserBehaviorPrediction {
    return {
      prediction: 3.0,
      confidence: 0.3,
      factors: {},
      timestamp: new Date().toISOString(),
      model_version: 'fallback',
    };
  }

  private getFallbackChurnRisk(): ChurnRiskPrediction {
    return {
      prediction: 0.2,
      confidence: 0.3,
      factors: {},
      timestamp: new Date().toISOString(),
      model_version: 'fallback',
    };
  }

  private getFallbackMarket(): MarketConditions {
    return {
      weather: {
        temperature: 20.0,
        precipitation_probability: 0.1,
        severity_score: 0.1,
        condition: 'clear',
      },
      traffic: {
        density: 0.5,
        congestion_level: 'moderate',
        incidents_count: 0,
        estimated_delay: 5.0,
      },
      events: {
        count: 0,
        max_impact: 0.0,
        total_attendees: 0,
      },
      composite_scores: {
        demand_multiplier: 1.0,
        price_impact: 1.0,
        wait_time_impact: 1.0,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private getFallbackInsights(): PredictiveInsights {
    return {
      demand_forecast: this.getFallbackDemand(),
      optimal_pricing: this.getFallbackPricing(),
      wait_time_estimate: this.getFallbackWaitTime(),
      market_conditions: this.getFallbackMarket(),
      recommendations: ['Service temporarily unavailable - standard booking available'],
    };
  }

  /**
   * Health check for AI services
   */
  async healthCheck(): Promise<{ ai_service: boolean; realtime_service: boolean }> {
    try {
      const [aiHealth, realtimeHealth] = await Promise.allSettled([
        axios.get(`${this.aiServiceUrl}/health`, { timeout: 5000 }),
        axios.get(`${this.realTimeServiceUrl}/health`, { timeout: 5000 }),
      ]);

      return {
        ai_service: aiHealth.status === 'fulfilled' && aiHealth.value.status === 200,
        realtime_service: realtimeHealth.status === 'fulfilled' && realtimeHealth.value.status === 200,
      };

    } catch (error) {
      logger.error('Error during AI services health check:', error);
      return {
        ai_service: false,
        realtime_service: false,
      };
    }
  }

  /**
   * Clear cache for specific patterns
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      const keys = this.cache.keys();
      const filteredKeys = keys.filter((key: string) => key.includes(pattern));
      this.cache.del(filteredKeys);
    } else {
      this.cache.flushAll();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    keys: number;
    hits: number;
    misses: number;
    ksize: number;
    vsize: number;
  } {
    return this.cache.getStats();
  }
}

export default new PredictiveAIService();
