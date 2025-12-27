/**
 * @fileoverview Cash Payment Service with dual verification and fraud prevention
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import CashTransaction, { CashPaymentStatus } from '../models/CashTransaction';
import UserWallet, { VerificationLevel } from '../models/UserWallet';
import { Booking } from '../models';
import { NotificationService } from './NotificationService';
import { logInfo, logError, logWarning } from '../utils/logger';

export interface CashPaymentResult {
  success: boolean;
  transactionId?: string;
  riderCode?: string;
  driverCode?: string | null;
  instructions?: string;
  error?: string | undefined;
  trustScore?: number | undefined;
}

export interface ConfirmationResult {
  success: boolean;
  status: string;
  message: string;
  error?: string;
  nextStep?: string;
}

export interface FraudAnalysis {
  riskScore: number;
  patterns: string[];
  recommendation: 'approve' | 'review' | 'reject';
  trustRequired: number;
}

export interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: Date;
}

export class CashPaymentService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Create a cash payment transaction with verification codes
   */
  async createCashPayment(
    bookingId: string,
    riderId: string,
    driverId: string,
    amount: number,
  ): Promise<CashPaymentResult> {
    const transaction = await sequelize.transaction();

    try {
      // Verify booking exists and is valid
      const booking = await Booking.findByPk(bookingId, { transaction });
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Check if user can make cash payments
      const canPay = await this.checkCashPaymentEligibility(riderId, amount, transaction);
      if (!canPay.eligible) {
        return {
          success: false,
          error: canPay.reason || 'Payment not eligible',
          trustScore: canPay.trustScore,
        };
      }

      // Generate unique confirmation codes
      const riderCode = this.generateConfirmationCode();
      const driverCode = this.generateConfirmationCode();

      // Calculate platform fee
      const platformFee = this.calculatePlatformFee(amount);

      // Create cash transaction record
      const cashTransaction = await CashTransaction.create({
        bookingId,
        riderId,
        driverId,
        amount,
        platformFee,
        expectedAmount: amount,
        riderConfirmationCode: riderCode,
        driverConfirmationCode: driverCode,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        metadata: {
          createdBy: 'cash_payment_service',
          version: '1.0',
        } as any,
      }, { transaction });

      // Update booking with cash transaction reference
      await (booking as any).update({
        cashTransactionId: cashTransaction.id,
        paymentMethod: 'cash',
      }, { transaction });

      // Create trust hold
      await this.createTrustHold(riderId, amount, cashTransaction.id, transaction);

      await transaction.commit();

      // Send notifications
      await this.sendCashPaymentNotifications(riderId, driverId, amount, riderCode);

      logInfo('Cash payment created successfully', {
        transactionId: cashTransaction.id,
        bookingId,
        amount,
        riderId,
        driverId,
      });

      return {
        success: true,
        transactionId: cashTransaction.id,
        riderCode,
        driverCode: null, // Don't expose driver code to rider
        instructions: this.getCashPaymentInstructions(amount),
        trustScore: canPay.trustScore || 0,
      };

    } catch (error) {
      await transaction.rollback();

      logError('Error creating cash payment', error as Error, {
        bookingId,
        riderId,
        driverId,
        amount,
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Driver confirms cash received
   */
  async confirmCashReceived(
    transactionId: string,
    driverId: string,
    actualAmount: number,
    location?: LocationData,
  ): Promise<ConfirmationResult> {
    const transaction = await sequelize.transaction();

    try {
      const cashTransaction = await CashTransaction.findByPk(transactionId, { transaction });

      if (!cashTransaction) {
        throw new Error('Transaction not found');
      }

      // Verify driver authorization
      if (cashTransaction.driverId !== driverId) {
        await this.logSuspiciousActivity(driverId, 'unauthorized_confirmation_attempt', {
          transactionId,
          actualDriverId: cashTransaction.driverId,
        });
        throw new Error('Unauthorized driver');
      }

      // Verify transaction status
      if (![CashPaymentStatus.PENDING_VERIFICATION, CashPaymentStatus.RIDER_CONFIRMED].includes(cashTransaction.status)) {
        throw new Error(`Cannot confirm transaction in status: ${cashTransaction.status}`);
      }

      // Check for amount discrepancy
      const amountDifference = Math.abs(actualAmount - cashTransaction.expectedAmount);
      const fraudFlags: string[] = [];
      let riskScore = 0;

      if (amountDifference > 0.50) {
        fraudFlags.push('amount_discrepancy');
        riskScore += 30;

        logWarning('Amount discrepancy detected', {
          transactionId,
          expected: cashTransaction.expectedAmount,
          actual: actualAmount,
          difference: amountDifference,
        });
      }

      // Verify location if provided
      let locationVerified = false;
      if (location) {
        locationVerified = await this.verifyTransactionLocation(transactionId, location);
        if (!locationVerified) {
          fraudFlags.push('location_anomaly');
          riskScore += 20;
        }
      }

      // Update transaction status
      const newStatus = cashTransaction.status === CashPaymentStatus.RIDER_CONFIRMED
        ? CashPaymentStatus.BOTH_CONFIRMED
        : CashPaymentStatus.DRIVER_CONFIRMED;

      await (cashTransaction as any).update({
        status: newStatus,
        driverConfirmedAt: new Date(),
        actualAmountClaimed: actualAmount,
        gpsLocationConfirmed: locationVerified,
        transactionLocation: location ? {
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
          confirmedAt: new Date(),
        } : null,
        riskScore,
        fraudFlags: fraudFlags.length > 0 ? fraudFlags : null,
      }, { transaction });

      await transaction.commit();

      // Handle based on new status
      if (newStatus === CashPaymentStatus.BOTH_CONFIRMED) {
        // Both parties confirmed - complete the transaction
        await this.completeCashTransaction(transactionId);

        return {
          success: true,
          status: 'completed',
          message: 'Cash payment completed successfully',
          nextStep: 'Transaction completed',
        };
      }

      // Notify rider for confirmation
      await this.notifyRiderForConfirmation(cashTransaction.riderId, transactionId);

      return {
        success: true,
        status: 'awaiting_rider_confirmation',
        message: 'Waiting for rider to confirm payment',
        nextStep: 'Rider needs to enter confirmation code',
      };

    } catch (error) {
      await transaction.rollback();

      logError('Error confirming cash received', error as Error, {
        transactionId,
        driverId,
        actualAmount,
      });

      return {
        success: false,
        status: 'failed',
        message: 'Failed to confirm cash receipt',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Rider confirms cash payment made
   */
  async confirmCashPaid(
    transactionId: string,
    riderId: string,
    confirmationCode: string,
  ): Promise<ConfirmationResult> {
    const transaction = await sequelize.transaction();

    try {
      const cashTransaction = await CashTransaction.findByPk(transactionId, { transaction });

      if (!cashTransaction) {
        throw new Error('Transaction not found');
      }

      // Verify rider authorization
      if (cashTransaction.riderId !== riderId) {
        await this.logSuspiciousActivity(riderId, 'unauthorized_confirmation_attempt', {
          transactionId,
          actualRiderId: cashTransaction.riderId,
        });
        throw new Error('Unauthorized rider');
      }

      // Verify confirmation code
      if (cashTransaction.riderConfirmationCode !== confirmationCode) {
        await this.logSuspiciousActivity(riderId, 'invalid_confirmation_code', {
          transactionId,
          providedCode: confirmationCode,
        });
        throw new Error('Invalid confirmation code');
      }

      // Verify transaction status
      if (![CashPaymentStatus.PENDING_VERIFICATION, CashPaymentStatus.DRIVER_CONFIRMED].includes(cashTransaction.status)) {
        throw new Error(`Cannot confirm transaction in status: ${cashTransaction.status}`);
      }

      // Update transaction status
      const newStatus = cashTransaction.status === CashPaymentStatus.DRIVER_CONFIRMED
        ? CashPaymentStatus.BOTH_CONFIRMED
        : CashPaymentStatus.RIDER_CONFIRMED;

      await cashTransaction.update({
        status: newStatus,
        riderConfirmedAt: new Date(),
      }, { transaction });

      await transaction.commit();

      // Handle based on new status
      if (newStatus === CashPaymentStatus.BOTH_CONFIRMED) {
        // Both parties confirmed - complete the transaction
        await this.completeCashTransaction(transactionId);

        return {
          success: true,
          status: 'completed',
          message: 'Cash payment completed successfully',
          nextStep: 'Transaction completed',
        };
      }

      return {
        success: true,
        status: 'awaiting_driver_confirmation',
        message: 'Waiting for driver to confirm cash received',
        nextStep: 'Driver needs to confirm receipt',
      };

    } catch (error) {
      await transaction.rollback();

      logError('Error confirming cash paid', error as Error, {
        transactionId,
        riderId,
      });

      return {
        success: false,
        status: 'failed',
        message: 'Failed to confirm cash payment',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check if user is eligible for cash payments
   */
  private async checkCashPaymentEligibility(
    userId: string,
    amount: number,
    transaction: Transaction,
  ): Promise<{ eligible: boolean; reason?: string; trustScore?: number }> {
    // Get or create user wallet
    let wallet = await UserWallet.findOne({
      where: { userId },
      transaction,
    });

    if (!wallet) {
      wallet = await UserWallet.create({ userId }, { transaction });
    }

    // Check if user is suspended
    if (wallet.isSuspended) {
      return {
        eligible: false,
        reason: `Account suspended: ${wallet.suspensionReason}`,
        trustScore: wallet.trustScore,
      };
    }

    // Check trust score requirements
    const requiredTrust = this.calculateRequiredTrust(amount);
    if (wallet.trustScore < requiredTrust) {
      return {
        eligible: false,
        reason: `Insufficient trust score. Required: ${requiredTrust}, Current: ${wallet.trustScore}`,
        trustScore: wallet.trustScore,
      };
    }

    // Check daily/weekly/monthly limits
    const limitCheck = await this.checkTransactionLimits(wallet, amount);
    if (!limitCheck.withinLimits) {
      return {
        eligible: false,
        reason: limitCheck.reason || 'Limit exceeded',
        trustScore: wallet.trustScore,
      };
    }

    return {
      eligible: true,
      trustScore: wallet.trustScore,
    };
  }

  /**
   * Calculate required trust score based on amount
   */
  private calculateRequiredTrust(amount: number): number {
    if (amount <= 10) return 20;
    if (amount <= 50) return 40;
    if (amount <= 100) return 60;
    if (amount <= 500) return 80;
    return 90; // High-value transactions
  }

  /**
   * Check transaction limits
   */
  private async checkTransactionLimits(
    wallet: any,
    amount: number,
  ): Promise<{ withinLimits: boolean; reason?: string }> {
    // Reset counters if needed
    await this.resetLimitCountersIfNeeded(wallet);

    // Check daily limit
    if (wallet.dailyCashUsed + amount > wallet.dailyCashLimit) {
      return {
        withinLimits: false,
        reason: `Daily limit exceeded. Used: $${wallet.dailyCashUsed}, Limit: $${wallet.dailyCashLimit}` as string,
      };
    }

    // Check weekly limit
    if (wallet.weeklyCashUsed + amount > wallet.weeklyCashLimit) {
      return {
        withinLimits: false,
        reason: `Weekly limit exceeded. Used: $${wallet.weeklyCashUsed}, Limit: $${wallet.weeklyCashLimit}` as string,
      };
    }

    // Check monthly limit
    if (wallet.monthlyCashUsed + amount > wallet.monthlyCashLimit) {
      return {
        withinLimits: false,
        reason: `Monthly limit exceeded. Used: $${wallet.monthlyCashUsed}, Limit: $${wallet.monthlyCashLimit}` as string,
      };
    }

    return { withinLimits: true };
  }

  /**
   * Generate 6-digit confirmation code
   */
  private generateConfirmationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Calculate platform fee
   */
  private calculatePlatformFee(amount: number): number {
    const feePercentage = 0.10; // 10%
    const maxFee = 10.00;
    return Math.min(amount * feePercentage, maxFee);
  }

  /**
   * Create trust hold during transaction
   */
  private async createTrustHold(
    userId: string,
    amount: number,
    transactionId: string,
    transaction: Transaction,
  ): Promise<void> {
    await sequelize.models['TrustHold'].create({
      userId,
      transactionId,
      amount,
      reason: 'cash_transaction_hold',
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
    }, { transaction });
  }

  /**
   * Complete cash transaction and update trust scores
   */
  private async completeCashTransaction(transactionId: string): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const cashTransaction = await CashTransaction.findByPk(transactionId, { transaction });
      if (!cashTransaction) {
        throw new Error('Transaction not found');
      }

      // Update transaction status
      await cashTransaction.update({
        status: CashPaymentStatus.COMPLETED,
      }, { transaction });

      // Update rider wallet
      const riderWallet = await UserWallet.findOne({
        where: { userId: cashTransaction.riderId },
        transaction,
      });

      if (riderWallet) {
        const newTrustScore = await this.calculateNewTrustScore(riderWallet, true);
        await riderWallet.update({
          completedCashTransactions: riderWallet.completedCashTransactions + 1,
          successfulTransactions: riderWallet.successfulTransactions + 1,
          totalTransactionValue: riderWallet.totalTransactionValue + cashTransaction.amount,
          trustScore: newTrustScore,
          lastTrustScoreUpdate: new Date(),
          // Update usage limits
          dailyCashUsed: riderWallet.dailyCashUsed + cashTransaction.amount,
          weeklyCashUsed: riderWallet.weeklyCashUsed + cashTransaction.amount,
          monthlyCashUsed: riderWallet.monthlyCashUsed + cashTransaction.amount,
        }, { transaction });
      }

      // Update driver wallet
      const driverWallet = await UserWallet.findOne({
        where: { userId: cashTransaction.driverId },
        transaction,
      });

      if (driverWallet) {
        const newTrustScore = await this.calculateNewTrustScore(driverWallet, true);
        await driverWallet.update({
          completedCashTransactions: driverWallet.completedCashTransactions + 1,
          successfulTransactions: driverWallet.successfulTransactions + 1,
          trustScore: newTrustScore,
          lastTrustScoreUpdate: new Date(),
        }, { transaction });
      }

      // Release trust hold
      await sequelize.models['TrustHold'].destroy({
        where: { transactionId },
        transaction,
      });

      // Update booking status
      await (Booking as any).update(
        { paymentStatus: 'completed' },
        { where: { cashTransactionId: transactionId }, transaction },
      );

      await transaction.commit();

      logInfo('Cash transaction completed successfully', {
        transactionId,
        riderId: cashTransaction.riderId,
        driverId: cashTransaction.driverId,
        amount: cashTransaction.amount,
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Calculate new trust score after transaction
   */
  private async calculateNewTrustScore(wallet: any, successful: boolean): Promise<number> {
    const totalTransactions = wallet.completedCashTransactions + 1;
    const disputeRate = wallet.disputedTransactions / totalTransactions;
    const successRate = (wallet.successfulTransactions + (successful ? 1 : 0)) / totalTransactions;

    // Base score calculation
    let score = 50; // Starting score

    // Transaction history bonus (up to 30 points)
    score += Math.min(totalTransactions * 2, 30);

    // Success rate bonus (up to 20 points)
    score += successRate * 20;

    // Dispute penalty (up to -40 points)
    score -= disputeRate * 40;

    // Verification bonus
    score += this.getVerificationBonus(wallet);

    // Cap between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get verification bonus points
   */
  private getVerificationBonus(wallet: any): number {
    let bonus = 0;
    if (wallet.phoneVerified) bonus += 5;
    if (wallet.idVerified) bonus += 10;
    if (wallet.addressVerified) bonus += 5;
    if (wallet.verificationLevel === VerificationLevel.PREMIUM) bonus += 10;
    return bonus;
  }

  /**
   * Get cash payment instructions for user
   */
  private getCashPaymentInstructions(amount: number): string {
    return `Please pay exactly $${amount.toFixed(2)} in cash to your driver. After payment, the driver will confirm receipt and you'll need to enter your confirmation code to complete the transaction.`;
  }

  /**
   * Send cash payment notifications
   */
  private async sendCashPaymentNotifications(
    riderId: string,
    driverId: string,
    amount: number,
    riderCode: string,
  ): Promise<void> {
    try {
      // Notify rider
      await (this.notificationService as any).sendNotification(riderId, {
        title: 'Cash Payment Created',
        body: `Pay $${amount.toFixed(2)} in cash. Your confirmation code: ${riderCode}`,
        type: 'cash_payment_created',
        data: { amount, riderCode },
      });

      // Notify driver
      await (this.notificationService as any).sendNotification(driverId, {
        title: 'Cash Payment Expected',
        body: `Passenger will pay $${amount.toFixed(2)} in cash`,
        type: 'cash_payment_expected',
        data: { amount },
      });
    } catch (error) {
      logError('Error sending cash payment notifications', error as Error);
    }
  }

  /**
   * Notify rider to confirm payment
   */
  private async notifyRiderForConfirmation(riderId: string, transactionId: string): Promise<void> {
    try {
      await (this.notificationService as any).sendNotification(riderId, {
        title: 'Confirm Your Cash Payment',
        body: 'Driver confirmed receipt. Please enter your confirmation code.',
        type: 'rider_confirmation_needed',
        data: { transactionId },
      });
    } catch (error) {
      logError('Error sending rider confirmation notification', error as Error);
    }
  }

  /**
   * Log suspicious activity
   */
  private async logSuspiciousActivity(
    userId: string,
    activity: string,
    metadata: any,
  ): Promise<void> {
    logWarning('Suspicious cash payment activity detected', {
      userId,
      activity,
      metadata,
      timestamp: new Date().toISOString(),
    });

    // Could also store in database for analysis
    // await SuspiciousActivity.create({ userId, activity, metadata });
  }

  /**
   * Verify transaction location
   */
  private async verifyTransactionLocation(
    _transactionId: string,
    location: LocationData,
  ): Promise<boolean> {
    // Basic verification - in production, you might check against:
    // - Booking pickup/dropoff locations
    // - Driver's route
    // - Reasonable distance from expected locations

    // For now, just check if coordinates are valid
    return (
      location.lat >= -90 && location.lat <= 90 &&
      location.lng >= -180 && location.lng <= 180
    );
  }

  /**
   * Reset limit counters based on time periods
   */
  private async resetLimitCountersIfNeeded(wallet: any): Promise<void> {
    const now = new Date();
    const lastReset = new Date(wallet.lastResetDate);

    // Check if we need to reset daily counter (new day)
    if (now.getDate() !== lastReset.getDate() ||
        now.getMonth() !== lastReset.getMonth() ||
        now.getFullYear() !== lastReset.getFullYear()) {

      wallet.dailyCashUsed = 0;

      // Check if we need to reset weekly counter (new week)
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());

      if (lastReset < weekStart) {
        wallet.weeklyCashUsed = 0;
      }

      // Check if we need to reset monthly counter (new month)
      if (now.getMonth() !== lastReset.getMonth() ||
          now.getFullYear() !== lastReset.getFullYear()) {
        wallet.monthlyCashUsed = 0;
      }

      wallet.lastResetDate = now;
      await wallet.save();
    }
  }
}

export default CashPaymentService;
