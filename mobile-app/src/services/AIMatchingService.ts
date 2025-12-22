/**
 * @fileoverview AI-powered ride matching service with ML compatibility scoring
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import { LocationCoordinates } from './LocationService';
import { ApiClient } from './ApiClient';
import { AuthService } from './AuthService';

export interface MatchingRequest {
  passengerProfile: PassengerProfile;
  ridePreferences: RidePreferences;
  origin: LocationCoordinates & { address?: string };
  destination: LocationCoordinates & { address?: string };
  requestTime: string;
  maxWaitTime?: number; // in minutes
  maxDetour?: number; // in km
  priceRange?: { min: number; max: number };
}

export interface PassengerProfile {
  id: string;
  rating: number;
  totalRides: number;
  preferences: {
    smokingTolerance: 'none' | 'low' | 'medium' | 'high';
    musicPreference: 'none' | 'quiet' | 'moderate' | 'loud';
    conversationLevel: 'minimal' | 'polite' | 'friendly' | 'chatty';
    petsComfort: 'none' | 'small' | 'medium' | 'large';
    temperaturePreference: 'cold' | 'cool' | 'moderate' | 'warm';
  };
  behaviorProfile: {
    punctuality: number; // 0-1 score
    cleanliness: number; // 0-1 score
    respectfulness: number; // 0-1 score
    reliability: number; // 0-1 score
  };
  rideHistory: RideHistoryItem[];
}

export interface RidePreferences {
  rideType: 'economy' | 'comfort' | 'premium' | 'shared';
  maxPassengers: number;
  amenities: string[];
  requiredFeatures: string[];
  avoidFeatures: string[];
  preferredDriverRating: number;
  prioritizeBy: 'time' | 'price' | 'comfort' | 'rating';
}

export interface RideHistoryItem {
  driverId: string;
  rating: number;
  completed: boolean;
  issues?: string[];
  positiveAspects?: string[];
  timestamp: string;
}

export interface DriverMatch {
  driver: DriverProfile;
  vehicle: VehicleInfo;
  route: RouteInfo;
  compatibility: CompatibilityScore;
  availability: AvailabilityInfo;
  estimatedArrival: number; // minutes
  pricing: MatchPricing;
  confidence: number; // 0-1 ML confidence
  rank: number;
}

export interface DriverProfile {
  id: string;
  firstName: string;
  lastName: string;
  rating: number;
  totalRides: number;
  profileImage?: string;
  verified: boolean;
  preferences: {
    smokingPolicy: 'prohibited' | 'allowed' | 'outdoor_only';
    musicPolicy: 'driver_choice' | 'passenger_choice' | 'mutual_agreement';
    conversationStyle: 'minimal' | 'polite' | 'friendly' | 'chatty';
    petsPolicy: 'none' | 'small_only' | 'medium_allowed' | 'all_welcome';
    maxPassengers: number;
  };
  behaviorProfile: {
    punctuality: number;
    cleanliness: number;
    professionalism: number;
    reliability: number;
    safetyScore: number;
  };
  specializations: string[];
}

export interface VehicleInfo {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  features: string[];
  capacity: number;
  condition: 'excellent' | 'good' | 'fair';
}

export interface RouteInfo {
  currentLocation: LocationCoordinates;
  plannedRoute: LocationCoordinates[];
  detourDistance: number; // km
  detourTime: number; // minutes
  routeCompatibility: number; // 0-1 score
}

export interface CompatibilityScore {
  overall: number; // 0-1 weighted average
  breakdown: {
    preferences: number;
    behavior: number;
    history: number;
    route: number;
    availability: number;
  };
  factors: CompatibilityFactor[];
}

export interface CompatibilityFactor {
  category: 'preference' | 'behavior' | 'history' | 'route' | 'availability';
  factor: string;
  score: number;
  weight: number;
  impact: 'positive' | 'neutral' | 'negative';
  description: string;
}

export interface AvailabilityInfo {
  status: 'available' | 'busy' | 'offline';
  currentPassengers: number;
  availableSeats: number;
  estimatedFreeTime: number; // minutes until available
  currentDestination?: LocationCoordinates;
}

export interface MatchPricing {
  basePrice: number;
  compatibilityDiscount: number;
  loyaltyDiscount: number;
  finalPrice: number;
  pricePerKm: number;
}

export interface MatchingResponse {
  matches: DriverMatch[];
  totalMatches: number;
  averageCompatibility: number;
  searchRadius: number;
  searchTime: number;
  recommendations: MatchingRecommendation[];
}

export interface MatchingRecommendation {
  type: 'expand_search' | 'adjust_preferences' | 'try_different_time' | 'consider_alternatives';
  title: string;
  description: string;
  action?: () => void;
}

class AIMatchingService {
  private apiClient: ApiClient;
  private authService: AuthService;
  
  // ML Model weights for compatibility scoring
  private readonly COMPATIBILITY_WEIGHTS = {
    preferences: 0.30,
    behavior: 0.25,
    history: 0.20,
    route: 0.15,
    availability: 0.10,
  };

  // Compatibility thresholds
  private readonly COMPATIBILITY_THRESHOLDS = {
    excellent: 0.85,
    good: 0.70,
    fair: 0.55,
    poor: 0.40,
  };

  constructor() {
    this.apiClient = new ApiClient();
    this.authService = new AuthService();
  }

  /**
   * Find matching drivers using AI algorithms
   */
  async findMatches(request: MatchingRequest): Promise<MatchingResponse> {
    try {
      if (!__DEV__) {
        return await this.callMLMatchingAPI(request);
      }

      // Development: Use local ML simulation
      return await this.simulateMLMatching(request);
    } catch (error) {
      console.error('AI Matching error:', error);
      throw new Error('Failed to find matching drivers');
    }
  }

  /**
   * Calculate compatibility score between passenger and driver
   */
  calculateCompatibility(
    passenger: PassengerProfile,
    driver: DriverProfile,
    route: RouteInfo,
    availability: AvailabilityInfo
  ): CompatibilityScore {
    const factors: CompatibilityFactor[] = [];
    
    // Calculate individual compatibility scores
    const preferenceScore = this.calculatePreferenceCompatibility(passenger, driver, factors);
    const behaviorScore = this.calculateBehaviorCompatibility(passenger, driver, factors);
    const historyScore = this.calculateHistoryCompatibility(passenger, driver, factors);
    const routeScore = this.calculateRouteCompatibility(route, factors);
    const availabilityScore = this.calculateAvailabilityCompatibility(availability, factors);

    // Calculate weighted overall score
    const breakdown = {
      preferences: preferenceScore,
      behavior: behaviorScore,
      history: historyScore,
      route: routeScore,
      availability: availabilityScore,
    };

    const overall = 
      preferenceScore * this.COMPATIBILITY_WEIGHTS.preferences +
      behaviorScore * this.COMPATIBILITY_WEIGHTS.behavior +
      historyScore * this.COMPATIBILITY_WEIGHTS.history +
      routeScore * this.COMPATIBILITY_WEIGHTS.route +
      availabilityScore * this.COMPATIBILITY_WEIGHTS.availability;

    return {
      overall,
      breakdown,
      factors,
    };
  }

  /**
   * Get match recommendations for improving results
   */
  async getMatchRecommendations(
    request: MatchingRequest,
    currentMatches: DriverMatch[]
  ): Promise<MatchingRecommendation[]> {
    const recommendations: MatchingRecommendation[] = [];
    
    // Analyze current match quality
    const avgCompatibility = currentMatches.length > 0 
      ? currentMatches.reduce((sum, match) => sum + match.compatibility.overall, 0) / currentMatches.length
      : 0;

    if (currentMatches.length === 0) {
      recommendations.push({
        type: 'expand_search',
        title: 'Expand Search Area',
        description: 'No drivers found in your area. Try expanding the search radius.',
      });
    } else if (avgCompatibility < this.COMPATIBILITY_THRESHOLDS.fair) {
      recommendations.push({
        type: 'adjust_preferences',
        title: 'Adjust Preferences',
        description: 'Consider relaxing some preferences to find more compatible drivers.',
      });
    }

    if (request.maxWaitTime && request.maxWaitTime < 10) {
      recommendations.push({
        type: 'try_different_time',
        title: 'Try Different Time',
        description: 'More drivers may be available if you can wait a bit longer.',
      });
    }

    return recommendations;
  }

  /**
   * Simulate ML matching algorithm (for development)
   */
  private async simulateMLMatching(request: MatchingRequest): Promise<MatchingResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const mockDrivers = this.generateMockDrivers(request);
    const matches: DriverMatch[] = [];

    for (const mockData of mockDrivers) {
      const compatibility = this.calculateCompatibility(
        request.passengerProfile,
        mockData.driver,
        mockData.route,
        mockData.availability
      );

      const match: DriverMatch = {
        ...mockData,
        compatibility,
        confidence: 0.75 + Math.random() * 0.25, // 75-100% confidence
        rank: matches.length + 1,
        pricing: this.calculateMatchPricing(compatibility, mockData.route),
      };

      matches.push(match);
    }

    // Sort by compatibility score
    matches.sort((a, b) => b.compatibility.overall - a.compatibility.overall);
    
    // Update ranks
    matches.forEach((match, index) => {
      match.rank = index + 1;
    });

    const avgCompatibility = matches.reduce((sum, match) => sum + match.compatibility.overall, 0) / matches.length;
    const recommendations = await this.getMatchRecommendations(request, matches);

    return {
      matches: matches.slice(0, 10), // Return top 10 matches
      totalMatches: matches.length,
      averageCompatibility: avgCompatibility,
      searchRadius: 5, // km
      searchTime: 800, // ms
      recommendations,
    };
  }

  /**
   * Calculate preference compatibility
   */
  private calculatePreferenceCompatibility(
    passenger: PassengerProfile,
    driver: DriverProfile,
    factors: CompatibilityFactor[]
  ): number {
    let score = 0;
    let totalWeight = 0;

    // Smoking compatibility
    const smokingWeight = 0.3;
    const smokingScore = this.calculateSmokingCompatibility(
      passenger.preferences.smokingTolerance,
      driver.preferences.smokingPolicy
    );
    score += smokingScore * smokingWeight;
    totalWeight += smokingWeight;

    factors.push({
      category: 'preference',
      factor: 'smoking_policy',
      score: smokingScore,
      weight: smokingWeight,
      impact: smokingScore > 0.7 ? 'positive' : smokingScore < 0.3 ? 'negative' : 'neutral',
      description: `Smoking preference compatibility: ${this.getCompatibilityLabel(smokingScore)}`,
    });

    // Music compatibility
    const musicWeight = 0.2;
    const musicScore = this.calculateMusicCompatibility(
      passenger.preferences.musicPreference,
      driver.preferences.musicPolicy
    );
    score += musicScore * musicWeight;
    totalWeight += musicWeight;

    factors.push({
      category: 'preference',
      factor: 'music_preference',
      score: musicScore,
      weight: musicWeight,
      impact: musicScore > 0.7 ? 'positive' : musicScore < 0.3 ? 'negative' : 'neutral',
      description: `Music preference compatibility: ${this.getCompatibilityLabel(musicScore)}`,
    });

    // Conversation compatibility
    const conversationWeight = 0.25;
    const conversationScore = this.calculateConversationCompatibility(
      passenger.preferences.conversationLevel,
      driver.preferences.conversationStyle
    );
    score += conversationScore * conversationWeight;
    totalWeight += conversationWeight;

    factors.push({
      category: 'preference',
      factor: 'conversation_style',
      score: conversationScore,
      weight: conversationWeight,
      impact: conversationScore > 0.7 ? 'positive' : conversationScore < 0.3 ? 'negative' : 'neutral',
      description: `Conversation style compatibility: ${this.getCompatibilityLabel(conversationScore)}`,
    });

    // Pets compatibility
    const petsWeight = 0.25;
    const petsScore = this.calculatePetsCompatibility(
      passenger.preferences.petsComfort,
      driver.preferences.petsPolicy
    );
    score += petsScore * petsWeight;
    totalWeight += petsWeight;

    factors.push({
      category: 'preference',
      factor: 'pets_policy',
      score: petsScore,
      weight: petsWeight,
      impact: petsScore > 0.7 ? 'positive' : petsScore < 0.3 ? 'negative' : 'neutral',
      description: `Pet policy compatibility: ${this.getCompatibilityLabel(petsScore)}`,
    });

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * Calculate behavior compatibility
   */
  private calculateBehaviorCompatibility(
    passenger: PassengerProfile,
    driver: DriverProfile,
    factors: CompatibilityFactor[]
  ): number {
    let score = 0;
    let totalWeight = 0;

    const behaviorMetrics = [
      { key: 'punctuality', weight: 0.3 },
      { key: 'cleanliness', weight: 0.25 },
      { key: 'reliability', weight: 0.25 },
      { key: 'respectfulness', weight: 0.2 },
    ];

    behaviorMetrics.forEach(metric => {
      const passengerScore = passenger.behaviorProfile[metric.key as keyof typeof passenger.behaviorProfile];
      const driverScore = driver.behaviorProfile[metric.key === 'respectfulness' ? 'professionalism' : metric.key as keyof typeof driver.behaviorProfile];
      
      // Calculate compatibility as inverse of difference
      const behaviorScore = 1 - Math.abs(passengerScore - driverScore);
      score += behaviorScore * metric.weight;
      totalWeight += metric.weight;

      factors.push({
        category: 'behavior',
        factor: metric.key,
        score: behaviorScore,
        weight: metric.weight,
        impact: behaviorScore > 0.7 ? 'positive' : behaviorScore < 0.3 ? 'negative' : 'neutral',
        description: `${metric.key} compatibility: ${this.getCompatibilityLabel(behaviorScore)}`,
      });
    });

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * Calculate history compatibility
   */
  private calculateHistoryCompatibility(
    passenger: PassengerProfile,
    driver: DriverProfile,
    factors: CompatibilityFactor[]
  ): number {
    // Check if they've ridden together before
    const previousRides = passenger.rideHistory.filter(ride => ride.driverId === driver.id);
    
    if (previousRides.length === 0) {
      // No history - neutral score
      factors.push({
        category: 'history',
        factor: 'previous_rides',
        score: 0.6,
        weight: 1,
        impact: 'neutral',
        description: 'No previous ride history',
      });
      return 0.6;
    }

    // Calculate average rating from previous rides
    const avgRating = previousRides.reduce((sum, ride) => sum + ride.rating, 0) / previousRides.length;
    const historyScore = avgRating / 5; // Convert to 0-1 scale

    factors.push({
      category: 'history',
      factor: 'previous_rides',
      score: historyScore,
      weight: 1,
      impact: historyScore > 0.8 ? 'positive' : historyScore < 0.6 ? 'negative' : 'neutral',
      description: `Previous ride average: ${avgRating.toFixed(1)}/5 (${previousRides.length} rides)`,
    });

    return historyScore;
  }

  /**
   * Calculate route compatibility
   */
  private calculateRouteCompatibility(route: RouteInfo, factors: CompatibilityFactor[]): number {
    const routeScore = route.routeCompatibility;

    factors.push({
      category: 'route',
      factor: 'route_alignment',
      score: routeScore,
      weight: 0.6,
      impact: routeScore > 0.7 ? 'positive' : routeScore < 0.3 ? 'negative' : 'neutral',
      description: `Route compatibility: ${this.getCompatibilityLabel(routeScore)}`,
    });

    // Consider detour impact
    const detourScore = route.detourDistance < 2 ? 1 : Math.max(0, 1 - (route.detourDistance - 2) / 5);
    factors.push({
      category: 'route',
      factor: 'detour_impact',
      score: detourScore,
      weight: 0.4,
      impact: detourScore > 0.7 ? 'positive' : detourScore < 0.3 ? 'negative' : 'neutral',
      description: `Detour: ${route.detourDistance.toFixed(1)}km, ${route.detourTime}min`,
    });

    return routeScore * 0.6 + detourScore * 0.4;
  }

  /**
   * Calculate availability compatibility
   */
  private calculateAvailabilityCompatibility(availability: AvailabilityInfo, factors: CompatibilityFactor[]): number {
    let score = 0;

    // Status score
    const statusScore = availability.status === 'available' ? 1 : availability.status === 'busy' ? 0.5 : 0;
    score += statusScore * 0.5;

    // Seat availability score
    const seatScore = availability.availableSeats > 0 ? 1 : 0;
    score += seatScore * 0.3;

    // Wait time score
    const waitScore = availability.estimatedFreeTime < 5 ? 1 : Math.max(0, 1 - availability.estimatedFreeTime / 15);
    score += waitScore * 0.2;

    factors.push({
      category: 'availability',
      factor: 'driver_availability',
      score,
      weight: 1,
      impact: score > 0.7 ? 'positive' : score < 0.3 ? 'negative' : 'neutral',
      description: `${availability.status}, ${availability.availableSeats} seats, ${availability.estimatedFreeTime}min wait`,
    });

    return score;
  }

  // Helper methods for specific compatibility calculations
  private calculateSmokingCompatibility(passengerTolerance: string, driverPolicy: string): number {
    const compatibilityMatrix: Record<string, Record<string, number>> = {
      'none': { 'prohibited': 1, 'outdoor_only': 0.8, 'allowed': 0 },
      'low': { 'prohibited': 0.9, 'outdoor_only': 1, 'allowed': 0.3 },
      'medium': { 'prohibited': 0.6, 'outdoor_only': 0.8, 'allowed': 0.7 },
      'high': { 'prohibited': 0.3, 'outdoor_only': 0.6, 'allowed': 1 },
    };
    
    return compatibilityMatrix[passengerTolerance]?.[driverPolicy] ?? 0.5;
  }

  private calculateMusicCompatibility(passengerPreference: string, driverPolicy: string): number {
    const compatibilityMatrix: Record<string, Record<string, number>> = {
      'none': { 'driver_choice': 0.3, 'passenger_choice': 1, 'mutual_agreement': 0.8 },
      'quiet': { 'driver_choice': 0.6, 'passenger_choice': 0.9, 'mutual_agreement': 1 },
      'moderate': { 'driver_choice': 0.8, 'passenger_choice': 0.8, 'mutual_agreement': 1 },
      'loud': { 'driver_choice': 0.9, 'passenger_choice': 0.7, 'mutual_agreement': 0.8 },
    };
    
    return compatibilityMatrix[passengerPreference]?.[driverPolicy] ?? 0.5;
  }

  private calculateConversationCompatibility(passengerLevel: string, driverStyle: string): number {
    const compatibilityMatrix: Record<string, Record<string, number>> = {
      'minimal': { 'minimal': 1, 'polite': 0.8, 'friendly': 0.4, 'chatty': 0.1 },
      'polite': { 'minimal': 0.7, 'polite': 1, 'friendly': 0.8, 'chatty': 0.5 },
      'friendly': { 'minimal': 0.4, 'polite': 0.8, 'friendly': 1, 'chatty': 0.8 },
      'chatty': { 'minimal': 0.1, 'polite': 0.5, 'friendly': 0.8, 'chatty': 1 },
    };
    
    return compatibilityMatrix[passengerLevel]?.[driverStyle] ?? 0.5;
  }

  private calculatePetsCompatibility(passengerComfort: string, driverPolicy: string): number {
    const compatibilityMatrix: Record<string, Record<string, number>> = {
      'none': { 'none': 1, 'small_only': 0.8, 'medium_allowed': 0.6, 'all_welcome': 0.4 },
      'small': { 'none': 0.3, 'small_only': 1, 'medium_allowed': 0.9, 'all_welcome': 0.8 },
      'medium': { 'none': 0.1, 'small_only': 0.6, 'medium_allowed': 1, 'all_welcome': 0.9 },
      'large': { 'none': 0, 'small_only': 0.2, 'medium_allowed': 0.7, 'all_welcome': 1 },
    };
    
    return compatibilityMatrix[passengerComfort]?.[driverPolicy] ?? 0.5;
  }

  private calculateMatchPricing(compatibility: CompatibilityScore, route: RouteInfo): MatchPricing {
    const basePrice = 2.50 + (route.detourDistance * 1.20);
    const compatibilityDiscount = compatibility.overall > 0.8 ? basePrice * 0.05 : 0;
    const loyaltyDiscount = 0; // Could be calculated based on ride history
    const finalPrice = Math.max(3.00, basePrice - compatibilityDiscount - loyaltyDiscount);

    return {
      basePrice,
      compatibilityDiscount,
      loyaltyDiscount,
      finalPrice,
      pricePerKm: 1.20,
    };
  }

  private getCompatibilityLabel(score: number): string {
    if (score >= this.COMPATIBILITY_THRESHOLDS.excellent) return 'Excellent';
    if (score >= this.COMPATIBILITY_THRESHOLDS.good) return 'Good';
    if (score >= this.COMPATIBILITY_THRESHOLDS.fair) return 'Fair';
    return 'Poor';
  }

  private generateMockDrivers(request: MatchingRequest): Array<{
    driver: DriverProfile;
    vehicle: VehicleInfo;
    route: RouteInfo;
    availability: AvailabilityInfo;
    estimatedArrival: number;
  }> {
    const mockData = [];
    const numDrivers = Math.floor(Math.random() * 8) + 5; // 5-12 drivers

    for (let i = 0; i < numDrivers; i++) {
      mockData.push({
        driver: this.generateMockDriver(i),
        vehicle: this.generateMockVehicle(i),
        route: this.generateMockRoute(request),
        availability: this.generateMockAvailability(),
        estimatedArrival: Math.floor(Math.random() * 15) + 2, // 2-17 minutes
      });
    }

    return mockData;
  }

  private generateMockDriver(index: number): DriverProfile {
    const names = [
      { first: 'Alex', last: 'Johnson' },
      { first: 'Sarah', last: 'Williams' },
      { first: 'Mike', last: 'Davis' },
      { first: 'Lisa', last: 'Brown' },
      { first: 'David', last: 'Wilson' },
      { first: 'Emma', last: 'Garcia' },
      { first: 'Chris', last: 'Martinez' },
      { first: 'Anna', last: 'Anderson' },
    ];

    const name = names[index % names.length];
    
    return {
      id: `driver-${index + 1}`,
      firstName: name.first,
      lastName: name.last,
      rating: 4.2 + Math.random() * 0.8,
      totalRides: Math.floor(Math.random() * 500) + 50,
      verified: Math.random() > 0.2,
      preferences: {
        smokingPolicy: ['prohibited', 'allowed', 'outdoor_only'][Math.floor(Math.random() * 3)] as any,
        musicPolicy: ['driver_choice', 'passenger_choice', 'mutual_agreement'][Math.floor(Math.random() * 3)] as any,
        conversationStyle: ['minimal', 'polite', 'friendly', 'chatty'][Math.floor(Math.random() * 4)] as any,
        petsPolicy: ['none', 'small_only', 'medium_allowed', 'all_welcome'][Math.floor(Math.random() * 4)] as any,
        maxPassengers: Math.floor(Math.random() * 3) + 2,
      },
      behaviorProfile: {
        punctuality: 0.7 + Math.random() * 0.3,
        cleanliness: 0.8 + Math.random() * 0.2,
        professionalism: 0.75 + Math.random() * 0.25,
        reliability: 0.8 + Math.random() * 0.2,
        safetyScore: 0.85 + Math.random() * 0.15,
      },
      specializations: Math.random() > 0.5 ? ['Airport Rides', 'Long Distance'] : [],
    };
  }

  private generateMockVehicle(index: number): VehicleInfo {
    const vehicles = [
      { make: 'Toyota', model: 'Camry', color: 'Silver' },
      { make: 'Honda', model: 'Civic', color: 'Blue' },
      { make: 'Hyundai', model: 'Elantra', color: 'White' },
      { make: 'Nissan', model: 'Altima', color: 'Black' },
      { make: 'Mazda', model: 'Mazda3', color: 'Red' },
    ];

    const vehicle = vehicles[index % vehicles.length];
    
    return {
      id: `vehicle-${index + 1}`,
      make: vehicle.make,
      model: vehicle.model,
      year: 2018 + Math.floor(Math.random() * 6),
      color: vehicle.color,
      licensePlate: `ABC${Math.floor(Math.random() * 900) + 100}`,
      features: ['Air Conditioning', 'Bluetooth', 'USB Charging'].filter(() => Math.random() > 0.3),
      capacity: Math.floor(Math.random() * 2) + 4,
      condition: ['excellent', 'good', 'fair'][Math.floor(Math.random() * 3)] as any,
    };
  }

  private generateMockRoute(request: MatchingRequest): RouteInfo {
    return {
      currentLocation: {
        latitude: request.origin.latitude + (Math.random() - 0.5) * 0.02,
        longitude: request.origin.longitude + (Math.random() - 0.5) * 0.02,
      },
      plannedRoute: [], // Would be populated with actual route points
      detourDistance: Math.random() * 3,
      detourTime: Math.random() * 8,
      routeCompatibility: 0.6 + Math.random() * 0.4,
    };
  }

  private generateMockAvailability(): AvailabilityInfo {
    const statuses = ['available', 'busy', 'offline'] as const;
    const status = statuses[Math.floor(Math.random() * 3)];
    
    return {
      status,
      currentPassengers: status === 'available' ? 0 : Math.floor(Math.random() * 2),
      availableSeats: status === 'available' ? Math.floor(Math.random() * 3) + 1 : 0,
      estimatedFreeTime: status === 'available' ? 0 : Math.floor(Math.random() * 10),
    };
  }

  private async callMLMatchingAPI(request: MatchingRequest): Promise<MatchingResponse> {
    const authToken = await this.authService.getValidToken();
    const response = await this.apiClient.post('/ai/matching/find', request, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
    });

    if (!response.success) {
      throw new Error(response.error || 'ML Matching API failed');
    }

    return response.data;
  }
}

export default new AIMatchingService();