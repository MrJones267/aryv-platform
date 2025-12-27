/**
 * @fileoverview Global error handling middleware
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-20
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationError as SequelizeValidationError } from 'sequelize';
import { AppError } from '../types';
import { logError, logSecurityEvent } from '../utils/logger';

// Development error response
const sendErrorDev = (err: AppError, res: Response): void => {
  res.status(err.statusCode).json({
    success: false,
    error: err.message,
    code: err.code,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });
};

// Production error response
const sendErrorProd = (err: AppError, res: Response): void => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logError('Unexpected error', err);

    res.status(500).json({
      success: false,
      error: 'Something went wrong',
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
};

// Handle Sequelize validation errors
const handleSequelizeValidationError = (err: SequelizeValidationError): AppError => {
  // Map validation errors (currently not used but structure kept for future enhancement)
  const _errors = err.errors.map(error => ({
    field: error.path,
    message: error.message,
    value: error.value,
  }));
  void _errors; // Explicitly mark as intentionally unused

  const message = 'Invalid input data';
  return new AppError(message, 400, 'VALIDATION_ERROR');
};

// Handle Sequelize unique constraint errors
const handleSequelizeUniqueConstraintError = (err: any): AppError => {
  const field = err.errors[0]?.path || 'field';
  const message = `${field} already exists`;
  return new AppError(message, 409, 'DUPLICATE_FIELD_VALUE');
};

// Handle Sequelize foreign key constraint errors
const handleSequelizeForeignKeyConstraintError = (_err: any): AppError => {
  const message = 'Invalid reference to related resource';
  return new AppError(message, 400, 'INVALID_REFERENCE');
};

// Handle JWT errors
const handleJWTError = (): AppError => {
  return new AppError('Invalid token. Please log in again!', 401, 'INVALID_TOKEN');
};

const handleJWTExpiredError = (): AppError => {
  return new AppError('Your token has expired! Please log in again.', 401, 'TOKEN_EXPIRED');
};

// Handle rate limit errors (currently unused but kept for future use)
// const handleRateLimitError = (): AppError => {
//   return new AppError('Too many requests from this IP, please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
// };

// Handle file upload errors
const handleMulterError = (err: any): AppError => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large', 400, 'FILE_TOO_LARGE');
  } else if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files', 400, 'TOO_MANY_FILES');
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected field', 400, 'UNEXPECTED_FIELD');
  }
  return new AppError('File upload error', 400, 'FILE_UPLOAD_ERROR');
};

// Main error handling middleware
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let error = { ...err };
  error.message = err.message;

  // Set default values
  error.statusCode = err.statusCode || 500;
  error.code = err.code || 'INTERNAL_SERVER_ERROR';
  error.isOperational = err.isOperational || false;

  // Log error details
  logError('Global error handler', err, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  });

  // Handle specific error types
  if (err.name === 'SequelizeValidationError') {
    error = handleSequelizeValidationError(err);
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    error = handleSequelizeUniqueConstraintError(err);
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = handleSequelizeForeignKeyConstraintError(err);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  } else if (err.type === 'entity.too.large') {
    error = new AppError('Request entity too large', 413, 'ENTITY_TOO_LARGE');
  } else if (err.code === 'EBADCSRFTOKEN') {
    error = new AppError('Invalid CSRF token', 403, 'INVALID_CSRF_TOKEN');
  } else if (err.type === 'time-out') {
    error = new AppError('Request timeout', 408, 'REQUEST_TIMEOUT');
  } else if (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT') {
    error = handleMulterError(err);
  }

  // Log security events for certain error types
  if (error.statusCode === 401 || error.statusCode === 403) {
    logSecurityEvent(
      `Authentication/Authorization failure: ${error.message}`,
      'medium',
      {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: error.statusCode,
      },
    );
  }

  // Handle rate limiting errors
  if (error.statusCode === 429) {
    logSecurityEvent(
      'Rate limit exceeded',
      'high',
      {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
    );
  }

  // Send error response
  if (process.env['NODE_ENV'] === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error, _promise: Promise<any>) => {
  logError('Unhandled Promise Rejection', reason);

  // Close server gracefully
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logError('Uncaught Exception', err);

  // Close server gracefully
  process.exit(1);
});

// Catch async errors wrapper
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND',
  );
  next(error);
};
