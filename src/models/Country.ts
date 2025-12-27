/**
 * @fileoverview Country model for country reference data
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface CountryAttributes {
  id: string;
  code: string; // ISO 3166-1 alpha-2 country code
  name: string; // Common country name
  nameOfficial?: string; // Official country name
  flag?: string; // Flag emoji
  continent: string;
  region: string;
  subRegion?: string;
  capital?: string;
  phonePrefix?: string;
  timezones: string[]; // Array of IANA timezone identifiers
  languages: string[]; // Array of ISO 639-1 language codes
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CountryCreationAttributes extends Optional<CountryAttributes, 'id' | 'createdAt' | 'updatedAt' | 'nameOfficial' | 'flag' | 'subRegion' | 'capital' | 'phonePrefix'> {}

export class Country extends Model<CountryAttributes, CountryCreationAttributes> implements CountryAttributes {
  public id!: string;
  public code!: string;
  public name!: string;
  public nameOfficial?: string;
  public flag?: string;
  public continent!: string;
  public region!: string;
  public subRegion?: string;
  public capital?: string;
  public phonePrefix?: string;
  public timezones!: string[];
  public languages!: string[];
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Helper methods
  public getPrimaryTimezone(): string {
    return this.timezones[0] || 'UTC';
  }

  public getPrimaryLanguage(): string {
    return this.languages[0] || 'en';
  }

  public getPhoneNumber(localNumber: string): string {
    if (!this.phonePrefix) return localNumber;
    return `${this.phonePrefix}${localNumber.replace(/^0+/, '')}`;
  }

  public isInRegion(region: string): boolean {
    return this.region.toLowerCase().includes(region.toLowerCase()) ||
           this.continent.toLowerCase().includes(region.toLowerCase());
  }
}

Country.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(2),
      allowNull: false,
      unique: true,
      validate: {
        len: [2, 2],
        isUppercase: true,
      },
      comment: 'ISO 3166-1 alpha-2 country code',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Common country name for display',
    },
    nameOfficial: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'name_official',
      comment: 'Official country name',
    },
    flag: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Country flag emoji or icon reference',
    },
    continent: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Continent name',
    },
    region: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Geographic region',
    },
    subRegion: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'sub_region',
      comment: 'Geographic sub-region',
    },
    capital: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Capital city',
    },
    phonePrefix: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'phone_prefix',
      comment: 'International dialing prefix',
    },
    timezones: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: ['UTC'],
      comment: 'Array of IANA timezone identifiers',
    },
    languages: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: ['en'],
      comment: 'Array of ISO 639-1 language codes',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
      comment: 'Whether country is available for user selection',
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
    sequelize,
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
  },
);

export default Country;
