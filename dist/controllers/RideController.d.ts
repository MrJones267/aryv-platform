import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class RideController {
    private groupChatService;
    constructor();
    createRide(req: AuthenticatedRequest, res: Response): Promise<void>;
    searchRides(req: Request, res: Response): Promise<void>;
    getRideById(req: Request, res: Response): Promise<void>;
    getUserRides(req: AuthenticatedRequest, res: Response): Promise<void>;
    getMyRides(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateRide(req: AuthenticatedRequest, res: Response): Promise<void>;
    deleteRide(req: AuthenticatedRequest, res: Response): Promise<void>;
    bookRide(req: AuthenticatedRequest, res: Response): Promise<void>;
    getRideBookings(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateRideStatus(req: AuthenticatedRequest, res: Response): Promise<void>;
    private calculateDistance;
    private deg2rad;
    findRideMatches(req: AuthenticatedRequest, res: Response): Promise<void>;
    calculateDynamicPrice(req: AuthenticatedRequest, res: Response): Promise<void>;
    optimizeRoute(req: AuthenticatedRequest, res: Response): Promise<void>;
    predictDemand(req: AuthenticatedRequest, res: Response): Promise<void>;
    getRideRecommendations(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=RideController.d.ts.map