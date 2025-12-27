import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types';
export declare const authenticateToken: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const authorizeRoles: (...roles: UserRole[]) => (req: AuthenticatedRequest, _res: Response, next: NextFunction) => void;
export declare const requireVerification: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireOwnership: (userIdField?: string) => (req: AuthenticatedRequest, _res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => Promise<void>;
export declare const authenticateAdminToken: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map