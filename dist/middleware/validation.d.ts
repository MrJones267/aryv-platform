import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
export declare const validateRequest: (schema: {
    body?: Joi.ObjectSchema;
    params?: Joi.ObjectSchema;
    query?: Joi.ObjectSchema;
}) => (req: Request, res: Response, next: NextFunction) => void;
export declare const commonSchemas: {
    uuid: Joi.StringSchema<string>;
    pagination: Joi.ObjectSchema<any>;
    coordinates: Joi.ObjectSchema<any>;
    location: Joi.ObjectSchema<any>;
};
export declare const authSchemas: {
    register: Joi.ObjectSchema<any>;
    login: Joi.ObjectSchema<any>;
    refreshToken: Joi.ObjectSchema<any>;
};
export declare const userSchemas: {
    updateProfile: Joi.ObjectSchema<any>;
    changePassword: Joi.ObjectSchema<any>;
};
export declare const vehicleSchemas: {
    create: Joi.ObjectSchema<any>;
    update: Joi.ObjectSchema<any>;
};
export declare const rideSchemas: {
    create: Joi.ObjectSchema<any>;
    update: Joi.ObjectSchema<any>;
    search: Joi.ObjectSchema<any>;
};
export declare const validateInput: (schema: {
    body?: Joi.ObjectSchema;
    params?: Joi.ObjectSchema;
    query?: Joi.ObjectSchema;
}) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.d.ts.map