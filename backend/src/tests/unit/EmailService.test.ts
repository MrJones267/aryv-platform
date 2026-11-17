/**
 * @fileoverview EmailService: Cloudflare's REST API in production, SMTP only
 *               as the development fallback
 * @author Oabona-Majoko
 * @created 2026-11-17
 * @lastModified 2026-11-17
 */

import nodemailer from 'nodemailer';
import {
  sendEmail,
  isEmailConfigured,
  EmailNotConfiguredError,
  EmailSendError,
} from '../../services/EmailService';

jest.mock('nodemailer');

const ENV_KEYS = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_EMAIL_TOKEN', 'EMAIL_FROM', 'SMTP_HOST', 'SMTP_FROM'];
const saved: Record<string, string | undefined> = {};

const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const OK = { success: true, errors: [], result: { delivered: [], queued: ['a@example.com'], permanent_bounces: [] } };

describe('EmailService', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    ENV_KEYS.forEach((k) => {
      saved[k] = process.env[k];
      delete process.env[k];
    });
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(reply(200, OK));
  });

  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
    jest.restoreAllMocks();
  });

  const useCloudflare = () => {
    process.env['CLOUDFLARE_ACCOUNT_ID'] = 'acct123';
    process.env['CLOUDFLARE_EMAIL_TOKEN'] = 'tok';
  };

  it('is not configured with nothing set, and refuses to pretend it sent', async () => {
    expect(isEmailConfigured()).toBe(false);
    await expect(sendEmail({ to: 'a@example.com', subject: 's', text: 't' })).rejects.toBeInstanceOf(
      EmailNotConfiguredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('needs both the account and the token for Cloudflare', () => {
    process.env['CLOUDFLARE_ACCOUNT_ID'] = 'acct123';
    expect(isEmailConfigured()).toBe(false);
    process.env['CLOUDFLARE_EMAIL_TOKEN'] = 'tok';
    expect(isEmailConfigured()).toBe(true);
  });

  it('posts the message to Cloudflare over HTTPS with the token', async () => {
    useCloudflare();
    process.env['EMAIL_FROM'] = 'ARYV <noreply@aryv-app.com>';

    await sendEmail({
      to: 'a@example.com',
      subject: 'Hello',
      text: 'Plain',
      html: '<p>Rich</p>',
      replyTo: 'hello@aryv-app.com',
      headers: { 'List-Unsubscribe': '<https://api.aryv-app.com/x>' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acct123/email/sending/send');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({
      from: 'ARYV <noreply@aryv-app.com>',
      to: 'a@example.com',
      subject: 'Hello',
      text: 'Plain',
      html: '<p>Rich</p>',
      reply_to: 'hello@aryv-app.com',
      headers: { 'List-Unsubscribe': '<https://api.aryv-app.com/x>' },
    });
    expect(init.signal).toBeDefined();
  });

  it('prefers Cloudflare over SMTP when both are set', async () => {
    useCloudflare();
    process.env['SMTP_HOST'] = 'smtp.example.com';

    await sendEmail({ to: 'a@example.com', subject: 's', text: 't' });

    expect(fetchMock).toHaveBeenCalled();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('throws with Cloudflare\'s reason when the message is refused', async () => {
    useCloudflare();
    fetchMock.mockResolvedValueOnce(
      reply(400, { success: false, errors: [{ code: 10001, message: 'email.sending.error.invalid_request_schema' }] }),
    );

    await expect(sendEmail({ to: 'a@example.com', subject: 's', text: 't' })).rejects.toThrow(
      /10001: email.sending.error.invalid_request_schema/,
    );
  });

  it('throws when the address bounces or is suppressed', async () => {
    useCloudflare();
    fetchMock.mockResolvedValueOnce(reply(200, { success: true, result: { permanent_bounces: ['a@example.com'] } }));

    await expect(sendEmail({ to: 'a@example.com', subject: 's', text: 't' })).rejects.toBeInstanceOf(EmailSendError);
  });

  it('throws a send error when Cloudflare cannot be reached', async () => {
    useCloudflare();
    fetchMock.mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));

    await expect(sendEmail({ to: 'a@example.com', subject: 's', text: 't' })).rejects.toThrow(
      /Could not reach Cloudflare Email/,
    );
  });

  it('falls back to SMTP for development, with timeouts set', async () => {
    process.env['SMTP_HOST'] = 'localhost';
    const sendMail = jest.fn().mockResolvedValue({});
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    await sendEmail({ to: 'a@example.com', subject: 's', text: 't' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect((nodemailer.createTransport as jest.Mock).mock.calls[0][0]).toMatchObject({
      host: 'localhost',
      connectionTimeout: 15000,
    });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@example.com', from: 'ARYV <noreply@aryv-app.com>' }));
  });
});
