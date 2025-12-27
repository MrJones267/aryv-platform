import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export default class PredictiveAIController {
    getPredictiveInsights(req: AuthenticatedRequest, res: Response): Promise<void>;
    predictDemand(req: AuthenticatedRequest, res: Response): Promise<void>;
    optimizePricing(req: AuthenticatedRequest, res: Response): Promise<void>;
    predictWaitTime(req: AuthenticatedRequest, res: Response): Promise<void>;
    predictUserBehavior(req: AuthenticatedRequest, res: Response): Promise<void>;
    predictChurnRisk(req: AuthenticatedRequest, res: Response): Promise<void>;
    getMarketConditions(req: AuthenticatedRequest, res: Response): Promise<void>;
    getPersonalizedRecommendations(req: AuthenticatedRequest, res: Response): Promise<void>;
    getHealthStatus(_req: Request, res: Response): Promise<void>;
    getCacheStats(req: AuthenticatedRequest, res: Response): Promise<void>;
    clearCache(req: AuthenticatedRequest, res: Response): Promise<void>;
    static getValidationRules(): {
        insights: import("express-validator").ValidationChain[];
        demandPrediction: import("express-validator").ValidationChain[];
        pricingOptimization: import("express-validator").ValidationChain[];
        waitTimePrediction: import("express-validator").ValidationChain[];
        userBehavior: import("express-validator").ValidationChain[];
        churnRisk: import("express-validator").ValidationChain[];
        marketConditions: import("express-validator").ValidationChain[];
        personalizedRecommendations: import("express-validator").ValidationChain[];
        clearCache: import("express-validator").ValidationChain[];
    };
}
//# sourceMappingURL=PredictiveAIController.d.ts.map