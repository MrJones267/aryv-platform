import { Request, Response } from 'express';
export declare class AdminUserController {
    static getAllUsers(req: Request, res: Response): Promise<void>;
    static getUserById(req: Request, res: Response): Promise<void>;
    static updateUser(req: Request, res: Response): Promise<void>;
    static blockUser(req: Request, res: Response): Promise<void>;
    static unblockUser(req: Request, res: Response): Promise<void>;
    static verifyUser(req: Request, res: Response): Promise<void>;
    static getUserAnalytics(req: Request, res: Response): Promise<void>;
}
export default AdminUserController;
//# sourceMappingURL=AdminUserController.d.ts.map