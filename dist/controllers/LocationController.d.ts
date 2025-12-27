import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class LocationController {
    updateLocation(req: AuthenticatedRequest, res: Response): Promise<void>;
    getCurrentLocation(req: AuthenticatedRequest, res: Response): Promise<void>;
    startRideTracking(req: AuthenticatedRequest, res: Response): Promise<void>;
    stopRideTracking(req: AuthenticatedRequest, res: Response): Promise<void>;
    getRideTracking(req: AuthenticatedRequest, res: Response): Promise<void>;
    findNearbyUsers(req: AuthenticatedRequest, res: Response): Promise<void>;
    searchPlaces(req: AuthenticatedRequest, res: Response): Promise<void>;
    reverseGeocode(req: AuthenticatedRequest, res: Response): Promise<void>;
    calculateRoute(req: AuthenticatedRequest, res: Response): Promise<void>;
    getETA(req: AuthenticatedRequest, res: Response): Promise<void>;
    sendEmergencyAlert(req: AuthenticatedRequest, res: Response): Promise<void>;
    getGeofences(_req: AuthenticatedRequest, res: Response): Promise<void>;
    checkGeofences(_req: AuthenticatedRequest, res: Response): Promise<void>;
    getLocationStatistics(_req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=LocationController.d.ts.map