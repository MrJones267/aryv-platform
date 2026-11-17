/**
 * @fileoverview Sends ARYV's email: one place for every message the API sends
 * @author Oabona-Majoko
 * @created 2026-11-17
 * @lastModified 2026-11-17
 *
 * Production sends through Cloudflare Email Service's REST API, over HTTPS.
 * Railway blocks outbound SMTP below its Pro plan, so a mail server login
 * that works from a laptop times out from the API; HTTPS is never blocked.
 *
 *   CLOUDFLARE_ACCOUNT_ID    the account that owns aryv-app.com
 *   CLOUDFLARE_EMAIL_TOKEN   an API token with "Email Sending: Edit"
 *   EMAIL_FROM               e.g. "ARYV <noreply@aryv-app.com>" (falls back to SMTP_FROM)
 *
 * SMTP (SMTP_HOST and friends) is still honoured when Cloudflare is not set,
 * for local development against a test mail server.
 */

import nodemailer from 'nodemailer';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** Only headers Cloudflare allows, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('No email provider is configured');
    this.name = 'EmailNotConfiguredError';
  }
}

export class EmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailSendError';
  }
}

const SEND_TIMEOUT_MS = 15_000;

const cloudflare = (): { accountId: string; token: string } | null => {
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID'];
  const token = process.env['CLOUDFLARE_EMAIL_TOKEN'];
  return accountId && token ? { accountId, token } : null;
};

const fromAddress = (): string =>
  process.env['EMAIL_FROM'] || process.env['SMTP_FROM'] || 'ARYV <noreply@aryv-app.com>';

/** True when a message handed to sendEmail would actually go out. */
export const isEmailConfigured = (): boolean => Boolean(cloudflare() || process.env['SMTP_HOST']);

const sendViaCloudflare = async (
  { accountId, token }: { accountId: string; token: string },
  email: OutgoingEmail,
): Promise<void> => {
  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/email/sending/send`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromAddress(),
          to: email.to,
          subject: email.subject,
          text: email.text,
          ...(email.html ? { html: email.html } : {}),
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
          ...(email.headers ? { headers: email.headers } : {}),
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      },
    );
  } catch (error) {
    throw new EmailSendError(`Could not reach Cloudflare Email: ${(error as Error).message}`);
  }

  const result = (await response.json().catch(() => null)) as {
    success?: boolean;
    errors?: { code?: number; message?: string }[];
    result?: { permanent_bounces?: string[]; suppressed_recipients?: string[] };
  } | null;

  if (!response.ok || !result?.success) {
    const reason = result?.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${response.status}`;
    throw new EmailSendError(`Cloudflare Email refused the message (${reason})`);
  }
  if (result.result?.permanent_bounces?.length || result.result?.suppressed_recipients?.length) {
    throw new EmailSendError('The address bounced or is suppressed');
  }
};

const sendViaSmtp = async (email: OutgoingEmail): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: process.env['SMTP_HOST'],
    port: parseInt(process.env['SMTP_PORT'] || '587', 10),
    secure: process.env['SMTP_SECURE'] === 'true',
    auth: { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] },
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
  });
  await transporter.sendMail({
    from: fromAddress(),
    to: email.to,
    subject: email.subject,
    text: email.text,
    ...(email.html ? { html: email.html } : {}),
    ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    ...(email.headers ? { headers: email.headers } : {}),
  });
};

/**
 * Send one message. Throws EmailNotConfiguredError when nothing is set up,
 * and EmailSendError when the provider would not take it.
 */
export const sendEmail = async (email: OutgoingEmail): Promise<void> => {
  const cf = cloudflare();
  if (cf) {
    await sendViaCloudflare(cf, email);
    return;
  }
  if (process.env['SMTP_HOST']) {
    await sendViaSmtp(email);
    return;
  }
  throw new EmailNotConfiguredError();
};

export default { sendEmail, isEmailConfigured };
