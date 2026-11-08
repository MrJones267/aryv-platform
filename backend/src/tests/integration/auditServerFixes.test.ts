/**
 * @fileoverview Promo validation reads real redemptions; opposite wallet
 * transfers at the same moment both complete.
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * - /api/promos/validate checked a Redis key nothing writes since /apply was
 *   retired, so a code the person had already used was reported valid and
 *   the booking then refused it.
 * - transferMoney locked both wallets in request order, so A->B and B->A at
 *   the same moment deadlocked and Postgres aborted one of them.
 */

import request from 'supertest';
import app from '../../index';
import { User, CashWallet } from '../../models';
import PromoCode from '../../models/PromoCode';
import PromoRedemption from '../../models/PromoRedemption';
import { AuthService } from '../../services/AuthService';
import cashWalletService from '../../services/CashWalletService';
import { UserRole } from '../../types';

const makeUser = (email: string) => User.create({
  email, password: 'Integration-Test-Password-1!', firstName: 'Test', lastName: 'User', role: UserRole.PASSENGER,
} as any);

describe('promo validation', () => {
  it('reports a code this person has already used, and accepts it for someone who has not', async () => {
    const used = await makeUser('used@test.com');
    const fresh = await makeUser('fresh@test.com');
    const promo = await PromoCode.create({
      code: 'WELCOME20', type: 'percentage', value: 20, maxDiscount: 10, minOrderAmount: 0,
      usageLimit: null, expiresAt: null, isActive: true, description: 'Welcome',
    } as any);
    await PromoRedemption.create({ promoCodeId: promo.id, userId: used.id, discountAmount: 5, orderAmount: 25 } as any);

    const validate = (u: any) => request(app).post('/api/promos/validate')
      .set('Authorization', `Bearer ${AuthService.generateAccessToken({ userId: u.id, email: u.email, role: u.role })}`)
      .send({ code: 'welcome20', orderAmount: 50 });

    const again = await validate(used);
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('PROMO_ALREADY_USED');

    const first = await validate(fresh);
    expect(first.status).toBe(200);
    expect(first.body.data.code).toBe('WELCOME20');
  });
});

describe('wallet transfers', () => {
  it('completes transfers in both directions at the same moment, with balances intact', async () => {
    const a = await makeUser('a@test.com');
    const b = await makeUser('b@test.com');
    for (const u of [a, b]) {
      await cashWalletService.createWallet(u.id);
      await CashWallet.update({ balance: 100 } as any, { where: { userId: u.id } });
    }

    const rounds = 5;
    const results = await Promise.all(
      Array.from({ length: rounds }, () => [
        cashWalletService.transferMoney({ fromUserId: a.id, toUserId: b.id, amount: 10, description: 'a to b' }),
        cashWalletService.transferMoney({ fromUserId: b.id, toUserId: a.id, amount: 7, description: 'b to a' }),
      ]).flat(),
    );

    expect(results.filter((r) => !r.success).map((r) => r.error)).toEqual([]);
    const balance = async (u: any) =>
      Number((await CashWallet.findOne({ where: { userId: u.id } }))!.balance);
    expect(await balance(a)).toBeCloseTo(100 - rounds * 10 + rounds * 7, 2);
    expect(await balance(b)).toBeCloseTo(100 + rounds * 10 - rounds * 7, 2);
  }, 30000);
});
