import { Request, Response } from 'express';
export declare class CourierController {
    getPricingSuggestions(req: Request, res: Response): Promise<void>;
    getDeliveryTiers(_req: Request, res: Response): Promise<void>;
    createPackage(req: Request, res: Response): Promise<void>;
    getAvailablePackages(req: Request, res: Response): Promise<void>;
    acceptDelivery(req: Request, res: Response): Promise<void>;
    confirmPickup(req: Request, res: Response): Promise<void>;
    verifyDeliveryQR(req: Request, res: Response): Promise<void>;
    updateCourierLocation(req: Request, res: Response): Promise<void>;
    getCourierDeliveries(req: Request, res: Response): Promise<void>;
    getPackageTracking(req: Request, res: Response): Promise<void>;
    private calculateDistance;
    private toRad;
    private calculateSuggestedPrice;
}
declare const _default: CourierController;
export default _default;
//# sourceMappingURL=CourierController.d.ts.map