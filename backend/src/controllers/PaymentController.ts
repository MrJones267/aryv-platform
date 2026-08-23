/**
 * @fileoverview Payment controller — Stripe cards, mobile money, and wallet operations
 * @author Oabona-Majoko
 * @created 2026-03-28
 * @lastModified 2026-03-28
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { redisClient } from '../config/redis';
import User from '../models/User';
import cashWalletService from '../services/CashWalletService';
import mobileMoneyService from '../services/MobileMoneyService';
import { PLATFORM_DEFAULT_CURRENCY } from '../services/CurrencyService';
import logger from '../utils/logger';

const INTENT_PREFIX = 'payment_intent:';
const INTENT_TTL = 3600; // 1 hour
const MM_PREFIX = 'mm_tx:';
const MM_TTL = 86400; // 24 hours

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStripe(): any | null {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) return null;
  try {
    return require('stripe')(key);
  } catch {
    return null;
  }
}

async function saveIntent(id: string, data: Record<string, any>): Promise<void> {
  await redisClient.set(`${INTENT_PREFIX}${id}`, JSON.stringify(data), INTENT_TTL);
}

async function loadIntent(id: string): Promise<Record<string, any> | null> {
  const raw = await redisClient.get(`${INTENT_PREFIX}${id}`);
  return raw ? JSON.parse(raw) : null;
}

function getUserPaymentMethods(user: any): any[] {
  const prefs = (user.preferences as Record<string, any>) || {};
  return prefs['paymentMethods'] || [];
}

async function updateUserPaymentMethods(user: any, methods: any[]): Promise<void> {
  const prefs = (user.preferences as Record<string, any>) || {};
  await user.update({ preferences: { ...prefs, paymentMethods: methods } });
}

// ─── Controller ──────────────────────────────────────────────────────────────

export class PaymentController {
  // ─── Payment Methods ───────────────────────────────────────────────────────

  async getPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) { res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      res.json({ success: true, data: getUserPaymentMethods(user), timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('getPaymentMethods error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async addCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName, setAsDefault } = req.body;
      if (!cardNumber || !expiryMonth || !expiryYear || !cvv || !cardholderName) {
        res.status(400).json({ success: false, error: 'All card fields are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) { res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      // In production: tokenise via Stripe and store the token, never raw card data
      const stripe = getStripe();
      let stripePaymentMethodId: string | null = null;

      if (stripe) {
        try {
          const pm = await stripe.paymentMethods.create({
            type: 'card',
            card: { number: cardNumber, exp_month: expiryMonth, exp_year: expiryYear, cvc: cvv },
            billing_details: { name: cardholderName },
          });
          stripePaymentMethodId = pm.id;
        } catch (stripeErr: any) {
          res.status(400).json({ success: false, error: stripeErr.message || 'Card declined', code: 'CARD_DECLINED', timestamp: new Date().toISOString() });
          return;
        }
      }

      const last4 = String(cardNumber).slice(-4);
      const methods = getUserPaymentMethods(user);
      const newMethod = {
        id: stripePaymentMethodId || `card_${crypto.randomBytes(8).toString('hex')}`,
        type: 'card' as const,
        provider: 'stripe' as const,
        label: `•••• ${last4}`,
        last4,
        expiryDate: `${String(expiryMonth).padStart(2, '0')}/${expiryYear}`,
        isDefault: setAsDefault || methods.length === 0,
        createdAt: new Date().toISOString(),
      };

      if (newMethod.isDefault) {
        methods.forEach((m) => { m.isDefault = false; });
      }
      methods.push(newMethod);
      await updateUserPaymentMethods(user, methods);

      res.status(201).json({ success: true, data: newMethod, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('addCard error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async addMobileMoney(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { phone, provider, accountName, setAsDefault } = req.body;
      if (!phone || !provider) {
        res.status(400).json({ success: false, error: 'phone and provider are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) { res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      const methods = getUserPaymentMethods(user);
      const newMethod = {
        id: `mm_${crypto.randomBytes(8).toString('hex')}`,
        type: 'mobile_money' as const,
        provider,
        label: accountName || phone,
        phone,
        isDefault: setAsDefault || methods.length === 0,
        createdAt: new Date().toISOString(),
      };

      if (newMethod.isDefault) {
        methods.forEach((m) => { m.isDefault = false; });
      }
      methods.push(newMethod);
      await updateUserPaymentMethods(user, methods);

      res.status(201).json({ success: true, data: newMethod, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('addMobileMoney error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async removePaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) { res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      const methods = getUserPaymentMethods(user).filter((m) => m.id !== id);
      await updateUserPaymentMethods(user, methods);

      res.json({ success: true, message: 'Payment method removed', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('removePaymentMethod error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async setDefaultPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const user = await User.findByPk(userId, { attributes: ['id', 'preferences'] });
      if (!user) { res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      const methods = getUserPaymentMethods(user);
      const target = methods.find((m) => m.id === id);
      if (!target) { res.status(404).json({ success: false, error: 'Payment method not found', code: 'METHOD_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      methods.forEach((m) => { m.isDefault = m.id === id; });
      await updateUserPaymentMethods(user, methods);

      res.json({ success: true, data: target, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('setDefaultPaymentMethod error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  // ─── Payment Intents ───────────────────────────────────────────────────────

  async createPaymentIntent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { amount, currency, paymentMethod, provider, rideId, packageId, metadata } = req.body;
      if (!amount || !currency || !paymentMethod) {
        res.status(400).json({ success: false, error: 'amount, currency, and paymentMethod are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const id = `pi_${crypto.randomBytes(16).toString('hex')}`;
      let clientSecret: string | undefined;

      // Stripe payment intent
      const stripe = getStripe();
      if (stripe && paymentMethod === 'card') {
        try {
          const stripeIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // cents
            currency: currency.toLowerCase(),
            metadata: { userId, rideId: rideId || '', packageId: packageId || '', ...metadata },
          });
          clientSecret = stripeIntent.client_secret;
        } catch (stripeErr: any) {
          logger.warn('Stripe intent creation failed, using local fallback', { error: stripeErr.message });
        }
      }

      const intent = {
        id,
        clientSecret,
        amount,
        currency,
        status: 'pending' as const,
        paymentMethod,
        provider: provider || (paymentMethod === 'card' ? 'stripe' : paymentMethod),
        metadata: metadata || {},
        userId,
        rideId: rideId || null,
        packageId: packageId || null,
        createdAt: new Date().toISOString(),
      };

      await saveIntent(id, intent);

      res.status(201).json({ success: true, data: intent, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('createPaymentIntent error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async confirmPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { paymentIntentId, paymentMethodId, cardToken, mobileMoneyPhone, mobileMoneyProvider } = req.body;
      if (!paymentIntentId) {
        res.status(400).json({ success: false, error: 'paymentIntentId is required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      const intent = await loadIntent(paymentIntentId);
      if (!intent) {
        res.status(404).json({ success: false, error: 'Payment intent not found or expired', code: 'INTENT_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      if (intent['userId'] !== userId) {
        res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN', timestamp: new Date().toISOString() });
        return;
      }

      // For wallet payments, deduct from wallet
      if (intent['paymentMethod'] === 'wallet') {
        const walletResult = await cashWalletService.processPayment({
          userId,
          amount: intent['amount'],
          description: `Payment for ${intent['rideId'] ? 'ride' : 'delivery'} ${intent['rideId'] || intent['packageId']}`,
          metadata: { paymentIntentId, rideId: intent['rideId'], packageId: intent['packageId'] },
        });
        if (!walletResult.success) {
          const updated = { ...intent, status: 'failed' };
          await saveIntent(paymentIntentId, updated);
          res.status(400).json({ success: false, error: walletResult.error || 'Wallet payment failed', code: 'WALLET_PAYMENT_FAILED', timestamp: new Date().toISOString() });
          return;
        }
      }

      const updated = { ...intent, status: 'completed', confirmedAt: new Date().toISOString(), paymentMethodId, cardToken, mobileMoneyPhone, mobileMoneyProvider };
      await saveIntent(paymentIntentId, updated);

      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('confirmPayment error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async cancelPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const intent = await loadIntent(id);
      if (!intent) { res.status(404).json({ success: false, error: 'Payment intent not found', code: 'INTENT_NOT_FOUND', timestamp: new Date().toISOString() }); return; }
      if (intent['userId'] !== userId) { res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN', timestamp: new Date().toISOString() }); return; }

      if (intent['status'] === 'completed') {
        res.status(400).json({ success: false, error: 'Cannot cancel a completed payment', code: 'ALREADY_COMPLETED', timestamp: new Date().toISOString() });
        return;
      }

      const updated = { ...intent, status: 'cancelled', cancelledAt: new Date().toISOString() };
      await saveIntent(id, updated);

      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('cancelPayment error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async getPaymentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const intent = await loadIntent(id);
      if (!intent || intent['userId'] !== userId) {
        res.status(404).json({ success: false, error: 'Payment intent not found', code: 'INTENT_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      res.json({ success: true, data: intent, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('getPaymentStatus error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  // ─── Mobile Money ──────────────────────────────────────────────────────────

  async initiateMobileMoney(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { paymentIntentId, phone, provider } = req.body;
      if (!paymentIntentId || !phone || !provider) {
        res.status(400).json({ success: false, error: 'paymentIntentId, phone, and provider are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      if (!mobileMoneyService.isSupportedProvider(provider)) {
        res.status(400).json({ success: false, error: `Unsupported provider: ${provider}`, code: 'UNSUPPORTED_PROVIDER', timestamp: new Date().toISOString() });
        return;
      }

      // Fetch the payment intent to get the amount
      const intentRaw = await redisClient.get(`${INTENT_PREFIX}${paymentIntentId}`);
      const intent = intentRaw ? JSON.parse(intentRaw) : null;
      const amount = intent?.amount ?? 0;
      const currency = intent?.currency ?? 'BWP';

      const reference = mobileMoneyService.generateReference();

      const result = await mobileMoneyService.initiate({
        phone, provider, reference,
        amount, currency,
        description: intent?.metadata?.rideId ? `ARYV ride payment` : `ARYV payment`,
      });

      await redisClient.set(
        `${MM_PREFIX}${reference}`,
        JSON.stringify({ reference, phone, provider, paymentIntentId, userId, status: 'pending', createdAt: new Date().toISOString() }),
        MM_TTL,
      );

      logger.info('Mobile money payment initiated', { phone, provider, reference });

      res.json({
        success: true,
        data: { reference, status: 'pending', ussdCode: result.ussdCode, deepLink: result.deepLink, instructions: result.instructions },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('initiateMobileMoney error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async checkMobileMoneyStatus(req: Request, res: Response): Promise<void> {
    try {
      const { reference } = req.params;
      if (!reference) {
        res.status(400).json({ success: false, error: 'reference is required', code: 'MISSING_REFERENCE', timestamp: new Date().toISOString() });
        return;
      }

      const raw = await redisClient.get(`${MM_PREFIX}${reference}`);
      if (!raw) {
        res.status(404).json({ success: false, error: 'Transaction not found or expired', code: 'TX_NOT_FOUND', timestamp: new Date().toISOString() });
        return;
      }

      const tx = JSON.parse(raw);

      // Poll the provider for current status
      let providerStatus = tx;
      if (mobileMoneyService.isSupportedProvider(tx.provider)) {
        const liveStatus = await mobileMoneyService.checkStatus(tx.provider, reference);
        providerStatus = { ...tx, ...liveStatus };
        // Persist updated status back to Redis
        if (liveStatus.status !== tx.status) {
          await redisClient.set(`${MM_PREFIX}${reference}`, JSON.stringify(providerStatus), MM_TTL);
        }
      }

      res.json({ success: true, data: providerStatus, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('checkMobileMoneyStatus error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  // ─── Wallet ────────────────────────────────────────────────────────────────

  async getWalletBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const result = await cashWalletService.getWalletBalance(userId);
      if (!result.success) {
        // Wallet might not exist yet — return zero balance
        res.json({ success: true, data: { available: 0, pending: 0, currency: 'USD', lastUpdated: new Date().toISOString() }, timestamp: new Date().toISOString() });
        return;
      }

      const w = result.data;
      res.json({
        success: true,
        data: {
          available: w?.availableBalance ?? 0,
          pending: w?.escrowBalance ?? 0,
          currency: w?.currency || 'USD',
          lastUpdated: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('getWalletBalance error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async topUpWallet(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { amount, currency, provider, phone } = req.body as {
        amount: number; currency?: string; provider?: string; phone?: string;
      };

      if (!amount || amount <= 0) {
        res.status(400).json({ success: false, error: 'Valid amount is required', code: 'INVALID_AMOUNT', timestamp: new Date().toISOString() });
        return;
      }

      // This used to credit the wallet immediately from the amount in the
      // request body, without taking a payment or verifying that one had been
      // made — so any authenticated user could mint balance from nothing. That
      // balance is real: settleCommission spends it, so a driver could clear
      // what they owe the platform for free.
      //
      // A top-up now only *initiates* a payment. The wallet is credited when
      // the provider confirms it, through the signed webhook.
      if (!provider) {
        res.status(400).json({ success: false, error: 'A mobile money provider is required', code: 'PROVIDER_REQUIRED', timestamp: new Date().toISOString() });
        return;
      }

      // Ensure the wallet exists so the credit has somewhere to land later.
      const walletResult = await cashWalletService.getWalletBalance(userId);
      if (!walletResult.success || !walletResult.data) {
        await cashWalletService.createWallet(userId);
      }

      const reference = mobileMoneyService.generateReference();

      let initiated;
      try {
        initiated = await mobileMoneyService.initiate({
          provider: provider as any,
          amount,
          currency: currency || PLATFORM_DEFAULT_CURRENCY,
          reference,
          phone: phone || '',
          description: 'ARYV wallet top-up',
        } as any);
      } catch (initiateError) {
        res.status(400).json({ success: false, error: (initiateError as Error).message, code: 'PROVIDER_UNSUPPORTED', timestamp: new Date().toISOString() });
        return;
      }

      // Park the intent so the webhook can find it and know who to credit.
      await redisClient.set(
        `mm_tx:${reference}`,
        JSON.stringify({
          userId,
          amount,
          currency: currency || PLATFORM_DEFAULT_CURRENCY,
          provider,
          purpose: 'wallet_topup',
          status: 'pending',
          createdAt: new Date().toISOString(),
        }),
        86400,
      );

      logger.info('Wallet top-up initiated', { userId, reference, provider, amount });

      res.status(201).json({
        success: true,
        data: {
          id: reference,
          amount,
          currency: currency || PLATFORM_DEFAULT_CURRENCY,
          // Pending, not completed: nothing has been paid yet.
          status: 'pending',
          paymentMethod: 'mobile_money',
          provider,
          instructions: initiated.instructions,
          ussdCode: initiated.ussdCode,
          deepLink: initiated.deepLink,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('topUpWallet error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async requestPayout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { amount, currency, paymentMethodId } = req.body;
      if (!amount || amount <= 0) {
        res.status(400).json({ success: false, error: 'Valid amount is required', code: 'INVALID_AMOUNT', timestamp: new Date().toISOString() });
        return;
      }

      const payoutId = `payout_${crypto.randomBytes(8).toString('hex')}`;
      const estimatedArrival = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 business days

      logger.info('Payout requested (queued for processing)', { userId, amount, currency, paymentMethodId, payoutId });

      res.json({
        success: true,
        data: { payoutId, status: 'pending', estimatedArrival },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('requestPayout error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  // ─── Transactions ──────────────────────────────────────────────────────────

  async getTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const page = parseInt(req.query['page'] as string) || 1;
      const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);

      const offset = (page - 1) * limit;
      const result = await cashWalletService.getTransactionHistory(userId, limit, offset);
      if (!result.success) {
        res.status(500).json({ success: false, error: result.error || 'Failed to fetch transactions', code: 'FETCH_TRANSACTIONS_FAILED', timestamp: new Date().toISOString() });
        return;
      }

      // Map CashTransaction shape to PaymentTransaction shape expected by mobile app
      const transactions = (result.data?.transactions || []).map((t: any) => ({
        id: t.id,
        amount: t.amount,
        fee: t.fee || 0,
        netAmount: t.amount - (t.fee || 0),
        currency: 'USD',
        status: t.status || 'completed',
        type: t.type === 'payment' ? 'ride_payment' : t.type === 'load' ? 'wallet_topup' : t.type,
        paymentMethod: 'wallet',
        provider: 'cash',
        description: t.description || '',
        createdAt: t.createdAt,
        completedAt: t.updatedAt,
      }));

      res.json({
        success: true,
        data: { transactions, total: result.data?.total || transactions.length, page },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('getTransactions error', { error: (error as Error).message, userId: req.user?.id });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  async getTransactionDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const result = await cashWalletService.getTransactionHistory(userId, 1000, 0);
      const tx = (result.data?.transactions || []).find((t: any) => t.id === id);
      if (!tx) { res.status(404).json({ success: false, error: 'Transaction not found', code: 'TX_NOT_FOUND', timestamp: new Date().toISOString() }); return; }

      res.json({ success: true, data: tx, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('getTransactionDetails error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }

  // ─── Refunds ───────────────────────────────────────────────────────────────

  async requestRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() }); return; }

      const { transactionId, reason, amount } = req.body;
      if (!transactionId || !reason) {
        res.status(400).json({ success: false, error: 'transactionId and reason are required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
        return;
      }

      // This wrote a log line and returned a generated id with status
      // 'pending'. Nothing was recorded anywhere, so a user was told their
      // refund request had been accepted and no human would ever see it.
      // Answering honestly is better than a receipt for something that did not
      // happen.
      const refundId = `refund_${crypto.randomBytes(8).toString('hex')}`;

      await redisClient.set(
        `refund_request:${refundId}`,
        JSON.stringify({
          refundId,
          userId,
          transactionId,
          reason,
          amount: amount ?? null,
          status: 'awaiting_review',
          requestedAt: new Date().toISOString(),
        }),
        30 * 24 * 60 * 60,
      );

      logger.warn('Refund requested — no automated refund path exists; needs manual handling', {
        userId, transactionId, reason, amount, refundId,
      });

      res.json({
        success: true,
        data: {
          refundId,
          status: 'awaiting_review',
          amount: amount ?? null,
          message: 'Your request has been recorded. Refunds are handled manually; '
            + 'our team will contact you.',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('requestRefund error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', timestamp: new Date().toISOString() });
    }
  }
}

export default PaymentController;
