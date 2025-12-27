"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Country = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Country extends sequelize_1.Model {
    getPrimaryTimezone() {
        return this.timezones[0] || 'UTC';
    }
    getPrimaryLanguage() {
        return this.languages[0] || 'en';
    }
    getPhoneNumber(localNumber) {
        if (!this.phonePrefix)
            return localNumber;
        return `${this.phonePrefix}${localNumber.replace(/^0+/, '')}`;
    }
    isInRegion(region) {
        return this.region.toLowerCase().includes(region.toLowerCase()) ||
            this.continent.toLowerCase().includes(region.toLowerCase());
    }
}
exports.Country = Country;
Country.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    code: {
        type: sequelize_1.DataTypes.STRING(2),
        allowNull: false,
        unique: true,
        validate: {
            len: [2, 2],
            isUppercase: true,
        },
        comment: 'ISO 3166-1 alpha-2 country code',
    },
    name: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        comment: 'Common country name for display',
    },
    nameOfficial: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: true,
        field: 'name_official',
        comment: 'Official country name',
    },
    flag: {
        type: sequelize_1.DataTypes.STRING(10),
        allowNull: true,
        comment: 'Country flag emoji or icon reference',
    },
    continent: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        comment: 'Continent name',
    },
    region: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        comment: 'Geographic region',
    },
    subRegion: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        field: 'sub_region',
        comment: 'Geographic sub-region',
    },
    capital: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        comment: 'Capital city',
    },
    phonePrefix: {
        type: sequelize_1.DataTypes.STRING(10),
        allowNull: true,
        field: 'phone_prefix',
        comment: 'International dialing prefix',
    },
    timezones: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: false,
        defaultValue: ['UTC'],
        comment: 'Array of IANA timezone identifiers',
    },
    languages: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: false,
        defaultValue: ['en'],
        comment: 'Array of ISO 639-1 language codes',
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
        comment: 'Whether country is available for user selection',
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
    sequelize: database_1.sequelize,
    modelName: 'Country',
    tableName: 'countries',
    indexes: [
        {
            fields: ['code'],
            unique: true,
        },
        {
            fields: ['continent'],
        },
        {
            fields: ['region'],
        },
        {
            fields: ['is_active'],
        },
        {
            fields: ['name'],
        },
    ],
});
exports.default = Country;
//# sourceMappingURL=Country.js.map