import { Model, Optional } from 'sequelize';
export interface AdminUserAttributes {
    id: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role: 'super_admin' | 'admin' | 'moderator';
    permissions: string[];
    isActive: boolean;
    lastLogin: Date | null;
    failedLoginAttempts: number;
    lockoutUntil: Date | null;
    twoFactorSecret: string | null;
    twoFactorEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
interface AdminUserCreationAttributes extends Optional<AdminUserAttributes, 'id' | 'lastLogin' | 'failedLoginAttempts' | 'lockoutUntil' | 'twoFactorSecret' | 'createdAt' | 'updatedAt'> {
}
export declare class AdminUser extends Model<AdminUserAttributes, AdminUserCreationAttributes> implements AdminUserAttributes {
    id: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role: 'super_admin' | 'admin' | 'moderator';
    permissions: string[];
    isActive: boolean;
    lastLogin: Date | null;
    failedLoginAttempts: number;
    lockoutUntil: Date | null;
    twoFactorSecret: string | null;
    twoFactorEnabled: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    validatePassword(password: string): Promise<boolean>;
    setPassword(password: string): Promise<void>;
    incrementFailedAttempts(): void;
    resetFailedAttempts(): void;
    isAccountLocked(): boolean;
    updateLastLogin(): void;
    toSafeObject(): Partial<AdminUserAttributes>;
    static findByEmail(email: string): Promise<AdminUser | null>;
    static createAdmin(userData: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        role: 'super_admin' | 'admin' | 'moderator';
        permissions: string[];
    }): Promise<AdminUser>;
}
export default AdminUser;
//# sourceMappingURL=AdminUser.d.ts.map