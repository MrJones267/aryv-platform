/**
 * @fileoverview SMS service using Twilio for phone verification codes
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import crypto from 'crypto';
import logger from '../utils/logger';
import { toE164 } from '../utils/phone';

const TWILIO_ACCOUNT_SID = process.env['TWILIO_ACCOUNT_SID'] || '';
const TWILIO_AUTH_TOKEN = process.env['TWILIO_AUTH_TOKEN'] || '';
const TWILIO_PHONE_NUMBER = process.env['TWILIO_PHONE_NUMBER'] || '';

const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
const OTP_KEY_PREFIX = 'otp:';

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
   * Stores the code in Redis (or in-memory fallback) with a TTL.
   * Returns the code in development so callers can include it in API responses.
   */
  async sendVerificationCode(
    phoneNumber: string,
    countryCode?: string,
  ): Promise<{ code: string; sent: boolean }> {
    const code = (100000 + crypto.randomInt(0, 900000)).toString();

    // Keyed on the normalised number so that verifyCode, which normalises the
    // same way, looks in the same place. Storing under whatever the user typed
    // meant a code sent to +26771234567 could not be verified by someone who
    // then typed 071234567.
    const key = toE164(phoneNumber, countryCode);
    if (!key) {
      logger.warn('Verification code not sent: number could not be normalised', { phoneNumber });
      return { code, sent: false };
    }

    // Store in Redis for later verification
    try {
      const { redisClient } = await import('../config/redis');
      await redisClient.set(`${OTP_KEY_PREFIX}${key}`, code, OTP_TTL_SECONDS);
    } catch {
      // Redis unavailable — store in memory (not for production use)
      this.memoryStore.set(key, { code, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000 });
    }

    if (!this.initialized || !TWILIO_PHONE_NUMBER) {
      logger.info('SMS verification code (Twilio not configured)', { to: key, code });
      return { code, sent: false };
    }

    try {
      await this.client.messages.create({
        body: `Your ARYV verification code is: ${code}. Valid for 10 minutes.`,
        from: TWILIO_PHONE_NUMBER,
        to: key,
      });
      logger.info('SMS verification code sent', { to: key });
      return { code, sent: true };
    } catch (error: any) {
      logger.error('Twilio send error', { error: error.message, phoneNumber });
      return { code, sent: false };
    }
  }

  /**
   * Verify a code submitted by the user.
   * Deletes the code on successful verification.
   */
  async verifyCode(
    phoneNumber: string,
    submittedCode: string,
    countryCode?: string,
  ): Promise<boolean> {
    const key = toE164(phoneNumber, countryCode);
    if (!key) return false;

    try {
      const { redisClient } = await import('../config/redis');
      const storedCode = await redisClient.get(`${OTP_KEY_PREFIX}${key}`);
      if (storedCode && storedCode === submittedCode) {
        await redisClient.del(`${OTP_KEY_PREFIX}${key}`);
        return true;
      }
    } catch {
      // Redis unavailable — fall back to memory store
      const entry = this.memoryStore.get(key);
      if (entry && entry.expiresAt > Date.now() && entry.code === submittedCode) {
        this.memoryStore.delete(key);
        return true;
      }
    }
    return false;
  }

  // In-memory fallback (single-instance dev only)
  private memoryStore = new Map<string, { code: string; expiresAt: number }>();
}

export const smsService = new SMSService();
export default smsService;
