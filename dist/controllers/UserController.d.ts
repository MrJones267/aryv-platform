import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class UserController {
    getProfile(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateProfile(req: AuthenticatedRequest, res: Response): Promise<void>;
    uploadAvatar(req: AuthenticatedRequest, res: Response): Promise<void>;
    deleteAvatar(req: AuthenticatedRequest, res: Response): Promise<void>;
    sendPhoneVerification(req: AuthenticatedRequest, res: Response): Promise<void>;
    confirmPhoneVerification(req: AuthenticatedRequest, res: Response): Promise<void>;
    getDrivingLicense(req: AuthenticatedRequest, res: Response): Promise<void>;
    uploadDrivingLicense(req: AuthenticatedRequest, res: Response): Promise<void>;
    getVehicles(req: AuthenticatedRequest, res: Response): Promise<void>;
    registerVehicle(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateVehicle(req: AuthenticatedRequest, res: Response): Promise<void>;
    deleteVehicle(req: AuthenticatedRequest, res: Response): Promise<void>;
    submitVehicleVerification(req: AuthenticatedRequest, res: Response): Promise<void>;
    getPaymentMethods(_req: AuthenticatedRequest, res: Response): Promise<void>;
    addPaymentMethod(_req: AuthenticatedRequest, res: Response): Promise<void>;
    removePaymentMethod(_req: AuthenticatedRequest, res: Response): Promise<void>;
    getRideHistory(req: AuthenticatedRequest, res: Response): Promise<void>;
    getUserStatistics(req: AuthenticatedRequest, res: Response): Promise<void>;
    submitReport(_req: AuthenticatedRequest, res: Response): Promise<void>;
    deactivateAccount(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=UserController.d.ts.map