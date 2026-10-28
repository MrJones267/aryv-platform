/**
 * @fileoverview SMS service using Twilio for phone verification codes
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import logger from '../utils/logger';
import { toE164 } from '../utils/phone';
import otpService, { OtpPurpose, OtpVerifyResult } from './OtpService';

const TWILIO_ACCOUNT_SID = process.env['TWILIO_ACCOUNT_SID'] || '';
const TWILIO_AUTH_TOKEN = process.env['TWILIO_AUTH_TOKEN'] || '';
const TWILIO_PHONE_NUMBER = process.env['TWILIO_PHONE_NUMBER'] || '';


class SMSService {
  private client: any = null;
  private initialized = false;

  constructor() {
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      try {
        // Dynamic require so server starts fine without twilio installed
        const twilio = require('twilio');
        this.client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        this.initialized = true;
        logger.info('SMSService initialized with Twilio');
      } catch {
        logger.warn('twilio package not found — SMS will log codes only');
      }
    } else {
      logger.warn('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set — SMS disabled');
    }
  }

  /**
   * Send an arbitrary message to a phone number.
   *
   * Returns whether the carrier accepted it. When Twilio is not configured the
   * body is logged instead, so local development still works — but callers
   * must treat a false return as "the recipient did not get this".
   */
  /** Whether a message can actually be sent: credentials and a sending number. */
  isConfigured(): boolean {
    return this.initialized && !!TWILIO_PHONE_NUMBER;
  }

  async sendMessage(phoneNumber: string, body: string, countryCode?: string): Promise<boolean> {
    // Twilio requires E.164 and rejects anything else. People type 71234567.
    const to = toE164(phoneNumber, countryCode);
    if (!to) {
      logger.warn('SMS not sent: number could not be normalised', { phoneNumber });
      return false;
    }

    if (!this.initialized || !TWILIO_PHONE_NUMBER) {
      logger.info('SMS not sent (Twilio not configured)', { to, body });
      return false;
    }

    try {
      await this.client.messages.create({
        body,
        from: TWILIO_PHONE_NUMBER,
        to,
      });
      logger.info('SMS sent', { to });
      return true;
    } catch (error: any) {
      logger.error('Twilio send error', { error: error.message, phoneNumber });
      return false;
    }
  }

  /**
   * Send a verification code to a phone number.
   *
   * The code itself is minted and held by OtpService, which owns the attempt
   * limit, the purpose binding and the single-use rule. This method is only
   * the delivery leg. It used to generate and store its own code with none of
   * those protections, in parallel with a second, separate implementation for
   * email — the two drifted, and both were guessable without limit.
   */
  async sendVerificationCode(
    phoneNumber: string,
    purpose: OtpPurpose = 'phone_verification',
    countryCode?: string,
  ): Promise<{ sent: boolean; throttled?: boolean; expiresAt?: Date; code?: string }> {
    const key = toE164(phoneNumber, countryCode);
    if (!key) {
      logger.warn('Verification code not sent: number could not be normalised', { phoneNumber });
      return { sent: false };
    }

    const issued = await otpService.issue('sms', key, purpose);
    if (!issued.ok || !issued.code) {
      return { sent: false, ...(issued.throttled ? { throttled: true } : {}) };
    }

    const result: { sent: boolean; expiresAt?: Date; code?: string } = {
      sent: false,
      ...(issued.expiresAt ? { expiresAt: issued.expiresAt } : {}),
    };

    // Only ever handed back outside production, so a developer without a
    // Twilio account can complete the flow. Never in a deployed environment.
    if (process.env['NODE_ENV'] !== 'production') {
      result.code = issued.code;
    }

    if (!this.initialized || !TWILIO_PHONE_NUMBER) {
      logger.info('SMS verification code (Twilio not configured)', { to: key });
      return result;
    }

    try {
      await this.client.messages.create({
        body: `Your ARYV verification code is: ${issued.code}. Valid for 10 minutes.`,
        from: TWILIO_PHONE_NUMBER,
        to: key,
      });
      logger.info('SMS verification code sent', { to: key });
      return { ...result, sent: true };
    } catch (error: any) {
      logger.error('Twilio send error', { error: error.message });
      return result;
    }
  }

  /**
   * Verify a code submitted by the user.
   *
   * Delegates to OtpService so the attempt limit applies here too. The previous
   * implementation compared strings and returned false on a mismatch, counting
   * nothing — a six-digit code could be guessed until it was found.
   */
  async verifyCode(
    phoneNumber: string,
    submittedCode: string,
    purpose: OtpPurpose = 'phone_verification',
    countryCode?: string,
  ): Promise<OtpVerifyResult> {
    const key = toE164(phoneNumber, countryCode);
    if (!key) return { ok: false, reason: 'not_found' };
    return otpService.verify('sms', key, purpose, submittedCode);
  }
}

export const smsService = new SMSService();
export default smsService;
