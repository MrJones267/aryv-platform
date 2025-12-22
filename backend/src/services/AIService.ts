/**
 * @fileoverview AI Services integration for backend
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import axios, { AxiosResponse } from 'axios';
import { config } from '../config/config';
import logger from '../utils/logger';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface RideMatchRequest {
  origin: Coordinates;
  destination: Coordinates;
  departure_time: string;
  preferences: {
    max_distance?: number;
    max_time_difference?: number;
    max_price?: number;
    vehicle_preferences?: Record<string, any>;
    seats_needed?: number;
  };
}

interface RideMatch {
  ride_id: string;
  driver_id: string;
  compatibility_score: number;
  distance_from_origin: number;
  distance_to_destination: number;
  time_deviation_hours: number;
  price_per_seat: number;
  available_seats: number;
  driver_rating: number;
  vehicle_info: {
    make: string;
    model: string;
    year: number;
    color: string;
    license_plate: string;
  };
  estimated_pickup_time: string;
  estimated_arrival_time: string;
  route_efficiency: number;
}

interface DynamicPricingRequest {
  ride_data: {
    origin: Coordinates;
    destination: Coordinates;
    departure_time: string;
    distance_km: number;
    estimated_duration_minutes: number;
  };
  market_conditions?: {
    weather?: {
      condition: string;
      temperature: number;
    };
    events?: Array<{
      location: Coordinates;
      impact: 'low' | 'medium' | 'high';
    }>;
  };
}

interface PricingResult {
  base_price: number;
  surge_multiplier: number;
  final_price: number;
  demand_factor: number;
  supply_factor: number;
  time_factor: number;
  distance_factor: number;
  weather_factor: number;
  event_factor: number;
  confidence_score: number;
  breakdown: {
    distance_cost: number;
    time_cost: number;
    surge_amount: number;
  };
  currency: string;
  timestamp: string;
}

interface RouteOptimizationRequest {
  waypoints: Array<{
    id: string;
    type: 'pickup' | 'dropoff';
    latitude: number;
    longitude: number;
    address: string;
    passenger_id: string;
    estimated_time?: number;
    priority?: number;
  }>;
  constraints?: {
    max_passengers?: number;
    max_detour_factor?: number;
  };
}

interface OptimizedRoute {
  optimized_waypoints: Array<{
    id: string;
    type: string;
    latitude: number;
    longitude: number;
    address: string;
    passenger_id: string;
    estimated_time: number;
    priority: number;
  }>;
  route_summary: {
    total_distance_km: number;
    total_time_minutes: number;
    efficiency_score: number;
    total_passengers: number;
  };
  passenger_routes: Record<string, {
    pickup_order: number;
    dropoff_order: number;
    direct_distance_km: number;
    estimated_pickup_time: number;
    estimated_dropoff_time: number;
    estimated_ride_time_minutes: number;
    pickup_location: Coordinates & { address: string };
    dropoff_location: Coordinates & { address: string };
  }>;
}

interface DemandPredictionRequest {
  location: Coordinates;
  time_range: {
    start: string;
    end: string;
  };
}

interface DemandPrediction {
  location: Coordinates;
  time_range: {
    start: string;
    end: string;
  };
  predictions: {
    overall_demand: number;
    peak_demand: number;
    demand_category: 'low' | 'normal' | 'high' | 'very_high';
    confidence: number;
  };
  hourly_breakdown: Array<{
    hour: number;
    predicted_demand: number;
    confidence: number;
  }>;
  factors: Record<string, number>;
  recommendations: string[];
}

export class AIService {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = config.aiServices.baseURL || 'http://ai-services:5000';
    this.timeout = 30000; // 30 seconds timeout
  }

  /**
   * Find compatible rides using AI matching algorithm
   */
  async findRideMatches(request: RideMatchRequest): Promise<{
    success: boolean;
    data?: {
      matches: RideMatch[];
      total_matches: number;
      search_params: any;
    };
    error?: string;
  }> {
    try {
      logger.info('Requesting AI ride matching', {
        origin: request.origin,
        destination: request.destination,
        departure_time: request.departure_time,
      });

      const response: AxiosResponse = await axios.post(
        `${this.baseURL}/api/match-rides`,
        request,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Source': 'hitch-backend',
          },
        },
      );

      if (response.data.success) {
        logger.info(`AI ride matching successful: ${response.data.data.total_matches} matches found`);
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        logger.warn('AI ride matching returned unsuccessful result', response.data);
        return {
          success: false,
          error: response.data.error || 'AI matching failed',
        };
      }

    } catch (error: any) {
      logger.error('AI ride matching service error', {
        error: error.message,
        stack: error.stack,
        request: request,
      });

      return {
        success: false,
        error: this._getErrorMessage(error),
      };
    }
  }

  /**
   * Calculate dynamic pricing using AI algorithm
   */
  async calculateDynamicPrice(request: DynamicPricingRequest): Promise<{
    success: boolean;
    data?: PricingResult;
    error?: string;
  }> {
    try {
      logger.info('Requesting AI dynamic pricing', {
        ride_data: request.ride_data,
      });

      const response: AxiosResponse = await axios.post(
        `${this.baseURL}/api/calculate-price`,
        request,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Source': 'hitch-backend',
          },
        },
      );

      if (response.data.success) {
        logger.info(`AI pricing successful: $${response.data.data.final_price} (surge: ${response.data.data.surge_multiplier}x)`);
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        logger.warn('AI pricing returned unsuccessful result', response.data);
        return {
          success: false,
          error: response.data.error || 'AI pricing failed',
        };
      }

    } catch (error: any) {
      logger.error('AI pricing service error', {
        error: error.message,
        stack: error.stack,
        request: request,
      });

      return {
        success: false,
        error: this._getErrorMessage(error),
      };
    }
  }

  /**
   * Optimize route for multiple passengers using AI
   */
  async optimizeRoute(request: RouteOptimizationRequest): Promise<{
    success: boolean;
    data?: OptimizedRoute;
    error?: string;
  }> {
    try {
      logger.info('Requesting AI route optimization', {
        waypoint_count: request.waypoints.length,
        passenger_count: new Set(request.waypoints.map(w => w.passenger_id)).size,
      });

      const response: AxiosResponse = await axios.post(
        `${this.baseURL}/api/optimize-route`,
        request,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Source': 'hitch-backend',
          },
        },
      );

      if (response.data.success) {
        logger.info(`AI route optimization successful: ${response.data.data.route_summary.total_distance_km}km, ${response.data.data.route_summary.total_time_minutes}min`);
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        logger.warn('AI route optimization returned unsuccessful result', response.data);
        return {
          success: false,
          error: response.data.error || 'AI route optimization failed',
        };
      }

    } catch (error: any) {
      logger.error('AI route optimization service error', {
        error: error.message,
        stack: error.stack,
        request: request,
      });

      return {
        success: false,
        error: this._getErrorMessage(error),
      };
    }
  }

  /**
   * Predict demand for specific location and time
   */
  async predictDemand(request: DemandPredictionRequest): Promise<{
    success: boolean;
    data?: DemandPrediction;
    error?: string;
  }> {
    try {
      logger.info('Requesting AI demand prediction', {
        location: request.location,
        time_range: request.time_range,
      });

      const response: AxiosResponse = await axios.post(
        `${this.baseURL}/api/predict-demand`,
        request,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Source': 'hitch-backend',
          },
        },
      );

      if (response.data.success) {
        logger.info(`AI demand prediction successful: ${response.data.data.predictions.demand_category} demand predicted`);
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        logger.warn('AI demand prediction returned unsuccessful result', response.data);
        return {
          success: false,
          error: response.data.error || 'AI demand prediction failed',
        };
      }

    } catch (error: any) {
      logger.error('AI demand prediction service error', {
        error: error.message,
        stack: error.stack,
        request: request,
      });

      return {
        success: false,
        error: this._getErrorMessage(error),
      };
    }
  }

  /**
   * Check AI services health
   */
  async checkHealth(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseURL}/health`,
        {
          timeout: 5000, // 5 seconds timeout for health check
          headers: {
            'X-Service-Source': 'hitch-backend',
          },
        },
      );

      return {
        success: response.data.success || response.status === 200,
        data: response.data,
      };

    } catch (error: any) {
      logger.error('AI services health check failed', {
        error: error.message,
        baseURL: this.baseURL,
      });

      return {
        success: false,
        error: this._getErrorMessage(error),
      };
    }
  }

  /**
   * Get comprehensive ride suggestions with AI-powered matching and pricing
   */
  async getRideRecommendations(
    origin: Coordinates,
    destination: Coordinates,
    departureTime: string,
    userPreferences: Record<string, any> = {},
  ): Promise<{
    success: boolean;
    data?: {
      matches: RideMatch[];
      pricing: PricingResult;
      recommendations: string[];
    };
    error?: string;
  }> {
    try {
      // Parallel requests for ride matching and pricing
      const matchRequest: RideMatchRequest = {
        origin,
        destination,
        departure_time: departureTime,
        preferences: {
          max_distance: userPreferences['maxDistance'] || 10,
          max_time_difference: userPreferences['maxTimeDifference'] || 2,
          max_price: userPreferences['maxPrice'],
          vehicle_preferences: userPreferences['vehiclePreferences'] || {},
          seats_needed: userPreferences['seatsNeeded'] || 1,
        },
      };

      // Calculate estimated distance and duration (simplified)
      const estimatedDistance = this._calculateEstimatedDistance(origin, destination);
      const estimatedDuration = estimatedDistance * 2; // Rough estimate: 30km/h average

      const pricingRequest: DynamicPricingRequest = {
        ride_data: {
          origin,
          destination,
          departure_time: departureTime,
          distance_km: estimatedDistance,
          estimated_duration_minutes: estimatedDuration,
        },
      };

      const [matchResult, pricingResult] = await Promise.all([
        this.findRideMatches(matchRequest),
        this.calculateDynamicPrice(pricingRequest),
      ]);

      if (!matchResult.success) {
        return {
          success: false,
          ...(matchResult.error && { error: matchResult.error }),
        };
      }

      // Generate recommendations based on results
      const recommendations = this._generateRecommendations(
        matchResult.data?.matches || [],
        pricingResult.data,
      );

      return {
        success: true,
        data: {
          matches: matchResult.data?.matches || [],
          pricing: pricingResult.data || {} as PricingResult,
          recommendations,
        },
      };

    } catch (error: any) {
      logger.error('AI ride recommendations error', {
        error: error.message,
        origin,
        destination,
        departureTime,
      });

      return {
        success: false,
        error: 'Failed to generate ride recommendations',
      };
    }
  }

  /**
   * Get error message from axios error
   */
  private _getErrorMessage(error: any): string {
    if (error.response) {
      // Server responded with error status
      return error.response.data?.error || `AI service error: ${error.response.status}`;
    } else if (error.request) {
      // Request was made but no response received
      return 'AI service unavailable - no response received';
    } else {
      // Something else happened
      return error.message || 'Unknown AI service error';
    }
  }

  /**
   * Calculate estimated distance between coordinates (simplified)
   */
  private _calculateEstimatedDistance(origin: Coordinates, destination: Coordinates): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this._toRadians(destination.latitude - origin.latitude);
    const dLon = this._toRadians(destination.longitude - origin.longitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this._toRadians(origin.latitude)) * Math.cos(this._toRadians(destination.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  private _toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Generate recommendations based on AI results
   */
  private _generateRecommendations(matches: RideMatch[], pricing?: PricingResult): string[] {
    const recommendations: string[] = [];

    if (matches.length === 0) {
      recommendations.push('No compatible rides found. Consider adjusting your search criteria or creating your own ride.');
      return recommendations;
    }

    // Analyze matches
    const avgCompatibility = matches.reduce((sum, match) => sum + match.compatibility_score, 0) / matches.length;
    const topMatch = matches[0];

    if (avgCompatibility > 0.8) {
      recommendations.push('Excellent ride options available! High compatibility scores found.');
    } else if (avgCompatibility > 0.6) {
      recommendations.push('Good ride options available with decent compatibility.');
    } else {
      recommendations.push('Limited compatible options. Consider flexible timing or preferences.');
    }

    if (topMatch.driver_rating >= 4.5) {
      recommendations.push(`Top match has an excellent driver rating of ${topMatch.driver_rating}/5.0.`);
    }

    if (pricing && pricing.surge_multiplier > 1.5) {
      recommendations.push(`High demand detected (${pricing.surge_multiplier}x surge). Consider riding later for better prices.`);
    } else if (pricing && pricing.surge_multiplier < 1.2) {
      recommendations.push('Great timing! Normal pricing currently in effect.');
    }

    if (topMatch.route_efficiency > 0.8) {
      recommendations.push('Highly efficient route found - minimal detour expected.');
    }

    return recommendations;
  }
}

// Export singleton instance
export const aiService = new AIService();
