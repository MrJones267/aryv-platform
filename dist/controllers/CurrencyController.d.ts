import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class CurrencyController {
    static getCurrencies(_req: Request, res: Response): Promise<Response>;
    static getPopularCurrencies(req: Request, res: Response): Promise<Response>;
    static getUserCurrencies(req: AuthenticatedRequest, res: Response): Promise<Response>;
    static setPrimaryCurrency(req: AuthenticatedRequest, res: Response): Promise<Response>;
    static addPaymentCurrency(req: AuthenticatedRequest, res: Response): Promise<Response>;
    static convertCurrency(req: AuthenticatedRequest, res: Response): Promise<Response>;
    static updateExchangeRates(req: AuthenticatedRequest, res: Response): Promise<Response>;
    static removePaymentCurrency(req: AuthenticatedRequest, res: Response): Promise<Response>;
}
export default CurrencyController;
//# sourceMappingURL=CurrencyController.d.ts.map