/**
 * @fileoverview An email address left on the website to hear when ARYV launches
 * @author Oabona-Majoko
 * @created 2026-11-12
 * @lastModified 2026-11-13
 */

import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/database';

export interface LaunchSignupModel extends Model<InferAttributes<LaunchSignupModel>, InferCreationAttributes<LaunchSignupModel>> {
  id: CreationOptional<string>;
  /** Always lower-case, so each address is kept once. */
  email: string;
  /** 'android' or 'ios'; null when the visitor did not say. */
  platform: CreationOptional<'android' | 'ios' | null>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const LaunchSignup = sequelize.define<LaunchSignupModel>(
  'launch_signups',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING(254), allowNull: false },
    platform: { type: DataTypes.STRING(10), allowNull: true, validate: { isIn: [['android', 'ios']] } },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  {
    tableName: 'launch_signups',
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['email'] }],
  },
);

export { LaunchSignup };
export default LaunchSignup;
