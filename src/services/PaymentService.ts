/**
 * @fileoverview Payment service for handling Stripe payment operations
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import Stripe from 'stripe';
import Booking from '../models/Booking';
import Ride from '../models/Ride';
import User from '../models/User';
import { BookingStatus } from '../types';
import { sequelize } from '../config/database';
import logger, { getErrorMessage, getErrorStack } from '../utils/logger';

export interface PaymentIntentData {
  bookingId: string;
  amount: number;
  currency: string;
  description?: string;
  receiptEmail?: string;
}

export interface PaymentResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class PaymentService {
  private stripe: Stripe | null = null;

  constructor() {
    if (process.env['STRIPE_SECRET_KEY']) {
      this.stripe = new Stripe(process.env['STRIPE_SECRET_KEY'], {
        apiVersion: '2023-10-16',
      });
    }
  }

  /**
   * Create a Stripe payment intent for a booking
   */
  async createPaymentIntent(data: PaymentIntentData): Promise<PaymentResult> {
    try {
      if (!this.stripe) {
        // Mock payment intent for development
        return {
          success: true,
          data: {
            id: `pi_mock_${Date.now()}`,
            client_secret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`,
            amount: Math.round(data.amount * 100),
            currency: data.currency,
            status: 'requires_payment_method',
          },
        };
      }

      const booking = await Booking.findByPk(data.bookingId, {
        include: [
          {
            model: Ride,
            as: 'ride',
            include: [
              {
                model: User,
                as: 'driver',
                attributes: ['id', 'firstName', 'lastName'],
              },
            ],
          },
          {
            model: User,
            as: 'passenger',
            attributes: ['id', 'firstName', 'lastName', 'email'],
          },
        ],
      });

      if (!booking) {
        return {
          success: false,
          error: 'Booking not found',
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100), // Convert to cents
        currency: data.currency,
        metadata: {
          bookingId: booking.id,
          rideId: booking.rideId,
          passengerId: booking.passengerId,
          platformFee: Math.round(booking.platformFee * 100),
          environment: process.env['NODE_ENV'] || 'development',
        },
        description: data.description || 'ARYV ride booking',
        ...(data.receiptEmail && { receipt_email: data.receiptEmail }),
        automatic_payment_methods: {
          enabled: true,
        },
        application_fee_amount: Math.round(booking.platformFee * 100), // Platform fee
      });

      logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.id,
        bookingId: data.bookingId,
        amount: paymentIntent.amount,
      });

      return {
        success: true,
        data: {
          id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
        },
      };
    } catch (error) {
      logger.error('Error creating payment intent', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        bookingId: data.bookingId,
      });

      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Verify payment intent status with Stripe
   */
  async verifyPaymentIntent(paymentIntentId: string): Promise<PaymentResult> {
    try {
      if (!this.stripe) {
        // Mock verification for development
        return {
          success: true,
          data: {
            id: paymentIntentId,
            status: paymentIntentId.startsWith('pi_mock_') ? 'succeeded' : 'failed',
          },
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      logger.info('Payment intent verified', {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
      });

      return {
        success: true,
        data: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          metadata: paymentIntent.metadata,
        },
      };
    } catch (error) {
      logger.error('Error verifying payment intent', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        paymentIntentId,
      });

      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Process refund for a booking
   */
  async processRefund(bookingId: string, amount?: number, reason?: string): Promise<PaymentResult> {
    const transaction = await sequelize.transaction();

    try {
      const booking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: Ride,
            as: 'ride',
          },
        ],
        transaction,
      });

      if (!booking || !booking.paymentIntentId) {
        await transaction.rollback();
        return {
          success: false,
          error: 'Booking or payment intent not found',
        };
      }

      if (!this.stripe) {
        // Mock refund for development
        await transaction.commit();
        return {
          success: true,
          data: {
            id: `re_mock_${Date.now()}`,
            amount: Math.round((amount || booking.totalAmount) * 100),
            status: 'succeeded',
          },
        };
      }

      const refund = await this.stripe.refunds.create({
        payment_intent: booking.paymentIntentId,
        ...(amount && { amount: Math.round(amount * 100) }), // Full refund if no amount specified
        reason: reason as Stripe.RefundCreateParams.Reason || 'requested_by_customer',
        metadata: {
          bookingId: booking.id,
          rideId: booking.rideId,
          refundReason: reason || 'Booking cancellation',
        },
      });

      // Update booking status
      await booking.update({
        status: BookingStatus.CANCELLED,
        cancelReason: reason || 'Refund processed',
      }, { transaction });

      await transaction.commit();

      logger.info('Refund processed', {
        refundId: refund.id,
        bookingId,
        amount: refund.amount,
        status: refund.status,
      });

      return {
        success: true,
        data: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          currency: refund.currency,
        },
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('Error processing refund', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        bookingId,
      });

      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<PaymentResult> {
    const transaction = await sequelize.transaction();

    try {
      logger.info('Processing Stripe webhook event', {
        eventType: event.type,
        eventId: event.id,
      });

      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent, transaction);

        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent, transaction);

        case 'charge.dispute.created':
          return await this.handleChargeDispute(event.data.object as Stripe.Dispute, transaction);

        default:
          logger.info('Unhandled webhook event type', { eventType: event.type });
          await transaction.commit();
          return { success: true };
      }
    } catch (error) {
      await transaction.rollback();
      logger.error('Error handling webhook event', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        eventType: event.type,
        eventId: event.id,
      });

      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent, transaction: any): Promise<PaymentResult> {
    const bookingId = paymentIntent.metadata?.['bookingId'];

    if (!bookingId) {
      await transaction.commit();
      return { success: true };
    }

    const booking = await Booking.findByPk(bookingId, {
      include: [
        {
          model: Ride,
          as: 'ride',
        },
      ],
      transaction,
    });

    if (!booking) {
      await transaction.commit();
      return { success: true };
    }

    // Update booking status if needed
    if (booking.status === BookingStatus.PENDING) {
      await booking.update({
        status: BookingStatus.CONFIRMED,
      }, { transaction });
    }

    await transaction.commit();

    logger.info('Payment succeeded, booking updated', {
      bookingId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    });

    return { success: true };
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent, transaction: any): Promise<PaymentResult> {
    const bookingId = paymentIntent.metadata?.['bookingId'];

    if (!bookingId) {
      await transaction.commit();
      return { success: true };
    }

    const booking = await Booking.findByPk(bookingId, { transaction });

    if (!booking) {
      await transaction.commit();
      return { success: true };
    }

    // Optionally cancel the booking or mark it as payment failed
    await booking.update({
      cancelReason: 'Payment failed',
    }, { transaction });

    await transaction.commit();

    logger.warn('Payment failed for booking', {
      bookingId,
      paymentIntentId: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error?.message,
    });

    return { success: true };
  }

  /**
   * Handle charge dispute
   */
  private async handleChargeDispute(dispute: Stripe.Dispute, transaction: any): Promise<PaymentResult> {
    const paymentIntentId = dispute.payment_intent as string;

    if (!paymentIntentId) {
      await transaction.commit();
      return { success: true };
    }

    // Find booking by payment intent ID
    const booking = await Booking.findOne({
      where: { paymentIntentId },
      transaction,
    });

    if (!booking) {
      await transaction.commit();
      return { success: true };
    }

    // Log dispute for manual review
    logger.warn('Payment dispute created', {
      disputeId: dispute.id,
      bookingId: booking.id,
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
    });

    await transaction.commit();
    return { success: true };
  }

  /**
   * Construct webhook event from raw body and signature
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event | null {
    try {
      if (!this.stripe || !process.env['STRIPE_WEBHOOK_SECRET']) {
        return null;
      }

      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env['STRIPE_WEBHOOK_SECRET'],
      );
    } catch (error) {
      logger.error('Error constructing webhook event', {
        error: getErrorMessage(error),
      });
      return null;
    }
  }
}

export const paymentService = new PaymentService();
export default paymentService;
