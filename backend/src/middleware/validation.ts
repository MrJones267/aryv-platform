/**
 * @fileoverview Input validation middleware using Joi
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-20
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../types';

/**
 * Middleware factory for request validation
 */
export const validateRequest = (schema: {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: ValidationError[] = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        })));
      }
    }

    // Validate request parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: `params.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value,
        })));
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => ({
          field: `query.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value,
        })));
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};

// Common validation schemas
export const commonSchemas = {
  // UUID parameter validation
  uuid: Joi.string().uuid().required(),

  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),

  // Coordinates validation
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }),

  // Location validation
  location: Joi.object({
    address: Joi.string().min(10).max(500).required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    city: Joi.string().min(1).max(100),
    state: Joi.string().min(1).max(100),
    country: Joi.string().min(1).max(100),
    postalCode: Joi.string().min(1).max(20),
  }),
};

// Authentication validation schemas
export const authSchemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    ).required().messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
    }),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(50).required(),
    role: Joi.string().valid('passenger', 'driver', 'admin', 'courier').default('passenger'),
    dateOfBirth: Joi.date().iso().max('now').optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(1).required(),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

// User validation schemas
export const userSchemas = {
  updateProfile: Joi.object({
    firstName: Joi.string().min(1).max(50).optional(),
    lastName: Joi.string().min(1).max(50).optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    dateOfBirth: Joi.date().iso().max('now').optional(),
    profilePicture: Joi.string().uri().optional(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    ).required().messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
    }),
  }),
};

// Vehicle validation schemas
export const vehicleSchemas = {
  create: Joi.object({
    make: Joi.string().min(1).max(50).required(),
    model: Joi.string().min(1).max(50).required(),
    year: Joi.number().integer().min(1980).max(new Date().getFullYear() + 1).required(),
    color: Joi.string().min(1).max(30).required(),
    licensePlate: Joi.string().min(1).max(20).required(),
    type: Joi.string().valid('sedan', 'suv', 'hatchback', 'minivan', 'motorcycle', 'bicycle').required(),
    capacity: Joi.number().integer().min(1).max(8).required(),
    registrationDocument: Joi.string().uri().optional(),
    insuranceDocument: Joi.string().uri().optional(),
    inspectionExpiry: Joi.date().iso().greater('now').optional(),
  }),

  update: Joi.object({
    make: Joi.string().min(1).max(50).optional(),
    model: Joi.string().min(1).max(50).optional(),
    year: Joi.number().integer().min(1980).max(new Date().getFullYear() + 1).optional(),
    color: Joi.string().min(1).max(30).optional(),
    licensePlate: Joi.string().min(1).max(20).optional(),
    type: Joi.string().valid('sedan', 'suv', 'hatchback', 'minivan', 'motorcycle', 'bicycle').optional(),
    capacity: Joi.number().integer().min(1).max(8).optional(),
    status: Joi.string().valid('active', 'inactive', 'maintenance', 'suspended').optional(),
    registrationDocument: Joi.string().uri().optional(),
    insuranceDocument: Joi.string().uri().optional(),
    inspectionExpiry: Joi.date().iso().greater('now').optional(),
  }),
};

// Ride validation schemas
export const rideSchemas = {
  create: Joi.object({
    vehicleId: Joi.string().uuid().required(),
    originAddress: Joi.string().min(10).max(500).required(),
    originCoordinates: commonSchemas.coordinates.required(),
    destinationAddress: Joi.string().min(10).max(500).required(),
    destinationCoordinates: commonSchemas.coordinates.required(),
    departureTime: Joi.date().iso().greater('now').required(),
    availableSeats: Joi.number().integer().min(1).max(7).required(),
    pricePerSeat: Joi.number().precision(2).min(0.01).max(10000).required(),
    description: Joi.string().max(1000).optional(),
    estimatedDuration: Joi.number().integer().min(1).max(1440).optional(),
    distance: Joi.number().precision(2).min(0.1).max(2000).optional(),
  }),

  update: Joi.object({
    departureTime: Joi.date().iso().greater('now').optional(),
    availableSeats: Joi.number().integer().min(1).max(7).optional(),
    pricePerSeat: Joi.number().precision(2).min(0.01).max(10000).optional(),
    description: Joi.string().max(1000).optional(),
    status: Joi.string().valid('pending', 'confirmed', 'cancelled').optional(),
  }),

  search: Joi.object({
    originLat: Joi.number().min(-90).max(90).required(),
    originLng: Joi.number().min(-180).max(180).required(),
    destinationLat: Joi.number().min(-90).max(90).required(),
    destinationLng: Joi.number().min(-180).max(180).required(),
    departureDate: Joi.date().iso().greater('now').required(),
    passengers: Joi.number().integer().min(1).max(7).required(),
    maxDistance: Joi.number().min(0.1).max(50).default(10), // km radius
    maxPrice: Joi.number().min(0.01).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
  }),
};

// Alias for compatibility with existing route imports
export const validateInput = validateRequest;
