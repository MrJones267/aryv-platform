import winston from 'winston';
declare const Logger: winston.Logger;
export declare const requestLogger: (req: any, res: any, next: any) => void;
export declare const logError: (message: string, error: Error, context?: any) => void;
export declare const logWarning: (message: string, context?: any) => void;
export declare const logInfo: (message: string, context?: any) => void;
export declare const logDebug: (message: string, context?: any) => void;
export declare const logDatabaseQuery: (query: string, duration: number, context?: any) => void;
export declare const logAuthEvent: (event: string, userId?: string, context?: any) => void;
export declare const logSecurityEvent: (event: string, severity: "low" | "medium" | "high" | "critical", context?: any) => void;
export declare const getErrorMessage: (error: unknown) => string;
export declare const getErrorStack: (error: unknown) => string | undefined;
export declare const logWarn: (message: string, context?: any) => void;
export default Logger;
//# sourceMappingURL=logger.d.ts.map