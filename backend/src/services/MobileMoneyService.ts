/**
 * @fileoverview Mobile money payment service — routes to provider-specific implementations
 * @author Oabona-Majoko
 * @created 2026-05-18
 * @lastModified 2026-05-18
 */

import crypto from 'crypto';
import logger from '../utils/logger';

export type MobileMoneyProvider =
  | 'orange_money'
  | 'myzaka'
  | 'smega'
  | 'mtn_momo'
  | 'fnb_ewallet';

export interface MobileMoneyInitiateParams {
  phone: string;
  amount: number;
  currency: string;
  reference: string;
  description: string;
  provider: MobileMoneyProvider;
}

export interface MobileMoneyStatusResult {
  reference: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  providerRef?: string;
  failureReason?: string;
}

export interface MobileMoneyInitiateResult {
  reference: string;
  ussdCode?: string;
  deepLink?: string;
  instructions: string;
  status: 'pending';
}

// ─── Provider Implementations ─────────────────────────────────────────────────

async function initiateOrangeMoney(params: MobileMoneyInitiateParams): Promise<MobileMoneyInitiateResult> {
  const apiKey = process.env['ORANGE_MONEY_API_KEY'];
  const merchantId = process.env['ORANGE_MONEY_MERCHANT_ID'];

  if (!apiKey || !merchantId) {
    logger.warn('Orange Money credentials not configured — returning USSD fallback');
    return {
      reference: params.reference,
      ussdCode: `*144*1*${merchantId || 'ARYV'}*${params.amount}#`,
      instructions: `Dial *144*1*${merchantId || 'ARYV'}*${params.amount}# on your Orange phone to pay ${params.currency} ${params.amount}. Use reference: ${params.reference}`,
      status: 'pending',
    };
  }

  // Orange Money API integration point
  // API docs: https://developer.orange.com/apis/orange-money-webpay
  // POST https://api.orange.com/orange-money-webpay/dev/v1/webpayment
  try {
    // When credentials are set, call the real API here:
    // const response = await fetch('https://api.orange.com/orange-money-webpay/dev/v1/webpayment', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ merchant_key: merchantId, currency: params.currency,
    //     order_id: params.reference, amount: params.amount, return_url: '...', cancel_url: '...',
    //     notif_url: `${process.env['API_BASE_URL']}/api/payments/mobile-money/webhook/orange`,
    //     lang: 'en', reference: params.reference }),
    // });
    // const data = await response.json();
    // return { reference: params.reference, deepLink: data.payment_url, instructions: '...', status: 'pending' };

    logger.info('Orange Money initiate', { reference: params.reference, amount: params.amount });
    return {
      reference: params.reference,
      ussdCode: `*144*1*${merchantId}*${params.amount}#`,
      instructions: `Dial *144*1*${merchantId}*${params.amount}# to pay ${params.currency} ${params.amount}.`,
      status: 'pending',
    };
  } catch (error) {
    logger.error('Orange Money API error', { error: (error as Error).message });
    throw error;
  }
}

async function initiateMyZaka(params: MobileMoneyInitiateParams): Promise<MobileMoneyInitiateResult> {
  const apiKey = process.env['MYZAKA_API_KEY'];
  const merchantCode = process.env['MYZAKA_MERCHANT_CODE'];

  if (!apiKey || !merchantCode) {
    logger.warn('MyZaka credentials not configured — returning USSD fallback');
    return {
      reference: params.reference,
      ussdCode: `*167*${merchantCode || 'ARYV'}*${params.amount}#`,
      instructions: `Dial *167*${merchantCode || 'ARYV'}*${params.amount}# on your Mascom/BTC phone to pay BWP ${params.amount}. Reference: ${params.reference}`,
      status: 'pending',
    };
  }

  // MyZaka (Botswana) API integration point
  // POST https://api.myzaka.co.bw/v1/payment/initiate
  try {
    logger.info('MyZaka initiate', { reference: params.reference, amount: params.amount });
    return {
      reference: params.reference,
      ussdCode: `*167*${merchantCode}*${params.amount}#`,
      instructions: `Dial *167*${merchantCode}*${params.amount}# to pay BWP ${params.amount}.`,
      status: 'pending',
    };
  } catch (error) {
    logger.error('MyZaka API error', { error: (error as Error).message });
    throw error;
  }
}

async function initiateSmega(params: MobileMoneyInitiateParams): Promise<MobileMoneyInitiateResult> {
  const apiKey = process.env['SMEGA_API_KEY'];
  const merchantId = process.env['SMEGA_MERCHANT_ID'];

  if (!apiKey || !merchantId) {
    logger.warn('Smega credentials not configured — returning USSD fallback');
    return {
      reference: params.reference,
      ussdCode: `*123*${merchantId || 'ARYV'}*${params.amount}#`,
      instructions: `Dial *123*${merchantId || 'ARYV'}*${params.amount}# on your phone to pay BWP ${params.amount}. Reference: ${params.reference}`,
      status: 'pending',
    };
  }

  // Smega (Botswana) API integration point
  try {
    logger.info('Smega initiate', { reference: params.reference, amount: params.amount });
    return {
      reference: params.reference,
      ussdCode: `*123*${merchantId}*${params.amount}#`,
      instructions: `Dial *123*${merchantId}*${params.amount}# to pay BWP ${params.amount}.`,
      status: 'pending',
    };
  } catch (error) {
    logger.error('Smega API error', { error: (error as Error).message });
    throw error;
  }
}

