/**
 * @fileoverview CourierEscrowService for automated agreement and payment management
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import { Transaction, Op } from 'sequelize';
import {
  DeliveryAgreement,
  Package,
  User,
  CourierProfile,
} from '../models';
import { DeliveryStatus } from '../models/DeliveryAgreement';
import { sequelize } from '../config/database';
import { logInfo, logError } from '../utils/logger';

// Mock payment provider interface - in production this would integrate with Stripe Connect, PayPal, etc.
interface PaymentProvider {
  createEscrowPayment(amount: number, senderId: string, metadata?: Record<string, any>): Promise<string>;
  releaseEscrowPayment(paymentId: string, recipientId: string): Promise<boolean>;
  refundEscrowPayment(paymentId: string, reason?: string): Promise<boolean>;
  getPaymentStatus(paymentId: string): Promise<'pending' | 'held' | 'released' | 'refunded' | 'failed'>;
}

// Mock implementation for development
class MockPaymentProvider implements PaymentProvider {
  private payments: Map<string, {
    amount: number;
    senderId: string;
    recipientId?: string;
    status: 'pending' | 'held' | 'released' | 'refunded' | 'failed';
    createdAt: Date;
    metadata?: Record<string, any>;
  }> = new Map();

  async createEscrowPayment(amount: number, senderId: string, metadata?: Record<string, any>): Promise<string> {
    const paymentId = `escrow_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    this.payments.set(paymentId, {
      amount,
      senderId,
      status: 'held',
      createdAt: new Date(),
      metadata: metadata || {},
    });

    logInfo('Mock escrow payment created', {
      paymentId,
      amount,
      senderId,
      metadata,
    });

    return paymentId;
  }

  async releaseEscrowPayment(paymentId: string, recipientId: string): Promise<boolean> {
    const payment = this.payments.get(paymentId);

    if (!payment || payment.status !== 'held') {
      logError('Cannot release payment: payment not found or not held', new Error('Payment not releasable'), { paymentId, recipientId });
      return false;
    }

    payment.recipientId = recipientId;
    payment.status = 'released';

    logInfo('Mock escrow payment released', {
      paymentId,
      recipientId,
      amount: payment.amount,
    });

    return true;
  }

  async refundEscrowPayment(paymentId: string, reason?: string): Promise<boolean> {
    const payment = this.payments.get(paymentId);

    if (!payment || payment.status !== 'held') {
      logError('Cannot refund payment: payment not found or not held', new Error('Payment not refundable'), { paymentId, reason });
      return false;
    }

    payment.status = 'refunded';

    logInfo('Mock escrow payment refunded', {
      paymentId,
      reason,
      amount: payment.amount,
    });

    return true;
  }

  async getPaymentStatus(paymentId: string): Promise<'pending' | 'held' | 'released' | 'refunded' | 'failed'> {
    const payment = this.payments.get(paymentId);
    return payment?.status || 'failed';
  }
}

export class CourierEscrowService {
  private paymentProvider: PaymentProvider;

  constructor() {
    // In production, this would be initialized with the actual payment provider
    this.paymentProvider = new MockPaymentProvider();
  }

  /**
   * Create a new delivery agreement with escrow
   */
  async createDeliveryAgreement(
    packageId: string,
    courierId: string,
    transaction?: Transaction,
  ): Promise<DeliveryAgreement> {
    const t = transaction || await sequelize.transaction();
    const shouldCommit = !transaction;

    try {
      // Get package details
      const packageData = await Package.findByPk(packageId, {
        include: [{
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        }],
        transaction: t,
      });

      if (!packageData) {
        throw new Error('Package not found');
      }

      // Verify courier is active
      const courierProfile = await CourierProfile.findOne({
        where: { userId: courierId },
        transaction: t,
      });

      if (!courierProfile?.isCourierActive) {
        throw new Error('Courier is not active');
      }

      // Check if package already has an active agreement
      const existingAgreement = await DeliveryAgreement.findOne({
        where: {
          packageId,
          status: {
            [Op.notIn]: [DeliveryStatus.CANCELLED, DeliveryStatus.COMPLETED],
          },
        },
        transaction: t,
      });

      if (existingAgreement) {
        throw new Error('Package already has an active delivery agreement');
      }

      // Calculate fees
      const agreedPrice = packageData.senderPriceOffer;
      const platformFee = this.calculatePlatformFee(agreedPrice);
      const escrowAmount = agreedPrice;

      // Create escrow payment
      const escrowPaymentId = await this.paymentProvider.createEscrowPayment(
        escrowAmount,
        packageData.senderId,
        {
          packageId,
          courierId,
          packageTitle: packageData.title,
        },
      );

      // Create delivery agreement
      const deliveryAgreement = await DeliveryAgreement.create({
        packageId,
        courierId,
        agreedPrice,
        platformFee,
        escrowAmount,
        escrowPaymentId,
        escrowHeldAt: new Date(),
        status: DeliveryStatus.PENDING_PICKUP,
        eventLog: [{
          timestamp: new Date().toISOString(),
          event_type: 'agreement_created',
          user_id: courierId,
          data: {
            agreed_price: agreedPrice,
            platform_fee: platformFee,
            escrow_payment_id: escrowPaymentId,
            package_title: packageData.title,
          },
        }],
      }, { transaction: t });

      // Generate QR code for delivery verification
      await deliveryAgreement.createQRCode();
      await deliveryAgreement.save({ transaction: t });

      // Mark package as no longer active
      packageData.isActive = false;
      await packageData.save({ transaction: t });

      // Log agreement creation
      await deliveryAgreement.logEvent('escrow_created', {
        escrow_payment_id: escrowPaymentId,
        escrow_amount: escrowAmount,
        sender_id: packageData.senderId,
      }, courierId);

      if (shouldCommit) {
        await t.commit();
      }

      logInfo('Delivery agreement created with escrow', {
        agreementId: deliveryAgreement.id,
        packageId,
        courierId,
        escrowPaymentId,
        escrowAmount,
      });

      return deliveryAgreement;

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }

      logError('Failed to create delivery agreement', error as Error, {
        packageId,
        courierId,
      });

      throw error;
    }
  }

  /**
   * Handle delivery completion and payment release
   */
  async completeDelivery(
    agreementId: string,
    verificationData: Record<string, any>,
    transaction?: Transaction,
  ): Promise<DeliveryAgreement> {
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

      if (agreement.status !== DeliveryStatus.IN_TRANSIT) {
        throw new Error('Agreement must be in IN_TRANSIT status to complete');
      }

      // Verify payment is still held in escrow
      if (!agreement.escrowPaymentId) {
        throw new Error('No escrow payment found for this agreement');
      }

      const paymentStatus = await this.paymentProvider.getPaymentStatus(agreement.escrowPaymentId);
      if (paymentStatus !== 'held') {
        throw new Error('Escrow payment is not in held status');
      }

      // Release payment to courier
      const releaseSuccess = await this.paymentProvider.releaseEscrowPayment(
        agreement.escrowPaymentId,
        agreement.courierId,
      );

      if (!releaseSuccess) {
        throw new Error('Failed to release escrow payment');
      }

      // Update agreement status
      await agreement.transitionTo(DeliveryStatus.COMPLETED, agreement.courierId, {
        payment_released: true,
        verification_data: verificationData,
        completion_time: new Date().toISOString(),
      });

      agreement.paymentReleasedAt = new Date();
      await agreement.save({ transaction: t });

      // Update courier profile stats
      const courierProfile = await CourierProfile.findOne({
        where: { userId: agreement.courierId },
        transaction: t,
      });

      if (courierProfile) {
        const courierEarnings = agreement.agreedPrice - agreement.platformFee;
        await courierProfile.recordSuccessfulDelivery(courierEarnings);
      }

      // Log payment release
      await agreement.logEvent('payment_released', {
        escrow_payment_id: agreement.escrowPaymentId,
        courier_earnings: agreement.agreedPrice - agreement.platformFee,
        platform_fee: agreement.platformFee,
      }, agreement.courierId);

      if (shouldCommit) {
        await t.commit();
      }

      logInfo('Delivery completed and payment released', {
        agreementId,
        courierId: agreement.courierId,
        amount: agreement.agreedPrice,
        platformFee: agreement.platformFee,
      });

      return agreement;

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }

      logError('Failed to complete delivery', error as Error, {
        agreementId,
      });

      throw error;
    }
  }

  /**
   * Handle delivery cancellation and refund
   */
  async cancelDelivery(
    agreementId: string,
    reason: string,
    cancelledByUserId: string,
    transaction?: Transaction,
  ): Promise<DeliveryAgreement> {
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
        ],
        transaction: t,
      });

      if (!agreement) {
        throw new Error('Delivery agreement not found');
      }

      if (agreement.status === DeliveryStatus.COMPLETED) {
        throw new Error('Cannot cancel completed delivery');
      }

      // Refund escrowed payment
      if (agreement.escrowPaymentId) {
        const refundSuccess = await this.paymentProvider.refundEscrowPayment(
          agreement.escrowPaymentId,
          reason,
        );

        if (!refundSuccess) {
          throw new Error('Failed to refund escrow payment');
        }
      }

      // Update agreement status
      await agreement.transitionTo(DeliveryStatus.CANCELLED, cancelledByUserId, {
        cancellation_reason: reason,
        cancelled_by: cancelledByUserId,
        refund_processed: true,
        cancellation_time: new Date().toISOString(),
      });

      // Reactivate package if cancelled before pickup
      if (agreement.status === DeliveryStatus.PENDING_PICKUP) {
        const packageData = agreement.package!;
        packageData.isActive = true;
        await packageData.save({ transaction: t });
      }

      if (shouldCommit) {
        await t.commit();
      }

      logInfo('Delivery cancelled and refund processed', {
        agreementId,
        reason,
        cancelledBy: cancelledByUserId,
      });

      return agreement;

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }

      logError('Failed to cancel delivery', error as Error, {
        agreementId,
        reason,
      });

      throw error;
    }
  }

  /**
   * Handle dispute creation (freeze payment)
   */
  async handleDispute(
    agreementId: string,
    disputeData: {
      raisedByUserId: string;
      disputeType: string;
      description: string;
      evidenceImages?: string[];
    },
    transaction?: Transaction,
  ): Promise<DeliveryAgreement> {
    const t = transaction || await sequelize.transaction();
    const shouldCommit = !transaction;

    try {
      const agreement = await DeliveryAgreement.findByPk(agreementId, {
        transaction: t,
      });

      if (!agreement) {
        throw new Error('Delivery agreement not found');
      }

      if (agreement.status === DeliveryStatus.DISPUTED) {
        throw new Error('Agreement is already disputed');
      }

      // Transition to disputed status (this will freeze any payment release)
      await agreement.transitionTo(DeliveryStatus.DISPUTED, disputeData.raisedByUserId, {
        dispute_type: disputeData.disputeType,
        dispute_description: disputeData.description,
        dispute_raised_at: new Date().toISOString(),
      });

      // Log dispute creation
      await agreement.logEvent('dispute_raised', {
        dispute_type: disputeData.disputeType,
        raised_by: disputeData.raisedByUserId,
        description: disputeData.description,
      }, disputeData.raisedByUserId);

      if (shouldCommit) {
        await t.commit();
      }

      logInfo('Dispute created, payment frozen', {
        agreementId,
        disputeType: disputeData.disputeType,
        raisedBy: disputeData.raisedByUserId,
      });

      return agreement;

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }

      logError('Failed to handle dispute', error as Error, {
        agreementId,
        disputeData,
      });

      throw error;
    }
  }

  /**
   * Resolve dispute (admin action)
   */
  async resolveDispute(
    agreementId: string,
    resolution: {
      adminId: string;
      resolution: 'release_to_courier' | 'refund_to_sender' | 'partial_split';
      courierAmount?: number;
      senderRefund?: number;
      notes?: string;
    },
    transaction?: Transaction,
  ): Promise<DeliveryAgreement> {
    const t = transaction || await sequelize.transaction();
    const shouldCommit = !transaction;

    try {
      const agreement = await DeliveryAgreement.findByPk(agreementId, {
        transaction: t,
      });

      if (!agreement) {
        throw new Error('Delivery agreement not found');
      }

      if (agreement.status !== DeliveryStatus.DISPUTED) {
        throw new Error('Agreement is not in disputed status');
      }

      if (!agreement.escrowPaymentId) {
        throw new Error('No escrow payment to resolve');
      }

      // Execute resolution based on admin decision
      let paymentSuccess = false;

      switch (resolution.resolution) {
        case 'release_to_courier':
          paymentSuccess = await this.paymentProvider.releaseEscrowPayment(
            agreement.escrowPaymentId,
            agreement.courierId,
          );
          if (paymentSuccess) {
            agreement.paymentReleasedAt = new Date();
            await agreement.transitionTo(DeliveryStatus.COMPLETED, resolution.adminId, {
              admin_resolution: 'released_to_courier',
              admin_notes: resolution.notes,
            });
          }
          break;

        case 'refund_to_sender':
          paymentSuccess = await this.paymentProvider.refundEscrowPayment(
            agreement.escrowPaymentId,
            `Admin resolution: ${resolution.notes || 'Dispute resolved in favor of sender'}`,
          );
          if (paymentSuccess) {
            await agreement.transitionTo(DeliveryStatus.CANCELLED, resolution.adminId, {
              admin_resolution: 'refunded_to_sender',
              admin_notes: resolution.notes,
            });
          }
          break;

        case 'partial_split':
          // For partial split, we would need more complex payment provider integration
          // This is a simplified implementation
          logInfo('Partial split resolution requested - manual processing required', {
            agreementId,
            courierAmount: resolution.courierAmount,
            senderRefund: resolution.senderRefund,
          });
          paymentSuccess = true; // Assume manual processing will handle this
          break;
      }

      if (!paymentSuccess) {
        throw new Error('Failed to execute payment resolution');
      }

      // Log dispute resolution
      await agreement.logEvent('dispute_resolved', {
        resolved_by: resolution.adminId,
        resolution_type: resolution.resolution,
        admin_notes: resolution.notes,
        courier_amount: resolution.courierAmount,
        sender_refund: resolution.senderRefund,
      }, resolution.adminId);

      if (shouldCommit) {
        await t.commit();
      }

      logInfo('Dispute resolved', {
        agreementId,
        resolution: resolution.resolution,
        adminId: resolution.adminId,
      });

      return agreement;

    } catch (error) {
      if (shouldCommit) {
        await t.rollback();
      }

      logError('Failed to resolve dispute', error as Error, {
        agreementId,
        resolution,
      });

      throw error;
    }
  }

  /**
   * Get escrow payment status
   */
  async getEscrowStatus(agreementId: string): Promise<{
    agreement: DeliveryAgreement;
    paymentStatus: string;
    canRelease: boolean;
    canRefund: boolean;
  }> {
    try {
      const agreement = await DeliveryAgreement.findByPk(agreementId);

      if (!agreement) {
        throw new Error('Delivery agreement not found');
      }

      let paymentStatus = 'unknown';
      if (agreement.escrowPaymentId) {
        paymentStatus = await this.paymentProvider.getPaymentStatus(agreement.escrowPaymentId);
      }

      const canRelease = agreement.status === DeliveryStatus.IN_TRANSIT && paymentStatus === 'held';
      const canRefund = (agreement.status === DeliveryStatus.PENDING_PICKUP ||
                        agreement.status === DeliveryStatus.IN_TRANSIT) &&
                       paymentStatus === 'held';

      return {
        agreement,
        paymentStatus,
        canRelease,
        canRefund,
      };

    } catch (error) {
      logError('Failed to get escrow status', error as Error, { agreementId });
      throw error;
    }
  }

  // Private helper methods

  private calculatePlatformFee(amount: number): number {
    // 10% platform fee
    return Math.round(amount * 0.10 * 100) / 100;
  }
}

export default new CourierEscrowService();
