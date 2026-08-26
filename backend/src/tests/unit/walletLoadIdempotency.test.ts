/**
 * @fileoverview A replayed payment webhook must not credit a wallet twice.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * Wallet credits were de-duplicated by a field on a JSON blob in Redis with a
 * 24-hour TTL, under an allkeys-lru eviction policy, written by a `set` that
 * swallows its own errors. Payment providers retry webhooks as a matter of
 * course, so any of eviction, expiry, a failed write, or Redis simply being
 * down turned a retry into a second credit of real money.
 *
 * Migration 025 moves that guarantee into the ledger: a partial unique index
 * on (source, source_reference) for `type = 'load'`. These cover how the
 * service behaves when that index does its job.
 */

import { UniqueConstraintError } from 'sequelize';

jest.mock('../../config/database', () => {
  const actual = jest.requireActual('../../config/database');
  const unavailable = () => Promise.reject(new Error('DB unavailable in unit tests'));
  (actual.sequelize as any).connectionManager.getConnection = jest.fn(unavailable);
  actual.sequelize.authenticate = jest.fn(unavailable);
  actual.sequelize.query = jest.fn(unavailable);
  actual.sequelize.transaction = jest.fn(async () => ({
    commit: jest.fn(),
    rollback: jest.fn(),
    LOCK: { UPDATE: 'UPDATE' },
  }));
  return actual;
});

import { CashWalletService } from '../../services/CashWalletService';
import { CashWallet, CashWalletTransaction } from '../../models/CashWallet';

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REFERENCE = 'OM-provider-ref-0001';

const duplicateError = () => {
  const err = new UniqueConstraintError({
    errors: [{ path: 'source_reference' } as never],
  });
  (err as unknown as { parent: { constraint: string } }).parent = {
    constraint: 'cash_wallet_transactions_load_reference_unique',
  };
  return err;
};

describe('wallet load idempotency', () => {
  let walletService: CashWalletService;
  let findOne: jest.SpyInstance;
  let create: jest.SpyInstance;
  let update: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    walletService = new CashWalletService();

    update = jest.fn();
    findOne = jest.spyOn(CashWallet, 'findOne').mockResolvedValue({
      id: 'wallet-1',
      userId: USER_ID,
      status: 'active',
      currency: 'BWP',
      balance: 100,
      update,
    } as never);

    // Limit and source checks both pass, so the test is about the insert.
    jest.spyOn(walletService as never as { checkLoadLimits: () => unknown }, 'checkLoadLimits')
      .mockResolvedValue({ success: true } as never);
    jest.spyOn(walletService as never as { validateLoadSource: () => unknown }, 'validateLoadSource')
      .mockResolvedValue({ success: true } as never);
    jest.spyOn(walletService, 'getWalletBalance')
      .mockResolvedValue({ success: true, data: { balance: 150 } } as never);

    create = jest.spyOn(CashWalletTransaction, 'create');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const load = () => walletService.loadWallet({
    userId: USER_ID,
    amount: 50,
    source: 'mobile_money',
    sourceReference: REFERENCE,
    metadata: { description: 'Wallet top-up' },
  });

  it('credits the wallet on the first webhook', async () => {
    create.mockResolvedValue({ id: 'tx-1' } as never);

    const result = await load();

    expect(result.success).toBe(true);
    expect(result.alreadyCredited).toBeUndefined();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 150 }),
      expect.anything(),
    );
  });

  it('does not credit again when the reference has already been used', async () => {
    // What the unique index does on a provider's retry.
    create.mockRejectedValue(duplicateError());

    const result = await load();

    // Reported as a success so the caller stops retrying — but no balance moved.
    expect(result.success).toBe(true);
    expect(result.alreadyCredited).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it('still reports unrelated failures as failures', async () => {
    // A different unique violation must not be mistaken for a duplicate
    // payment and silently swallowed.
    const other = new UniqueConstraintError({ errors: [{ path: 'wallet_id' } as never] });
    (other as unknown as { parent: { constraint: string } }).parent = {
      constraint: 'cash_wallets_user_id_unique',
    };
    create.mockRejectedValue(other);

    const result = await load();

    expect(result.success).toBe(false);
    expect(result.code).toBe('WALLET_LOAD_FAILED');
    expect(update).not.toHaveBeenCalled();
  });

  it('reports a genuine database error as a failure', async () => {
    create.mockRejectedValue(new Error('connection reset'));

    const result = await load();

    expect(result.success).toBe(false);
    expect(result.alreadyCredited).toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses to credit an inactive wallet', async () => {
    findOne.mockResolvedValue({ id: 'w', status: 'frozen', balance: 0, update } as never);

    const result = await load();

    expect(result.success).toBe(false);
    expect(result.code).toBe('WALLET_INACTIVE');
    expect(create).not.toHaveBeenCalled();
  });
});
