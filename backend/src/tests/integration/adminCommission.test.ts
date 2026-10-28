/**
 * @fileoverview Integration tests for collecting cash-ride commission from drivers
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * A driver owing the block threshold cannot take cash rides, and nothing in
 * production could record that they had paid: the only settlement path
 * deducted from an in-app wallet that does not exist there. These cover the
 * admin list of what is owed and recording a payment received.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { User } from '../../models';
import { AdminUser } from '../../models/AdminUser';
import UserWallet from '../../models/UserWallet';
import { UserRole } from '../../types';

describe('Admin commission collection', () => {
  let adminToken: string;
  let moderatorToken: string;
  let blocked: any;
  let owing: any;

  const tokenFor = (admin: AdminUser) =>
    jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions, type: 'admin' },
      process.env['ADMIN_JWT_SECRET']!,
      { expiresIn: '1h' }
    );

  const driverOwing = async (email: string, firstName: string, owed: number) => {
    const driver = await User.create({
      email, password: 'Integration-Test-Password-1!', firstName, lastName: 'Driver', role: UserRole.DRIVER,
    });
    await UserWallet.create({ userId: driver.id, commissionOwed: owed } as any);
    return driver;
  };

  beforeEach(async () => {
    // The setup file empties every table before each test.
    adminToken = tokenFor(await AdminUser.createAdmin({
      email: 'finance@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Fin', lastName: 'Ance', role: 'admin', permissions: ['users.read'],
    }));
    moderatorToken = tokenFor(await AdminUser.createAdmin({
      email: 'mod@test.com', password: 'Integration-Test-Password-1!',
      firstName: 'Mod', lastName: 'Erator', role: 'moderator', permissions: ['users.read'],
    }));
    blocked = await driverOwing('blocked@test.com', 'Kabelo', 62.5);
    owing = await driverOwing('owing@test.com', 'Lorato', 18);
    await driverOwing('clear@test.com', 'Clear', 0);
  });

  const as = (token: string) => ({
    get: (p: string) => request(app).get(p).set('Authorization', `Bearer ${token}`),
    pay: (driverId: string, body: object) =>
      request(app).post(`/api/admin/commission/${driverId}/settlements`).set('Authorization', `Bearer ${token}`).send(body),
  });

  it('lists drivers who owe, most first, and flags who is blocked', async () => {
    const response = await as(adminToken).get('/api/admin/commission').expect(200);
    const { drivers, totals } = response.body.data;

    expect(totals).toEqual({ drivers: 2, blocked: 1 });
    expect(drivers.map((d: any) => [d.driverName, d.owed, d.blocked])).toEqual([
      ['Kabelo Driver', 62.5, true],
      ['Lorato Driver', 18, false],
    ]);
  });

  it('can show only blocked drivers', async () => {
    const response = await as(adminToken).get('/api/admin/commission?filter=blocked').expect(200);
    expect(response.body.data.drivers.map((d: any) => d.driverId)).toEqual([blocked.id]);
  });

  it('records a payment, clears the debt and unblocks the driver', async () => {
    const response = await as(adminToken)
      .pay(blocked.id, { amount: 62.5, method: 'mobile_money', reference: 'OM-123456', note: 'Paid at Main Mall' })
      .expect(200);
    expect(response.body.data).toMatchObject({ amountSettled: 62.5, remainingOwed: 0 });

    const wallet = await UserWallet.findOne({ where: { userId: blocked.id } });
    expect(Number(wallet!.commissionOwed)).toBe(0);
    expect(Number(wallet!.totalCommissionPaid)).toBe(62.5);

    const list = await as(adminToken).get('/api/admin/commission').expect(200);
    expect(list.body.data.totals).toEqual({ drivers: 1, blocked: 0 });
  });

  it('records a part payment, and never applies more than is owed', async () => {
    await as(adminToken).pay(owing.id, { amount: 10, method: 'cash_agent', reference: 'RCPT-9' }).expect(200);
    const over = await as(adminToken).pay(owing.id, { amount: 50, method: 'bank_transfer', reference: 'FNB-77' }).expect(200);
    expect(over.body.data).toMatchObject({ amountSettled: 8, remainingOwed: 0 });
  });

  it('keeps who recorded each payment, with its reference, in the history', async () => {
    await as(adminToken).pay(owing.id, { amount: 18, method: 'mobile_money', reference: 'MZ-42' }).expect(200);
    const ledger = await as(adminToken).get(`/api/admin/commission/${owing.id}/ledger`).expect(200);
    const [entry] = ledger.body.data.entries;
    expect(entry).toMatchObject({ entryType: 'settlement', amount: 18, balanceAfter: 0, settlementMethod: 'mobile_money', recordedBy: 'finance@test.com' });
    expect(entry.description).toContain('MZ-42');
  });

  it('refuses a driver who owes nothing', async () => {
    await as(adminToken).pay(owing.id, { amount: 18, method: 'manual', reference: 'X1' }).expect(200);
    await as(adminToken).pay(owing.id, { amount: 1, method: 'manual', reference: 'X2' }).expect(409);
  });

  it.each([
    [{ amount: 0, method: 'manual', reference: 'R1' }],
    [{ amount: 10.555, method: 'manual', reference: 'R1' }],
    [{ amount: '10', method: 'manual', reference: 'R1' }],
    [{ amount: 10, method: 'wallet_deduction', reference: 'R1' }],
    [{ amount: 10, method: 'manual' }],
  ])('refuses %p', async body => {
    await as(adminToken).pay(owing.id, body).expect(400);
  });

  it('is not open to moderators', async () => {
    await as(moderatorToken).get('/api/admin/commission').expect(403);
    await as(moderatorToken).pay(owing.id, { amount: 1, method: 'manual', reference: 'R1' }).expect(403);
  });
});
