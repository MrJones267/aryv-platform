import { Request, Response } from 'express';
export declare class DisputeController {
    createDispute(req: Request, res: Response): Promise<void>;
    getAllDisputes(req: Request, res: Response): Promise<void>;
    getUserDisputes(req: Request, res: Response): Promise<void>;
    getDisputeDetails(req: Request, res: Response): Promise<void>;
    moveToReview(req: Request, res: Response): Promise<void>;
    resolveDispute(req: Request, res: Response): Promise<void>;
    getDisputeStats(req: Request, res: Response): Promise<void>;
}
declare const _default: DisputeController;
export default _default;
//# sourceMappingURL=DisputeController.d.ts.map