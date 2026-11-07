/**
 * @fileoverview Cash wallet service for managing stored value operations
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2026-11-05
 */

import { Transaction, UniqueConstraintError } from 'sequelize';
import { sequelize } from '../config/database';
import { CashWallet, CashWalletTransaction } from '../models/CashWallet';
import User from '../models/User';
import logger, { getErrorMessage, getErrorStack } from '../utils/logger';

export interface WalletLoadRequest {
  userId: string;
  amount: number;
  source: 'agent' | 'kiosk' | 'partner_store' | 'mobile_money' | 'voucher' | 'bank_transfer';
  sourceReference: string;
  agentId?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  metadata?: Record<string, any>;
}

export interface WalletPaymentRequest {
  userId: string;
  amount: number;
  description: string;
  bookingId?: string;
  escrowHold?: boolean;
  metadata?: Record<string, any>;
}

export interface WalletTransferRequest {
  fromUserId: string;
  toUserId: string;
  amount: number;
  description: string;
  metadata?: Record<string, any>;
}

export interface WalletResult {
  success: boolean;
  data?: any;
  error?: string;
  code?: string;
  /** Set when a load was refused because the reference was already credited. */
  alreadyCredited?: boolean;
}

/**
 * Was this failure the load-idempotency index refusing a repeat credit?
 *
 * Matched on the index name from migration 025 so an unrelated unique
 * violation — two wallets for one user, say — is still reported as the error
 * it is rather than being silently swallowed as a duplicate payment.
 */
const LOAD_REFERENCE_INDEX = 'cash_wallet_transactions_load_reference_unique';

const isDuplicateLoadReference = (error: unknown): boolean => {
  if (!(error instanceof UniqueConstraintError)) return false;
  const constraint = (error as unknown as { parent?: { constraint?: string } }).parent?.constraint;
  return constraint === LOAD_REFERENCE_INDEX
    || (error.errors ?? []).some((e) => String(e.path ?? '').includes('source_reference'));
};

export class CashWalletService {

