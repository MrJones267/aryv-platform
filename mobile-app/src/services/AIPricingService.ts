/**
 * @fileoverview AI-powered dynamic pricing service with ML algorithms
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import { LocationCoordinates } from './LocationService';
import { ApiClient } from './ApiClient';
import { AuthService } from './AuthService';

export interface PricingRequest {
  origin: LocationCoordinates & { address?: string };
  destination: LocationCoordinates & { address?: string };
  rideType: 'economy' | 'comfort' | 'premium' | 'shared';
  requestTime: string;
  passengerCount?: number;
  scheduledTime?: string; // for future rides
  waypoints?: LocationCoordinates[];
}

export interface PricingResponse {
  basePrice: number;
  surgeFactor: number;
  finalPrice: number;
  currency: string;
  breakdown: PriceBreakdown;
  estimatedDuration: number; // in minutes
  estimatedDistance: number; // in kilometers
  confidence: number; // 0-1 confidence in pricing
  factors: PricingFactors;
  alternatives?: AlternativePricing[];
}

export interface PriceBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeMultiplier: number;
  demandAdjustment: number;
  weatherAdjustment: number;
  trafficAdjustment: number;
  tolls?: number;
  taxes: number;
  fees: number;
  discount?: number;
}

export interface PricingFactors {
  demand: {
    level: 'low' | 'medium' | 'high' | 'very_high';
    score: number; // 0-1
    driversAvailable: number;
    activeRequests: number;
  };
  weather: {
    condition: string;
    impact: 'none' | 'low' | 'medium' | 'high';
    score: number;
  };
  traffic: {
    level: 'light' | 'moderate' | 'heavy' | 'severe';
    impact: number; // multiplier
    congestionScore: number;
  };
  time: {
    dayOfWeek: number;
    hourOfDay: number;
    isWeekend: boolean;
    isHoliday: boolean;
    timeCategory: 'night' | 'morning_rush' | 'midday' | 'evening_rush' | 'late_night';
  };
  route: {
    complexity: 'simple' | 'moderate' | 'complex';
    highwayPercentage: number;
    cityPercentage: number;
    tollRoads: boolean;
  };
}

export interface AlternativePricing {
  rideType: 'economy' | 'comfort' | 'premium' | 'shared';
  price: number;
  estimatedWaitTime: number;
  description: string;
}

export interface PriceHistory {
  route: string;
  timestamp: string;
  price: number;
  surgeFactor: number;
  actualDuration: number;
  actualDistance: number;
  feedback?: 'too_high' | 'fair' | 'good_value';
}

export interface SurgeZone {
  id: string;
  name: string;
  center: LocationCoordinates;
  radius: number; // in meters
  currentMultiplier: number;
  expectedDuration: number; // minutes until surge ends
  reason: string;
}

class AIPricingService {
  private apiClient: ApiClient;
  private authService: AuthService;
  private priceCache: Map<string, { price: PricingResponse; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
  
  // ML Model weights (would be loaded from backend in production)
  private readonly MODEL_WEIGHTS = {
    demand: 0.35,
    weather: 0.15,
    traffic: 0.25,
    time: 0.15,
    route: 0.10,
  };

  // Base pricing configuration
  private readonly BASE_RATES = {
    economy: {
      baseFare: 2.50,
      perKm: 1.20,
      perMinute: 0.25,
      minFare: 5.00,
    },
    comfort: {
      baseFare: 3.50,
      perKm: 1.60,
      perMinute: 0.35,
      minFare: 7.00,
    },
    premium: {
      baseFare: 5.00,
      perKm: 2.20,
      perMinute: 0.50,
      minFare: 12.00,
    },
    shared: {
      baseFare: 1.50,
      perKm: 0.80,
      perMinute: 0.15,
      minFare: 3.50,
    },
  };

  constructor() {
    this.apiClient = new ApiClient();
    this.authService = new AuthService();
  }

  /**
   * Calculate AI-powered dynamic pricing
   */
  async calculatePrice(request: PricingRequest): Promise<PricingResponse> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cached = this.getCachedPrice(cacheKey);
      if (cached) {
        return cached;
      }

      // In production, this would call the ML service
      if (!__DEV__) {
        return await this.callMLPricingAPI(request);
      }

      // Development: Use local ML simulation
      const pricing = await this.simulateMLPricing(request);
      
      // Cache the result
      this.cachePrice(cacheKey, pricing);
      
      return pricing;
    } catch (error) {
      console.error('AI Pricing calculation error:', error);
      // Fallback to basic pricing
      return this.calculateFallbackPrice(request);
    }
  }

  /**
   * Get current surge zones
   */
  async getSurgeZones(): Promise<SurgeZone[]> {
    try {
      if (!__DEV__) {
        const response = await this.apiClient.get('/pricing/surge-zones');
        return response.success ? response.data : [];
      }

      // Mock surge zones for development
      return this.getMockSurgeZones();
    } catch (error) {
      console.error('Failed to get surge zones:', error);
      return [];
    }
  }

  /**
   * Get price history for route
   */
  async getPriceHistory(
    origin: LocationCoordinates,
    destination: LocationCoordinates,
    days: number = 7
  ): Promise<PriceHistory[]> {
    try {
      if (!__DEV__) {
        const originStr = `${origin.latitude},${origin.longitude}`;
        const destinationStr = `${destination.latitude},${destination.longitude}`;
        const queryParams = `?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destinationStr)}&days=${days}`;
        const response = await this.apiClient.get(`/pricing/history${queryParams}`);
        return response.success ? response.data : [];
      }

      // Mock price history for development
      return this.getMockPriceHistory(origin, destination, days);
    } catch (error) {
      console.error('Failed to get price history:', error);
      return [];
    }
  }

  /**
   * Submit price feedback
   */
  async submitPriceFeedback(
    rideId: string,
    feedback: 'too_high' | 'fair' | 'good_value',
    actualPrice: number
  ): Promise<boolean> {
    try {
      const authToken = await this.authService.getValidToken();
      if (!authToken) return false;

      const response = await this.apiClient.post('/pricing/feedback', {
        rideId,
        feedback,
        actualPrice,
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      return response.success;
    } catch (error) {
      console.error('Failed to submit price feedback:', error);
      return false;
    }
  }

  /**
   * Simulate ML pricing algorithm (for development)
   */
  private async simulateMLPricing(request: PricingRequest): Promise<PricingResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Calculate base metrics
    const distance = this.calculateDistance(request.origin, request.destination);
    const estimatedDuration = this.estimateDuration(distance, request);
    
    // Get pricing factors
    const factors = this.calculatePricingFactors(request, distance);
    
    // Apply ML algorithm
    const basePrice = this.calculateBasePrice(request.rideType, distance, estimatedDuration);
    const surgeFactor = this.calculateSurgeFactor(factors);
    
    // Calculate final price
    const breakdown = this.calculatePriceBreakdown(basePrice, factors, surgeFactor);
    const finalPrice = Math.max(
      breakdown.baseFare + breakdown.distanceFare + breakdown.timeFare + 
      breakdown.demandAdjustment + breakdown.weatherAdjustment + 
      breakdown.trafficAdjustment + breakdown.taxes + breakdown.fees - 
      (breakdown.discount || 0),
      this.BASE_RATES[request.rideType].minFare
    );

    // Generate alternatives
    const alternatives = this.generateAlternatives(request, factors);

    return {
      basePrice,
      surgeFactor,
      finalPrice: Math.round(finalPrice * 100) / 100,
      currency: 'USD',
      breakdown,
      estimatedDuration: Math.round(estimatedDuration),
      estimatedDistance: Math.round(distance * 100) / 100,
      confidence: this.calculateConfidence(factors),
      factors,
      alternatives,
    };
  }

  /**
   * Calculate pricing factors using ML features
   */
  private calculatePricingFactors(request: PricingRequest, distance: number): PricingFactors {
    const requestTime = new Date(request.requestTime);
    const hour = requestTime.getHours();
    const dayOfWeek = requestTime.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    return {
      demand: this.calculateDemandFactor(request, requestTime),
      weather: this.calculateWeatherFactor(request),
      traffic: this.calculateTrafficFactor(request, hour, isWeekend),
      time: {
        dayOfWeek,
        hourOfDay: hour,
        isWeekend,
        isHoliday: this.isHoliday(requestTime),
        timeCategory: this.getTimeCategory(hour, isWeekend),
      },
      route: this.calculateRouteFactor(distance, request),
    };
  }

  /**
   * Calculate demand factor
   */
  private calculateDemandFactor(request: PricingRequest, requestTime: Date): PricingFactors['demand'] {
    // Simulate demand based on time and location
    const hour = requestTime.getHours();
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    const isWeekend = requestTime.getDay() === 0 || requestTime.getDay() === 6;
    
    // Mock demand calculation
    let demandScore = 0.3; // base demand
    
    if (isRushHour && !isWeekend) demandScore += 0.4;
    if (isWeekend && (hour >= 22 || hour <= 2)) demandScore += 0.3;
    if (hour >= 12 && hour <= 14) demandScore += 0.2; // lunch rush
    
    // Add randomness to simulate real-world variation
    demandScore += (Math.random() - 0.5) * 0.2;
    demandScore = Math.max(0, Math.min(1, demandScore));
    
    let level: 'low' | 'medium' | 'high' | 'very_high' = 'low';
    if (demandScore > 0.75) level = 'very_high';
    else if (demandScore > 0.5) level = 'high';
    else if (demandScore > 0.3) level = 'medium';
    
    return {
      level,
      score: demandScore,
      driversAvailable: Math.floor(20 + (1 - demandScore) * 30),
      activeRequests: Math.floor(demandScore * 50),
    };
  }

  /**
   * Calculate weather factor
   */
  private calculateWeatherFactor(request: PricingRequest): PricingFactors['weather'] {
    // Mock weather data (in production, integrate with weather API)
    const conditions = ['clear', 'cloudy', 'light_rain', 'heavy_rain', 'snow', 'storm'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    
    let impact: 'none' | 'low' | 'medium' | 'high' = 'none';
    let score = 0;
    
    switch (condition) {
      case 'heavy_rain':
      case 'storm':
        impact = 'high';
        score = 0.8;
        break;
      case 'light_rain':
      case 'snow':
        impact = 'medium';
        score = 0.5;
        break;
      case 'cloudy':
        impact = 'low';
        score = 0.2;
        break;
      default:
        impact = 'none';
        score = 0;
    }
    
    return { condition, impact, score };
  }

  /**
   * Calculate traffic factor
   */
  private calculateTrafficFactor(
    request: PricingRequest,
    hour: number,
    isWeekend: boolean
  ): PricingFactors['traffic'] {
    let congestionScore = 0.3; // base congestion
    
    // Rush hour traffic
    if (!isWeekend && ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19))) {
      congestionScore = 0.8;
    } else if (!isWeekend && (hour >= 10 && hour <= 16)) {
      congestionScore = 0.5;
    } else if (isWeekend && (hour >= 12 && hour <= 18)) {
      congestionScore = 0.4;
    }
    
    // Add some randomness
    congestionScore += (Math.random() - 0.5) * 0.2;
    congestionScore = Math.max(0, Math.min(1, congestionScore));
    
    let level: 'light' | 'moderate' | 'heavy' | 'severe' = 'light';
    if (congestionScore > 0.75) level = 'severe';
    else if (congestionScore > 0.5) level = 'heavy';
    else if (congestionScore > 0.3) level = 'moderate';
    
    const impact = 1 + (congestionScore * 0.5); // 1x to 1.5x multiplier
    
    return { level, impact, congestionScore };
  }

  /**
   * Calculate route complexity factor
   */
  private calculateRouteFactor(distance: number, request: PricingRequest): PricingFactors['route'] {
    // Simulate route analysis
    const highwayPercentage = Math.min(1, distance / 10); // More highway for longer routes
    const cityPercentage = 1 - highwayPercentage;
    const tollRoads = Math.random() > 0.7; // 30% chance of toll roads
    
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (distance > 20 || request.waypoints?.length) complexity = 'complex';
    else if (distance > 5 || cityPercentage > 0.8) complexity = 'moderate';
    
    return { complexity, highwayPercentage, cityPercentage, tollRoads };
  }

  /**
   * Calculate base price before adjustments
   */
  private calculateBasePrice(rideType: string, distance: number, duration: number): number {
    const rates = this.BASE_RATES[rideType as keyof typeof this.BASE_RATES];
    return rates.baseFare + (rates.perKm * distance) + (rates.perMinute * duration);
  }

  /**
   * Calculate surge factor based on all factors
   */
  private calculateSurgeFactor(factors: PricingFactors): number {
    const demandWeight = factors.demand.score * this.MODEL_WEIGHTS.demand;
    const weatherWeight = factors.weather.score * this.MODEL_WEIGHTS.weather;
    const trafficWeight = (factors.traffic.impact - 1) * 2 * this.MODEL_WEIGHTS.traffic; // Normalize to 0-1
    const timeWeight = this.getTimeMultiplier(factors.time) * this.MODEL_WEIGHTS.time;
    const routeWeight = this.getRouteMultiplier(factors.route) * this.MODEL_WEIGHTS.route;
    
    const totalWeight = demandWeight + weatherWeight + trafficWeight + timeWeight + routeWeight;
    
    // Convert to surge multiplier (1.0 to 3.0)
    return 1.0 + Math.min(2.0, totalWeight * 2);
  }

  /**
   * Get time-based multiplier
   */
  private getTimeMultiplier(timeFactor: PricingFactors['time']): number {
    switch (timeFactor.timeCategory) {
      case 'morning_rush':
      case 'evening_rush':
        return 0.8;
      case 'late_night':
        return 0.6;
      case 'night':
        return 0.4;
      default:
        return 0.2;
    }
  }

  /**
   * Get route complexity multiplier
   */
  private getRouteMultiplier(routeFactor: PricingFactors['route']): number {
    let multiplier = 0.2;
    
    if (routeFactor.complexity === 'complex') multiplier += 0.4;
    else if (routeFactor.complexity === 'moderate') multiplier += 0.2;
    
    if (routeFactor.tollRoads) multiplier += 0.2;
    if (routeFactor.cityPercentage > 0.7) multiplier += 0.2;
    
    return Math.min(1.0, multiplier);
  }

  /**
   * Calculate detailed price breakdown
   */
  private calculatePriceBreakdown(
    basePrice: number,
    factors: PricingFactors,
    surgeFactor: number
  ): PriceBreakdown {
    const surgeMultiplier = surgeFactor - 1;
    const demandAdjustment = basePrice * factors.demand.score * 0.3;
    const weatherAdjustment = basePrice * factors.weather.score * 0.2;
    const trafficAdjustment = basePrice * (factors.traffic.impact - 1);
    const taxes = basePrice * 0.08; // 8% tax
    const fees = 1.50; // Platform fee
    
    return {
      baseFare: Math.round(basePrice * 0.4 * 100) / 100,
      distanceFare: Math.round(basePrice * 0.4 * 100) / 100,
      timeFare: Math.round(basePrice * 0.2 * 100) / 100,
      surgeMultiplier: Math.round(surgeMultiplier * 100) / 100,
      demandAdjustment: Math.round(demandAdjustment * 100) / 100,
      weatherAdjustment: Math.round(weatherAdjustment * 100) / 100,
      trafficAdjustment: Math.round(trafficAdjustment * 100) / 100,
      tolls: factors.route.tollRoads ? 3.50 : undefined,
      taxes: Math.round(taxes * 100) / 100,
      fees: fees,
    };
  }

  /**
   * Generate alternative pricing options
   */
  private generateAlternatives(
    request: PricingRequest,
    factors: PricingFactors
  ): AlternativePricing[] {
    const alternatives: AlternativePricing[] = [];
    const rideTypes = ['economy', 'comfort', 'premium', 'shared'] as const;
    
    rideTypes.forEach(rideType => {
      if (rideType !== request.rideType) {
        const distance = this.calculateDistance(request.origin, request.destination);
        const duration = this.estimateDuration(distance, { ...request, rideType });
        const basePrice = this.calculateBasePrice(rideType, distance, duration);
        const surgeFactor = this.calculateSurgeFactor(factors);
        const finalPrice = Math.max(basePrice * surgeFactor, this.BASE_RATES[rideType].minFare);
        
        alternatives.push({
          rideType,
          price: Math.round(finalPrice * 100) / 100,
          estimatedWaitTime: this.calculateWaitTime(rideType, factors.demand),
          description: this.getRideTypeDescription(rideType),
        });
      }
    });
    
    return alternatives.sort((a, b) => a.price - b.price);
  }

  // Helper methods
  private calculateDistance(origin: LocationCoordinates, destination: LocationCoordinates): number {
    const R = 6371; // Earth's radius in km
    const dLat = (destination.latitude - origin.latitude) * Math.PI / 180;
    const dLon = (destination.longitude - origin.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(origin.latitude * Math.PI / 180) * Math.cos(destination.latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private estimateDuration(distance: number, request: PricingRequest): number {
    const baseSpeed = request.rideType === 'shared' ? 25 : 30; // km/h
    return (distance / baseSpeed) * 60; // minutes
  }

  private calculateConfidence(factors: PricingFactors): number {
    // Higher confidence for more data points
    let confidence = 0.7;
    
    if (factors.traffic.level !== 'light') confidence += 0.1;
    if (factors.demand.level !== 'low') confidence += 0.1;
    if (factors.weather.impact !== 'none') confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  private getTimeCategory(hour: number, isWeekend: boolean): PricingFactors['time']['timeCategory'] {
    if (hour >= 22 || hour <= 5) return 'late_night';
    if (hour >= 6 && hour <= 9 && !isWeekend) return 'morning_rush';
    if (hour >= 17 && hour <= 19 && !isWeekend) return 'evening_rush';
    if (hour >= 22 || hour <= 2) return 'night';
    return 'midday';
  }

  private isHoliday(date: Date): boolean {
    // Simplified holiday check - in production, use proper holiday API
    const month = date.getMonth();
    const day = date.getDate();
    return (month === 11 && day === 25) || (month === 0 && day === 1); // Christmas & New Year
  }

  private calculateWaitTime(rideType: string, demand: PricingFactors['demand']): number {
    const baseWaitTime = {
      economy: 5,
      comfort: 7,
      premium: 10,
      shared: 8,
    }[rideType] || 5;
    
    return Math.round(baseWaitTime * (1 + demand.score));
  }

  private getRideTypeDescription(rideType: string): string {
    const descriptions = {
      economy: 'Affordable rides with reliable drivers',
      comfort: 'Extra legroom and newer vehicles',
      premium: 'Luxury vehicles with top-rated drivers',
      shared: 'Split the cost with other passengers',
    };
    return descriptions[rideType as keyof typeof descriptions] || '';
  }

  // Cache management
  private generateCacheKey(request: PricingRequest): string {
    return `${request.origin.latitude},${request.origin.longitude}_${request.destination.latitude},${request.destination.longitude}_${request.rideType}_${Math.floor(Date.now() / this.CACHE_DURATION)}`;
  }

  private getCachedPrice(key: string): PricingResponse | null {
    const cached = this.priceCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.price;
    }
    return null;
  }

  private cachePrice(key: string, price: PricingResponse): void {
    this.priceCache.set(key, { price, timestamp: Date.now() });
  }

  // Mock data methods for development
  private getMockSurgeZones(): SurgeZone[] {
    return [
      {
        id: 'downtown_surge',
        name: 'Downtown Business District',
        center: { latitude: 37.7749, longitude: -122.4194 },
        radius: 2000,
        currentMultiplier: 1.8,
        expectedDuration: 45,
        reason: 'High demand during lunch rush',
      },
      {
        id: 'airport_surge',
        name: 'Airport Area',
        center: { latitude: 37.6213, longitude: -122.3790 },
        radius: 3000,
        currentMultiplier: 2.2,
        expectedDuration: 60,
        reason: 'Flight arrivals causing high demand',
      },
    ];
  }

  private getMockPriceHistory(
    origin: LocationCoordinates,
    destination: LocationCoordinates,
    days: number
  ): PriceHistory[] {
    const history: PriceHistory[] = [];
    const routeKey = `${origin.latitude.toFixed(3)},${origin.longitude.toFixed(3)}_${destination.latitude.toFixed(3)},${destination.longitude.toFixed(3)}`;
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Generate 2-4 price points per day
      const pointsPerDay = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < pointsPerDay; j++) {
        const hour = Math.floor(Math.random() * 24);
        date.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
        
        history.push({
          route: routeKey,
          timestamp: date.toISOString(),
          price: 8 + Math.random() * 15,
          surgeFactor: 1 + Math.random() * 1.5,
          actualDuration: 15 + Math.random() * 30,
          actualDistance: 5 + Math.random() * 10,
          feedback: Math.random() > 0.7 ? ['too_high', 'fair', 'good_value'][Math.floor(Math.random() * 3)] as any : undefined,
        });
      }
    }
    
    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private async callMLPricingAPI(request: PricingRequest): Promise<PricingResponse> {
    const authToken = await this.authService.getValidToken();
    const response = await this.apiClient.post('/ai/pricing/calculate', request, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
    });
    
    if (!response.success) {
      throw new Error(response.error || 'ML Pricing API failed');
    }
    
    return response.data;
  }

  private calculateFallbackPrice(request: PricingRequest): PricingResponse {
    const distance = this.calculateDistance(request.origin, request.destination);
    const duration = this.estimateDuration(distance, request);
    const basePrice = this.calculateBasePrice(request.rideType, distance, duration);
    
    return {
      basePrice,
      surgeFactor: 1.0,
      finalPrice: Math.max(basePrice, this.BASE_RATES[request.rideType].minFare),
      currency: 'USD',
      breakdown: {
        baseFare: basePrice * 0.4,
        distanceFare: basePrice * 0.4,
        timeFare: basePrice * 0.2,
        surgeMultiplier: 0,
        demandAdjustment: 0,
        weatherAdjustment: 0,
        trafficAdjustment: 0,
        taxes: basePrice * 0.08,
        fees: 1.50,
      },
      estimatedDuration: Math.round(duration),
      estimatedDistance: Math.round(distance * 100) / 100,
      confidence: 0.5,
      factors: {
        demand: { level: 'medium', score: 0.5, driversAvailable: 25, activeRequests: 15 },
        weather: { condition: 'clear', impact: 'none', score: 0 },
        traffic: { level: 'moderate', impact: 1.2, congestionScore: 0.4 },
        time: {
          dayOfWeek: new Date().getDay(),
          hourOfDay: new Date().getHours(),
          isWeekend: false,
          isHoliday: false,
          timeCategory: 'midday',
        },
        route: { complexity: 'moderate', highwayPercentage: 0.5, cityPercentage: 0.5, tollRoads: false },
      },
    };
  }
}

export default new AIPricingService();