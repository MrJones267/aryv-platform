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
        pickup_location: Coordinates & {
            address: string;
        };
        dropoff_location: Coordinates & {
            address: string;
        };
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
export declare class AIService {
    private baseURL;
    private timeout;
    constructor();
    findRideMatches(request: RideMatchRequest): Promise<{
        success: boolean;
        data?: {
            matches: RideMatch[];
            total_matches: number;
            search_params: any;
        };
        error?: string;
    }>;
    calculateDynamicPrice(request: DynamicPricingRequest): Promise<{
        success: boolean;
        data?: PricingResult;
        error?: string;
    }>;
    optimizeRoute(request: RouteOptimizationRequest): Promise<{
        success: boolean;
        data?: OptimizedRoute;
        error?: string;
    }>;
    predictDemand(request: DemandPredictionRequest): Promise<{
        success: boolean;
        data?: DemandPrediction;
        error?: string;
    }>;
    checkHealth(): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getRideRecommendations(origin: Coordinates, destination: Coordinates, departureTime: string, userPreferences?: Record<string, any>): Promise<{
        success: boolean;
        data?: {
            matches: RideMatch[];
            pricing: PricingResult;
            recommendations: string[];
        };
        error?: string;
    }>;
    private _getErrorMessage;
    private _calculateEstimatedDistance;
    private _toRadians;
    private _generateRecommendations;
}
export declare const aiService: AIService;
export {};
//# sourceMappingURL=AIService.d.ts.map