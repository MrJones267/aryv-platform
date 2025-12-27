"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = exports.catchAsync = exports.globalErrorHandler = void 0;
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: err.code,
        stack: err.stack,
        timestamp: new Date().toISOString(),
    });
};
const sendErrorProd = (err, res) => {
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code,
            timestamp: new Date().toISOString(),
        });
    }
    else {
        (0, logger_1.logError)('Unexpected error', err);
        res.status(500).json({
            success: false,
            error: 'Something went wrong',
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
        });
    }
};
const handleSequelizeValidationError = (err) => {
    const _errors = err.errors.map(error => ({
        field: error.path,
        message: error.message,
        value: error.value,
    }));
    void _errors;
    const message = 'Invalid input data';
    return new types_1.AppError(message, 400, 'VALIDATION_ERROR');
};
const handleSequelizeUniqueConstraintError = (err) => {
    const field = err.errors[0]?.path || 'field';
    const message = `${field} already exists`;
    return new types_1.AppError(message, 409, 'DUPLICATE_FIELD_VALUE');
};
const handleSequelizeForeignKeyConstraintError = (_err) => {
    const message = 'Invalid reference to related resource';
    return new types_1.AppError(message, 400, 'INVALID_REFERENCE');
};
const handleJWTError = () => {
    return new types_1.AppError('Invalid token. Please log in again!', 401, 'INVALID_TOKEN');
};
const handleJWTExpiredError = () => {
    return new types_1.AppError('Your token has expired! Please log in again.', 401, 'TOKEN_EXPIRED');
};
const handleMulterError = (err) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return new types_1.AppError('File too large', 400, 'FILE_TOO_LARGE');
    }
    else if (err.code === 'LIMIT_FILE_COUNT') {
        return new types_1.AppError('Too many files', 400, 'TOO_MANY_FILES');
    }
    else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return new types_1.AppError('Unexpected field', 400, 'UNEXPECTED_FIELD');
    }
    return new types_1.AppError('File upload error', 400, 'FILE_UPLOAD_ERROR');
};
const globalErrorHandler = (err, req, res, _next) => {
    let error = { ...err };
    error.message = err.message;
    error.statusCode = err.statusCode || 500;
    error.code = err.code || 'INTERNAL_SERVER_ERROR';
    error.isOperational = err.isOperational || false;
    (0, logger_1.logError)('Global error handler', err, {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
    });
    if (err.name === 'SequelizeValidationError') {
        error = handleSequelizeValidationError(err);
    }
    else if (err.name === 'SequelizeUniqueConstraintError') {
        error = handleSequelizeUniqueConstraintError(err);
    }
    else if (err.name === 'SequelizeForeignKeyConstraintError') {
        error = handleSequelizeForeignKeyConstraintError(err);
    }
    else if (err.name === 'JsonWebTokenError') {
        error = handleJWTError();
    }
    else if (err.name === 'TokenExpiredError') {
        error = handleJWTExpiredError();
    }
    else if (err.type === 'entity.too.large') {
        error = new types_1.AppError('Request entity too large', 413, 'ENTITY_TOO_LARGE');
    }
    else if (err.code === 'EBADCSRFTOKEN') {
        error = new types_1.AppError('Invalid CSRF token', 403, 'INVALID_CSRF_TOKEN');
    }
    else if (err.type === 'time-out') {
        error = new types_1.AppError('Request timeout', 408, 'REQUEST_TIMEOUT');
    }
    else if (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT') {
        error = handleMulterError(err);
    }
    if (error.statusCode === 401 || error.statusCode === 403) {
        (0, logger_1.logSecurityEvent)(`Authentication/Authorization failure: ${error.message}`, 'medium', {
            url: req.url,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            statusCode: error.statusCode,
        });
    }
    if (error.statusCode === 429) {
        (0, logger_1.logSecurityEvent)('Rate limit exceeded', 'high', {
            url: req.url,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
        });
    }
    if (process.env['NODE_ENV'] === 'development') {
        sendErrorDev(error, res);
    }
    else {
        sendErrorProd(error, res);
    }
};
exports.globalErrorHandler = globalErrorHandler;
process.on('unhandledRejection', (reason, _promise) => {
    (0, logger_1.logError)('Unhandled Promise Rejection', reason);
    process.exit(1);
});
process.on('uncaughtException', (err) => {
    (0, logger_1.logError)('Uncaught Exception', err);
    process.exit(1);
});
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.catchAsync = catchAsync;
const notFound = (req, _res, next) => {
    const error = new types_1.AppError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
    next(error);
};
exports.notFound = notFound;
//# sourceMappingURL=errorHandler.js.map