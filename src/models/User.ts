/**
 * @fileoverview User model with Sequelize and TypeScript
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-20
 */

import {
  Model,
  DataTypes,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from 'sequelize';
import bcrypt from 'bcryptjs';
import { sequelize } from '../config/database';
import { UserRole, UserStatus } from '../types';

// User model interface
export interface UserModel extends Model<
  InferAttributes<UserModel>,
  InferCreationAttributes<UserModel>
> {
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

  // Virtual attributes
  fullName: NonAttribute<string>;

  // Instance methods
  comparePassword(password: string): Promise<boolean>;
  toSafeObject(): Omit<UserModel, 'password'>;
}

// Define User model
const User = sequelize.define<UserModel>(
  'users',
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
        isEmail: {
          msg: 'Please provide a valid email address',
        },
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'password_hash',
      validate: {
        len: {
          args: [8, 128],
          msg: 'Password must be between 8 and 128 characters',
        },
      },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'phone_number',
      validate: {
        is: {
          args: /^\+?[1-9]\d{1,14}$/,
          msg: 'Please provide a valid phone number',
        },
      },
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'first_name',
      validate: {
        len: {
          args: [1, 50],
          msg: 'First name must be between 1 and 50 characters',
        },
      },
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'last_name',
      validate: {
        len: {
          args: [1, 50],
          msg: 'Last name must be between 1 and 50 characters',
        },
      },
    },
    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      allowNull: false,
      defaultValue: UserRole.PASSENGER,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(UserStatus)),
      allowNull: false,
      defaultValue: UserStatus.ACTIVE,
    },
    profilePicture: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'profile_image',
      validate: {
        isUrl: {
          msg: 'Profile picture must be a valid URL',
        },
      },
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isBefore: {
          args: new Date().toISOString(),
          msg: 'Date of birth cannot be in the future',
        },
        isAdult(value: Date) {
          if (value) {
            const age = new Date().getFullYear() - value.getFullYear();
            if (age < 18) {
              throw new Error('User must be at least 18 years old');
            }
          }
        },
      },
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'is_verified',
      defaultValue: false,
    },
    isPhoneVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'is_active',
      defaultValue: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login',
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'refresh_token',
    },
    countryCode: {
      type: DataTypes.STRING(2),
      allowNull: true,
      field: 'country_code',
      validate: {
        len: [2, 2],
        isUppercase: true,
      },
      comment: 'ISO 3166-1 alpha-2 country code',
    },
    countryName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'country_name',
      comment: 'Full country name for display',
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'timezone',
      comment: 'User timezone (e.g., America/New_York)',
    },
    deactivatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deactivated_at',
    },
    deactivationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'deactivation_reason',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    paranoid: false, // No soft delete for this table
    indexes: [
      {
        fields: ['email'],
      },
      {
        fields: ['phone'],
      },
      {
        fields: ['role'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['country_code'],
      },
    ],
    getterMethods: {
      fullName() {
        return `${this.firstName} ${this.lastName}`;
      },
    },
  },
);

// Hash password before creating user
User.beforeCreate(async (user: UserModel) => {
  if (user.password) {
    const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '12');
    user.password = await bcrypt.hash(user.password, saltRounds);
  }
});

// Hash password before updating user
User.beforeUpdate(async (user: UserModel) => {
  if (user.changed('password')) {
    const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '12');
    user.password = await bcrypt.hash(user.password, saltRounds);
  }
});

// Instance method to compare password
(User.prototype as any).comparePassword = async function(this: UserModel, password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

// Instance method to return safe user object (without sensitive fields)
(User.prototype as any).toSafeObject = function(this: UserModel) {
  const { password, ...safeUser } = this.toJSON();
  return safeUser;
};

export default User;
