/**
 * @fileoverview Mobile Predictive AI Service
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiConfig } from '../config/api';
import logger from './LoggingService';

const log = logger.createLogger('PredictiveAIService');
const API_BASE_URL = getApiConfig().apiUrl?.replace('/api', '') || 'https://api.aryv-app.com';
const getAuthToken = async () => {
  const token = await AsyncStorage.getItem('@aryv_auth_token')
    || await AsyncStorage.getItem('accessToken');
  return token || '';
};

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

export interface AIServiceResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

class PredictiveAIServiceClass {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/predictive-ai`;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<AIServiceResponse<T>> {
    try {
      const token = await getAuthToken();
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      log.error('PredictiveAIService request error', error);
      throw error;
    }
  }

  /**
   * Get comprehensive predictive insights for a location
   */
  async getPredictiveInsights(
    latitude: number,
    longitude: number,
    basePrice?: number
  ): Promise<AIServiceResponse<PredictiveInsights>> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
    });

    const body = basePrice ? JSON.stringify({ basePrice }) : JSON.stringify({});

    return this.makeRequest<PredictiveInsights>(`/insights?${params.toString()}`, {
      method: 'GET',
      body: body,
    });
  }

  /**
   * Predict demand for a specific location
   */
  async predictDemand(
    latitude: number,
    longitude: number,
    timeHorizonMinutes: number = 60,
    includeFactors: boolean = true
  ): Promise<AIServiceResponse<DemandPrediction>> {
    return this.makeRequest<DemandPrediction>('/predict/demand', {
      method: 'POST',
      body: JSON.stringify({
        latitude,
        longitude,
        timeHorizonMinutes,
        includeFactors
      }),
    });
  }

  /**
   * Optimize pricing based on market conditions
   */
  async optimizePricing(
    basePrice: number,
    latitude: number,
    longitude: number,
    demandLevel: number,
    supplyLevel: number
  ): Promise<AIServiceResponse<PricePrediction>> {
    return this.makeRequest<PricePrediction>('/optimize/pricing', {
      method: 'POST',
      body: JSON.stringify({
        basePrice,
        latitude,
        longitude,
        demandLevel,
        supplyLevel
      }),
    });
  }

  /**
   * Predict wait time for a ride request
   */
  async predictWaitTime(
    latitude: number,
    longitude: number,
    timeOfDay?: number
  ): Promise<AIServiceResponse<WaitTimePrediction>> {
    return this.makeRequest<WaitTimePrediction>('/predict/wait-time', {
      method: 'POST',
      body: JSON.stringify({
        latitude,
        longitude,
        timeOfDay
      }),
    });
  }

  /**
   * Predict user behavior patterns
   */
  async predictUserBehavior(
    userId: string,
    behaviorType: 'ride_frequency' | 'preferred_times' | 'price_sensitivity' = 'ride_frequency'
  ): Promise<AIServiceResponse<UserBehaviorPrediction>> {
    return this.makeRequest<UserBehaviorPrediction>(`/predict/user-behavior/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ behaviorType }),
    });
  }

  /**
   * Predict user churn risk
   */
  async predictChurnRisk(userId: string): Promise<AIServiceResponse<ChurnRiskPrediction>> {
    return this.makeRequest<ChurnRiskPrediction>(`/predict/churn-risk/${userId}`);
  }

  /**
   * Get real-time market conditions
   */
  async getMarketConditions(
    latitude: number,
    longitude: number
  ): Promise<AIServiceResponse<MarketConditions>> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
    });

    return this.makeRequest<MarketConditions>(`/market/conditions?${params.toString()}`);
  }

  /**
   * Get personalized recommendations for users
   */
  async getPersonalizedRecommendations(
    userId: string,
    latitude: number,
    longitude: number,
    preferences?: Record<string, any>
  ): Promise<AIServiceResponse<{ recommendations: string[] }>> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
    });

    return this.makeRequest<{ recommendations: string[] }>(
      `/recommendations/${userId}?${params.toString()}`,
      {
        method: 'POST',
        body: JSON.stringify({ preferences }),
      }
    );
  }

  /**
   * Get AI services health status
   */
  async getHealthStatus(): Promise<AIServiceResponse<{
    overall_status: string;
    services: { ai_service: boolean; realtime_service: boolean };
  }>> {
    return this.makeRequest<{
      overall_status: string;
      services: { ai_service: boolean; realtime_service: boolean };
    }>('/health');
  }

  // Utility methods for offline scenarios

  /**
   * Get fallback demand prediction for offline scenarios
   */
  getFallbackDemandPrediction(): DemandPrediction {
    return {
      prediction: 8,
      confidence: 0.3,
      factors: { 'offline_mode': 1.0 },
      timestamp: new Date().toISOString(),
      model_version: 'offline_fallback'
    };
  }

  /**
   * Get fallback pricing for offline scenarios
   */
  getFallbackPricePrediction(basePrice: number): PricePrediction {
    return {
      prediction: basePrice * 1.1, // 10% markup as fallback
      confidence: 0.3,
      factors: { 'offline_mode': 1.0 },
      timestamp: new Date().toISOString(),
      model_version: 'offline_fallback'
    };
  }

  /**
   * Get fallback wait time for offline scenarios
   */
  getFallbackWaitTimePrediction(): WaitTimePrediction {
    return {
      prediction: 10, // 10 minutes as conservative estimate
      confidence: 0.3,
      factors: { 'offline_mode': 1.0 },
      timestamp: new Date().toISOString(),
      model_version: 'offline_fallback'
    };
  }

  /**
   * Get fallback market conditions for offline scenarios
   */
  getFallbackMarketConditions(): MarketConditions {
    return {
      weather: {
        temperature: 20,
        precipitation_probability: 0.1,
        severity_score: 0.1,
        condition: 'clear'
      },
      traffic: {
        density: 0.5,
        congestion_level: 'moderate',
        incidents_count: 0,
        estimated_delay: 5
      },
      events: {
        count: 0,
        max_impact: 0,
        total_attendees: 0
      },
      composite_scores: {
        demand_multiplier: 1.0,
        price_impact: 1.0,
        wait_time_impact: 1.0
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get basic recommendations for offline scenarios
   */
  getFallbackRecommendations(): string[] {
    return [
      'Plan your trip ahead for the best experience',
      'Check app later for real-time insights',
      'Consider flexible timing for better rates'
    ];
  }

  /**
   * Format prediction confidence as user-friendly text
   */
  formatConfidence(confidence: number): string {
    if (confidence >= 0.8) return 'Very High';
    if (confidence >= 0.6) return 'High';
    if (confidence >= 0.4) return 'Medium';
    if (confidence >= 0.2) return 'Low';
    return 'Very Low';
  }

  /**
   * Format demand prediction as user-friendly text
   */
  formatDemandLevel(prediction: number): string {
    if (prediction >= 25) return 'Very High';
    if (prediction >= 15) return 'High';
    if (prediction >= 8) return 'Moderate';
    if (prediction >= 3) return 'Low';
    return 'Very Low';
  }

  /**
   * Format price impact as user-friendly text
   */
  formatPriceImpact(basePriceMultiplier: number): string {
    if (basePriceMultiplier >= 2.0) return 'Surge Pricing Active';
    if (basePriceMultiplier >= 1.5) return 'Higher Than Usual';
    if (basePriceMultiplier >= 1.2) return 'Slightly Higher';
    if (basePriceMultiplier >= 0.9) return 'Normal Pricing';
    return 'Lower Than Usual';
  }

  /**
   * Format wait time as user-friendly text
   */
  formatWaitTime(minutes: number): string {
    if (minutes < 3) return 'Very Fast';
    if (minutes < 6) return 'Fast';
    if (minutes < 10) return 'Normal';
    if (minutes < 15) return 'Longer Than Usual';
    return 'High Wait Time';
  }

  /**
   * Get color code for confidence levels
   */
  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.7) return '#4CAF50'; // Green
    if (confidence >= 0.5) return '#FF9800'; // Orange
    return '#F44336'; // Red
  }

  /**
   * Get color code for demand levels
   */
  getDemandColor(prediction: number): string {
    if (prediction >= 20) return '#F44336'; // Red - Very High
    if (prediction >= 10) return '#FF9800'; // Orange - High
    if (prediction >= 5) return '#4CAF50'; // Green - Moderate
    return '#2196F3'; // Blue - Low
  }

  /**
   * Get icon name for weather conditions
   */
  getWeatherIcon(condition: string): string {
    switch (condition.toLowerCase()) {
      case 'clear':
      case 'sunny':
        return 'sunny';
      case 'cloudy':
      case 'overcast':
        return 'cloudy';
      case 'rain':
      case 'rainy':
        return 'rainy';
      case 'snow':
      case 'snowy':
        return 'snow';
      case 'storm':
      case 'thunderstorm':
        return 'thunderstorm';
      default:
        return 'partly-sunny';
    }
  }

  /**
   * Get icon name for traffic conditions
   */
  getTrafficIcon(level: string): string {
    switch (level.toLowerCase()) {
      case 'low':
        return 'car-sport';
      case 'moderate':
        return 'car';
      case 'high':
        return 'warning';
      case 'severe':
        return 'alert-circle';
      default:
        return 'car';
    }
  }
}

export const PredictiveAIService = new PredictiveAIServiceClass();
export default PredictiveAIService;