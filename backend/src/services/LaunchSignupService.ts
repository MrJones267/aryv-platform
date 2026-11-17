/**
 * @fileoverview The launch sign-up list: adding, removing, counting, exporting
 * @author Oabona-Majoko
 * @created 2026-11-13
 * @lastModified 2026-11-17
 *
 * Removal links are signed rather than stored: the token is an HMAC of the
 * address, so a link works for exactly one address and needs no table of
 * its own. The key is LAUNCH_SIGNUP_SECRET, or JWT_SECRET when that is not
 * set; changing whichever is in use invalidates every link already sent.
 */

import crypto from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import LaunchSignup from '../models/LaunchSignup';
import type { OutgoingEmail } from './EmailService';

export type LaunchPlatform = 'android' | 'ios';
export const LAUNCH_PLATFORMS: readonly LaunchPlatform[] = ['android', 'ios'];

export const asLaunchPlatform = (value: unknown): LaunchPlatform | null =>
  LAUNCH_PLATFORMS.includes(value as LaunchPlatform) ? (value as LaunchPlatform) : null;

const API_URL = (process.env['PUBLIC_API_URL'] || 'https://api.aryv-app.com').replace(/\/+$/, '');

const signingKey = (): string => {
  const key = process.env['LAUNCH_SIGNUP_SECRET'] || process.env['JWT_SECRET'];
  if (!key) throw new Error('LAUNCH_SIGNUP_SECRET or JWT_SECRET must be set to sign removal links');
  return key;
};

export const removalToken = (email: string): string =>
  crypto.createHmac('sha256', signingKey()).update(`launch-signup-removal:${email.toLowerCase()}`).digest('base64url');

export const isValidRemovalToken = (email: unknown, token: unknown): email is string => {
  if (typeof email !== 'string' || typeof token !== 'string' || !email || !token) return false;
  const expected = Buffer.from(removalToken(email));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

export const removalUrl = (email: string): string =>
  `${API_URL}/api/launch-signups/remove?email=${encodeURIComponent(email)}&token=${removalToken(email)}`;

/**
 * The email sent the moment someone joins the list. It promises only what
 * the privacy policy says: one email at launch, and the address shared with
 * no one.
 */
export const welcomeEmail = (email: string): OutgoingEmail => {
  const remove = removalUrl(email);
  const removeHtml = remove.replace(/&/g, '&amp;');
  const text = [
    "You're on the ARYV launch list.",
    '',
    'Thanks for signing up. We will email you once, on the day ARYV launches in Botswana, with the links to get the app on Google Play and the App Store.',
    '',
    "Until then we won't send you anything else, and we don't share your address with anyone.",
    '',
    'Know someone who travels the same roads? Send them to https://aryv-app.com',
    '',
    `Didn't sign up, or changed your mind? Remove your address here: ${remove}`,
    '',
    'ARYV · https://aryv-app.com · hello@aryv-app.com',
  ].join('\n');

  const html = `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#f4f6fb;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0b1020">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td>
<p style="margin:0 0 20px;font-size:22px;font-weight:800;letter-spacing:.04em">ARYV</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">You're on the launch list.</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#39415a">Thanks for signing up. We will email you once, on the day ARYV launches in Botswana, with the links to get the app on Google Play and the App Store.</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#39415a">Until then we won't send you anything else, and we don't share your address with anyone.</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#39415a">Know someone who travels the same roads? Send them to <a href="https://aryv-app.com" style="color:#1f6fd1">aryv-app.com</a>.</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#6b7390">Didn't sign up, or changed your mind? <a href="${removeHtml}" style="color:#6b7390">Remove your address</a>.<br>ARYV · <a href="https://aryv-app.com" style="color:#6b7390">aryv-app.com</a> · <a href="mailto:hello@aryv-app.com" style="color:#6b7390">hello@aryv-app.com</a></p>
</td></tr></table></td></tr></table></body></html>`;

  return {
    to: email,
    subject: "You're on the ARYV launch list",
    text,
    html,
    replyTo: 'hello@aryv-app.com',
    headers: {
      'List-Unsubscribe': `<${remove}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
};

/**
 * Quote a CSV cell, and defuse cells a spreadsheet would run as a formula
 * (an address may legally begin with = or +).
 */
const csvCell = (value: string): string => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};

export interface LaunchSignupSummary {
  total: number;
  android: number;
  ios: number;
  unspecified: number;
  latestAt: string | null;
}

export const launchSignupService = {
  /**
   * Keep an address once. Signing up again keeps the first date, and records
   * the platform if this time the visitor gave one.
   *
   * @returns true when the address is new to the list, so the caller sends
   *          the welcome email once per address rather than once per visit.
   */
  async add(email: string, platform: LaunchPlatform | null): Promise<boolean> {
    const rows = await sequelize.query<{ inserted: boolean }>(
      `INSERT INTO launch_signups (id, email, platform, created_at, updated_at)
       VALUES (:id, :email, :platform, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
         SET platform = COALESCE(EXCLUDED.platform, launch_signups.platform),
             updated_at = NOW()
       RETURNING (xmax = 0) AS inserted`,
      { replacements: { id: crypto.randomUUID(), email: email.toLowerCase(), platform }, type: QueryTypes.SELECT },
    );
    return rows[0]?.inserted === true;
  },

  async remove(email: string): Promise<void> {
    await LaunchSignup.destroy({ where: { email: email.toLowerCase() } });
  },

  async summary(): Promise<LaunchSignupSummary> {
    const rows = (await sequelize.query(
      `SELECT platform, COUNT(*)::int AS n, MAX(created_at) AS latest
         FROM launch_signups GROUP BY platform`,
      { type: QueryTypes.SELECT },
    )) as Array<{ platform: LaunchPlatform | null; n: number; latest: Date | string }>;

    const count = (p: LaunchPlatform | null) => rows.find((r) => r.platform === p)?.n ?? 0;
    const latest = rows.map((r) => new Date(r.latest).getTime()).filter((t) => !Number.isNaN(t));
    return {
      total: rows.reduce((sum, r) => sum + Number(r.n), 0),
      android: count('android'),
      ios: count('ios'),
      unspecified: count(null),
      latestAt: latest.length ? new Date(Math.max(...latest)).toISOString() : null,
    };
  },

  /** Every address with its removal link, ready for a mail-merge. */
  async exportCsv(): Promise<{ csv: string; count: number }> {
    const rows = await LaunchSignup.findAll({ order: [['createdAt', 'ASC']] });
    const lines = ['email,platform,signed_up_at,removal_link'];
    for (const row of rows) {
      lines.push([
        csvCell(row.email),
        csvCell(row.platform ?? ''),
        csvCell(new Date(row.createdAt).toISOString()),
        csvCell(removalUrl(row.email)),
      ].join(','));
    }
    return { csv: `${lines.join('\r\n')}\r\n`, count: rows.length };
  },
};

export default launchSignupService;
