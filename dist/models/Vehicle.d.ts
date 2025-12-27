import { Model, CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey, NonAttribute } from 'sequelize';
import { VehicleType, VehicleStatus } from '../types';
import type { UserModel } from './User';
export interface VehicleModel extends Model<InferAttributes<VehicleModel>, InferCreationAttributes<VehicleModel>> {
    id: CreationOptional<string>;
    driverId: ForeignKey<string>;
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    type: VehicleType;
    capacity: number;
    status: CreationOptional<VehicleStatus>;
    isVerified: CreationOptional<boolean>;
    registrationDocument: CreationOptional<string | null>;
    insuranceDocument: CreationOptional<string | null>;
    inspectionExpiry: CreationOptional<Date | null>;
    verificationSubmittedAt: CreationOptional<Date | null>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
    driver?: NonAttribute<UserModel>;
    displayName: NonAttribute<string>;
}
declare const Vehicle: import("sequelize").ModelCtor<VehicleModel>;
export default Vehicle;
//# sourceMappingURL=Vehicle.d.ts.map