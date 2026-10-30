/**
 * @fileoverview A report of a chat message or a person, for an admin to review
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * "Report message" in chat used to thank the person and send nothing.
 * messageExcerpt is the message as it read when reported. resolvedBy is an
 * admin_users id and deliberately not a foreign key to users.
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

export const REPORT_REASONS = ['harassment', 'inappropriate', 'spam', 'scam', 'safety', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];
export const REPORT_OUTCOMES = ['actioned', 'dismissed'] as const;
export type ReportOutcome = typeof REPORT_OUTCOMES[number];

export interface ContentReportModel extends Model<
  InferAttributes<ContentReportModel>,
  InferCreationAttributes<ContentReportModel>
> {
  id: CreationOptional<string>;
  reporterId: ForeignKey<string>;
  reportedUserId: ForeignKey<string>;
  messageId: CreationOptional<string | null>;
  groupChatId: CreationOptional<string | null>;
  messageExcerpt: CreationOptional<string | null>;
  reason: ReportReason;
  details: CreationOptional<string | null>;
  status: CreationOptional<'open' | ReportOutcome>;
  resolutionNotes: CreationOptional<string | null>;
  resolvedBy: CreationOptional<string | null>;
  resolvedAt: CreationOptional<Date | null>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const ContentReport = sequelize.define<ContentReportModel>(
  'content_reports',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    reporterId: { type: DataTypes.UUID, allowNull: false, field: 'reporter_id', references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    reportedUserId: { type: DataTypes.UUID, allowNull: false, field: 'reported_user_id', references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    messageId: { type: DataTypes.UUID, allowNull: true, field: 'message_id' },
    groupChatId: { type: DataTypes.UUID, allowNull: true, field: 'group_chat_id' },
    messageExcerpt: { type: DataTypes.TEXT, allowNull: true, field: 'message_excerpt' },
    reason: { type: DataTypes.STRING(30), allowNull: false, validate: { isIn: [REPORT_REASONS as unknown as string[]] } },
    details: { type: DataTypes.STRING(1000), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'open' },
    resolutionNotes: { type: DataTypes.STRING(1000), allowNull: true, field: 'resolution_notes' },
    resolvedBy: { type: DataTypes.UUID, allowNull: true, field: 'resolved_by' },
    resolvedAt: { type: DataTypes.DATE, allowNull: true, field: 'resolved_at' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  {
    tableName: 'content_reports',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['status', 'created_at'] }, { fields: ['reported_user_id'] }],
  },
);

export { ContentReport };
export default ContentReport;
