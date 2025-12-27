"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUser = void 0;
const sequelize_1 = require("sequelize");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
class AdminUser extends sequelize_1.Model {
    async validatePassword(password) {
        return bcryptjs_1.default.compare(password, this.passwordHash);
    }
    async setPassword(password) {
        const saltRounds = 12;
        this.passwordHash = await bcryptjs_1.default.hash(password, saltRounds);
    }
    incrementFailedAttempts() {
        this.failedLoginAttempts += 1;
        if (this.failedLoginAttempts >= 5) {
            this.lockoutUntil = new Date(Date.now() + 30 * 60 * 1000);
        }
    }
    resetFailedAttempts() {
        this.failedLoginAttempts = 0;
        this.lockoutUntil = null;
    }
    isAccountLocked() {
        return this.lockoutUntil !== null && this.lockoutUntil > new Date();
    }
    updateLastLogin() {
        this.lastLogin = new Date();
    }
    toSafeObject() {
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
    static async findByEmail(email) {
        return this.findOne({ where: { email: email.toLowerCase() } });
    }
    static async createAdmin(userData) {
        const admin = this.build({
            email: userData.email.toLowerCase(),
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
            permissions: userData.permissions,
            isActive: true,
            failedLoginAttempts: 0,
            twoFactorEnabled: false,
            passwordHash: '',
        });
        await admin.setPassword(userData.password);
        await admin.save();
        return admin;
    }
}
exports.AdminUser = AdminUser;
AdminUser.init({
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
            isEmail: true,
        },
        set(value) {
            this.setDataValue('email', value.toLowerCase());
        },
    },
    passwordHash: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    firstName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [2, 50],
        },
    },
    lastName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [2, 50],
        },
    },
    role: {
        type: sequelize_1.DataTypes.ENUM('super_admin', 'admin', 'moderator'),
        allowNull: false,
        defaultValue: 'admin',
    },
    permissions: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    lastLogin: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    failedLoginAttempts: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    lockoutUntil: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    twoFactorSecret: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    twoFactorEnabled: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
}, {
    sequelize: database_1.sequelize,
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
});
exports.default = AdminUser;
//# sourceMappingURL=AdminUser.js.map