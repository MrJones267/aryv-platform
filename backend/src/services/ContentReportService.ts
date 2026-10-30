/**
 * @fileoverview Reporting chat messages and people, and admins resolving reports
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * A message can be reported only by someone in the chat it was sent in, and
 * the report is against whoever sent it. A person can be reported directly.
 * The same person reporting the same message (or person) again while the
 * first report is open gets the open report back rather than a duplicate.
 * Resolving tells the reporter it was looked at, without saying what was
 * done to the other person.
 */

import { Op } from 'sequelize';
import ContentReport, { ContentReportModel, REPORT_REASONS, REPORT_OUTCOMES, ReportOutcome, ReportReason } from '../models/ContentReport';
import GroupChatMessage from '../models/GroupChatMessage';
import GroupChatParticipant from '../models/GroupChatParticipant';
import User from '../models/User';
import { notificationService } from './NotificationService';
import logger from '../utils/logger';

// Constants
const CONSTANTS = {
  EXCERPT_MAX: 2000,
  DETAILS_MAX: 1000,
  NOTES_MIN: 5,
  NOTES_MAX: 1000,
};

export class ReportError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export interface CreateReportInput {
  messageId?: string;
  reportedUserId?: string;
  reason: string;
  details?: string;
}

const userSummary = (u: any) => u && ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, status: u.status });

class ContentReportService {
  async create(reporterId: string, input: CreateReportInput): Promise<{ report: ContentReportModel; duplicate: boolean }> {
    if (!(REPORT_REASONS as readonly string[]).includes(input.reason)) {
      throw new ReportError('INVALID_REASON', `reason must be one of ${REPORT_REASONS.join(', ')}`);
    }
    const details = input.details?.trim() || null;
    if (details && details.length > CONSTANTS.DETAILS_MAX) {
      throw new ReportError('DETAILS_TOO_LONG', `Details can be at most ${CONSTANTS.DETAILS_MAX} characters`);
    }

    let reportedUserId = input.reportedUserId;
    let groupChatId: string | null = null;
    let excerpt: string | null = null;

    if (input.messageId) {
      const message = await GroupChatMessage.findByPk(input.messageId);
      if (!message) {throw new ReportError('MESSAGE_NOT_FOUND', 'Message not found', 404);}
      const inChat = await GroupChatParticipant.count({ where: { groupChatId: message.groupChatId, userId: reporterId } });
      if (!inChat) {throw new ReportError('NOT_IN_CHAT', 'You can only report messages in your own chats', 403);}
      reportedUserId = message.senderId;
      groupChatId = message.groupChatId;
      excerpt = (message.content ?? '').slice(0, CONSTANTS.EXCERPT_MAX) || null;
    }

    if (!reportedUserId) {throw new ReportError('MISSING_TARGET', 'Say which message or person you are reporting');}
    if (reportedUserId === reporterId) {throw new ReportError('CANNOT_REPORT_SELF', 'You cannot report yourself');}
    const reported = await User.findByPk(reportedUserId, { attributes: ['id'] });
    if (!reported) {throw new ReportError('USER_NOT_FOUND', 'User not found', 404);}

    const existing = await ContentReport.findOne({
      where: {
        reporterId,
        reportedUserId,
        status: 'open',
        messageId: input.messageId ?? { [Op.is]: null },
      },
    });
    if (existing) {return { report: existing, duplicate: true };}

    const report = await ContentReport.create({
      reporterId,
      reportedUserId,
      messageId: input.messageId ?? null,
      groupChatId,
      messageExcerpt: excerpt,
      reason: input.reason as ReportReason,
      details,
    });
    logger.info('Content reported', { reportId: report.id, reason: report.reason, hasMessage: !!report.messageId });
    return { report, duplicate: false };
  }

  async list({ status, page, limit }: { status?: string; page: number; limit: number }): Promise<Record<string, unknown>> {
    const where = status ? { status } : {};
    const [rows, openCount] = await Promise.all([
      ContentReport.findAndCountAll({ where, order: [['createdAt', status === 'open' ? 'ASC' : 'DESC']], limit, offset: (page - 1) * limit }),
      ContentReport.count({ where: { status: 'open' } }),
    ]);
    const ids = [...new Set(rows.rows.flatMap(r => [r.reporterId, r.reportedUserId]))];
    const users = await User.findAll({ where: { id: ids }, attributes: ['id', 'firstName', 'lastName', 'email', 'status'] });
    const byId = new Map(users.map(u => [u.id, u]));
    return {
      reports: rows.rows.map(r => ({
        id: r.id, reason: r.reason, status: r.status, createdAt: r.createdAt,
        hasMessage: !!r.messageId, excerpt: r.messageExcerpt?.slice(0, 160) ?? null,
        reporter: userSummary(byId.get(r.reporterId)), reported: userSummary(byId.get(r.reportedUserId)),
      })),
      openCount,
      pagination: { page, limit, total: rows.count, totalPages: Math.ceil(rows.count / limit) },
    };
  }

  async get(id: string): Promise<Record<string, unknown> | null> {
    const report = await ContentReport.findByPk(id);
    if (!report) {return null;}
    const [reporter, reported, againstUser, openAgainstUser] = await Promise.all([
      User.findByPk(report.reporterId, { attributes: ['id', 'firstName', 'lastName', 'email', 'status'] }),
      User.findByPk(report.reportedUserId, { attributes: ['id', 'firstName', 'lastName', 'email', 'status'] }),
      ContentReport.count({ where: { reportedUserId: report.reportedUserId } }),
      ContentReport.count({ where: { reportedUserId: report.reportedUserId, status: 'open' } }),
    ]);
    return {
      ...report.toJSON(),
      reporter: userSummary(reporter),
      reported: userSummary(reported),
      reportsAgainstUser: { total: againstUser, open: openAgainstUser },
    };
  }

  async resolve(id: string, adminId: string, outcome: string, notes: string): Promise<ContentReportModel> {
    if (!(REPORT_OUTCOMES as readonly string[]).includes(outcome)) {
      throw new ReportError('INVALID_OUTCOME', `outcome must be one of ${REPORT_OUTCOMES.join(', ')}`);
    }
    const trimmed = (notes ?? '').trim();
    if (trimmed.length < CONSTANTS.NOTES_MIN || trimmed.length > CONSTANTS.NOTES_MAX) {
      throw new ReportError('NOTES_REQUIRED', `Notes must be ${CONSTANTS.NOTES_MIN} to ${CONSTANTS.NOTES_MAX} characters`);
    }
    const report = await ContentReport.findByPk(id);
    if (!report) {throw new ReportError('REPORT_NOT_FOUND', 'Report not found', 404);}
    if (report.status !== 'open') {throw new ReportError('ALREADY_RESOLVED', 'This report has already been resolved', 409);}

    await report.update({ status: outcome as ReportOutcome, resolutionNotes: trimmed, resolvedBy: adminId, resolvedAt: new Date() });

    await notificationService.sendToUser(report.reporterId, {
      type: 'report_reviewed',
      title: 'We looked at your report',
      message: 'Thank you for telling us. ARYV has reviewed your report and acted where needed.',
      data: { reportId: report.id },
      timestamp: new Date().toISOString(),
    }).catch(error => logger.warn('Report reviewed notification failed', { error: (error as Error).message }));

    return report;
  }
}

export const contentReportService = new ContentReportService();
export default contentReportService;
