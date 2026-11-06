/**
 * @fileoverview Paying commission from the wallet: CashWalletService.debitForCommission
 * @author Oabona-Majoko
 * @created 2026-11-05
 * @lastModified 2026-11-05
 *
 * Commission paid from the wallet used to debit user_wallets.availableBalance,
 * which nothing ever credits, so a driver's top-ups could never pay it. It
 * now debits cash_wallets inside the settlement's own transaction. Only money
 * that is actually available can be spent; frozen and escrowed amounts cannot.
 */

jest.mock('../../config/database', () => {
  const actual = jest.requireActual('../../config/database');
  const unavailable = () => Promise.reject(new Error('DB unavailable in unit tests'));
  (actual.sequelize as any).connectionManager.getConnection = jest.fn(unavailable);
  actual.sequelize.authenticate = jest.fn(unavailable);
  actual.sequelize.query = jest.fn(unavailable);
  return actual;
});

import { CashWalletService } from '../../services/CashWalletService';
import { CashWallet, CashWalletTransaction } from '../../models/CashWallet';

const DRIVER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('paying commission from the wallet', () => {
  const tx = { commit: jest.fn(), rollback: jest.fn(), LOCK: { UPDATE: 'UPDATE' } } as any;
  let walletService: CashWalletService;
  let update: jest.Mock;
  let create: jest.SpyInstance;

  const wallet = (overrides: Record<string, unknown> = {}) => ({
    id: 'wallet-1',
    userId: DRIVER_ID,
    status: 'active',
    currency: 'BWP',
    balance: '50.00',
    frozenBalance: '0.00',
    escrowBalance: '0.00',
    update,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    walletService = new CashWalletService();
    update = jest.fn();
    create = jest.spyOn(CashWalletTransaction, 'create').mockResolvedValue({ id: 'cwt-1' } as never);
  });

  it('takes the amount from the balance and records it, in the caller\'s transaction', async () => {
    const findOne = jest.spyOn(CashWallet, 'findOne').mockResolvedValue(wallet() as never);

    const result = await walletService.debitForCommission(DRIVER_ID, 15, tx);

    expect(result).toMatchObject({ success: true, transactionId: 'cwt-1', balanceAfter: 35 });
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ transaction: tx, lock: 'UPDATE' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 'wallet-1', type: 'fee', amount: 15, balanceBefore: 50, balanceAfter: 35,
        status: 'completed', metadata: { purpose: 'commission_settlement' },
      }),
      { transaction: tx },
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ balance: 35 }), { transaction: tx });
    // The caller owns the transaction.
    expect(tx.commit).not.toHaveBeenCalled();
    expect(tx.rollback).not.toHaveBeenCalled();
  });

  it('cannot spend money that is frozen or held in escrow', async () => {
    jest.spyOn(CashWallet, 'findOne').mockResolvedValue(
      wallet({ balance: '50.00', frozenBalance: '20.00', escrowBalance: '20.00' }) as never,
    );

    const result = await walletService.debitForCommission(DRIVER_ID, 15, tx);

    expect(result).toMatchObject({ success: false, code: 'INSUFFICIENT_BALANCE' });
    expect(result.error).toContain('Available: 10');
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses when there is no wallet, or it is not active', async () => {
    jest.spyOn(CashWallet, 'findOne').mockResolvedValueOnce(null as never);
    expect(await walletService.debitForCommission(DRIVER_ID, 15, tx)).toMatchObject({ success: false, code: 'WALLET_INACTIVE' });

    jest.spyOn(CashWallet, 'findOne').mockResolvedValueOnce(wallet({ status: 'suspended' }) as never);
    expect(await walletService.debitForCommission(DRIVER_ID, 15, tx)).toMatchObject({ success: false, code: 'WALLET_INACTIVE' });

    expect(create).not.toHaveBeenCalled();
  });
});
