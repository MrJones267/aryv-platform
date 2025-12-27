"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = __importDefault(require("../utils/logger"));
class PredictiveAIService {
    constructor() {
        this.aiServiceUrl = process.env['AI_SERVICE_URL'] || 'http://localhost:5001';
        this.realTimeServiceUrl = process.env['REALTIME_DATA_URL'] || 'http://localhost:5002';
        this.timeout = 10000;
        this.cache = new node_cache_1.default({
            stdTTL: 300,
            checkperiod: 60,
            useClones: false,
        });
    }
    async getPredictiveInsights(latitude, longitude, basePrice, _userId) {
        try {
            const cacheKey = `insights:${latitude}:${longitude}:${basePrice || 'default'}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            const [demandResult, marketConditions, waitTimeResult,] = await Promise.allSettled([
                this.predictDemand(latitude, longitude, 60),
                this.getMarketConditions(latitude, longitude),
                this.predictWaitTime(latitude, longitude),
            ]);
            const demand = demandResult.status === 'fulfilled' ? demandResult.value : this.getFallbackDemand();
            const market = marketConditions.status === 'fulfilled' ? marketConditions.value : this.getFallbackMarket();
            const waitTime = waitTimeResult.status === 'fulfilled' ? waitTimeResult.value : this.getFallbackWaitTime();
            let pricing = this.getFallbackPricing();
            if (basePrice) {
                try {
                    pricing = await this.optimizePricing(basePrice, latitude, longitude, demand.prediction, market.composite_scores.demand_multiplier);
                }
                catch (error) {
                    logger_1.default.warn('Failed to get pricing optimization, using fallback');
                }
            }
            const recommendations = this.generateRecommendations(demand, pricing, waitTime, market);
            const insights = {
                demand_forecast: demand,
                optimal_pricing: pricing,
                wait_time_estimate: waitTime,
                market_conditions: market,
                recommendations,
            };
            this.cache.set(cacheKey, insights, 180);
            return insights;
        }
        catch (error) {
            logger_1.default.error('Error getting predictive insights:', error);
            return this.getFallbackInsights();
        }
    }
    async predictDemand(latitude, longitude, timeHorizonMinutes = 60, includeFactors = true) {
        try {
            const cacheKey = `demand:${latitude}:${longitude}:${timeHorizonMinutes}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await axios_1.default.post(`${this.aiServiceUrl}/predict/demand`, {
                latitude,
                longitude,
                time_horizon: timeHorizonMinutes,
                include_factors: includeFactors,
            }, { timeout: this.timeout });
            const result = response.data;
            this.cache.set(cacheKey, result, 300);
            return result;
        }
        catch (error) {
            logger_1.default.error('Error predicting demand:', error);
            return this.getFallbackDemand();
        }
    }
    async optimizePricing(basePrice, latitude, longitude, demandLevel, supplyLevel) {
        try {
            const cacheKey = `pricing:${basePrice}:${latitude}:${longitude}:${demandLevel}:${supplyLevel}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await axios_1.default.post(`${this.aiServiceUrl}/optimize/pricing`, {
                base_price: basePrice,
                latitude,
                longitude,
                demand_level: demandLevel,
                supply_level: supplyLevel,
            }, { timeout: this.timeout });
            const result = response.data;
            this.cache.set(cacheKey, result, 180);
            return result;
        }
        catch (error) {
            logger_1.default.error('Error optimizing pricing:', error);
            return this.getFallbackPricing();
        }
    }
    async predictWaitTime(latitude, longitude, timeOfDay) {
        try {
            const cacheKey = `waittime:${latitude}:${longitude}:${timeOfDay || 'current'}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await axios_1.default.post(`${this.aiServiceUrl}/predict/wait-time`, {
                latitude,
                longitude,
                time_of_day: timeOfDay,
            }, { timeout: this.timeout });
            const result = response.data;
            this.cache.set(cacheKey, result, 240);
            return result;
        }
        catch (error) {
            logger_1.default.error('Error predicting wait time:', error);
            return this.getFallbackWaitTime();
        }
    }
    async predictUserBehavior(userId, behaviorType = 'ride_frequency') {
        try {
            const cacheKey = `behavior:${userId}:${behaviorType}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await axios_1.default.post(`${this.aiServiceUrl}/predict/user-behavior`, {
                user_id: userId,
                behavior_type: behaviorType,
            }, { timeout: this.timeout });
            const result = response.data;
            this.cache.set(cacheKey, result, 1800);
            return result;
        }
        catch (error) {
            logger_1.default.error('Error predicting user behavior:', error);
            return this.getFallbackUserBehavior();
        }
    }
    async predictChurnRisk(userId) {
        try {
            const cacheKey = `churn:${userId}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await axios_1.default.post(`${this.aiServiceUrl}/predict/churn-risk`, {
                user_id: userId,
            }, { timeout: this.timeout });
            const result = response.data;
            this.cache.set(cacheKey, result, 3600);
            return result;
        }
        catch (error) {
            logger_1.default.error('Error predicting churn risk:', error);
            return this.getFallbackChurnRisk();
        }
    }
    async getMarketConditions(latitude, longitude) {
        try {
            const cacheKey = `market:${latitude}:${longitude}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await axios_1.default.get(`${this.realTimeServiceUrl}/conditions/aggregated`, {
                params: { latitude, longitude },
                timeout: this.timeout,
            });
            const result = response.data;
            this.cache.set(cacheKey, result, 120);
            return result;
        }
        catch (error) {
            logger_1.default.error('Error getting market conditions:', error);
            return this.getFallbackMarket();
        }
    }
    async getPersonalizedRecommendations(userId, latitude, longitude, _preferences) {
        try {
            const [behaviorResult, marketResult, churnResult] = await Promise.allSettled([
                this.predictUserBehavior(userId, 'ride_frequency'),
                this.getMarketConditions(latitude, longitude),
                this.predictChurnRisk(userId),
            ]);
            const behavior = behaviorResult.status === 'fulfilled' ? behaviorResult.value : null;
            const market = marketResult.status === 'fulfilled' ? marketResult.value : null;
            const churn = churnResult.status === 'fulfilled' ? churnResult.value : null;
            const recommendations = [];
            if (behavior && behavior.prediction < 2) {
                recommendations.push('Consider booking rides in advance for better pricing');
            }
            if (market && market.composite_scores.demand_multiplier > 1.5) {
                recommendations.push('High demand expected - book soon or consider alternative times');
            }
            if (market && market.weather.severity_score > 0.5) {
                recommendations.push('Weather may affect your ride - allow extra time');
            }
            if (market && market.traffic.congestion_level === 'severe') {
                recommendations.push('Heavy traffic expected - consider public transport alternatives');
            }
            if (churn && churn.prediction > 0.6) {
                recommendations.push('Check out our latest features and promotions');
                recommendations.push('Share feedback to help us improve your experience');
            }
            return recommendations;
        }
        catch (error) {
            logger_1.default.error('Error getting personalized recommendations:', error);
            return ['Book your ride and enjoy the journey!'];
        }
    }
    generateRecommendations(demand, pricing, waitTime, market) {
        const recommendations = [];
        if (demand.prediction > 20) {
            recommendations.push('High demand expected - book early for best availability');
        }
        else if (demand.prediction < 5) {
            recommendations.push('Low demand period - great time for quick rides');
        }
        if (pricing.prediction > pricing.prediction * 1.5) {
            recommendations.push('Consider booking later for potentially lower prices');
        }
        if (waitTime.prediction > 15) {
            recommendations.push('Longer wait times expected - plan accordingly');
        }
        else if (waitTime.prediction < 5) {
            recommendations.push('Fast pickup times available');
        }
        if (market.weather.severity_score > 0.6) {
            recommendations.push('Weather conditions may affect your ride - stay flexible');
        }
        if (market.traffic.density > 0.8) {
            recommendations.push('Heavy traffic expected - allow extra travel time');
        }
        if (market.events.count > 0) {
            recommendations.push('Local events may affect routes and timing');
        }
        return recommendations.length > 0 ? recommendations : ['All conditions normal - enjoy your ride!'];
    }
    getFallbackDemand() {
        return {
            prediction: 10,
            confidence: 0.3,
            factors: {},
            timestamp: new Date().toISOString(),
            model_version: 'fallback',
        };
    }
    getFallbackPricing() {
        return {
            prediction: 25.0,
            confidence: 0.3,
            factors: {},
            timestamp: new Date().toISOString(),
            model_version: 'fallback',
        };
    }
    getFallbackWaitTime() {
        return {
            prediction: 8.0,
            confidence: 0.3,
            factors: {},
            timestamp: new Date().toISOString(),
            model_version: 'fallback',
        };
    }
    getFallbackUserBehavior() {
        return {
            prediction: 3.0,
            confidence: 0.3,
            factors: {},
            timestamp: new Date().toISOString(),
            model_version: 'fallback',
        };
    }
    getFallbackChurnRisk() {
        return {
            prediction: 0.2,
            confidence: 0.3,
            factors: {},
            timestamp: new Date().toISOString(),
            model_version: 'fallback',
        };
    }
    getFallbackMarket() {
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
    getFallbackInsights() {
        return {
            demand_forecast: this.getFallbackDemand(),
            optimal_pricing: this.getFallbackPricing(),
            wait_time_estimate: this.getFallbackWaitTime(),
            market_conditions: this.getFallbackMarket(),
            recommendations: ['Service temporarily unavailable - standard booking available'],
        };
    }
    async healthCheck() {
        try {
            const [aiHealth, realtimeHealth] = await Promise.allSettled([
                axios_1.default.get(`${this.aiServiceUrl}/health`, { timeout: 5000 }),
                axios_1.default.get(`${this.realTimeServiceUrl}/health`, { timeout: 5000 }),
            ]);
            return {
                ai_service: aiHealth.status === 'fulfilled' && aiHealth.value.status === 200,
                realtime_service: realtimeHealth.status === 'fulfilled' && realtimeHealth.value.status === 200,
            };
        }
        catch (error) {
            logger_1.default.error('Error during AI services health check:', error);
            return {
                ai_service: false,
                realtime_service: false,
            };
        }
    }
    clearCache(pattern) {
        if (pattern) {
            const keys = this.cache.keys();
            const filteredKeys = keys.filter((key) => key.includes(pattern));
            this.cache.del(filteredKeys);
        }
        else {
            this.cache.flushAll();
        }
    }
    getCacheStats() {
        return this.cache.getStats();
    }
}
exports.default = new PredictiveAIService();
//# sourceMappingURL=PredictiveAIService.js.map