/**
 * @fileoverview One person blocking another
 * @author Oabona-Majoko
 * @created 2026-10-31
 * @lastModified 2026-10-31
 */

import {
  Model,
  DataTypes,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  ForeignKey,
} from 'sequelize';
import { sequelize } from '../config/database';

export interface UserBlockModel extends Model<InferAttributes<UserBlockModel>, InferCreationAttributes<UserBlockModel>> {
  id: CreationOptional<string>;
  blockerId: ForeignKey<string>;
  blockedId: ForeignKey<string>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const UserBlock = sequelize.define<UserBlockModel>(
  'user_blocks',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    blockerId: { type: DataTypes.UUID, allowNull: false, field: 'blocker_id', references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    blockedId: { type: DataTypes.UUID, allowNull: false, field: 'blocked_id', references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  {
    tableName: 'user_blocks',
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['blocker_id', 'blocked_id'] }, { fields: ['blocked_id'] }],
  },
);

export { UserBlock };
export default UserBlock;
