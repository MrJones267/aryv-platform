"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
const types_1 = require("../types");
const User = database_1.sequelize.define('users', {
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    email: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: {
                msg: 'Please provide a valid email address',
            },
        },
    },
    password: {
        type: sequelize_1.DataTypes.STRING,
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
        type: sequelize_1.DataTypes.STRING,
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
        type: sequelize_1.DataTypes.STRING,
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
        type: sequelize_1.DataTypes.STRING,
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
        type: sequelize_1.DataTypes.ENUM(...Object.values(types_1.UserRole)),
        allowNull: false,
        defaultValue: types_1.UserRole.PASSENGER,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(types_1.UserStatus)),
        allowNull: false,
        defaultValue: types_1.UserStatus.ACTIVE,
    },
    profilePicture: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        field: 'profile_image',
        validate: {
            isUrl: {
                msg: 'Profile picture must be a valid URL',
            },
        },
    },
    dateOfBirth: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true,
        validate: {
            isBefore: {
                args: new Date().toISOString(),
                msg: 'Date of birth cannot be in the future',
            },
            isAdult(value) {
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
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: true,
        field: 'is_verified',
        defaultValue: false,
    },
    isPhoneVerified: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: true,
        field: 'is_active',
        defaultValue: true,
    },
    lastLoginAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'last_login',
    },
    refreshToken: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        field: 'refresh_token',
    },
    countryCode: {
        type: sequelize_1.DataTypes.STRING(2),
        allowNull: true,
        field: 'country_code',
        validate: {
            len: [2, 2],
            isUppercase: true,
        },
        comment: 'ISO 3166-1 alpha-2 country code',
    },
    countryName: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        field: 'country_name',
        comment: 'Full country name for display',
    },
    timezone: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        field: 'timezone',
        comment: 'User timezone (e.g., America/New_York)',
    },
    deactivatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        field: 'deactivated_at',
    },
    deactivationReason: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        field: 'deactivation_reason',
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
    },
}, {
    tableName: 'users',
    timestamps: true,
    paranoid: false,
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
});
User.beforeCreate(async (user) => {
    if (user.password) {
        const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '12');
        user.password = await bcryptjs_1.default.hash(user.password, saltRounds);
    }
});
User.beforeUpdate(async (user) => {
    if (user.changed('password')) {
        const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '12');
        user.password = await bcryptjs_1.default.hash(user.password, saltRounds);
    }
});
User.prototype.comparePassword = async function (password) {
    return bcryptjs_1.default.compare(password, this.password);
};
User.prototype.toSafeObject = function () {
    const { password, ...safeUser } = this.toJSON();
    return safeUser;
};
exports.default = User;
//# sourceMappingURL=User.js.map