/**
 * @fileoverview Structured logging utility with winston
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-20
 */

import winston from 'winston';
import path from 'path';

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info['timestamp']} ${info.level}: ${info.message}`,
  ),
);

// File format (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format,
    level: process.env['LOG_LEVEL'] || 'debug',
  }),

  // Error log file
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  // Combined log file
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Create logger instance
const Logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'debug',
  levels,
  transports,
  exitOnError: false,
  handleExceptions: true,
  handleRejections: true,
});

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any): void => {
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
    } else {
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

// Structured logging methods
export const logError = (message: string, error: Error, context?: any): void => {
  Logger.error(message, {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

export const logWarning = (message: string, context?: any): void => {
  Logger.warn(message, {
    timestamp: new Date().toISOString(),
    ...context,
  });
};

export const logInfo = (message: string, context?: any): void => {
  Logger.info(message, {
    timestamp: new Date().toISOString(),
    ...context,
  });
};

export const logDebug = (message: string, context?: any): void => {
  Logger.debug(message, {
    timestamp: new Date().toISOString(),
    ...context,
  });
};

// Database query logger
export const logDatabaseQuery = (query: string, duration: number, context?: any): void => {
  Logger.debug('Database Query', {
    query,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

// Authentication logger
export const logAuthEvent = (event: string, userId?: string, context?: any): void => {
  Logger.info(`Auth Event: ${event}`, {
    userId,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

// Security logger
export const logSecurityEvent = (event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: any): void => {
  const logMethod = severity === 'critical' || severity === 'high' ? Logger.error : Logger.warn;

  logMethod(`Security Event: ${event}`, {
    severity,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

// Error handling utilities for unknown error types
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
};

export const getErrorStack = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.stack;
  return undefined;
};

// Alias for consistency
export const logWarn = logWarning;

export default Logger;
