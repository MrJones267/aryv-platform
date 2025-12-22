/**
 * @fileoverview AI-powered recommendations service for personalized suggestions
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import { LocationCoordinates } from './LocationService';
import { ApiClient } from './ApiClient';
import { AuthService } from './AuthService';

export interface UserBehaviorProfile {
  userId: string;
  travelPatterns: TravelPattern[];
  preferredTimes: TimePreference[];
  routeHistory: RouteHistoryItem[];
  driverPreferences: DriverPreference[];
  pricePreferences: PricePreference;
  timePreferences: TimePreference[];
}

export interface TravelPattern {
  routeId: string;
  origin: LocationCoordinates & { name: string };
  destination: LocationCoordinates & { name: string };
  frequency: number; // times per week
  averageTime: number; // minutes
  preferredDayOfWeek: number[];
  preferredHourRange: { start: number; end: number };
  confidence: number; // 0-1 ML confidence
}

export interface TimePreference {
  dayOfWeek: number; // 0-6
  hourOfDay: number; // 0-23
  preference: 'avoid' | 'neutral' | 'preferred';
  reason: string;
  score: number; // 0-1
}

export interface RouteHistoryItem {
  origin: LocationCoordinates;
  destination: LocationCoordinates;
  timestamp: string;
  duration: number;
  cost: number;
  rating: number;
  driverId: string;
  weatherConditions?: string;
  trafficLevel?: string;
}

export interface DriverPreference {
  driverId: string;
  preferenceScore: number; // 0-1
  rideCount: number;
  averageRating: number;
  lastRideDate: string;
  preferenceReasons: string[];
}

export interface PricePreference {
  priceRange: { min: number; max: number };
  priceSensitivity: 'low' | 'medium' | 'high';
  willPayMoreFor: string[];
  budgetConstraints: BudgetConstraint[];
}

export interface BudgetConstraint {
  timeOfMonth: 'beginning' | 'middle' | 'end';
  maxBudget: number;
  flexibility: number; // 0-1
}

export interface RecommendationRequest {
  userId: string;
  context: RecommendationContext;
  requestType: 'route' | 'driver' | 'timing' | 'price' | 'all';
  currentLocation?: LocationCoordinates;
  intendedDestination?: LocationCoordinates;
  timeframe?: {
    start: string;
    end: string;
  };
}

export interface RecommendationContext {
  timeOfDay: number;
  dayOfWeek: number;
  weather: string;
  urgency: 'low' | 'medium' | 'high';
  budget: 'flexible' | 'normal' | 'tight';
  purpose: 'work' | 'leisure' | 'shopping' | 'airport' | 'other';
}

export interface AIRecommendation {
  id: string;
  type: 'route' | 'driver' | 'timing' | 'price' | 'general';
  category: string;
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  reasoning: string[];
  actionable: boolean;
  data?: any;
  expiresAt?: string;
}

export interface RouteRecommendation extends AIRecommendation {
  type: 'route';
  data: {
    suggestedRoute: LocationCoordinates[];
    alternativeRoutes: AlternativeRoute[];
    estimatedSavings: {
      time: number; // minutes
      cost: number; // dollars
    };
    trafficInsights: TrafficInsight[];
  };
}

export interface DriverRecommendation extends AIRecommendation {
  type: 'driver';
  data: {
    recommendedDrivers: RecommendedDriver[];
    avoidDrivers: string[];
    newDrivers: RecommendedDriver[];
    frequentDrivers: RecommendedDriver[];
  };
}

export interface TimingRecommendation extends AIRecommendation {
  type: 'timing';
  data: {
    optimalTimes: OptimalTime[];
    avoidTimes: AvoidTime[];
    surgePredicton: SurgePrediction[];
    weatherImpact: WeatherImpact;
  };
}

export interface PriceRecommendation extends AIRecommendation {
  type: 'price';
  data: {
    priceStrategy: PriceStrategy;
    discountOpportunities: DiscountOpportunity[];
    costOptimization: CostOptimization[];
    budgetAlerts: BudgetAlert[];
  };
}

export interface AlternativeRoute {
  route: LocationCoordinates[];
  estimatedTime: number;
  estimatedCost: number;
  trafficLevel: 'light' | 'moderate' | 'heavy';
  advantages: string[];
  disadvantages: string[];
}

export interface TrafficInsight {
  timeWindow: { start: number; end: number };
  trafficLevel: 'light' | 'moderate' | 'heavy' | 'severe';
  estimatedDelay: number;
  alternativeAction: string;
}

export interface RecommendedDriver {
  driverId: string;
  name: string;
  rating: number;
  compatibilityScore: number;
  estimatedArrival: number;
  whyRecommended: string[];
  lastRideDate?: string;
}

export interface OptimalTime {
  timeSlot: { start: number; end: number };
  dayOfWeek: number;
  advantages: string[];
  estimatedSavings: { time: number; cost: number };
  confidence: number;
}

export interface AvoidTime {
  timeSlot: { start: number; end: number };
  dayOfWeek: number;
  reason: string;
  impact: 'minor' | 'moderate' | 'major';
  alternatives: string[];
}

export interface SurgePrediction {
  timeSlot: { start: number; end: number };
  predictedMultiplier: number;
  confidence: number;
  location?: string;
}

export interface WeatherImpact {
  condition: string;
  impact: 'none' | 'minor' | 'moderate' | 'major';
  recommendations: string[];
}

export interface PriceStrategy {
  strategy: 'budget' | 'balanced' | 'premium';
  expectedSavings: number;
  tradeoffs: string[];
}

export interface DiscountOpportunity {
  type: 'loyalty' | 'off_peak' | 'shared_ride' | 'advance_booking';
  discount: number;
  requirements: string[];
  expiresAt: string;
}

export interface CostOptimization {
  suggestion: string;
  potentialSavings: number;
  difficulty: 'easy' | 'moderate' | 'hard';
}

export interface BudgetAlert {
  type: 'overspending' | 'budget_exceeded' | 'unusual_pattern';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  suggestions: string[];
}

export interface RecommendationsResponse {
  recommendations: AIRecommendation[];
  userInsights: UserInsights;
  trendingPatterns: TrendingPattern[];
  personalizedTips: PersonalizedTip[];
}

export interface UserInsights {
  travelFrequency: string;
  averageSpend: number;
  preferredTimes: string[];
  topRoutes: string[];
  behaviorTrends: string[];
}

export interface TrendingPattern {
  pattern: string;
  description: string;
  relevanceScore: number;
  userImpact: string;
}

export interface PersonalizedTip {
  category: 'savings' | 'efficiency' | 'comfort' | 'safety';
  tip: string;
  estimatedBenefit: string;
}

class AIRecommendationsService {
  private apiClient: ApiClient;
  private authService: AuthService;
  private userProfile: UserBehaviorProfile | null = null;
  
  // ML Model parameters for recommendations
  private readonly RECOMMENDATION_WEIGHTS = {
    frequency: 0.3,
    recency: 0.25,
    success: 0.2,
    preference: 0.15,
    context: 0.1,
  };

  constructor() {
    this.apiClient = new ApiClient();
    this.authService = new AuthService();
  }

  /**
   * Get AI-powered recommendations for user
   */
  async getRecommendations(request: RecommendationRequest): Promise<RecommendationsResponse> {
    try {
      if (!__DEV__) {
        return await this.callMLRecommendationsAPI(request);
      }

      // Development: Use local ML simulation
      return await this.simulateMLRecommendations(request);
    } catch (error) {
      console.error('AI Recommendations error:', error);
      throw new Error('Failed to get recommendations');
    }
  }

  /**
   * Update user behavior profile with new ride data
   */
  async updateUserBehaviorProfile(
    userId: string,
    rideData: {
      origin: LocationCoordinates;
      destination: LocationCoordinates;
      timestamp: string;
      duration: number;
      cost: number;
      rating: number;
      driverId: string;
    }
  ): Promise<void> {
    try {
      // Update local profile
      if (!this.userProfile || this.userProfile.userId !== userId) {
        this.userProfile = await this.loadUserProfile(userId);
      }

      this.userProfile.routeHistory.push({
        ...rideData,
        weatherConditions: 'clear', // Would be fetched from weather API
        trafficLevel: 'moderate', // Would be calculated from traffic data
      });

      // Update travel patterns
      this.updateTravelPatterns(rideData);
      
      // Update driver preferences
      this.updateDriverPreferences(rideData);

      if (!__DEV__) {
        // Send to backend for ML model training
        await this.syncUserProfileToBackend();
      }
    } catch (error) {
      console.error('Failed to update user behavior profile:', error);
    }
  }

  /**
   * Get smart route suggestions
   */
  async getRouteRecommendations(
    origin: LocationCoordinates,
    destination: LocationCoordinates,
    context: RecommendationContext
  ): Promise<RouteRecommendation[]> {
    const recommendations: RouteRecommendation[] = [];
    
    // Analyze user's route history
    const similarRoutes = this.findSimilarRoutes(origin, destination);
    
    if (similarRoutes.length > 0) {
      const bestRoute = similarRoutes.sort((a, b) => b.rating - a.rating)[0];
      
      recommendations.push({
        id: `route_${Date.now()}`,
        type: 'route',
        category: 'optimal_route',
        title: 'Your Preferred Route',
        description: 'Based on your previous trips, this route typically gives you the best experience.',
        confidence: 0.85,
        impact: 'high',
        reasoning: [
          `You've taken similar routes ${similarRoutes.length} times`,
          `Average rating: ${bestRoute.rating.toFixed(1)}/5`,
          `Typical duration: ${Math.round(bestRoute.duration)} minutes`,
        ],
        actionable: true,
        data: {
          suggestedRoute: [origin, destination], // Simplified - would include waypoints
          alternativeRoutes: await this.generateAlternativeRoutes(origin, destination),
          estimatedSavings: {
            time: Math.random() > 0.5 ? Math.floor(Math.random() * 10) + 2 : 0,
            cost: Math.random() > 0.5 ? Math.round((Math.random() * 5 + 1) * 100) / 100 : 0,
          },
          trafficInsights: this.generateTrafficInsights(context),
        },
      });
    }

    return recommendations;
  }

  /**
   * Get driver recommendations
   */
  async getDriverRecommendations(context: RecommendationContext): Promise<DriverRecommendation[]> {
    const recommendations: DriverRecommendation[] = [];
    
    if (this.userProfile && this.userProfile.driverPreferences.length > 0) {
      const topDrivers = this.userProfile.driverPreferences
        .filter(pref => pref.preferenceScore > 0.7)
        .sort((a, b) => b.preferenceScore - a.preferenceScore)
        .slice(0, 3);

      if (topDrivers.length > 0) {
        recommendations.push({
          id: `driver_${Date.now()}`,
          type: 'driver',
          category: 'preferred_drivers',
          title: 'Your Favorite Drivers',
          description: 'These drivers have consistently provided great rides for you.',
          confidence: 0.9,
          impact: 'high',
          reasoning: [
            `Based on ${this.userProfile.routeHistory.length} previous rides`,
            'High compatibility scores',
            'Consistently good ratings',
          ],
          actionable: true,
          data: {
            recommendedDrivers: topDrivers.map(pref => ({
              driverId: pref.driverId,
              name: `Driver ${pref.driverId.slice(-3)}`, // Mock name
              rating: pref.averageRating,
              compatibilityScore: pref.preferenceScore,
              estimatedArrival: Math.floor(Math.random() * 15) + 3,
              whyRecommended: pref.preferenceReasons,
              lastRideDate: pref.lastRideDate,
            })),
            avoidDrivers: [],
            newDrivers: this.generateNewDriverRecommendations(),
            frequentDrivers: topDrivers.map(pref => ({
              driverId: pref.driverId,
              name: `Driver ${pref.driverId.slice(-3)}`,
              rating: pref.averageRating,
              compatibilityScore: pref.preferenceScore,
              estimatedArrival: Math.floor(Math.random() * 15) + 3,
              whyRecommended: [`${pref.rideCount} previous rides together`],
            })),
          },
        });
      }
    }

    return recommendations;
  }

  /**
   * Get timing recommendations
   */
  async getTimingRecommendations(context: RecommendationContext): Promise<TimingRecommendation[]> {
    const recommendations: TimingRecommendation[] = [];
    
    const optimalTimes = this.calculateOptimalTimes(context);
    const avoidTimes = this.calculateAvoidTimes(context);
    
    recommendations.push({
      id: `timing_${Date.now()}`,
      type: 'timing',
      category: 'optimal_timing',
      title: 'Best Times to Travel',
      description: 'Based on your travel patterns and current conditions, these are the optimal times for your trip.',
      confidence: 0.8,
      impact: 'medium',
      reasoning: [
        'Based on historical traffic patterns',
        'Your travel behavior analysis',
        'Real-time conditions',
      ],
      actionable: true,
      data: {
        optimalTimes,
        avoidTimes,
        surgePredicton: this.generateSurgePredictions(),
        weatherImpact: {
          condition: 'clear',
          impact: 'none',
          recommendations: ['Good conditions for travel'],
        },
      },
    });

    return recommendations;
  }

  /**
   * Get price optimization recommendations
   */
  async getPriceRecommendations(context: RecommendationContext): Promise<PriceRecommendation[]> {
    const recommendations: PriceRecommendation[] = [];
    
    recommendations.push({
      id: `price_${Date.now()}`,
      type: 'price',
      category: 'price_optimization',
      title: 'Save Money on Your Rides',
      description: 'Smart strategies to reduce your ride costs while maintaining quality.',
      confidence: 0.75,
      impact: 'medium',
      reasoning: [
        'Based on your spending patterns',
        'Current market conditions',
        'Available discounts and promotions',
      ],
      actionable: true,
      data: {
        priceStrategy: {
          strategy: 'balanced',
          expectedSavings: Math.round((Math.random() * 10 + 5) * 100) / 100,
          tradeoffs: ['Slightly longer wait times', 'Shared rides when possible'],
        },
        discountOpportunities: this.generateDiscountOpportunities(),
        costOptimization: this.generateCostOptimizations(),
        budgetAlerts: [],
      },
    });

    return recommendations;
  }

  /**
   * Simulate ML recommendations (for development)
   */
  private async simulateMLRecommendations(request: RecommendationRequest): Promise<RecommendationsResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 600));

    // Load or create user profile
    if (!this.userProfile || this.userProfile.userId !== request.userId) {
      this.userProfile = await this.generateMockUserProfile(request.userId);
    }

    const recommendations: AIRecommendation[] = [];

    // Generate different types of recommendations based on request
    if (request.requestType === 'all' || request.requestType === 'route') {
      if (request.currentLocation && request.intendedDestination) {
        const routeRecs = await this.getRouteRecommendations(
          request.currentLocation,
          request.intendedDestination,
          request.context
        );
        recommendations.push(...routeRecs);
      }
    }

    if (request.requestType === 'all' || request.requestType === 'driver') {
      const driverRecs = await this.getDriverRecommendations(request.context);
      recommendations.push(...driverRecs);
    }

    if (request.requestType === 'all' || request.requestType === 'timing') {
      const timingRecs = await this.getTimingRecommendations(request.context);
      recommendations.push(...timingRecs);
    }

    if (request.requestType === 'all' || request.requestType === 'price') {
      const priceRecs = await this.getPriceRecommendations(request.context);
      recommendations.push(...priceRecs);
    }

    // Add general recommendations
    recommendations.push(...this.generateGeneralRecommendations(request.context));

    return {
      recommendations: recommendations.sort((a, b) => b.confidence * b.impact.length - a.confidence * a.impact.length),
      userInsights: this.generateUserInsights(),
      trendingPatterns: this.generateTrendingPatterns(),
      personalizedTips: this.generatePersonalizedTips(),
    };
  }

  // Helper methods for generating mock data and calculations

  private async loadUserProfile(userId: string): Promise<UserBehaviorProfile> {
    // In production, this would fetch from backend
    return this.generateMockUserProfile(userId);
  }

  private async generateMockUserProfile(userId: string): Promise<UserBehaviorProfile> {
    return {
      userId,
      travelPatterns: [],
      preferredTimes: [],
      routeHistory: this.generateMockRouteHistory(),
      driverPreferences: this.generateMockDriverPreferences(),
      pricePreferences: {
        priceRange: { min: 5, max: 30 },
        priceSensitivity: 'medium',
        willPayMoreFor: ['Shorter wait time', 'Higher rated drivers', 'Comfort features'],
        budgetConstraints: [],
      },
      timePreferences: [],
    };
  }

  private generateMockRouteHistory(): RouteHistoryItem[] {
    const history: RouteHistoryItem[] = [];
    const numRides = Math.floor(Math.random() * 20) + 10;

    for (let i = 0; i < numRides; i++) {
      const daysAgo = Math.floor(Math.random() * 90);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      history.push({
        origin: {
          latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
          longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
        },
        destination: {
          latitude: 37.7849 + (Math.random() - 0.5) * 0.1,
          longitude: -122.4094 + (Math.random() - 0.5) * 0.1,
        },
        timestamp: date.toISOString(),
        duration: Math.floor(Math.random() * 30) + 10,
        cost: Math.round((Math.random() * 25 + 8) * 100) / 100,
        rating: 3.5 + Math.random() * 1.5,
        driverId: `driver-${Math.floor(Math.random() * 10) + 1}`,
        weatherConditions: ['clear', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)],
        trafficLevel: ['light', 'moderate', 'heavy'][Math.floor(Math.random() * 3)],
      });
    }

    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private generateMockDriverPreferences(): DriverPreference[] {
    const preferences: DriverPreference[] = [];
    const driverCount = Math.floor(Math.random() * 5) + 3;

    for (let i = 0; i < driverCount; i++) {
      const driverId = `driver-${i + 1}`;
      preferences.push({
        driverId,
        preferenceScore: 0.6 + Math.random() * 0.4,
        rideCount: Math.floor(Math.random() * 8) + 1,
        averageRating: 4.0 + Math.random() * 1.0,
        lastRideDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        preferenceReasons: [
          'Consistently punctual',
          'Clean vehicle',
          'Friendly conversation',
          'Safe driving',
        ].filter(() => Math.random() > 0.5),
      });
    }

    return preferences;
  }

  private findSimilarRoutes(origin: LocationCoordinates, destination: LocationCoordinates): RouteHistoryItem[] {
    if (!this.userProfile) return [];

    return this.userProfile.routeHistory.filter(route => {
      const originDistance = this.calculateDistance(origin, route.origin);
      const destDistance = this.calculateDistance(destination, route.destination);
      return originDistance < 1 && destDistance < 1; // Within 1km
    });
  }

  private calculateDistance(point1: LocationCoordinates, point2: LocationCoordinates): number {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private async generateAlternativeRoutes(
    origin: LocationCoordinates,
    destination: LocationCoordinates
  ): Promise<AlternativeRoute[]> {
    return [
      {
        route: [origin, destination], // Simplified
        estimatedTime: Math.floor(Math.random() * 20) + 15,
        estimatedCost: Math.round((Math.random() * 15 + 10) * 100) / 100,
        trafficLevel: 'light',
        advantages: ['Less traffic', 'Scenic route'],
        disadvantages: ['Slightly longer distance'],
      },
      {
        route: [origin, destination],
        estimatedTime: Math.floor(Math.random() * 25) + 10,
        estimatedCost: Math.round((Math.random() * 12 + 8) * 100) / 100,
        trafficLevel: 'moderate',
        advantages: ['Faster route', 'Highway access'],
        disadvantages: ['More traffic', 'Higher tolls'],
      },
    ];
  }

  private generateTrafficInsights(context: RecommendationContext): TrafficInsight[] {
    return [
      {
        timeWindow: { start: 7, end: 9 },
        trafficLevel: 'heavy',
        estimatedDelay: 15,
        alternativeAction: 'Leave 15 minutes earlier or wait until 9:30 AM',
      },
      {
        timeWindow: { start: 17, end: 19 },
        trafficLevel: 'severe',
        estimatedDelay: 25,
        alternativeAction: 'Consider public transport or leave after 7 PM',
      },
    ];
  }

  private generateNewDriverRecommendations(): RecommendedDriver[] {
    return [
      {
        driverId: 'new-driver-1',
        name: 'Sarah K.',
        rating: 4.8,
        compatibilityScore: 0.85,
        estimatedArrival: 6,
        whyRecommended: ['High compatibility score', 'Excellent ratings', 'Similar preferences'],
      },
    ];
  }

  private calculateOptimalTimes(context: RecommendationContext): OptimalTime[] {
    return [
      {
        timeSlot: { start: 10, end: 12 },
        dayOfWeek: context.dayOfWeek,
        advantages: ['Low traffic', 'Lower prices', 'More driver availability'],
        estimatedSavings: { time: 8, cost: 3.50 },
        confidence: 0.9,
      },
    ];
  }

  private calculateAvoidTimes(context: RecommendationContext): AvoidTime[] {
    return [
      {
        timeSlot: { start: 8, end: 9 },
        dayOfWeek: context.dayOfWeek,
        reason: 'Rush hour traffic and surge pricing',
        impact: 'major',
        alternatives: ['Leave before 7:30 AM', 'Wait until 9:30 AM'],
      },
    ];
  }

  private generateSurgePredictions(): SurgePrediction[] {
    return [
      {
        timeSlot: { start: 17, end: 19 },
        predictedMultiplier: 1.8,
        confidence: 0.85,
        location: 'Downtown area',
      },
    ];
  }

  private generateDiscountOpportunities(): DiscountOpportunity[] {
    return [
      {
        type: 'off_peak',
        discount: 15,
        requirements: ['Travel between 10 AM - 4 PM'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }

  private generateCostOptimizations(): CostOptimization[] {
    return [
      {
        suggestion: 'Try shared rides for routine trips',
        potentialSavings: 8.50,
        difficulty: 'easy',
      },
      {
        suggestion: 'Book rides during off-peak hours',
        potentialSavings: 5.25,
        difficulty: 'moderate',
      },
    ];
  }

  private generateGeneralRecommendations(context: RecommendationContext): AIRecommendation[] {
    return [
      {
        id: `general_${Date.now()}`,
        type: 'general',
        category: 'efficiency',
        title: 'Pre-book Regular Trips',
        description: 'Based on your travel patterns, pre-booking could save you time and money.',
        confidence: 0.8,
        impact: 'medium',
        reasoning: [
          'You take similar trips regularly',
          'Pre-booking often has lower prices',
          'Guaranteed availability',
        ],
        actionable: true,
      },
    ];
  }

  private generateUserInsights(): UserInsights {
    return {
      travelFrequency: '3-4 rides per week',
      averageSpend: 18.50,
      preferredTimes: ['10-11 AM', '2-3 PM', '7-8 PM'],
      topRoutes: ['Home to Downtown', 'Office to Airport'],
      behaviorTrends: ['Prefers shorter wait times', 'Values driver ratings', 'Price conscious'],
    };
  }

  private generateTrendingPatterns(): TrendingPattern[] {
    return [
      {
        pattern: 'Increased shared ride usage',
        description: 'More users are choosing shared rides to save money',
        relevanceScore: 0.8,
        userImpact: 'Could save you $50/month',
      },
    ];
  }

  private generatePersonalizedTips(): PersonalizedTip[] {
    return [
      {
        category: 'savings',
        tip: 'Schedule rides 10 minutes later to avoid surge pricing',
        estimatedBenefit: '$4-6 per trip',
      },
      {
        category: 'efficiency',
        tip: 'Use pickup locations near main roads for faster driver arrival',
        estimatedBenefit: '3-5 minutes faster pickup',
      },
    ];
  }

  private updateTravelPatterns(rideData: any): void {
    // Update travel patterns based on new ride data
    // This would be more sophisticated in production
  }

  private updateDriverPreferences(rideData: any): void {
    if (!this.userProfile) return;
    
    const existingPref = this.userProfile.driverPreferences.find(p => p.driverId === rideData.driverId);
    
    if (existingPref) {
      existingPref.rideCount++;
      existingPref.averageRating = (existingPref.averageRating + rideData.rating) / 2;
      existingPref.lastRideDate = rideData.timestamp;
      existingPref.preferenceScore = Math.min(1, existingPref.preferenceScore + (rideData.rating - 3) * 0.1);
    } else {
      this.userProfile.driverPreferences.push({
        driverId: rideData.driverId,
        preferenceScore: rideData.rating / 5,
        rideCount: 1,
        averageRating: rideData.rating,
        lastRideDate: rideData.timestamp,
        preferenceReasons: [],
      });
    }
  }

  private async syncUserProfileToBackend(): Promise<void> {
    if (!this.userProfile) return;
    
    const authToken = await this.authService.getValidToken();
    await this.apiClient.post('/ai/recommendations/profile', this.userProfile, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
    });
  }

  private async callMLRecommendationsAPI(request: RecommendationRequest): Promise<RecommendationsResponse> {
    const authToken = await this.authService.getValidToken();
    const response = await this.apiClient.post('/ai/recommendations/generate', request, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
    });

    if (!response.success) {
      throw new Error(response.error || 'ML Recommendations API failed');
    }

    return response.data;
  }
}

export default new AIRecommendationsService();