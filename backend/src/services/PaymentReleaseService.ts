/**
 * @fileoverview PaymentReleaseService for automated payment processing
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Transaction } from 'sequelize';
import {
  DeliveryAgreement,
  Package,
  User,
} from '../models';
import { DeliveryStatus } from '../models/DeliveryAgreement';
import { sequelize, Op } from '../config/database';
import { logInfo, logError } from '../utils/logger';
import courierEscrowService from './CourierEscrowService';
import qrCodeService from './QRCodeService';

// Payment release triggers
export enum PaymentReleaseTrigger {
  QR_CODE_SCAN = 'qr_code_scan',
  MANUAL_ADMIN = 'manual_admin',
  AUTO_TIMEOUT = 'auto_timeout',
  DISPUTE_RESOLUTION = 'dispute_resolution'
}

// Payment release result
export interface PaymentReleaseResult {
  success: boolean;
  agreementId: string;
  amount: number;
  platformFee: number;
  courierEarnings: number;
  trigger: PaymentReleaseTrigger;
  timestamp: Date;
  error?: string;
}

export class PaymentReleaseService {
  private readonly AUTO_RELEASE_DELAY_HOURS = 24; // Auto-release after 24 hours if no disputes

  /**
   * Process payment release upon QR code verification
   */
  async processQRCodePaymentRelease(
    qrToken: string,
    scannedByUserId: string,
    scanLocation?: [number, number],
    transaction?: Transaction,
  ): Promise<PaymentReleaseResult> {
    const t = transaction || await sequelize.transaction();
    const shouldCommit = !transaction;

    try {
      // Verify and scan QR code
      const qrResult = await qrCodeService.verifyAndScanQRCode(
        qrToken,
        scannedByUserId,
        scanLocation,
        t,
      );

      if (!qrResult.isValid) {
        const result: PaymentReleaseResult = {
          success: false,
          agreementId: qrResult.agreement?.id || '',
          amount: 0,
          platformFee: 0,
          courierEarnings: 0,
          trigger: PaymentReleaseTrigger.QR_CODE_SCAN,
          timestamp: new Date(),
          error: qrResult.message,
        };

        if (shouldCommit) {
          await t.rollback();
        }

        return result;
      }

      const agreement = qrResult.agreement;

      // Verify agreement is ready for payment release
      if (agreement.status !== DeliveryStatus.IN_TRANSIT) {
        const result: PaymentReleaseResult = {
          success: false,
          agreementId: agreement.id,
          amount: agreement.agreedPrice,
          platformFee: agreement.platformFee,
          courierEarnings: agreement.agreedPrice - agreement.platformFee,
          trigger: PaymentReleaseTrigger.QR_CODE_SCAN,
          timestamp: new Date(),
          error: 'Agreement is not in transit status',
        };

        if (shouldCommit) {
          await t.rollback();
        }

        return result;
      }

      // Process payment release through escrow service
      const completedAgreement = await courierEscrowService.completeDelivery(
        agreement.id,
        {
          qr_code_verified: true,
          qr_token: qrToken,
          scanned_by: scannedByUserId,
          scan_location: scanLocation,
          delivery_confirmed_at: new Date().toISOString(),
        },
        t,
      );

      // Create successful result
      const result: PaymentReleaseResult = {
        success: true,
        agreementId: completedAgreement.id,
        amount: completedAgreement.agreedPrice,
        platformFee: completedAgreement.platformFee,
        courierEarnings: completedAgreement.agreedPrice - completedAgreement.platformFee,
        trigger: PaymentReleaseTrigger.QR_CODE_SCAN,
        timestamp: new Date(),
      };

      // Log payment release
      await this.logPaymentRelease(result, t);

      // Send notifications (placeholder for notification service)
      await this.sendPaymentReleaseNotifications(completedAgreement, result, t);

      if (shouldCommit) {
        await t.commit();
      }

      logInfo('Payment released via QR code scan', {
        agreementId: agreement.id,
        courierEarnings: result.courierEarnings,
        platformFee: result.platformFee,
      });

      return result;

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }

      logError('Failed to process QR code payment release', error as Error, {
        qrToken,
        scannedByUserId,
      });

      const result: PaymentReleaseResult = {
        success: false,
        agreementId: '',
        amount: 0,
        platformFee: 0,
        courierEarnings: 0,
        trigger: PaymentReleaseTrigger.QR_CODE_SCAN,
        timestamp: new Date(),
        error: (error as Error).message,
      };

      return result;
    }
  }

  /**
   * Process manual payment release by admin
   */
  async processManualPaymentRelease(
    agreementId: string,
    adminId: string,
    reason: string,
    transaction?: Transaction,
  ): Promise<PaymentReleaseResult> {
    const t = transaction || await sequelize.transaction();
    const shouldCommit = !transaction;

    try {
      const agreement = await DeliveryAgreement.findByPk(agreementId, {
        include: [
          {
            model: Package,
            as: 'package',
            include: [{
              model: User,
              as: 'sender',
            }],
          },
          {
            model: User,
            as: 'courier',
          },
        ],
        transaction: t,
      });

      if (!agreement) {
        throw new Error('Delivery agreement not found');
      }

      // Verify agreement can be manually completed
      if (![DeliveryStatus.IN_TRANSIT, DeliveryStatus.DISPUTED].includes(agreement.status)) {
        throw new Error('Agreement cannot be manually completed in current status');
      }

      // Process payment release
      const completedAgreement = await courierEscrowService.completeDelivery(
        agreementId,
        {
          manual_release: true,
          admin_id: adminId,
          admin_reason: reason,
          completed_at: new Date().toISOString(),
        },
        t,
      );

      const result: PaymentReleaseResult = {
        success: true,
        agreementId: completedAgreement.id,
        amount: completedAgreement.agreedPrice,
        platformFee: completedAgreement.platformFee,
        courierEarnings: completedAgreement.agreedPrice - completedAgreement.platformFee,
        trigger: PaymentReleaseTrigger.MANUAL_ADMIN,
        timestamp: new Date(),
      };

      // Log manual release
      await this.logPaymentRelease(result, t);
      await completedAgreement.logEvent('manual_payment_release', {
        admin_id: adminId,
        reason,
        amount: result.amount,
        courier_earnings: result.courierEarnings,
      }, adminId);

      // Send notifications
      await this.sendPaymentReleaseNotifications(completedAgreement, result, t);

      if (shouldCommit) {
        await t.commit();
      }

      logInfo('Payment released manually by admin', {
        agreementId,
        adminId,
        reason,
        courierEarnings: result.courierEarnings,
      });

      return result;

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }

      logError('Failed to process manual payment release', error as Error, {
        agreementId,
        adminId,
        reason,
      });

      const result: PaymentReleaseResult = {
        success: false,
        agreementId,
        amount: 0,
        platformFee: 0,
        courierEarnings: 0,
        trigger: PaymentReleaseTrigger.MANUAL_ADMIN,
        timestamp: new Date(),
        error: (error as Error).message,
      };

      return result;
    }
  }

  /**
   * Process automatic payment release after timeout
   */
  async processAutoTimeoutRelease(
    agreementId: string,
    transaction?: Transaction,
  ): Promise<PaymentReleaseResult> {
    const t = transaction || await sequelize.transaction();
    const shouldCommit = !transaction;

    try {
      const agreement = await DeliveryAgreement.findByPk(agreementId, {
        transaction: t,
      });

      if (!agreement) {
        throw new Error('Delivery agreement not found');
      }

      // Verify agreement is eligible for auto-release
      if (agreement.status !== DeliveryStatus.COMPLETED) {
        throw new Error('Agreement must be completed for auto-release');
      }

      // Check if enough time has passed since completion
      if (!agreement.deliveryConfirmedAt) {
        throw new Error('No delivery confirmation time found');
      }

      const timeSinceCompletion = Date.now() - agreement.deliveryConfirmedAt.getTime();
      const hoursElapsed = timeSinceCompletion / (1000 * 60 * 60);

      if (hoursElapsed < this.AUTO_RELEASE_DELAY_HOURS) {
        throw new Error('Auto-release delay period not yet elapsed');
      }

      // Check if payment was already released
      if (agreement.paymentReleasedAt) {
        const result: PaymentReleaseResult = {
          success: true,
          agreementId: agreement.id,
          amount: agreement.agreedPrice,
          platformFee: agreement.platformFee,
          courierEarnings: agreement.agreedPrice - agreement.platformFee,
          trigger: PaymentReleaseTrigger.AUTO_TIMEOUT,
          timestamp: agreement.paymentReleasedAt,
          error: 'Payment was already released',
        };

        if (shouldCommit) {
          await t.rollback();
        }

        return result;
      }

      // Process auto-release
      const completedAgreement = await courierEscrowService.completeDelivery(
        agreementId,
        {
          auto_release: true,
          release_trigger: 'timeout',
          hours_elapsed: hoursElapsed,
          auto_released_at: new Date().toISOString(),
        },
        t,
      );

      const result: PaymentReleaseResult = {
        success: true,
        agreementId: completedAgreement.id,
        amount: completedAgreement.agreedPrice,
        platformFee: completedAgreement.platformFee,
        courierEarnings: completedAgreement.agreedPrice - completedAgreement.platformFee,
        trigger: PaymentReleaseTrigger.AUTO_TIMEOUT,
        timestamp: new Date(),
      };

      // Log auto-release
      await this.logPaymentRelease(result, t);
      await completedAgreement.logEvent('auto_payment_release', {
        hours_elapsed: hoursElapsed,
        auto_release_delay: this.AUTO_RELEASE_DELAY_HOURS,
        amount: result.amount,
      });

      if (shouldCommit) {
        await t.commit();
      }

      logInfo('Payment auto-released after timeout', {
        agreementId,
        hoursElapsed,
        courierEarnings: result.courierEarnings,
      });

      return result;

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }

      logError('Failed to process auto-timeout release', error as Error, {
        agreementId,
      });

      const result: PaymentReleaseResult = {
        success: false,
        agreementId,
        amount: 0,
        platformFee: 0,
        courierEarnings: 0,
        trigger: PaymentReleaseTrigger.AUTO_TIMEOUT,
        timestamp: new Date(),
        error: (error as Error).message,
      };

      return result;
    }
  }

  /**
   * Find and process eligible agreements for auto-release
   */
  async processEligibleAutoReleases(): Promise<PaymentReleaseResult[]> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - this.AUTO_RELEASE_DELAY_HOURS);

      // Find agreements eligible for auto-release
      const eligibleAgreements = await DeliveryAgreement.findAll({
        where: {
          status: DeliveryStatus.COMPLETED,
          deliveryConfirmedAt: {
            [Op.lte]: cutoffTime,
          },
          paymentReleasedAt: { [Op.is]: null },
        } as any,
        limit: 50, // Process in batches
      });

      const results: PaymentReleaseResult[] = [];

      // Process each eligible agreement
      for (const agreement of eligibleAgreements) {
        try {
          const result = await this.processAutoTimeoutRelease(agreement.id);
          results.push(result);
        } catch (error) {
          logError('Failed to auto-release payment for agreement', error as Error, {
            agreementId: agreement.id,
          });
        }
      }

      logInfo('Processed auto-release batch', {
        eligible: eligibleAgreements.length,
        processed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });

      return results;

    } catch (error) {
      logError('Failed to process eligible auto-releases', error as Error);
      return [];
    }
  }

  /**
   * Get payment release statistics
   */
  async getPaymentReleaseStats(): Promise<{
    totalReleased: number;
    totalAmount: number;
    totalCourierEarnings: number;
    totalPlatformFees: number;
    releasesByTrigger: Record<PaymentReleaseTrigger, number>;
    averageReleaseTime: number;
  }> {
    try {
      // Get all completed agreements with payment released
      const completedAgreements = await DeliveryAgreement.findAll({
        where: {
          status: DeliveryStatus.COMPLETED,
          paymentReleasedAt: { [Op.ne]: null as any },
        },
        attributes: [
          'id',
          'agreedPrice',
          'platformFee',
          'createdAt',
          'paymentReleasedAt',
          'eventLog',
        ],
      });

      let totalAmount = 0;
      let totalPlatformFees = 0;
      let totalReleaseTime = 0;
      const releasesByTrigger: Record<PaymentReleaseTrigger, number> = {
        [PaymentReleaseTrigger.QR_CODE_SCAN]: 0,
        [PaymentReleaseTrigger.MANUAL_ADMIN]: 0,
        [PaymentReleaseTrigger.AUTO_TIMEOUT]: 0,
        [PaymentReleaseTrigger.DISPUTE_RESOLUTION]: 0,
      };

      for (const agreement of completedAgreements) {
        totalAmount += agreement.agreedPrice;
        totalPlatformFees += agreement.platformFee;

        // Calculate release time
        if (agreement.paymentReleasedAt) {
          const releaseTime = agreement.paymentReleasedAt.getTime() - agreement.createdAt.getTime();
          totalReleaseTime += releaseTime;
        }

        // Determine release trigger from event log
        const releaseEvents = agreement.eventLog.filter((event: any) =>
          event.event_type === 'payment_released' ||
          event.event_type === 'qr_code_scanned' ||
          event.event_type === 'manual_payment_release' ||
          event.event_type === 'auto_payment_release',
        );

        if (releaseEvents.length > 0) {
          const lastEvent = releaseEvents[releaseEvents.length - 1];
          if (lastEvent.event_type === 'qr_code_scanned') {
            releasesByTrigger[PaymentReleaseTrigger.QR_CODE_SCAN]++;
          } else if (lastEvent.event_type === 'manual_payment_release') {
            releasesByTrigger[PaymentReleaseTrigger.MANUAL_ADMIN]++;
          } else if (lastEvent.event_type === 'auto_payment_release') {
            releasesByTrigger[PaymentReleaseTrigger.AUTO_TIMEOUT]++;
          }
        }
      }

      const totalCourierEarnings = totalAmount - totalPlatformFees;
      const averageReleaseTime = completedAgreements.length > 0
        ? totalReleaseTime / completedAgreements.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      return {
        totalReleased: completedAgreements.length,
        totalAmount,
        totalCourierEarnings,
        totalPlatformFees,
        releasesByTrigger,
        averageReleaseTime,
      };

    } catch (error) {
      logError('Failed to get payment release stats', error as Error);
      throw error;
    }
  }

  // Private helper methods

  private async logPaymentRelease(result: PaymentReleaseResult, _transaction?: Transaction): Promise<void> {
    try {
      // In a real implementation, this would log to a dedicated payment_releases table
      logInfo('Payment release logged', {
        agreementId: result.agreementId,
        amount: result.amount,
        trigger: result.trigger,
        success: result.success,
        timestamp: result.timestamp,
      });
    } catch (error) {
      logError('Failed to log payment release', error as Error, { result });
    }
  }

  private async sendPaymentReleaseNotifications(
    agreement: DeliveryAgreement,
    result: PaymentReleaseResult,
    _transaction?: Transaction,
  ): Promise<void> {
    try {
      // In a real implementation, this would integrate with notification service
      // to send push notifications, emails, SMS, etc.

      logInfo('Payment release notifications sent', {
        agreementId: agreement.id,
        courierId: agreement.courierId,
        amount: result.courierEarnings,
        trigger: result.trigger,
      });

      // Placeholder for actual notification implementation
      // await notificationService.sendPaymentReleaseNotification(agreement, result);

    } catch (error) {
      logError('Failed to send payment release notifications', error as Error, {
        agreementId: agreement.id,
      });
    }
  }
}

export default new PaymentReleaseService();
