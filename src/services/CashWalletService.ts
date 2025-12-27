/**
 * @fileoverview Cash wallet service for managing stored value operations
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import { Transaction } from 'sequelize';
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
}

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
      const [senderWallet, receiverWallet] = await Promise.all([
        CashWallet.findOne({ where: { userId: request.fromUserId }, transaction, lock: true }),
        CashWallet.findOne({ where: { userId: request.toUserId }, transaction, lock: true }),
      ]);

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
      case 'agent':
        if (!request.agentId) {
          return {
            success: false,
            error: 'Agent ID is required for agent loads',
            code: 'AGENT_ID_REQUIRED',
          };
        }
        // TODO: Validate agent exists and is active
        break;

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
        // TODO: Validate mobile money transaction
        break;

      case 'voucher':
        // TODO: Validate voucher code
        break;
    }

    return { success: true };
  }
}

export const cashWalletService = new CashWalletService();
export default cashWalletService;
