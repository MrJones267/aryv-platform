import { Request, Response } from 'express';
export declare class AdminRideController {
    static getAllRides(req: Request, res: Response): Promise<void>;
    static getRideById(req: Request, res: Response): Promise<void>;
    static cancelRide(req: Request, res: Response): Promise<void>;
    static getRideAnalytics(req: Request, res: Response): Promise<void>;
    static updateRideStatus(req: Request, res: Response): Promise<void>;
    static getRideBookings(req: Request, res: Response): Promise<void>;
}
export default AdminRideController;
//# sourceMappingURL=AdminRideController.d.ts.map