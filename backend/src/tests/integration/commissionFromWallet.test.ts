/**
 * @fileoverview A driver pays their commission from their wallet balance
 * @author Oabona-Majoko
 * @created 2026-11-05
 * @lastModified 2026-11-05
 *
 * Money a driver has in the app is in cash_wallets. Paying commission from
 * the wallet used to read user_wallets.availableBalance instead, which nothing
 * credits, so it always failed with an "Available: 0" error. It now takes the
 * money from cash_wallets and records the debit there, alongside the
 * commission ledger entry.
 */

import request from 'supertest';
import app from '../../index';
import { User } from '../../models';
import UserWallet from '../../models/UserWallet';
import { CashWallet, CashWalletTransaction } from '../../models/CashWallet';
import CommissionLedger from '../../models/CommissionLedger';
import { AuthService } from '../../services/AuthService';
import { UserRole } from '../../types';

describe('POST /api/payments/commission/settle from the wallet', () => {
  let driver: any;
  let token: string;

  beforeEach(async () => {
    driver = await User.create({
      email: 'driver@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Tumelo', lastName: 'Driver', role: UserRole.DRIVER,
    });
    token = AuthService.generateAccessToken({ userId: driver.id, email: driver.email, role: driver.role });
    await UserWallet.create({ userId: driver.id, commissionOwed: 18 } as any);
  });

  const settle = (amount: number) =>
    request(app).post('/api/payments/commission/settle').set('Authorization', `Bearer ${token}`).send({ amount });

  it('takes the commission out of the driver\'s wallet balance', async () => {
    await CashWallet.create({ userId: driver.id, balance: 50, currency: 'BWP' } as any);

    const response = await settle(18).expect(200);
    expect(response.body.data).toMatchObject({ amountSettled: 18, remainingOwed: 0 });

    const wallet = await CashWallet.findOne({ where: { userId: driver.id } });
    expect(Number(wallet!.balance)).toBe(32);

    const debits = await CashWalletTransaction.findAll({ where: { walletId: wallet!.id } });
    expect(debits).toHaveLength(1);
    expect(debits[0]).toMatchObject({ type: 'fee', status: 'completed' });
    expect(Number(debits[0]!.amount)).toBe(18);

    const profile = await UserWallet.findOne({ where: { userId: driver.id } });
    expect(Number(profile!.commissionOwed)).toBe(0);
    expect(await CommissionLedger.count({ where: { driverId: driver.id, entryType: 'settlement' } })).toBe(1);
  });

  it('changes nothing when the wallet cannot cover it', async () => {
    await CashWallet.create({ userId: driver.id, balance: 5, currency: 'BWP' } as any);

    const response = await settle(18).expect(400);
    expect(response.body.error).toMatch(/insufficient wallet balance/i);

    const wallet = await CashWallet.findOne({ where: { userId: driver.id } });
    expect(Number(wallet!.balance)).toBe(5);
    expect(await CashWalletTransaction.count()).toBe(0);
    const profile = await UserWallet.findOne({ where: { userId: driver.id } });
    expect(Number(profile!.commissionOwed)).toBe(18);
    expect(await CommissionLedger.count({ where: { driverId: driver.id, entryType: 'settlement' } })).toBe(0);
  });

  it('says so when the driver has no wallet yet', async () => {
    const response = await settle(18).expect(400);
    expect(response.body.error).toMatch(/no active wallet/i);
  });
});
