import { Request, Response } from 'express';
export declare class AdminController {
    static login(req: Request, res: Response): Promise<void>;
    static verify(req: Request, res: Response): Promise<void>;
    static logout(req: Request, res: Response): Promise<void>;
    static updateProfile(req: any, res: Response): Promise<void>;
    static getDashboardStats(_req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=AdminController.d.ts.map