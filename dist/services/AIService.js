"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiService = exports.AIService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config/config");
const logger_1 = __importDefault(require("../utils/logger"));
class AIService {
    constructor() {
        this.baseURL = config_1.config.aiServices.baseURL || 'http://ai-services:5000';
        this.timeout = 30000;
    }
    async findRideMatches(request) {
        try {
            logger_1.default.info('Requesting AI ride matching', {
                origin: request.origin,
                destination: request.destination,
                departure_time: request.departure_time,
            });
            const response = await axios_1.default.post(`${this.baseURL}/api/match-rides`, request, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Source': 'hitch-backend',
                },
            });
            if (response.data.success) {
                logger_1.default.info(`AI ride matching successful: ${response.data.data.total_matches} matches found`);
                return {
                    success: true,
                    data: response.data.data,
                };
            }
            else {
                logger_1.default.warn('AI ride matching returned unsuccessful result', response.data);
                return {
                    success: false,
                    error: response.data.error || 'AI matching failed',
                };
            }
        }
        catch (error) {
            logger_1.default.error('AI ride matching service error', {
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
    async calculateDynamicPrice(request) {
        try {
            logger_1.default.info('Requesting AI dynamic pricing', {
                ride_data: request.ride_data,
            });
            const response = await axios_1.default.post(`${this.baseURL}/api/calculate-price`, request, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Source': 'hitch-backend',
                },
            });
            if (response.data.success) {
                logger_1.default.info(`AI pricing successful: $${response.data.data.final_price} (surge: ${response.data.data.surge_multiplier}x)`);
                return {
                    success: true,
                    data: response.data.data,
                };
            }
            else {
                logger_1.default.warn('AI pricing returned unsuccessful result', response.data);
                return {
                    success: false,
                    error: response.data.error || 'AI pricing failed',
                };
            }
        }
        catch (error) {
            logger_1.default.error('AI pricing service error', {
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
    async optimizeRoute(request) {
        try {
            logger_1.default.info('Requesting AI route optimization', {
                waypoint_count: request.waypoints.length,
                passenger_count: new Set(request.waypoints.map(w => w.passenger_id)).size,
            });
            const response = await axios_1.default.post(`${this.baseURL}/api/optimize-route`, request, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Source': 'hitch-backend',
                },
            });
            if (response.data.success) {
                logger_1.default.info(`AI route optimization successful: ${response.data.data.route_summary.total_distance_km}km, ${response.data.data.route_summary.total_time_minutes}min`);
                return {
                    success: true,
                    data: response.data.data,
                };
            }
            else {
                logger_1.default.warn('AI route optimization returned unsuccessful result', response.data);
                return {
                    success: false,
                    error: response.data.error || 'AI route optimization failed',
                };
            }
        }
        catch (error) {
            logger_1.default.error('AI route optimization service error', {
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
    async predictDemand(request) {
        try {
            logger_1.default.info('Requesting AI demand prediction', {
                location: request.location,
                time_range: request.time_range,
            });
            const response = await axios_1.default.post(`${this.baseURL}/api/predict-demand`, request, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Source': 'hitch-backend',
                },
            });
            if (response.data.success) {
                logger_1.default.info(`AI demand prediction successful: ${response.data.data.predictions.demand_category} demand predicted`);
                return {
                    success: true,
                    data: response.data.data,
                };
            }
            else {
                logger_1.default.warn('AI demand prediction returned unsuccessful result', response.data);
                return {
                    success: false,
                    error: response.data.error || 'AI demand prediction failed',
                };
            }
        }
        catch (error) {
            logger_1.default.error('AI demand prediction service error', {
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
    async checkHealth() {
        try {
            const response = await axios_1.default.get(`${this.baseURL}/health`, {
                timeout: 5000,
                headers: {
                    'X-Service-Source': 'hitch-backend',
                },
            });
            return {
                success: response.data.success || response.status === 200,
                data: response.data,
            };
        }
        catch (error) {
            logger_1.default.error('AI services health check failed', {
                error: error.message,
                baseURL: this.baseURL,
            });
            return {
                success: false,
                error: this._getErrorMessage(error),
            };
        }
    }
    async getRideRecommendations(origin, destination, departureTime, userPreferences = {}) {
        try {
            const matchRequest = {
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
            const estimatedDistance = this._calculateEstimatedDistance(origin, destination);
            const estimatedDuration = estimatedDistance * 2;
            const pricingRequest = {
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
            const recommendations = this._generateRecommendations(matchResult.data?.matches || [], pricingResult.data);
            return {
                success: true,
                data: {
                    matches: matchResult.data?.matches || [],
                    pricing: pricingResult.data || {},
                    recommendations,
                },
            };
        }
        catch (error) {
            logger_1.default.error('AI ride recommendations error', {
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
    _getErrorMessage(error) {
        if (error.response) {
            return error.response.data?.error || `AI service error: ${error.response.status}`;
        }
        else if (error.request) {
            return 'AI service unavailable - no response received';
        }
        else {
            return error.message || 'Unknown AI service error';
        }
    }
    _calculateEstimatedDistance(origin, destination) {
        const R = 6371;
        const dLat = this._toRadians(destination.latitude - origin.latitude);
        const dLon = this._toRadians(destination.longitude - origin.longitude);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this._toRadians(origin.latitude)) * Math.cos(this._toRadians(destination.latitude)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return Math.round(distance * 100) / 100;
    }
    _toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    _generateRecommendations(matches, pricing) {
        const recommendations = [];
        if (matches.length === 0) {
            recommendations.push('No compatible rides found. Consider adjusting your search criteria or creating your own ride.');
            return recommendations;
        }
        const avgCompatibility = matches.reduce((sum, match) => sum + match.compatibility_score, 0) / matches.length;
        const topMatch = matches[0];
        if (avgCompatibility > 0.8) {
            recommendations.push('Excellent ride options available! High compatibility scores found.');
        }
        else if (avgCompatibility > 0.6) {
            recommendations.push('Good ride options available with decent compatibility.');
        }
        else {
            recommendations.push('Limited compatible options. Consider flexible timing or preferences.');
        }
        if (topMatch.driver_rating >= 4.5) {
            recommendations.push(`Top match has an excellent driver rating of ${topMatch.driver_rating}/5.0.`);
        }
        if (pricing && pricing.surge_multiplier > 1.5) {
            recommendations.push(`High demand detected (${pricing.surge_multiplier}x surge). Consider riding later for better prices.`);
        }
        else if (pricing && pricing.surge_multiplier < 1.2) {
            recommendations.push('Great timing! Normal pricing currently in effect.');
        }
        if (topMatch.route_efficiency > 0.8) {
            recommendations.push('Highly efficient route found - minimal detour expected.');
        }
        return recommendations;
    }
}
exports.AIService = AIService;
exports.aiService = new AIService();
//# sourceMappingURL=AIService.js.map