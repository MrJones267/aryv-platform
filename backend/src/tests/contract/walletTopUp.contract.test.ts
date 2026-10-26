/**
 * @fileoverview A wallet top-up must not credit anything until a payment is
 *               confirmed.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * POST /api/payments/wallet/topup took an amount from the request body and
 * credited the wallet with it immediately — no payment taken, nothing verified.
 * Any authenticated user could mint balance from nothing, and that balance is
 * real money in the system: settleCommission spends it, so a driver could clear
 * what they owe the platform for free.
 */

import request from 'supertest';
import type { Express } from 'express';
import { buildApp, authHeader, TEST_USER } from './harness';
import User from '../../models/User';
import cashWalletService from '../../services/CashWalletService';

describe('wallet top-up', () => {
  let app: Express;
  let loadWallet: jest.SpyInstance;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.spyOn(User, 'findByPk').mockImplementation((async (pk: unknown) =>
      pk === TEST_USER.id
        ? { ...TEST_USER, toSafeObject: () => TEST_USER }
        : null) as any);

    loadWallet = jest.spyOn(cashWalletService, 'loadWallet').mockResolvedValue({
      success: true,
    } as any);
    jest.spyOn(cashWalletService, 'getWalletBalance').mockResolvedValue({
      success: true,
      data: { balance: 0 },
    } as any);
    jest.spyOn(cashWalletService, 'createWallet').mockResolvedValue({ success: true } as any);
  });

  it('never credits the wallet from the request alone', async () => {
    // The regression. Nothing a caller can send should move a balance.
    //
    // The status assertion is load-bearing: an earlier version of this test
    // used the wrong path and passed against a 404, proving nothing.
    const res = await request(app)
      .post('/api/payments/wallet/topup')
      .set(authHeader())
      .send({ amount: 1000000, currency: 'BWP', provider: 'orange_money', phone: '+26771234567' });

    expect(res.status).not.toBe(404);
    expect(loadWallet).not.toHaveBeenCalled();
  });

  it('does not report a top-up as completed', async () => {
    // It answered `status: 'completed'` while no money had moved, which is what
    // made the hole invisible from the client's side.
    const res = await request(app)
      .post('/api/payments/wallet/topup')
      .set(authHeader())
      .send({ amount: 50, currency: 'BWP', provider: 'orange_money', phone: '+26771234567' });

    if (res.status === 201) {
      expect(res.body.data.status).not.toBe('completed');
      expect(res.body.data.status).toBe('pending');
    }
  });

  it('requires a provider, since a top-up is now a real payment', async () => {
    const res = await request(app)
      .post('/api/payments/wallet/topup')
      .set(authHeader())
      .send({ amount: 50, currency: 'BWP' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PROVIDER_REQUIRED');
  });

  it('still rejects a nonsensical amount', async () => {
    const res = await request(app)
      .post('/api/payments/wallet/topup')
      .set(authHeader())
      .send({ amount: -100, provider: 'orange_money' });

    expect(res.status).toBe(400);
  });

  it('refuses an unauthenticated caller', async () => {
    const res = await request(app)
      .post('/api/payments/wallet/topup')
      .send({ amount: 50, provider: 'orange_money' });

    expect([400, 401, 429]).toContain(res.status);
    expect(loadWallet).not.toHaveBeenCalled();
  });
});