  /**
   * Create a new cash wallet for a user
   */
  async createWallet(userId: string, kycLevel: 'basic' | 'enhanced' | 'full' = 'basic'): Promise<WalletResult> {
    const transaction = await sequelize.transaction();

    try {
      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        await transaction.rollback();
        return {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        };
      }

      // Check if wallet already exists
      const existingWallet = await CashWallet.findOne({
        where: { userId },
        transaction,
      });

      if (existingWallet) {
        await transaction.rollback();
        return {
          success: false,
          error: 'Wallet already exists for this user',
          code: 'WALLET_EXISTS',
        };
      }

      // Set limits based on KYC level
      const limits = this.getKycLimits(kycLevel);

      const wallet = await CashWallet.create({
        userId,
        kycLevel,
        status: 'active',
        currency: 'USD',
        balance: 0,
        dailyLoadLimit: limits.dailyLoadLimit,
        monthlyLoadLimit: limits.monthlyLoadLimit,
        dailySpendLimit: limits.dailySpendLimit,
        monthlySpendLimit: limits.monthlySpendLimit,
        isVerified: kycLevel === 'full',
      }, { transaction });

      await transaction.commit();

      logger.info('Cash wallet created', {
        userId,
        walletId: wallet.id,
        kycLevel,
      });

      return {
        success: true,
        data: wallet,
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('Error creating cash wallet', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId,
      });

      return {
        success: false,
        error: getErrorMessage(error),
        code: 'WALLET_CREATION_FAILED',
      };
    }
  }

  /**
   * Load money into a cash wallet
   */
  async loadWallet(request: WalletLoadRequest): Promise<WalletResult> {
    const transaction = await sequelize.transaction();

    try {
      const wallet = await CashWallet.findOne({
        where: { userId: request.userId },
        transaction,
        lock: true, // Row-level lock for concurrency
      });

      if (!wallet || wallet.status !== 'active') {
        await transaction.rollback();
        return {
          success: false,
          error: 'Wallet not found or inactive',
          code: 'WALLET_INACTIVE',
        };
      }

      // Check daily and monthly limits
      const limitCheck = await this.checkLoadLimits(wallet.id, request.amount, transaction);
      if (!limitCheck.success) {
        await transaction.rollback();
        return limitCheck;
      }

      // Validate source-specific requirements
      const sourceValidation = await this.validateLoadSource(request, transaction);
      if (!sourceValidation.success) {
        await transaction.rollback();
        return sourceValidation;
      }

      const balanceBefore = parseFloat(wallet.balance.toString());
      const balanceAfter = balanceBefore + request.amount;

      // Create transaction record
      const walletTransaction = await CashWalletTransaction.create({
        walletId: wallet.id,
        type: 'load',
        amount: request.amount,
        currency: wallet.currency,
        balanceBefore,
        balanceAfter,
        status: 'completed',
        source: request.source,
        sourceReference: request.sourceReference,
        description: `Wallet load via ${request.source}`,
        metadata: {
          ...request.metadata,
          agentId: request.agentId,
          location: request.location,
        },
        processedAt: new Date(),
      }, { transaction });

      // Update wallet balance
      await wallet.update({
        balance: balanceAfter,
        lastTransactionAt: new Date(),
      }, { transaction });

      await transaction.commit();

      logger.info('Wallet loaded successfully', {
        userId: request.userId,
        walletId: wallet.id,
        amount: request.amount,
        source: request.source,
        transactionId: walletTransaction.id,
      });

      return {
        success: true,
        data: {
          transactionId: walletTransaction.id,
          balanceBefore,
          balanceAfter,
          wallet: await this.getWalletBalance(request.userId),
        },
      };
    } catch (error) {
      await transaction.rollback();

      // A unique violation on the load reference means this exact payment has
      // already been credited — a provider retrying its webhook, which they
      // all do. That is a success, not a failure: report it as one so the
      // caller stops retrying, and above all do not credit again.
      if (isDuplicateLoadReference(error)) {
        logger.info('Wallet load ignored — this payment reference was already credited', {
          userId: request.userId,
          source: request.source,
          sourceReference: request.sourceReference,
        });
        return {
          success: true,
          alreadyCredited: true,
          data: { wallet: await this.getWalletBalance(request.userId) },
        };
      }

      logger.error('Error loading wallet', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: request.userId,
        amount: request.amount,
      });

      return {
        success: false,
        error: getErrorMessage(error),
        code: 'WALLET_LOAD_FAILED',
      };
    }
  }

  /**
   * Process wallet payment
   */
  async processPayment(request: WalletPaymentRequest): Promise<WalletResult> {
    const transaction = await sequelize.transaction();

    try {
      const wallet = await CashWallet.findOne({
        where: { userId: request.userId },
        transaction,
        lock: true,
      });

      if (!wallet || wallet.status !== 'active') {
        await transaction.rollback();
        return {
          success: false,
          error: 'Wallet not found or inactive',
          code: 'WALLET_INACTIVE',
        };
      }

      const availableBalance = parseFloat(wallet.balance.toString()) -
                              parseFloat(wallet.frozenBalance.toString()) -
                              parseFloat(wallet.escrowBalance.toString());

      if (availableBalance < request.amount) {
        await transaction.rollback();
        return {
          success: false,
          error: 'Insufficient wallet balance',
          code: 'INSUFFICIENT_BALANCE',
        };
      }

      // Check spending limits
      const limitCheck = await this.checkSpendingLimits(wallet.id, request.amount, transaction);
      if (!limitCheck.success) {
        await transaction.rollback();
        return limitCheck;
      }

      const balanceBefore = parseFloat(wallet.balance.toString());
      let balanceAfter: number;
      let escrowBalance = parseFloat(wallet.escrowBalance.toString());

      if (request.escrowHold) {
        // Hold payment in escrow
        escrowBalance += request.amount;
        balanceAfter = balanceBefore; // Balance stays the same, money moved to escrow
      } else {
        // Direct payment
        balanceAfter = balanceBefore - request.amount;
      }

      // Create transaction record
      const walletTransaction = await CashWalletTransaction.create({
        walletId: wallet.id,
        type: request.escrowHold ? 'escrow_hold' : 'payment',
        amount: request.amount,
        currency: wallet.currency,
        balanceBefore,
        balanceAfter,
        status: 'completed',
        source: 'ride_payment',
        sourceReference: request.bookingId,
        description: request.description,
        metadata: request.metadata,
        processedAt: new Date(),
      }, { transaction });

      // Update wallet
      await wallet.update({
        balance: balanceAfter,
        escrowBalance: escrowBalance,
        lastTransactionAt: new Date(),
      }, { transaction });

      await transaction.commit();

      logger.info('Wallet payment processed', {
        userId: request.userId,
        walletId: wallet.id,
        amount: request.amount,
        escrowHold: request.escrowHold,
        transactionId: walletTransaction.id,
      });

      return {
        success: true,
        data: {
          transactionId: walletTransaction.id,
          balanceBefore,
          balanceAfter,
          escrowHold: request.escrowHold,
          wallet: await this.getWalletBalance(request.userId),
        },
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('Error processing wallet payment', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId: request.userId,
        amount: request.amount,
      });

      return {
        success: false,
        error: getErrorMessage(error),
        code: 'WALLET_PAYMENT_FAILED',
      };
    }
  }

  /**
   * Take a driver's commission payment out of their wallet, inside the
   * caller's transaction so the debit and the commission record succeed or
   * fail together. Nothing is committed or rolled back here.
   *
   * Spending limits do not apply: they guard money leaving to third parties,
   * and this is the driver paying what they owe the platform.
   *
   * Recorded as a `fee` with metadata.purpose 'commission_settlement'. The
   * source enum has no commission value, and adding one would need a
   * migration that cannot run inside a transaction.
   */
  async debitForCommission(
    userId: string,
    amount: number,
    transaction: Transaction,
  ): Promise<{ success: boolean; error?: string; code?: string; transactionId?: string; balanceAfter?: number }> {
    const wallet = await CashWallet.findOne({
      where: { userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!wallet || wallet.status !== 'active') {
      return { success: false, error: 'No active wallet to pay from', code: 'WALLET_INACTIVE' };
    }

    const balanceBefore = parseFloat(wallet.balance.toString());
    const available = Math.round((balanceBefore
      - parseFloat(wallet.frozenBalance.toString())
      - parseFloat(wallet.escrowBalance.toString())) * 100) / 100;

    if (available < amount) {
      return {
        success: false,
        error: `Insufficient wallet balance. Available: ${available}, required: ${amount}`,
        code: 'INSUFFICIENT_BALANCE',
      };
    }

    const balanceAfter = Math.round((balanceBefore - amount) * 100) / 100;

    const entry = await CashWalletTransaction.create({
      walletId: wallet.id,
      type: 'fee',
      amount,
      currency: wallet.currency,
      balanceBefore,
      balanceAfter,
      status: 'completed',
      source: 'ride_payment',
      description: 'Commission settlement',
      metadata: { purpose: 'commission_settlement' },
      processedAt: new Date(),
    } as any, { transaction });

    await wallet.update({ balance: balanceAfter, lastTransactionAt: new Date() }, { transaction });

    return { success: true, transactionId: entry.id, balanceAfter };
  }

  /**
   * Release escrow payment
   */
  async releaseEscrow(walletId: string, amount: number, description: string): Promise<WalletResult> {
    const transaction = await sequelize.transaction();

    try {
      const wallet = await CashWallet.findByPk(walletId, {
        transaction,
        lock: true,
      });

      if (!wallet) {
        await transaction.rollback();
        return {
          success: false,
          error: 'Wallet not found',
          code: 'WALLET_NOT_FOUND',
        };
      }

      const escrowBalance = parseFloat(wallet.escrowBalance.toString());
      if (escrowBalance < amount) {
        await transaction.rollback();
        return {
          success: false,
          error: 'Insufficient escrow balance',
          code: 'INSUFFICIENT_ESCROW',
        };
      }

      const balanceBefore = parseFloat(wallet.balance.toString());
      const balanceAfter = balanceBefore - amount;
      const newEscrowBalance = escrowBalance - amount;

      // Create release transaction
      const walletTransaction = await CashWalletTransaction.create({
        walletId: wallet.id,
        type: 'escrow_release',
        amount,
        currency: wallet.currency,
        balanceBefore,
        balanceAfter,
        status: 'completed',
        source: 'ride_payment',
        description,
        processedAt: new Date(),
      }, { transaction });

      // Update wallet
      await wallet.update({
        balance: balanceAfter,
        escrowBalance: newEscrowBalance,
        lastTransactionAt: new Date(),
      }, { transaction });

      await transaction.commit();

      logger.info('Escrow payment released', {
        walletId: wallet.id,
        amount,
        transactionId: walletTransaction.id,
      });

      return {
        success: true,
        data: {
          transactionId: walletTransaction.id,
          balanceBefore,
          balanceAfter,
        },
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('Error releasing escrow payment', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        walletId,
        amount,
      });

      return {
        success: false,
        error: getErrorMessage(error),
        code: 'ESCROW_RELEASE_FAILED',
      };
    }
  }

  /**
   * Transfer money between wallets
   */
  async transferMoney(request: WalletTransferRequest): Promise<WalletResult> {
    const transaction = await sequelize.transaction();

    try {
      // Lock both wallets one after the other, always in the same order. They
      // were locked in request order, so A->B and B->A at the same moment
      // each held one lock and waited for the other: Postgres aborted one
      // with a deadlock error.
      const lockWallet = (userId: string) =>
        CashWallet.findOne({ where: { userId }, transaction, lock: transaction.LOCK.UPDATE });
      const [firstId, secondId] = [request.fromUserId, request.toUserId].sort();
      const first = await lockWallet(firstId!);
      const second = firstId === secondId ? first : await lockWallet(secondId!);
      const senderWallet = firstId === request.fromUserId ? first : second;
      const receiverWallet = firstId === request.fromUserId ? second : first;

      if (!senderWallet || senderWallet.status !== 'active') {
        await transaction.rollback();
        return {
          success: false,
          error: 'Sender wallet not found or inactive',
          code: 'SENDER_WALLET_INACTIVE',
        };
      }

      if (!receiverWallet || receiverWallet.status !== 'active') {
        await transaction.rollback();
        return {
          success: false,
          error: 'Receiver wallet not found or inactive',
          code: 'RECEIVER_WALLET_INACTIVE',
        };
      }

      // Check sender balance
      const senderAvailableBalance = parseFloat(senderWallet.balance.toString()) -
                                    parseFloat(senderWallet.frozenBalance.toString()) -
                                    parseFloat(senderWallet.escrowBalance.toString());

      if (senderAvailableBalance < request.amount) {
        await transaction.rollback();
        return {
          success: false,
          error: 'Insufficient balance',
          code: 'INSUFFICIENT_BALANCE',
        };
      }

      // Process transfer
      const senderBalanceBefore = parseFloat(senderWallet.balance.toString());
      const senderBalanceAfter = senderBalanceBefore - request.amount;
      const receiverBalanceBefore = parseFloat(receiverWallet.balance.toString());
      const receiverBalanceAfter = receiverBalanceBefore + request.amount;

      // Create transactions
      await Promise.all([
        CashWalletTransaction.create({
          walletId: senderWallet.id,
          type: 'transfer',
          amount: -request.amount,
          currency: senderWallet.currency,
          balanceBefore: senderBalanceBefore,
          balanceAfter: senderBalanceAfter,
          status: 'completed',
          source: 'mobile_money',
          sourceReference: `transfer_to_${request.toUserId}`,
          description: `Transfer to user ${request.toUserId}: ${request.description}`,
          metadata: request.metadata,
          processedAt: new Date(),
        }, { transaction }),
        CashWalletTransaction.create({
          walletId: receiverWallet.id,
          type: 'transfer',
          amount: request.amount,
          currency: receiverWallet.currency,
          balanceBefore: receiverBalanceBefore,
          balanceAfter: receiverBalanceAfter,
          status: 'completed',
          source: 'mobile_money',
          sourceReference: `transfer_from_${request.fromUserId}`,
          description: `Transfer from user ${request.fromUserId}: ${request.description}`,
          metadata: request.metadata,
          processedAt: new Date(),
        }, { transaction }),
      ]);

      // Update balances
      await Promise.all([
        senderWallet.update({
          balance: senderBalanceAfter,
          lastTransactionAt: new Date(),
        }, { transaction }),
        receiverWallet.update({
          balance: receiverBalanceAfter,
          lastTransactionAt: new Date(),
        }, { transaction }),
      ]);

      await transaction.commit();

      logger.info('Wallet transfer completed', {
        fromUserId: request.fromUserId,
        toUserId: request.toUserId,
        amount: request.amount,
      });

      return {
        success: true,
        data: {
          senderBalance: senderBalanceAfter,
          receiverBalance: receiverBalanceAfter,
        },
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('Error transferring money', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        fromUserId: request.fromUserId,
        toUserId: request.toUserId,
      });

      return {
        success: false,
        error: getErrorMessage(error),
        code: 'TRANSFER_FAILED',
      };
    }
  }

  /**
   * Get wallet balance and details
   */
  async getWalletBalance(userId: string): Promise<WalletResult> {
    try {
      const wallet = await CashWallet.findOne({
        where: { userId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email'],
          },
        ],
      });

      if (!wallet) {
        return {
          success: false,
          error: 'Wallet not found',
          code: 'WALLET_NOT_FOUND',
        };
      }

      const availableBalance = parseFloat(wallet.balance.toString()) -
                              parseFloat(wallet.frozenBalance.toString()) -
                              parseFloat(wallet.escrowBalance.toString());

      return {
        success: true,
        data: {
          id: wallet.id,
          balance: parseFloat(wallet.balance.toString()),
          availableBalance,
          frozenBalance: parseFloat(wallet.frozenBalance.toString()),
          escrowBalance: parseFloat(wallet.escrowBalance.toString()),
          currency: wallet.currency,
          status: wallet.status,
          kycLevel: wallet.kycLevel,
          isVerified: wallet.isVerified,
          limits: {
            dailyLoadLimit: parseFloat(wallet.dailyLoadLimit.toString()),
            monthlyLoadLimit: parseFloat(wallet.monthlyLoadLimit.toString()),
            dailySpendLimit: parseFloat(wallet.dailySpendLimit.toString()),
            monthlySpendLimit: parseFloat(wallet.monthlySpendLimit.toString()),
          },
          lastTransactionAt: wallet.lastTransactionAt,
        },
      };
    } catch (error) {
      logger.error('Error getting wallet balance', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId,
      });

      return {
        success: false,
        error: getErrorMessage(error),
        code: 'WALLET_BALANCE_FETCH_FAILED',
      };
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<WalletResult> {
    try {
      const wallet = await CashWallet.findOne({
        where: { userId },
      });

      if (!wallet) {
        return {
          success: false,
          error: 'Wallet not found',
          code: 'WALLET_NOT_FOUND',
        };
      }

      const { count, rows: transactions } = await CashWalletTransaction.findAndCountAll({
        where: { walletId: wallet.id },
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      return {
        success: true,
        data: {
          transactions: transactions.map(tx => ({
            id: tx.id,
            type: tx.type,
            amount: parseFloat(tx.amount.toString()),
            currency: tx.currency,
            balanceBefore: parseFloat(tx.balanceBefore.toString()),
            balanceAfter: parseFloat(tx.balanceAfter.toString()),
            status: tx.status,
            source: tx.source,
            sourceReference: tx.sourceReference,
            description: tx.description,
            metadata: tx.metadata,
            processedAt: tx.processedAt,
            createdAt: tx.createdAt,
          })),
          pagination: {
            total: count,
            limit,
            offset,
            hasMore: count > offset + limit,
          },
        },
      };
    } catch (error) {
      logger.error('Error getting transaction history', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId,
      });

      return {
        success: false,
        error: getErrorMessage(error),
        code: 'TRANSACTION_HISTORY_FETCH_FAILED',
      };
    }
  }

  /**
   * Get KYC limits based on verification level
   */
  private getKycLimits(kycLevel: 'basic' | 'enhanced' | 'full') {
    switch (kycLevel) {
      case 'basic':
        return {
          dailyLoadLimit: 200.00,
          monthlyLoadLimit: 2000.00,
          dailySpendLimit: 300.00,
          monthlySpendLimit: 3000.00,
        };
      case 'enhanced':
        return {
          dailyLoadLimit: 1000.00,
          monthlyLoadLimit: 15000.00,
          dailySpendLimit: 1500.00,
          monthlySpendLimit: 20000.00,
        };
      case 'full':
        return {
          dailyLoadLimit: 5000.00,
          monthlyLoadLimit: 100000.00,
          dailySpendLimit: 10000.00,
          monthlySpendLimit: 150000.00,
        };
    }
  }

  /**
   * Check load limits
   */
  private async checkLoadLimits(
    walletId: string,
    amount: number,
    transaction: Transaction,
  ): Promise<WalletResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get today's loads
    const dailyLoads = await CashWalletTransaction.sum('amount', {
      where: {
        walletId,
        type: 'load',
        status: 'completed',
        createdAt: {
          $gte: today,
        },
      },
      transaction,
    });

    // Get this month's loads
    const monthlyLoads = await CashWalletTransaction.sum('amount', {
      where: {
        walletId,
        type: 'load',
        status: 'completed',
        createdAt: {
          $gte: thisMonth,
        },
      },
      transaction,
    });

    const wallet = await CashWallet.findByPk(walletId, { transaction });
    if (!wallet) {
      return {
        success: false,
        error: 'Wallet not found',
        code: 'WALLET_NOT_FOUND',
      };
    }

    const dailyTotal = (dailyLoads || 0) + amount;
    const monthlyTotal = (monthlyLoads || 0) + amount;

    if (dailyTotal > parseFloat(wallet.dailyLoadLimit.toString())) {
      return {
        success: false,
        error: `Daily load limit exceeded. Limit: $${wallet.dailyLoadLimit}, Current: $${dailyLoads || 0}`,
        code: 'DAILY_LOAD_LIMIT_EXCEEDED',
      };
    }

    if (monthlyTotal > parseFloat(wallet.monthlyLoadLimit.toString())) {
      return {
        success: false,
        error: `Monthly load limit exceeded. Limit: $${wallet.monthlyLoadLimit}, Current: $${monthlyLoads || 0}`,
        code: 'MONTHLY_LOAD_LIMIT_EXCEEDED',
      };
    }

    return { success: true };
  }

  /**
   * Check spending limits
   */
  private async checkSpendingLimits(
    walletId: string,
    amount: number,
    transaction: Transaction,
  ): Promise<WalletResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get today's spending
    const dailySpending = await CashWalletTransaction.sum('amount', {
      where: {
        walletId,
        type: ['payment', 'transfer'],
        status: 'completed',
        createdAt: {
          $gte: today,
        },
      },
      transaction,
    });

    // Get this month's spending
    const monthlySpending = await CashWalletTransaction.sum('amount', {
      where: {
        walletId,
        type: ['payment', 'transfer'],
        status: 'completed',
        createdAt: {
          $gte: thisMonth,
        },
      },
      transaction,
    });

    const wallet = await CashWallet.findByPk(walletId, { transaction });
    if (!wallet) {
      return {
        success: false,
        error: 'Wallet not found',
        code: 'WALLET_NOT_FOUND',
      };
    }

    const dailyTotal = (dailySpending || 0) + amount;
    const monthlyTotal = (monthlySpending || 0) + amount;

    if (dailyTotal > parseFloat(wallet.dailySpendLimit.toString())) {
      return {
        success: false,
        error: `Daily spending limit exceeded. Limit: $${wallet.dailySpendLimit}, Current: $${dailySpending || 0}`,
        code: 'DAILY_SPEND_LIMIT_EXCEEDED',
      };
    }

    if (monthlyTotal > parseFloat(wallet.monthlySpendLimit.toString())) {
      return {
        success: false,
        error: `Monthly spending limit exceeded. Limit: $${wallet.monthlySpendLimit}, Current: $${monthlySpending || 0}`,
        code: 'MONTHLY_SPEND_LIMIT_EXCEEDED',
      };
    }

    return { success: true };
  }

  /**
   * Validate load source requirements
   */
  private async validateLoadSource(
    request: WalletLoadRequest,
    _transaction: Transaction,
  ): Promise<WalletResult> {
    switch (request.source) {
      case 'agent': {
        if (!request.agentId) {
          return {
            success: false,
            error: 'Agent ID is required for agent loads',
            code: 'AGENT_ID_REQUIRED',
          };
        }
        const agent = await User.findByPk(request.agentId, {
          attributes: ['id', 'status', 'role'],
        });
        if (!agent) {
          return { success: false, error: 'Agent not found', code: 'AGENT_NOT_FOUND' };
        }
        if ((agent as any).status !== 'active') {
          return { success: false, error: 'Agent is not active', code: 'AGENT_INACTIVE' };
        }
        break;
      }

      case 'kiosk':
      case 'partner_store':
        if (!request.location) {
          return {
            success: false,
            error: 'Location is required for kiosk/partner store loads',
            code: 'LOCATION_REQUIRED',
          };
        }
        break;

      case 'mobile_money':
        // Requires mobile money provider reference (e.g. MTN MoMo transaction ID)
        if (!request.sourceReference) {
          return {
            success: false,
            error: 'Mobile money transaction reference is required',
            code: 'MOBILE_MONEY_REF_REQUIRED',
          };
        }
        break;

      case 'voucher':
        // Requires voucher code in sourceReference
        if (!request.sourceReference || request.sourceReference.trim().length < 6) {
          return {
            success: false,
            error: 'A valid voucher code is required',
            code: 'VOUCHER_CODE_REQUIRED',
          };
        }
        break;
    }

    return { success: true };
  }
}

export const cashWalletService = new CashWalletService();
export default cashWalletService;
