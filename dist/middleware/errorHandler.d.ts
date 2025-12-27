import { Request, Response, NextFunction } from 'express';
export declare const globalErrorHandler: (err: any, req: Request, res: Response, _next: NextFunction) => void;
export declare const catchAsync: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export declare const notFound: (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=errorHandler.d.ts.map