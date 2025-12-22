/**
 * @fileoverview Admin User model for ARYV platform
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional } from 'sequelize';
import bcrypt from 'bcryptjs';
import { sequelize } from '../config/database';

// Admin user attributes interface
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

// Optional attributes for creation
interface AdminUserCreationAttributes
  extends Optional<AdminUserAttributes, 'id' | 'lastLogin' | 'failedLoginAttempts' | 'lockoutUntil' | 'twoFactorSecret' | 'createdAt' | 'updatedAt'> {}

// Admin user model class
export class AdminUser extends Model<AdminUserAttributes, AdminUserCreationAttributes> implements AdminUserAttributes {
  public id!: string;
  public email!: string;
  public passwordHash!: string;
  public firstName!: string;
  public lastName!: string;
  public role!: 'super_admin' | 'admin' | 'moderator';
  public permissions!: string[];
  public isActive!: boolean;
  public lastLogin!: Date | null;
  public failedLoginAttempts!: number;
  public lockoutUntil!: Date | null;
  public twoFactorSecret!: string | null;
  public twoFactorEnabled!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
  }

  public async setPassword(password: string): Promise<void> {
    const saltRounds = 12;
    this.passwordHash = await bcrypt.hash(password, saltRounds);
  }

  public incrementFailedAttempts(): void {
    this.failedLoginAttempts += 1;

    // Lock account after 5 failed attempts for 30 minutes
    if (this.failedLoginAttempts >= 5) {
      this.lockoutUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
  }

  public resetFailedAttempts(): void {
    this.failedLoginAttempts = 0;
    this.lockoutUntil = null;
  }

  public isAccountLocked(): boolean {
    return this.lockoutUntil !== null && this.lockoutUntil > new Date();
  }

  public updateLastLogin(): void {
    this.lastLogin = new Date();
  }

  public toSafeObject(): Partial<AdminUserAttributes> {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      permissions: this.permissions,
      isActive: this.isActive,
      lastLogin: this.lastLogin,
      twoFactorEnabled: this.twoFactorEnabled,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // Static methods
  public static async findByEmail(email: string): Promise<AdminUser | null> {
    return this.findOne({ where: { email: email.toLowerCase() } });
  }

  public static async createAdmin(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'super_admin' | 'admin' | 'moderator';
    permissions: string[];
  }): Promise<AdminUser> {
    const admin = this.build({
      email: userData.email.toLowerCase(),
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      permissions: userData.permissions,
      isActive: true,
      failedLoginAttempts: 0,
      twoFactorEnabled: false,
      passwordHash: '', // Will be set by setPassword
    });

    await admin.setPassword(userData.password);
    await admin.save();

    return admin;
  }
}

// Initialize the model
AdminUser.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
      set(value: string) {
        this.setDataValue('email', value.toLowerCase());
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
    role: {
      type: DataTypes.ENUM('super_admin', 'admin', 'moderator'),
      allowNull: false,
      defaultValue: 'admin',
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lockoutUntil: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    twoFactorSecret: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'AdminUser',
    tableName: 'admin_users',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['email'],
      },
      {
        fields: ['role'],
      },
      {
        fields: ['isActive'],
      },
    ],
  },
);

export default AdminUser;
