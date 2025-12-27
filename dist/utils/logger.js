"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logWarn = exports.getErrorStack = exports.getErrorMessage = exports.logSecurityEvent = exports.logAuthEvent = exports.logDatabaseQuery = exports.logDebug = exports.logInfo = exports.logWarning = exports.logError = exports.requestLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};
winston_1.default.addColors(colors);
const format = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => `${info['timestamp']} ${info.level}: ${info.message}`));
const fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
const transports = [
    new winston_1.default.transports.Console({
        format,
        level: process.env['LOG_LEVEL'] || 'debug',
    }),
    new winston_1.default.transports.File({
        filename: path_1.default.join(process.cwd(), 'logs', 'error.log'),
        level: 'error',
        format: fileFormat,
        maxsize: 5242880,
        maxFiles: 5,
    }),
    new winston_1.default.transports.File({
        filename: path_1.default.join(process.cwd(), 'logs', 'combined.log'),
        format: fileFormat,
        maxsize: 5242880,
        maxFiles: 5,
    }),
];
const Logger = winston_1.default.createLogger({
    level: process.env['LOG_LEVEL'] || 'debug',
    levels,
    transports,
    exitOnError: false,
    handleExceptions: true,
    handleRejections: true,
});
const fs_1 = __importDefault(require("fs"));
const logsDir = path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir);
}
const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`;
        if (res.statusCode >= 400) {
            Logger.warn(message, {
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                duration,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
            });
        }
        else {
            Logger.http(message, {
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                duration,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
            });
        }
    });
    next();
};
exports.requestLogger = requestLogger;
const logError = (message, error, context) => {
    Logger.error(message, {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        ...context,
    });
};
exports.logError = logError;
const logWarning = (message, context) => {
    Logger.warn(message, {
        timestamp: new Date().toISOString(),
        ...context,
    });
};
exports.logWarning = logWarning;
const logInfo = (message, context) => {
    Logger.info(message, {
        timestamp: new Date().toISOString(),
        ...context,
    });
};
exports.logInfo = logInfo;
const logDebug = (message, context) => {
    Logger.debug(message, {
        timestamp: new Date().toISOString(),
        ...context,
    });
};
exports.logDebug = logDebug;
const logDatabaseQuery = (query, duration, context) => {
    Logger.debug('Database Query', {
        query,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        ...context,
    });
};
exports.logDatabaseQuery = logDatabaseQuery;
const logAuthEvent = (event, userId, context) => {
    Logger.info(`Auth Event: ${event}`, {
        userId,
        timestamp: new Date().toISOString(),
        ...context,
    });
};
exports.logAuthEvent = logAuthEvent;
const logSecurityEvent = (event, severity, context) => {
    const logMethod = severity === 'critical' || severity === 'high' ? Logger.error : Logger.warn;
    logMethod(`Security Event: ${event}`, {
        severity,
        timestamp: new Date().toISOString(),
        ...context,
    });
};
exports.logSecurityEvent = logSecurityEvent;
const getErrorMessage = (error) => {
    if (error instanceof Error)
        return error.message;
    if (typeof error === 'string')
        return error;
    return 'An unknown error occurred';
};
exports.getErrorMessage = getErrorMessage;
const getErrorStack = (error) => {
    if (error instanceof Error)
        return error.stack;
    return undefined;
};
exports.getErrorStack = getErrorStack;
exports.logWarn = exports.logWarning;
exports.default = Logger;
//# sourceMappingURL=logger.js.map