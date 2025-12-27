"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInput = exports.rideSchemas = exports.vehicleSchemas = exports.userSchemas = exports.authSchemas = exports.commonSchemas = exports.validateRequest = void 0;
const joi_1 = __importDefault(require("joi"));
const validateRequest = (schema) => {
    return (req, res, next) => {
        const errors = [];
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
exports.validateRequest = validateRequest;
exports.commonSchemas = {
    uuid: joi_1.default.string().uuid().required(),
    pagination: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(20),
    }),
    coordinates: joi_1.default.object({
        latitude: joi_1.default.number().min(-90).max(90).required(),
        longitude: joi_1.default.number().min(-180).max(180).required(),
    }),
    location: joi_1.default.object({
        address: joi_1.default.string().min(10).max(500).required(),
        latitude: joi_1.default.number().min(-90).max(90).required(),
        longitude: joi_1.default.number().min(-180).max(180).required(),
        city: joi_1.default.string().min(1).max(100),
        state: joi_1.default.string().min(1).max(100),
        country: joi_1.default.string().min(1).max(100),
        postalCode: joi_1.default.string().min(1).max(20),
    }),
};
exports.authSchemas = {
    register: joi_1.default.object({
        email: joi_1.default.string().email().required(),
        password: joi_1.default.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required().messages({
            'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
        }),
        phone: joi_1.default.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
        firstName: joi_1.default.string().min(1).max(50).required(),
        lastName: joi_1.default.string().min(1).max(50).required(),
        role: joi_1.default.string().valid('passenger', 'driver', 'admin', 'courier').default('passenger'),
        dateOfBirth: joi_1.default.date().iso().max('now').optional(),
    }),
    login: joi_1.default.object({
        email: joi_1.default.string().email().required(),
        password: joi_1.default.string().min(1).required(),
    }),
    refreshToken: joi_1.default.object({
        refreshToken: joi_1.default.string().required(),
    }),
};
exports.userSchemas = {
    updateProfile: joi_1.default.object({
        firstName: joi_1.default.string().min(1).max(50).optional(),
        lastName: joi_1.default.string().min(1).max(50).optional(),
        phone: joi_1.default.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
        dateOfBirth: joi_1.default.date().iso().max('now').optional(),
        profilePicture: joi_1.default.string().uri().optional(),
    }),
    changePassword: joi_1.default.object({
        currentPassword: joi_1.default.string().required(),
        newPassword: joi_1.default.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required().messages({
            'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
        }),
    }),
};
exports.vehicleSchemas = {
    create: joi_1.default.object({
        make: joi_1.default.string().min(1).max(50).required(),
        model: joi_1.default.string().min(1).max(50).required(),
        year: joi_1.default.number().integer().min(1980).max(new Date().getFullYear() + 1).required(),
        color: joi_1.default.string().min(1).max(30).required(),
        licensePlate: joi_1.default.string().min(1).max(20).required(),
        type: joi_1.default.string().valid('sedan', 'suv', 'hatchback', 'minivan', 'motorcycle', 'bicycle').required(),
        capacity: joi_1.default.number().integer().min(1).max(8).required(),
        registrationDocument: joi_1.default.string().uri().optional(),
        insuranceDocument: joi_1.default.string().uri().optional(),
        inspectionExpiry: joi_1.default.date().iso().greater('now').optional(),
    }),
    update: joi_1.default.object({
        make: joi_1.default.string().min(1).max(50).optional(),
        model: joi_1.default.string().min(1).max(50).optional(),
        year: joi_1.default.number().integer().min(1980).max(new Date().getFullYear() + 1).optional(),
        color: joi_1.default.string().min(1).max(30).optional(),
        licensePlate: joi_1.default.string().min(1).max(20).optional(),
        type: joi_1.default.string().valid('sedan', 'suv', 'hatchback', 'minivan', 'motorcycle', 'bicycle').optional(),
        capacity: joi_1.default.number().integer().min(1).max(8).optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'maintenance', 'suspended').optional(),
        registrationDocument: joi_1.default.string().uri().optional(),
        insuranceDocument: joi_1.default.string().uri().optional(),
        inspectionExpiry: joi_1.default.date().iso().greater('now').optional(),
    }),
};
exports.rideSchemas = {
    create: joi_1.default.object({
        vehicleId: joi_1.default.string().uuid().required(),
        originAddress: joi_1.default.string().min(10).max(500).required(),
        originCoordinates: exports.commonSchemas.coordinates.required(),
        destinationAddress: joi_1.default.string().min(10).max(500).required(),
        destinationCoordinates: exports.commonSchemas.coordinates.required(),
        departureTime: joi_1.default.date().iso().greater('now').required(),
        availableSeats: joi_1.default.number().integer().min(1).max(7).required(),
        pricePerSeat: joi_1.default.number().precision(2).min(0.01).max(10000).required(),
        description: joi_1.default.string().max(1000).optional(),
        estimatedDuration: joi_1.default.number().integer().min(1).max(1440).optional(),
        distance: joi_1.default.number().precision(2).min(0.1).max(2000).optional(),
    }),
    update: joi_1.default.object({
        departureTime: joi_1.default.date().iso().greater('now').optional(),
        availableSeats: joi_1.default.number().integer().min(1).max(7).optional(),
        pricePerSeat: joi_1.default.number().precision(2).min(0.01).max(10000).optional(),
        description: joi_1.default.string().max(1000).optional(),
        status: joi_1.default.string().valid('pending', 'confirmed', 'cancelled').optional(),
    }),
    search: joi_1.default.object({
        originLat: joi_1.default.number().min(-90).max(90).required(),
        originLng: joi_1.default.number().min(-180).max(180).required(),
        destinationLat: joi_1.default.number().min(-90).max(90).required(),
        destinationLng: joi_1.default.number().min(-180).max(180).required(),
        departureDate: joi_1.default.date().iso().greater('now').required(),
        passengers: joi_1.default.number().integer().min(1).max(7).required(),
        maxDistance: joi_1.default.number().min(0.1).max(50).default(10),
        maxPrice: joi_1.default.number().min(0.01).optional(),
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(50).default(20),
    }),
};
exports.validateInput = exports.validateRequest;
//# sourceMappingURL=validation.js.map