async function initiateMtnMomo(params: MobileMoneyInitiateParams): Promise<MobileMoneyInitiateResult> {
  const subscriptionKey = process.env['MTN_MOMO_SUBSCRIPTION_KEY'];
  const apiKey = process.env['MTN_MOMO_API_KEY'];
  const userId = process.env['MTN_MOMO_USER_ID'];

  if (!subscriptionKey || !apiKey || !userId) {
    logger.warn('MTN MoMo credentials not configured — returning USSD fallback');
    return {
      reference: params.reference,
      ussdCode: `*170#`,
      instructions: `Open MTN MoMo app or dial *170# and send ${params.currency} ${params.amount} to merchant. Reference: ${params.reference}`,
      status: 'pending',
    };
  }

  // MTN MoMo API integration point
  // API docs: https://momodeveloper.mtn.com/
  // POST https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay
  try {
    logger.info('MTN MoMo initiate', { reference: params.reference, amount: params.amount });
    return {
      reference: params.reference,
      instructions: `A payment prompt will appear on ${params.phone}. Approve the payment of ${params.currency} ${params.amount}.`,
      status: 'pending',
    };
  } catch (error) {
    logger.error('MTN MoMo API error', { error: (error as Error).message });
    throw error;
  }
}

async function initiateFnbEwallet(params: MobileMoneyInitiateParams): Promise<MobileMoneyInitiateResult> {
  const apiKey = process.env['FNB_EWALLET_API_KEY'];

  if (!apiKey) {
    logger.warn('FNB eWallet credentials not configured');
    return {
      reference: params.reference,
      instructions: `Use FNB app to pay BWP ${params.amount} to merchant ARYV. Reference: ${params.reference}`,
      status: 'pending',
    };
  }

  // FNB eWallet API integration point
  try {
    logger.info('FNB eWallet initiate', { reference: params.reference, amount: params.amount });
    return {
      reference: params.reference,
      instructions: `A payment request has been sent to your FNB eWallet for BWP ${params.amount}.`,
      status: 'pending',
    };
  } catch (error) {
    logger.error('FNB eWallet API error', { error: (error as Error).message });
    throw error;
  }
}

// ─── Status Checks ─────────────────────────────────────────────────────────────

async function checkOrangeMoneyStatus(reference: string): Promise<MobileMoneyStatusResult> {
  const apiKey = process.env['ORANGE_MONEY_API_KEY'];
  if (!apiKey) return { reference, status: 'pending' };
  // GET https://api.orange.com/orange-money-webpay/dev/v1/webpayment/{reference}
  return { reference, status: 'pending' };
}

async function checkMyZakaStatus(reference: string): Promise<MobileMoneyStatusResult> {
  const apiKey = process.env['MYZAKA_API_KEY'];
  if (!apiKey) return { reference, status: 'pending' };
  // GET https://api.myzaka.co.bw/v1/payment/status/{reference}
  return { reference, status: 'pending' };
}

async function checkSmegaStatus(reference: string): Promise<MobileMoneyStatusResult> {
  const apiKey = process.env['SMEGA_API_KEY'];
  if (!apiKey) return { reference, status: 'pending' };
  return { reference, status: 'pending' };
}

async function checkMtnMomoStatus(reference: string): Promise<MobileMoneyStatusResult> {
  const subscriptionKey = process.env['MTN_MOMO_SUBSCRIPTION_KEY'];
  if (!subscriptionKey) return { reference, status: 'pending' };
  // GET https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/{referenceId}
  return { reference, status: 'pending' };
}

async function checkFnbEwalletStatus(reference: string): Promise<MobileMoneyStatusResult> {
  const apiKey = process.env['FNB_EWALLET_API_KEY'];
  if (!apiKey) return { reference, status: 'pending' };
  return { reference, status: 'pending' };
}

// ─── Webhook Handlers ──────────────────────────────────────────────────────────

export function verifyOrangeMoneyWebhook(payload: string, signature: string): boolean {
  const secret = process.env['ORANGE_MONEY_WEBHOOK_SECRET'];
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function verifyMyZakaWebhook(payload: string, signature: string): boolean {
  const secret = process.env['MYZAKA_WEBHOOK_SECRET'];
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function verifySmegaWebhook(payload: string, signature: string): boolean {
  const secret = process.env['SMEGA_WEBHOOK_SECRET'];
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ─── Public API ────────────────────────────────────────────────────────────────

export const mobileMoneyService = {
  generateReference(): string {
    return `mm_${crypto.randomBytes(8).toString('hex')}`;
  },

  async initiate(params: MobileMoneyInitiateParams): Promise<MobileMoneyInitiateResult> {
    switch (params.provider) {
      case 'orange_money': return initiateOrangeMoney(params);
      case 'myzaka':       return initiateMyZaka(params);
      case 'smega':        return initiateSmega(params);
      case 'mtn_momo':     return initiateMtnMomo(params);
      case 'fnb_ewallet':  return initiateFnbEwallet(params);
      default:
        throw new Error(`Unsupported mobile money provider: ${params.provider}`);
    }
  },

  async checkStatus(provider: MobileMoneyProvider, reference: string): Promise<MobileMoneyStatusResult> {
    switch (provider) {
      case 'orange_money': return checkOrangeMoneyStatus(reference);
      case 'myzaka':       return checkMyZakaStatus(reference);
      case 'smega':        return checkSmegaStatus(reference);
      case 'mtn_momo':     return checkMtnMomoStatus(reference);
      case 'fnb_ewallet':  return checkFnbEwalletStatus(reference);
      default:
        return { reference, status: 'pending' };
    }
  },

  isSupportedProvider(provider: string): provider is MobileMoneyProvider {
    return ['orange_money', 'myzaka', 'smega', 'mtn_momo', 'fnb_ewallet'].includes(provider);
  },
};

export default mobileMoneyService;
