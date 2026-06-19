/**
 * @fileoverview Commission service — accrues platform commission on cash rides
 *               to a driver-owed balance, records settlements, and enforces a
 *               cap on unpaid commission. This lets ARYV earn on cash rides
 *               while riders pay 100% in cash (no card / mobile money needed).
 * @author Oabona-Majoko
 * @created 2026-06-17
 * @lastModified 2026-06-17
 */

import { Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import UserWallet from '../models/UserWallet';
import CommissionLedger, {
  CommissionEntryType,
  SettlementMethod,
} from '../models/CommissionLedger';
import { logInfo, logError } from '../utils/logger';

export interface CommissionBalance {
  commissionOwed: number;
  totalCommissionPaid: number;
  blockThreshold: number;
  isBlocked: boolean;
  lastSettledAt: Date | null;
}

export interface SettlementResult {
  success: boolean;
  amountSettled?: number;
  remainingOwed?: number;
  ledgerEntryId?: string;
  error?: string;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export class CommissionService {
  /**
   * Accrue platform commission to a driver's owed balance after a completed
   * cash ride. Designed to run inside an existing DB transaction so it commits
   * atomically with the ride completion.
   */
  async accrueCommission(
    driverId: string,
    amount: number,
    cashTransactionId: string,
    transaction: Transaction,
  ): Promise<void> {
    if (amount <= 0) {
      return;
    }

    let wallet = await UserWallet.findOne({ where: { userId: driverId }, transaction });
    if (!wallet) {
      wallet = await UserWallet.create({ userId: driverId }, { transaction });
    }

    const newOwed = round2(Number(wallet.commissionOwed) + amount);

    await wallet.update({ commissionOwed: newOwed }, { transaction });

    await CommissionLedger.create({
      driverId,
      entryType: CommissionEntryType.ACCRUAL,
      amount: round2(amount),
      balanceAfter: newOwed,
      cashTransactionId,
      description: 'Platform commission on cash ride',
    }, { transaction });

    logInfo('Commission accrued for cash ride', {
      driverId,
      amount: round2(amount),
      commissionOwed: newOwed,
      cashTransactionId,
    });
  }

  /**
   * Record a settlement: the driver has paid all or part of the owed
   * commission (via wallet deduction, cash agent, mobile money, etc.).
   */
  async settleCommission(
    driverId: string,
    amount: number,
    method: SettlementMethod,
    recordedBy?: string,
    description?: string,
  ): Promise<SettlementResult> {
    if (amount <= 0) {
      return { success: false, error: 'Settlement amount must be greater than zero' };
    }

    const transaction = await sequelize.transaction();
    try {
      const wallet = await UserWallet.findOne({ where: { userId: driverId }, transaction });
      if (!wallet) {
        await transaction.rollback();
        return { success: false, error: 'Driver wallet not found' };
      }

      const owed = Number(wallet.commissionOwed);
      if (owed <= 0) {
        await transaction.rollback();
        return { success: false, error: 'No outstanding commission to settle' };
      }

      // Never settle more than is owed; refund/over-payment is out of scope.
      const applied = round2(Math.min(amount, owed));
      const newOwed = round2(owed - applied);

      // If settling via the digital wallet, the funds must exist there.
      if (method === SettlementMethod.WALLET_DEDUCTION) {
        const available = Number(wallet.availableBalance);
        if (available < applied) {
          await transaction.rollback();
          return {
            success: false,
            error: `Insufficient wallet balance. Available: ${available}, required: ${applied}`,
          };
        }
        await wallet.update({
          availableBalance: round2(available - applied),
        }, { transaction });
      }

      await wallet.update({
        commissionOwed: newOwed,
        totalCommissionPaid: round2(Number(wallet.totalCommissionPaid) + applied),
        lastCommissionSettledAt: new Date(),
      }, { transaction });

      const entry = await CommissionLedger.create({
        driverId,
        entryType: CommissionEntryType.SETTLEMENT,
        amount: applied,
        balanceAfter: newOwed,
        settlementMethod: method,
        recordedBy: recordedBy ?? null,
        description: description ?? `Commission settled via ${method}`,
      }, { transaction });

      await transaction.commit();

      logInfo('Commission settled', {
        driverId,
        amountSettled: applied,
        remainingOwed: newOwed,
        method,
      });

      return {
        success: true,
        amountSettled: applied,
        remainingOwed: newOwed,
        ledgerEntryId: entry.id,
      };
    } catch (error) {
      await transaction.rollback();
      logError('Error settling commission', error as Error, { driverId, amount, method });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get a driver's current commission standing.
   */
  async getBalance(driverId: string): Promise<CommissionBalance> {
    let wallet = await UserWallet.findOne({ where: { userId: driverId } });
    if (!wallet) {
      wallet = await UserWallet.create({ userId: driverId });
    }

    const owed = Number(wallet.commissionOwed);
    const threshold = Number(wallet.commissionBlockThreshold);

    return {
      commissionOwed: owed,
      totalCommissionPaid: Number(wallet.totalCommissionPaid),
      blockThreshold: threshold,
      isBlocked: owed >= threshold,
      lastSettledAt: wallet.lastCommissionSettledAt ?? null,
    };
  }

  /**
   * Whether a driver is blocked from accepting new cash rides because their
   * unpaid commission has reached the threshold. This is the enforcement
   * mechanism that makes cash-ride commission actually collectable.
   */
  async isBlockedForUnpaidCommission(
    driverId: string,
    transaction?: Transaction,
  ): Promise<{ blocked: boolean; owed: number; threshold: number }> {
    const wallet = await UserWallet.findOne({
      where: { userId: driverId },
      ...(transaction ? { transaction } : {}),
    });

    if (!wallet) {
      return { blocked: false, owed: 0, threshold: 50 };
    }

    const owed = Number(wallet.commissionOwed);
    const threshold = Number(wallet.commissionBlockThreshold);
    return { blocked: owed >= threshold, owed, threshold };
  }

  /**
   * Paginated ledger history for a driver.
   */
  async getLedger(
    driverId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ rows: CommissionLedgerModelRow[]; count: number }> {
    const { rows, count } = await CommissionLedger.findAndCountAll({
      where: { driverId },
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    return { rows: rows as unknown as CommissionLedgerModelRow[], count };
  }
}

// Minimal row shape returned to callers.
type CommissionLedgerModelRow = {
  id: string;
  entryType: CommissionEntryType;
  amount: number;
  balanceAfter: number;
  settlementMethod: SettlementMethod | null;
  cashTransactionId: string | null;
  description: string | null;
  createdAt: Date;
};

export default CommissionService;
