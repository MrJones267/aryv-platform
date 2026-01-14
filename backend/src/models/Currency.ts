/**
 * @fileoverview Currency model for multi-currency support
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface CurrencyAttributes {
  id: string;
  code: string; // ISO 4217 currency code (USD, EUR, GBP, etc.)
  name: string; // Currency name (US Dollar, Euro, British Pound)
  symbol: string; // Currency symbol ($, €, £)
  decimalPlaces: number; // Number of decimal places (2 for most currencies)
  isActive: boolean; // Whether currency is available for use
  exchangeRate: number; // Exchange rate relative to base currency (USD)
  lastUpdated: Date; // Last time exchange rate was updated
  countryCode?: string; // ISO country code
  flag?: string; // Country flag emoji or URL
  region?: string; // Geographic region (North America, Europe, Africa, etc.)
  isPopular?: boolean; // Whether currency is popular/commonly used
  createdAt: Date;
  updatedAt: Date;
}

export interface CurrencyCreationAttributes extends Optional<CurrencyAttributes, 'id' | 'createdAt' | 'updatedAt' | 'countryCode' | 'flag' | 'region' | 'isPopular'> {}

export class Currency extends Model<CurrencyAttributes, CurrencyCreationAttributes> implements CurrencyAttributes {
  public id!: string;
  public code!: string;
  public name!: string;
  public symbol!: string;
  public decimalPlaces!: number;
  public isActive!: boolean;
  public exchangeRate!: number;
  public lastUpdated!: Date;
  public countryCode?: string;
  public flag?: string;
  public region?: string;
  public isPopular?: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Helper methods
  public formatAmount(amount: number): string {
    return `${this.symbol}${amount.toFixed(this.decimalPlaces)}`;
  }

  public convertFromUSD(usdAmount: number): number {
    return parseFloat((usdAmount * this.exchangeRate).toFixed(this.decimalPlaces));
  }

  public convertToUSD(amount: number): number {
    return parseFloat((amount / this.exchangeRate).toFixed(2));
  }
}

Currency.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(3),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 3],
        isUppercase: true,
      },
      comment: 'ISO 4217 currency code',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Full currency name',
    },
    symbol: {
      type: DataTypes.STRING(5),
      allowNull: false,
      comment: 'Currency symbol',
    },
    decimalPlaces: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      validate: {
        min: 0,
        max: 4,
      },
      comment: 'Number of decimal places for currency',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether currency is available for transactions',
    },
    exchangeRate: {
      type: DataTypes.DECIMAL(15, 6),
      allowNull: false,
      defaultValue: 1.0,
      validate: {
        min: 0.000001,
      },
      comment: 'Exchange rate relative to USD base currency',
    },
    lastUpdated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Last time exchange rate was updated',
    },
    countryCode: {
      type: DataTypes.STRING(2),
      allowNull: true,
      validate: {
        len: [2, 2],
        isUppercase: true,
      },
      comment: 'ISO country code',
    },
    flag: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Country flag emoji or icon reference',
    },
    region: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Geographic region (North America, Europe, Africa, etc.)',
    },
    isPopular: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Whether currency is popular/commonly used',
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
    modelName: 'Currency',
    tableName: 'currencies',
    indexes: [
      {
        fields: ['code'],
        unique: true,
      },
      {
        fields: ['isActive'],
      },
      {
        fields: ['countryCode'],
      },
    ],
  },
);

export default Currency;
