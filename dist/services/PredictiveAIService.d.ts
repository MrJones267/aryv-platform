export interface PredictionResult {
    prediction: number;
    confidence: number;
    factors: Record<string, number>;
    timestamp: string;
    model_version: string;
}
export interface DemandPrediction extends PredictionResult {
    prediction: number;
}
export interface PricePrediction extends PredictionResult {
    prediction: number;
}
export interface WaitTimePrediction extends PredictionResult {
    prediction: number;
}
export interface UserBehaviorPrediction extends PredictionResult {
    prediction: number;
}
export interface ChurnRiskPrediction extends PredictionResult {
    prediction: number;
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
declare class PredictiveAIService {
    private aiServiceUrl;
    private realTimeServiceUrl;
    private cache;
    private timeout;
    constructor();
    getPredictiveInsights(latitude: number, longitude: number, basePrice?: number, _userId?: string): Promise<PredictiveInsights>;
    predictDemand(latitude: number, longitude: number, timeHorizonMinutes?: number, includeFactors?: boolean): Promise<DemandPrediction>;
    optimizePricing(basePrice: number, latitude: number, longitude: number, demandLevel: number, supplyLevel: number): Promise<PricePrediction>;
    predictWaitTime(latitude: number, longitude: number, timeOfDay?: number): Promise<WaitTimePrediction>;
    predictUserBehavior(userId: string, behaviorType?: 'ride_frequency' | 'preferred_times' | 'price_sensitivity'): Promise<UserBehaviorPrediction>;
    predictChurnRisk(userId: string): Promise<ChurnRiskPrediction>;
    getMarketConditions(latitude: number, longitude: number): Promise<MarketConditions>;
    getPersonalizedRecommendations(userId: string, latitude: number, longitude: number, _preferences?: Record<string, any>): Promise<string[]>;
    private generateRecommendations;
    private getFallbackDemand;
    private getFallbackPricing;
    private getFallbackWaitTime;
    private getFallbackUserBehavior;
    private getFallbackChurnRisk;
    private getFallbackMarket;
    private getFallbackInsights;
    healthCheck(): Promise<{
        ai_service: boolean;
        realtime_service: boolean;
    }>;
    clearCache(pattern?: string): void;
    getCacheStats(): {
        keys: number;
        hits: number;
        misses: number;
        ksize: number;
        vsize: number;
    };
}
declare const _default: PredictiveAIService;
export default _default;
//# sourceMappingURL=PredictiveAIService.d.ts.map