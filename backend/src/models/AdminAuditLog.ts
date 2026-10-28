/**
 * @fileoverview A record of something an admin did
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * The admin_audit_logs table has existed since migration 003 (and 027 in
 * production), but there was no model and nothing wrote to it. Rows are
 * written by AuditService and never updated.
 */

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface AdminAuditLogAttributes {
  id: string;
  adminUserId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

type AdminAuditLogCreation = Optional<AdminAuditLogAttributes, 'id' | 'resourceId' | 'details' | 'ipAddress' | 'userAgent' | 'createdAt'>;

export class AdminAuditLog extends Model<AdminAuditLogAttributes, AdminAuditLogCreation> implements AdminAuditLogAttributes {
  public id!: string;
  public adminUserId!: string;
  public action!: string;
  public resourceType!: string;
  public resourceId!: string | null;
  public details!: Record<string, unknown> | null;
  public ipAddress!: string | null;
  public userAgent!: string | null;
  public createdAt!: Date;
}

AdminAuditLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    adminUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'admin_user_id',
      references: { model: 'admin_users', key: 'id' },
    },
    action: { type: DataTypes.STRING(100), allowNull: false },
    resourceType: { type: DataTypes.STRING(50), allowNull: false, field: 'resource_type' },
    resourceId: { type: DataTypes.STRING(255), allowNull: true, field: 'resource_id' },
    details: { type: DataTypes.JSONB, allowNull: true },
    ipAddress: { type: DataTypes.INET, allowNull: true, field: 'ip_address' },
    userAgent: { type: DataTypes.TEXT, allowNull: true, field: 'user_agent' },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  },
  {
    sequelize,
    modelName: 'AdminAuditLog',
    tableName: 'admin_audit_logs',
    // Append-only: no updated_at in the table, and rows are never changed.
    timestamps: false,
    indexes: [
      { fields: ['admin_user_id'] },
      { fields: ['action'] },
      { fields: ['resource_type', 'resource_id'] },
      { fields: ['created_at'] },
    ],
  },
);

export default AdminAuditLog;
