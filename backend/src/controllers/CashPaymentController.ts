/**
 * @fileoverview Cash Payment Controller for handling cash payment API endpoints
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Response } from 'express';
import { validationResult } from 'express-validator';
import CashPaymentService from '../services/CashPaymentService';
import CashTransaction, { CashPaymentStatus } from '../models/CashTransaction';
import CashDispute from '../models/CashDispute';
import UserWallet from '../models/UserWallet';
import { AuthenticatedRequest } from '../types';
import { logInfo, logError } from '../utils/logger';
import { sequelize } from '../config/database';

export class CashPaymentController {
  private cashPaymentService: CashPaymentService;

  constructor() {
    this.cashPaymentService = new CashPaymentService();
  }

  /**
   * Create a cash payment transaction
   * POST /api/payments/cash/create
   */
  async createCashPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      // Only the booking is taken from the caller. The driver and the fare are
      // resolved from the booking server-side — a rider must not be able to
      // name their own counterparty or their own price.
      const { bookingId } = req.body;
      const riderId = req.user?.id;

      if (!riderId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const result = await this.cashPaymentService.createCashPayment(
        bookingId,
        riderId,
      );

      if (result.success) {
        res.status(201).json({
          success: true,
          data: {
            transactionId: result.transactionId,
            riderCode: result.riderCode,
            instructions: result.instructions,
            trustScore: result.trustScore,
          },
          message: 'Cash payment created successfully',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          trustScore: result.trustScore,
        });
      }

    } catch (error) {
      logError('Error in createCashPayment', error as Error, {
        userId: req.user?.id,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Driver confirms cash received
   * POST /api/payments/cash/:transactionId/confirm-received
   */
  async confirmCashReceived(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      const { transactionId } = req.params;
      const { actualAmount, location } = req.body;
      const driverId = req.user?.id;

      if (!driverId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const result = await this.cashPaymentService.confirmCashReceived(
        transactionId,
        driverId,
        parseFloat(actualAmount),
        location,
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            status: result.status,
            message: result.message,
            nextStep: result.nextStep,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || result.message,
        });
      }

    } catch (error) {
      logError('Error in confirmCashReceived', error as Error, {
        userId: req.user?.id,
        transactionId: req.params['transactionId'],
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Rider confirms cash payment made
   * POST /api/payments/cash/:transactionId/confirm-paid
   */
  async confirmCashPaid(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      const { transactionId } = req.params;
      const { confirmationCode } = req.body;
      const riderId = req.user?.id;

      if (!riderId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const result = await this.cashPaymentService.confirmCashPaid(
        transactionId,
        riderId,
        confirmationCode,
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            status: result.status,
            message: result.message,
            nextStep: result.nextStep,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || result.message,
        });
      }

    } catch (error) {
      logError('Error in confirmCashPaid', error as Error, {
        userId: req.user?.id,
        transactionId: req.params['transactionId'],
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get cash transaction details
   * GET /api/payments/cash/:transactionId
   */
  async getCashTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const transaction = await CashTransaction.findByPk(transactionId);

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
        return;
      }

      // Verify user has access to this transaction
      if (transaction.riderId !== userId && transaction.driverId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      // Return different data based on user role
      const isRider = transaction.riderId === userId;
      const responseData = {
        id: transaction.id,
        bookingId: transaction.bookingId,
        amount: transaction.amount,
        expectedAmount: transaction.expectedAmount,
        actualAmountClaimed: transaction.actualAmountClaimed,
        status: transaction.status,
        platformFee: transaction.platformFee,
        riderConfirmedAt: transaction.riderConfirmedAt,
        driverConfirmedAt: transaction.driverConfirmedAt,
        createdAt: transaction.createdAt,
        expiresAt: transaction.expiresAt,
        riskScore: transaction.riskScore,
        // Only show confirmation code to the relevant user
        confirmationCode: isRider ? transaction.riderConfirmationCode : transaction.driverConfirmationCode,
        userRole: isRider ? 'rider' : 'driver',
      };

      res.json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logError('Error in getCashTransaction', error as Error, {
        userId: req.user?.id,
        transactionId: req.params['transactionId'],
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get user's cash transaction history
   * GET /api/payments/cash/history
   */
  async getCashTransactionHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { limit = 20, offset = 0, status } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const whereClause: any = {
        [require('sequelize').Op.or]: [
          { riderId: userId },
          { driverId: userId },
        ],
      };

      if (status) {
        whereClause.status = status;
      }

      const transactions = await CashTransaction.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        order: [['createdAt', 'DESC']],
        include: [
          {
            association: 'booking',
            attributes: ['id', 'rideId'],
          },
        ],
      });

      const transactionsWithRole = transactions.rows.map(tx => ({
        id: tx.id,
        bookingId: tx.bookingId,
        amount: tx.amount,
        status: tx.status,
        platformFee: tx.platformFee,
        createdAt: tx.createdAt,
        userRole: tx.riderId === userId ? 'rider' : 'driver',
        riskScore: tx.riskScore,
      }));

      res.json({
        success: true,
        data: {
          transactions: transactionsWithRole,
          total: transactions.count,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logError('Error in getCashTransactionHistory', error as Error, {
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get user's wallet information and trust score
   * GET /api/payments/cash/wallet
   */
  async getWalletInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      let wallet = await UserWallet.findOne({ where: { userId } });

      if (!wallet) {
        // Create wallet if it doesn't exist
        wallet = await UserWallet.create({ userId });
      }

      res.json({
        success: true,
        data: {
          trustScore: wallet.trustScore,
          verificationLevel: wallet.verificationLevel,
          completedTransactions: wallet.completedCashTransactions,
          disputedTransactions: wallet.disputedTransactions,
          // Riders have no cash limits. null rather than absent, so an app
          // build that still compares against a limit compares against nothing.
          dailyCashLimit: null,
          weeklyCashLimit: null,
          monthlyCashLimit: null,
          phoneVerified: wallet.phoneVerified,
          idVerified: wallet.idVerified,
          addressVerified: wallet.addressVerified,
          isSuspended: wallet.isSuspended,
          suspensionReason: wallet.suspensionReason,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logError('Error in getWalletInfo', error as Error, {
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Report a problem with cash transaction
   * POST /api/payments/cash/:transactionId/dispute
   */
  async reportDispute(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      const { transactionId } = req.params;
      const { reason, description, evidence } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      // Verify transaction exists and user has access
      const transaction = await CashTransaction.findByPk(transactionId);

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
        return;
      }

      if (transaction.riderId !== userId && transaction.driverId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const open = await CashDispute.findOne({ where: { transactionId, status: 'open' } });
      if (open) {
        res.status(409).json({
          success: false,
          error: 'This payment already has an open dispute',
          code: 'DISPUTE_EXISTS',
          data: { disputeId: open.id },
        });
        return;
      }

      // Both rows together: a dispute with no disputed payment, or the
      // reverse, would leave an admin nothing coherent to resolve.
      const dispute = await sequelize.transaction(async t => {
        const created = await CashDispute.create({
          transactionId: transactionId as string,
          reporterId: userId,
          reason,
          description,
          evidence: evidence ?? null,
          priority: this.calculateDisputePriority(reason, Number(transaction.amount)),
          status: 'open',
          transactionStatusBefore: transaction.status,
        }, { transaction: t });

        await transaction.update({
          status: CashPaymentStatus.DISPUTED,
          disputeReason: reason,
        }, { transaction: t });

        return created;
      });

      logInfo('Cash payment dispute created', {
        disputeId: dispute.id,
        transactionId,
        reporterId: userId,
        reason,
      });

      res.status(201).json({
        success: true,
        data: {
          disputeId: dispute.id,
          status: 'dispute_created',
          message: 'Dispute has been reported and will be reviewed within 24-48 hours',
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logError('Error in reportDispute', error as Error, {
        userId: req.user?.id,
        transactionId: req.params['transactionId'],
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Calculate dispute priority based on reason and amount
   */
  private calculateDisputePriority(reason: string, amount: number): number {
    let priority = 50; // Default priority

    // High priority reasons
    if (reason.includes('fraud') || reason.includes('theft')) {
      priority = 90;
    } else if (reason.includes('wrong_amount') || reason.includes('no_payment')) {
      priority = 80;
    } else if (reason.includes('driver_issue') || reason.includes('rider_issue')) {
      priority = 70;
    }

    // Adjust based on amount (the larger threshold first, or it never applies)
    if (amount > 500) {
      priority += 20;
    } else if (amount > 100) {
      priority += 10;
    }

    return Math.min(100, priority);
  }
}

export default CashPaymentController;
