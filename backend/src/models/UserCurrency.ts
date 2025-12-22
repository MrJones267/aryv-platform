/**
 * @fileoverview User Currency Preferences model
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import User from './User';
import { Currency } from './Currency';

export interface UserCurrencyAttributes {
  id: string;
  userId: string;
  currencyId: string;
  isPrimary: boolean; // Primary currency for display
  isPaymentEnabled: boolean; // Can use this currency for payments
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCurrencyCreationAttributes extends Optional<UserCurrencyAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class UserCurrency extends Model<UserCurrencyAttributes, UserCurrencyCreationAttributes> implements UserCurrencyAttributes {
  public id!: string;
  public userId!: string;
  public currencyId!: string;
  public isPrimary!: boolean;
  public isPaymentEnabled!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association helpers
  public Currency?: Currency;
  public User?: typeof User;
}

UserCurrency.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    currencyId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'currencies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Primary currency for display purposes',
    },
    isPaymentEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether user can make payments in this currency',
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
    modelName: 'UserCurrency',
    tableName: 'user_currencies',
    indexes: [
      {
        fields: ['userId'],
      },
      {
        fields: ['currencyId'],
      },
      {
        fields: ['userId', 'isPrimary'],
      },
      {
        fields: ['userId', 'currencyId'],
        unique: true,
      },
    ],
  },
);

// Define associations
UserCurrency.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

UserCurrency.belongsTo(Currency, {
  foreignKey: 'currencyId',
  as: 'currency',
});

User.hasMany(UserCurrency, {
  foreignKey: 'userId',
  as: 'currencies',
});

Currency.hasMany(UserCurrency, {
  foreignKey: 'currencyId',
  as: 'userCurrencies',
});

export default UserCurrency;
