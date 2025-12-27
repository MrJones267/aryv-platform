import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class CashPaymentController {
    private cashPaymentService;
    constructor();
    createCashPayment(req: AuthenticatedRequest, res: Response): Promise<void>;
    confirmCashReceived(req: AuthenticatedRequest, res: Response): Promise<void>;
    confirmCashPaid(req: AuthenticatedRequest, res: Response): Promise<void>;
    getCashTransaction(req: AuthenticatedRequest, res: Response): Promise<void>;
    getCashTransactionHistory(req: AuthenticatedRequest, res: Response): Promise<void>;
    getWalletInfo(req: AuthenticatedRequest, res: Response): Promise<void>;
    reportDispute(req: AuthenticatedRequest, res: Response): Promise<void>;
    private calculateDisputePriority;
}
export default CashPaymentController;
//# sourceMappingURL=CashPaymentController.d.ts.map