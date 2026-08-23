/**
 * @fileoverview PaymentReleaseService for automated payment processing
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Transaction } from 'sequelize';
import { DeliveryAgreement } from '../models';
import { DeliveryStatus } from '../models/DeliveryAgreement';
import { sequelize } from '../config/database';
import { logInfo, logError } from '../utils/logger';
import courierEscrowService from './CourierEscrowService';

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

  /**
   * Process payment release upon QR code verification
   */
  /**
   * Release escrow for a delivery whose handover has already been verified.
   *
   * Separate from processQRCodePaymentRelease, which did its own token lookup.
   * Handover verification now lives in DeliveryHandoverService, because it has
   * to enforce courier identity and an attempt cap — properties that belong
   * with the protocol rather than with payment. By the time this is called the
   * code has been consumed, so re-verifying here would fail.
   */
  async processConfirmedDeliveryRelease(
    agreementId: string,
    courierId: string,
    location?: [number, number],
    transaction?: Transaction,
  ): Promise<PaymentReleaseResult> {
    const t = transaction || await sequelize.transaction();
    const shouldCommit = !transaction;

    const failed = (error: string, id = agreementId): PaymentReleaseResult => ({
      success: false,
      agreementId: id,
      amount: 0,
      platformFee: 0,
      courierEarnings: 0,
      trigger: PaymentReleaseTrigger.QR_CODE_SCAN,
      timestamp: new Date(),
      error,
    });

    try {
      const agreement = await DeliveryAgreement.findByPk(agreementId, { transaction: t });

      if (!agreement) {
        if (shouldCommit) await t.rollback();
        return failed('Delivery agreement not found');
      }

      if (agreement.courierId !== courierId) {
        if (shouldCommit) await t.rollback();
        return failed('This delivery belongs to another courier');
      }

      if (agreement.status !== DeliveryStatus.IN_TRANSIT) {
        if (shouldCommit) await t.rollback();
        return failed(`Delivery is ${agreement.status}, not in transit`);
      }

      const completedAgreement = await courierEscrowService.completeDelivery(
        agreement.id,
        {
          handover_code_verified: true,
          confirmed_by: courierId,
          confirmation_location: location,
          delivery_confirmed_at: new Date().toISOString(),
        },
        t,
      );

      const result: PaymentReleaseResult = {
        success: true,
        agreementId: completedAgreement.id,
        amount: completedAgreement.agreedPrice,
        platformFee: completedAgreement.platformFee,
        courierEarnings: completedAgreement.agreedPrice - completedAgreement.platformFee,
        trigger: PaymentReleaseTrigger.QR_CODE_SCAN,
        timestamp: new Date(),
      };

      await this.logPaymentRelease(result, t);
      await this.sendPaymentReleaseNotifications(completedAgreement, result, t);

      if (shouldCommit) await t.commit();

      logInfo('Payment released after verified handover', {
        agreementId: agreement.id,
        courierEarnings: result.courierEarnings,
        platformFee: result.platformFee,
      });

      return result;
    } catch (error) {
      if (shouldCommit) await t.rollback();
      logError('Failed to release payment after handover', error as Error, {
        agreementId,
        courierId,
      });
      return failed((error as Error).message);
    }
  }

  /**
   * Process manual payment release by admin
   */
  /**
   * Process automatic payment release after timeout
   */
  /**
   * Find and process eligible agreements for auto-release
   */
  /**
   * Get payment release statistics
   */
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
