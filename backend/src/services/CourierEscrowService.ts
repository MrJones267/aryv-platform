/**
 * @fileoverview CourierEscrowService for automated agreement and payment management
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import crypto from 'crypto';
import { Transaction, Op } from 'sequelize';
import {
  DeliveryAgreement,
  Package,
  User,
  CourierProfile,
} from '../models';
import { DeliveryStatus } from '../models/DeliveryAgreement';
import { sequelize } from '../config/database';
import { CommissionService } from './CommissionService';
import { PLATFORM_DEFAULT_CURRENCY } from './CurrencyService';
import { logInfo, logError, logWarning } from '../utils/logger';

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
    const paymentId = `escrow_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

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

/**
 * Refuses every operation. Used in production until a real provider is wired
 * up, so that couriers and senders get an honest error instead of the mock's
 * cheerful success — the API reported `paymentReleased: true` and an earnings
 * figure while no money had moved and none ever would.
 */
class UnconfiguredPaymentProvider implements PaymentProvider {
  private static readonly MESSAGE =
    'Courier payments are not available yet: no escrow payment provider is configured.';

  async createEscrowPayment(): Promise<string> {
    throw new Error(UnconfiguredPaymentProvider.MESSAGE);
  }

  async releaseEscrowPayment(): Promise<boolean> {
    throw new Error(UnconfiguredPaymentProvider.MESSAGE);
  }

  async refundEscrowPayment(): Promise<boolean> {
    throw new Error(UnconfiguredPaymentProvider.MESSAGE);
  }

  async getPaymentStatus(): Promise<'pending' | 'held' | 'released' | 'refunded' | 'failed'> {
    throw new Error(UnconfiguredPaymentProvider.MESSAGE);
  }
}

export class CourierEscrowService {
  private paymentProvider: PaymentProvider;
  private commissionService = new CommissionService();

  constructor() {
    // MockPaymentProvider keeps escrow state in a per-process Map. Beyond
    // moving no money, that state does not survive a restart or exist on a
    // second instance: after any redeploy every in-flight delivery becomes
    // permanently uncompletable, because getPaymentStatus no longer reports
    // 'held' and completeDelivery refuses to release. It must never run in
    // production.
    const isProduction = process.env['NODE_ENV'] === 'production';

    if (isProduction) {
      logWarning(
        'No escrow payment provider configured; courier payment operations will fail',
      );
      this.paymentProvider = new UnconfiguredPaymentProvider();
    } else {
      this.paymentProvider = new MockPaymentProvider();
    }
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

      const paymentMethod = packageData.paymentMethod ?? 'cash_on_delivery';

      // A courier who is too far behind on commission cannot take more cash
      // work, exactly as a driver cannot take more cash rides. Without this the
      // platform's only revenue on cash deliveries is uncollectable.
      if (paymentMethod === 'cash_on_delivery') {
        const owed = await this.commissionService.isBlockedForUnpaidCommission(courierId, t);
        if (owed.blocked) {
          throw new Error(
            `Settle your outstanding commission (${owed.owed.toFixed(2)}) before accepting `
            + `more cash deliveries. Limit: ${owed.threshold.toFixed(2)}.`,
          );
        }
      }

      // Cash never passes through the platform, so there is nothing to hold.
      // Calling the provider here would fail in production by design — it
      // refuses every operation until a real one is configured.
      const escrowPaymentId = paymentMethod === 'escrow'
        ? await this.paymentProvider.createEscrowPayment(
          escrowAmount,
          packageData.senderId,
          {
            packageId,
            courierId,
            packageTitle: packageData.title,
          },
        )
        : null;

      // Create delivery agreement
      const deliveryAgreement = await DeliveryAgreement.create({
        packageId,
        courierId,
        agreedPrice,
        platformFee,
        paymentMethod,
        // Inherited from the package: the sender set the price, so the price
        // is in their currency.
        currency: packageData.currency ?? PLATFORM_DEFAULT_CURRENCY,
        escrowAmount,
        ...(escrowPaymentId ? { escrowPaymentId } : {}),
        ...(paymentMethod === 'escrow' ? { escrowHeldAt: new Date() } : {}),
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

      // Deliberately no longer generates a code here.
      //
      // createQRCode() wrote a token onto the agreement row, and the agreement
      // is returned to the courier — so the courier received a delivery token
      // at the moment they accepted the job, which is the one thing the
      // handover protocol depends on not happening. It also issued the code at
      // acceptance rather than at pickup.
      //
      // Codes are now issued by DeliveryHandoverService when pickup is
      // confirmed, stored on delivery_qr_codes, and sent to the recipient.
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

      const isCash = (agreement.paymentMethod ?? 'cash_on_delivery') === 'cash_on_delivery';

      if (isCash) {
        // The recipient paid the courier at the door, exactly as a passenger
        // pays a driver. Nothing to release: the courier already holds the
        // money, and the platform's share becomes a debt they settle later
        // through the same ledger that collects on cash rides.
        await this.commissionService.accrueCommission(
          agreement.courierId,
          agreement.platformFee,
          null,
          t,
          {
            description: 'Platform commission on cash delivery',
            metadata: { deliveryAgreementId: agreement.id },
          },
        );

        await agreement.transitionTo(DeliveryStatus.COMPLETED, agreement.courierId, {
          payment_method: 'cash_on_delivery',
          cash_collected: true,
          verification_data: verificationData,
          completion_time: new Date().toISOString(),
        });

        agreement.cashCollectedAt = new Date();
        agreement.cashAmountCollected = agreement.agreedPrice;
        await agreement.save({ transaction: t });
      } else {
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

        await agreement.transitionTo(DeliveryStatus.COMPLETED, agreement.courierId, {
          payment_released: true,
          verification_data: verificationData,
          completion_time: new Date().toISOString(),
        });

        agreement.paymentReleasedAt = new Date();
        await agreement.save({ transaction: t });
      }

      // Update courier profile stats
      const courierProfile = await CourierProfile.findOne({
        where: { userId: agreement.courierId },
        transaction: t,
      });

      if (courierProfile) {
        const courierEarnings = agreement.agreedPrice - agreement.platformFee;
        await courierProfile.recordSuccessfulDelivery(courierEarnings);
      }

      await agreement.logEvent(isCash ? 'cash_collected' : 'payment_released', {
        payment_method: agreement.paymentMethod,
        ...(isCash ? {} : { escrow_payment_id: agreement.escrowPaymentId }),
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

      const statusBeforeCancel = agreement.status;

      // Update agreement status
      await agreement.transitionTo(DeliveryStatus.CANCELLED, cancelledByUserId, {
        cancellation_reason: reason,
        cancelled_by: cancelledByUserId,
        refund_processed: true,
        cancellation_time: new Date().toISOString(),
      });

      // Reactivate package if cancelled before pickup
      if (statusBeforeCancel === DeliveryStatus.PENDING_PICKUP) {
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
