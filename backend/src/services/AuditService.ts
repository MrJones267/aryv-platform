/**
 * @fileoverview Writes the admin audit trail
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * Every admin request that changes something is recorded by auditAdminWrites
 * (routes/admin.ts); sign-ins are recorded by the login handler, because they
 * happen before there is an admin on the request. Recording never throws: an
 * audit write that failed is logged as an error, and the action it describes
 * is not undone or blocked by it.
 */

import { Request } from 'express';
import AdminAuditLog from '../models/AdminAuditLog';
import logger from '../utils/logger';

// Constants
const REDACTED = '[redacted]';
// Anything holding a credential. Codes are matched by exact name so that
// fields such as countryCode are kept.
const SENSITIVE_KEY = /password|passcode|token|secret|authorization|^otp$|^code$|^totp/i;
const MAX_STRING = 1000;
const MAX_DEPTH = 4;

/**
 * A copy of a request body that is safe to keep: passwords, tokens and codes
 * removed, long strings cut short, deep nesting flattened.
 */
export const sanitiseDetails = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[nested]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitiseDetails(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitiseDetails(v, depth + 1);
  }
  return out;
};

/** IPv4 clients arrive as ::ffff:a.b.c.d behind some proxies. */
const clientIp = (req: Request): string | null => {
  const ip = req.ip ?? null;
  return ip?.startsWith('::ffff:') ? ip.slice(7) : ip;
};

export interface AuditEntry {
  adminUserId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
}

export async function recordAdminAction(req: Request, entry: AuditEntry): Promise<void> {
  try {
    await AdminAuditLog.create({
      adminUserId: entry.adminUserId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      details: (sanitiseDetails(entry.details ?? {}) as Record<string, unknown>) ?? null,
      ipAddress: clientIp(req),
      userAgent: req.get('user-agent')?.slice(0, 500) ?? null,
    });
  } catch (error) {
    logger.error(`Admin audit entry was not recorded: ${(error as Error).message}`, {
      action: entry.action,
      adminUserId: entry.adminUserId,
      resourceId: entry.resourceId,
    });
  }
}

export default { recordAdminAction, sanitiseDetails };
