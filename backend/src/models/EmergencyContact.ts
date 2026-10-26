/**
 * @fileoverview Someone to reach when a user raises an emergency.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * This replaces the single emergencyContactName/emergencyContactPhone pair on
 * users. One contact is not enough for a feature whose entire job is reaching
 * somebody: the one person may not answer, and there is no second attempt.
 *
 * `phone` is stored E.164 so it can be dialled or texted without re-parsing at
 * the moment it matters most. Exactly one contact per user may be primary,
 * enforced by a partial unique index in migration 022.
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

export interface EmergencyContactModel extends Model<
  InferAttributes<EmergencyContactModel>,
  InferCreationAttributes<EmergencyContactModel>
> {
  id: CreationOptional<string>;
  userId: ForeignKey<string>;

  name: string;
  phone: string;
  relationship: CreationOptional<string | null>;

  isPrimary: CreationOptional<boolean>;
  /** Order the non-primary contacts are tried in. Lower goes first. */
  priority: CreationOptional<number>;

  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const EmergencyContact = sequelize.define<EmergencyContactModel>(
  'emergency_contacts',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: { model: 'users', key: 'id' },
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { notEmpty: true },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        // Mirrors the CHECK constraint. A contact that cannot be dialled is
        // not a contact.
        is: /^\+[1-9][0-9]{6,17}$/,
      },
    },
    relationship: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_primary',
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    tableName: 'emergency_contacts',
    timestamps: true,
    underscored: true,
  },
);

export default EmergencyContact;
