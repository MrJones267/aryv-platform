import { Model, CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { UserRole, UserStatus } from '../types';
export interface UserModel extends Model<InferAttributes<UserModel>, InferCreationAttributes<UserModel>> {
    id: CreationOptional<string>;
    email: string;
    password: string;
    phone: CreationOptional<string | null>;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: CreationOptional<UserStatus>;
    profilePicture: CreationOptional<string | null>;
    dateOfBirth: CreationOptional<Date | null>;
    isEmailVerified: CreationOptional<boolean>;
    isPhoneVerified: CreationOptional<boolean>;
    lastLoginAt: CreationOptional<Date | null>;
    refreshToken: CreationOptional<string | null>;
    countryCode: CreationOptional<string | null>;
    countryName: CreationOptional<string | null>;
    timezone: CreationOptional<string | null>;
    deactivatedAt: CreationOptional<Date | null>;
    deactivationReason: CreationOptional<string | null>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
    fullName: NonAttribute<string>;
    comparePassword(password: string): Promise<boolean>;
    toSafeObject(): Omit<UserModel, 'password'>;
}
declare const User: import("sequelize").ModelCtor<UserModel>;
export default User;
//# sourceMappingURL=User.d.ts.map