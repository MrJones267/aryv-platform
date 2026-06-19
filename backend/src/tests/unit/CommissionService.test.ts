/**
 * @fileoverview Unit tests for CommissionService — cash-ride commission
 *               accrual, settlement, balance and block enforcement.
 * @author Oabona-Majoko
 * @created 2026-06-17
 * @lastModified 2026-06-17
 */

import { sequelize } from '../../config/database';
import CommissionService from '../../services/CommissionService';
import UserWallet from '../../models/UserWallet';
import CommissionLedger, {
  CommissionEntryType,
  SettlementMethod,
} from '../../models/CommissionLedger';

// Mock the models. config/database is intentionally NOT mocked: sequelize
// .define() runs without a DB connection, and we stub sequelize.transaction().
jest.mock('../../models/UserWallet');
jest.mock('../../models/CommissionLedger', () => {
  const actual = jest.requireActual('../../models/CommissionLedger');
  return {
    __esModule: true,
    ...actual,
    default: { create: jest.fn() },
  };
});
jest.mock('../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

const MockedUserWallet = UserWallet as unknown as {
  findOne: jest.Mock;
  create: jest.Mock;
};
const MockedLedger = CommissionLedger as unknown as { create: jest.Mock };

/** Build a wallet stub with a jest.fn update() and sane defaults. */
const makeWallet = (overrides: Record<string, unknown> = {}) => ({
  userId: 'driver-1',
  availableBalance: 0,
  commissionOwed: 0,
  totalCommissionPaid: 0,
  commissionBlockThreshold: 50,
  lastCommissionSettledAt: null,
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('CommissionService', () => {
  let service: CommissionService;
  let mockTx: { commit: jest.Mock; rollback: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommissionService();
    mockTx = { commit: jest.fn().mockResolvedValue(undefined), rollback: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(sequelize, 'transaction').mockResolvedValue(mockTx as any);
    MockedLedger.create.mockResolvedValue({ id: 'ledger-1' });
  });

  describe('accrueCommission', () => {
    const tx = {} as any;

    it('adds the fee to commissionOwed and writes an ACCRUAL ledger entry', async () => {
      const wallet = makeWallet({ commissionOwed: 10 });
      MockedUserWallet.findOne.mockResolvedValue(wallet);

      await service.accrueCommission('driver-1', 2.5, 'cash-txn-1', tx);

      expect(wallet.update).toHaveBeenCalledWith({ commissionOwed: 12.5 }, { transaction: tx });
      expect(MockedLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          driverId: 'driver-1',
          entryType: CommissionEntryType.ACCRUAL,
          amount: 2.5,
          balanceAfter: 12.5,
          cashTransactionId: 'cash-txn-1',
        }),
        { transaction: tx },
      );
    });

    it('creates a wallet when the driver has none yet', async () => {
      MockedUserWallet.findOne.mockResolvedValue(null);
      const created = makeWallet({ commissionOwed: 0 });
      MockedUserWallet.create.mockResolvedValue(created);

      await service.accrueCommission('driver-1', 5, 'cash-txn-2', tx);

      expect(MockedUserWallet.create).toHaveBeenCalledWith({ userId: 'driver-1' }, { transaction: tx });
      expect(created.update).toHaveBeenCalledWith({ commissionOwed: 5 }, { transaction: tx });
    });

    it('is a no-op for non-positive amounts', async () => {
      await service.accrueCommission('driver-1', 0, 'cash-txn-3', tx);
      expect(MockedUserWallet.findOne).not.toHaveBeenCalled();
      expect(MockedLedger.create).not.toHaveBeenCalled();
    });

    it('handles string decimal balances (Sequelize DECIMAL) without concatenating', async () => {
      const wallet = makeWallet({ commissionOwed: '10.00' as unknown as number });
      MockedUserWallet.findOne.mockResolvedValue(wallet);

      await service.accrueCommission('driver-1', 2.5, 'cash-txn-4', tx);

      expect(wallet.update).toHaveBeenCalledWith({ commissionOwed: 12.5 }, { transaction: tx });
    });
  });

  describe('settleCommission', () => {
    it('rejects non-positive amounts', async () => {
      const res = await service.settleCommission('driver-1', 0, SettlementMethod.CASH_AGENT);
      expect(res.success).toBe(false);
      expect(sequelize.transaction).not.toHaveBeenCalled();
    });

    it('returns an error when nothing is owed', async () => {
      MockedUserWallet.findOne.mockResolvedValue(makeWallet({ commissionOwed: 0 }));

      const res = await service.settleCommission('driver-1', 5, SettlementMethod.CASH_AGENT);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/no outstanding commission/i);
      expect(mockTx.rollback).toHaveBeenCalled();
    });

    it('settles via cash agent, reduces owed, records totalCommissionPaid and commits', async () => {
      const wallet = makeWallet({ commissionOwed: 20, totalCommissionPaid: 5 });
      MockedUserWallet.findOne.mockResolvedValue(wallet);

      const res = await service.settleCommission('driver-1', 12, SettlementMethod.CASH_AGENT, 'admin-9');

      expect(res.success).toBe(true);
      expect(res.amountSettled).toBe(12);
      expect(res.remainingOwed).toBe(8);
      expect(wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({ commissionOwed: 8, totalCommissionPaid: 17 }),
        { transaction: mockTx },
      );
      expect(MockedLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: CommissionEntryType.SETTLEMENT,
          amount: 12,
          balanceAfter: 8,
          settlementMethod: SettlementMethod.CASH_AGENT,
          recordedBy: 'admin-9',
        }),
        { transaction: mockTx },
      );
      expect(mockTx.commit).toHaveBeenCalled();
    });

    it('never settles more than is owed (caps the applied amount)', async () => {
      const wallet = makeWallet({ commissionOwed: 7 });
      MockedUserWallet.findOne.mockResolvedValue(wallet);

      const res = await service.settleCommission('driver-1', 100, SettlementMethod.MOBILE_MONEY);

      expect(res.amountSettled).toBe(7);
      expect(res.remainingOwed).toBe(0);
    });

    it('deducts from the digital wallet on WALLET_DEDUCTION when funds exist', async () => {
      const wallet = makeWallet({ commissionOwed: 15, availableBalance: 50 });
      MockedUserWallet.findOne.mockResolvedValue(wallet);

      const res = await service.settleCommission('driver-1', 15, SettlementMethod.WALLET_DEDUCTION);

      expect(res.success).toBe(true);
      // First update debits the wallet balance.
      expect(wallet.update).toHaveBeenCalledWith({ availableBalance: 35 }, { transaction: mockTx });
    });

    it('fails WALLET_DEDUCTION with insufficient balance and rolls back', async () => {
      const wallet = makeWallet({ commissionOwed: 15, availableBalance: 5 });
      MockedUserWallet.findOne.mockResolvedValue(wallet);

      const res = await service.settleCommission('driver-1', 15, SettlementMethod.WALLET_DEDUCTION);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/insufficient wallet balance/i);
      expect(mockTx.rollback).toHaveBeenCalled();
      expect(MockedLedger.create).not.toHaveBeenCalled();
    });
  });

  describe('getBalance', () => {
    it('reports isBlocked=true when owed reaches the threshold', async () => {
      MockedUserWallet.findOne.mockResolvedValue(
        makeWallet({ commissionOwed: 50, commissionBlockThreshold: 50, totalCommissionPaid: 3 }),
      );

      const balance = await service.getBalance('driver-1');

      expect(balance.commissionOwed).toBe(50);
      expect(balance.totalCommissionPaid).toBe(3);
      expect(balance.isBlocked).toBe(true);
    });

    it('reports isBlocked=false below the threshold', async () => {
      MockedUserWallet.findOne.mockResolvedValue(
        makeWallet({ commissionOwed: 10, commissionBlockThreshold: 50 }),
      );

      const balance = await service.getBalance('driver-1');
      expect(balance.isBlocked).toBe(false);
    });
  });

  describe('isBlockedForUnpaidCommission', () => {
    it('returns blocked=true at or above the threshold', async () => {
      MockedUserWallet.findOne.mockResolvedValue(
        makeWallet({ commissionOwed: 60, commissionBlockThreshold: 50 }),
      );

      const res = await service.isBlockedForUnpaidCommission('driver-1');
      expect(res).toEqual({ blocked: true, owed: 60, threshold: 50 });
    });

    it('defaults to not-blocked when the driver has no wallet', async () => {
      MockedUserWallet.findOne.mockResolvedValue(null);

      const res = await service.isBlockedForUnpaidCommission('driver-1');
      expect(res.blocked).toBe(false);
    });
  });
});
