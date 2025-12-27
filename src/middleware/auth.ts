/**
 * @fileoverview Authentication middleware for JWT token verification
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-20
 */

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/AuthService';
import { User as UserModel } from '../models';
import { AdminUser } from '../models/AdminUser';
import { AuthenticatedRequest, UserRole, AppError, User } from '../types';

/**
 * Middleware to authenticate JWT token
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token is required',
        code: 'ACCESS_TOKEN_REQUIRED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verify token
    const decoded = AuthService.verifyToken(token);

    // Get fresh user data
    const user = await UserModel.findByPk(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check if user account is active
    if (user.status === 'suspended' || user.status === 'deactivated') {
      res.status(403).json({
        success: false,
        error: 'Account is suspended or deactivated',
        code: 'ACCOUNT_SUSPENDED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Attach user to request (toSafeObject returns full user without password/refreshToken)
    req.user = user.toSafeObject() as User;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    console.error(`[${new Date().toISOString()}] Authentication error:`, {
      error: (error as Error).message,
      url: req.url,
      method: req.method,
    });

    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTHENTICATION_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Middleware to authorize specific roles
 */
export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      _res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      _res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user is verified
 */
export const requireVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!req.user.isEmailVerified) {
    res.status(403).json({
      success: false,
      error: 'Email verification required',
      code: 'EMAIL_VERIFICATION_REQUIRED',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
};

/**
 * Middleware to check if user owns the resource
 */
export const requireOwnership = (userIdField: string = 'userId') => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      _res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const resourceUserId = req.params[userIdField] || req.body[userIdField];

    if (req.user.role !== UserRole.ADMIN && req.user.id !== resourceUserId) {
      _res.status(403).json({
        success: false,
        error: 'Access denied: You can only access your own resources',
        code: 'ACCESS_DENIED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};

/**
 * Optional authentication middleware - does not fail if no token provided
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
      const decoded = AuthService.verifyToken(token);
      const user = await UserModel.findByPk(decoded.userId);

      if (user && user.status === 'active') {
        req.user = user.toSafeObject() as User;
      }
    }

    next();
  } catch (error) {
    // Silently continue without authentication for optional auth
    next();
  }
};

/**
 * Middleware to authenticate admin JWT token
 */
export const authenticateAdminToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Access token is required',
        code: 'ACCESS_TOKEN_REQUIRED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env['JWT_SECRET'] || 'your-secret-key',
    ) as any;

    // Check if token is for admin access
    if (decoded.type !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'ADMIN_ACCESS_REQUIRED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Find admin user in database
    const admin = await AdminUser.findByPk(decoded.id);
    if (!admin || !admin.isActive) {
      res.status(401).json({
        success: false,
        error: 'Admin not found or inactive',
        code: 'ADMIN_NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Attach admin user to request
    req.user = admin.toSafeObject() as any;

    next();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Admin authentication error:`, {
      error: (error as Error).message,
      url: req.url,
      method: req.method,
    });

    res.status(401).json({
      success: false,
      error: 'Invalid or expired admin token',
      code: 'INVALID_ADMIN_TOKEN',
      timestamp: new Date().toISOString(),
    });
  }
};
