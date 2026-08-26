/**
 * @fileoverview Payment service for handling Stripe payment operations
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import Stripe from 'stripe';
import { Transaction } from 'sequelize';
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
        if (process.env['NODE_ENV'] !== 'development') {
          return { success: false, error: 'Payment processing is not configured. Contact support.' };
        }
        // Dev-only mock — never active in production
        return {
          success: true,
          data: {
            id: `pi_mock_${Date.now()}`,
            client_secret: `pi_mock_${Date.now()}_secret_dev`,
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
        if (process.env['NODE_ENV'] !== 'development') {
          return { success: false, error: 'Payment processing is not configured. Contact support.' };
        }
        // Dev-only mock
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
   * Process refund for a booking.
   *
   * The caller never decides how much money leaves the platform. `amount` is a
   * *request* for a partial refund and is clamped to what the booking is
   * actually worth; omitting it refunds the booking in full. Anything above
   * `booking.totalAmount` is refused outright rather than silently clamped, so
   * a caller asking for more than exists gets an error instead of a surprise.
   *
   * Eligibility is decided here, not at the route, because this is the only
   * function that moves money and every caller has to pass through it:
   *
   *  - An already-cancelled booking is refused. Without this, replaying the
   *    same request issued a second Stripe refund against the same intent.
   *  - A departed ride is refused unless the caller sets `allowAfterDeparture`,
   *    which only the admin path does. Self-service refunds after the trip has
   *    run are the refund-fraud case: ride, then claim the money back.
   */
  async processRefund(
    bookingId: string,
    amount?: number,
    reason?: string,
    options: { allowAfterDeparture?: boolean; requestedBy?: string } = {},
  ): Promise<PaymentResult> {
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
        // Scoped to `bookings` deliberately: the Ride include makes this a LEFT
        // OUTER JOIN, and Postgres refuses FOR UPDATE on the nullable side of
        // one. Locking the booking row is all that is needed — it is what two
        // concurrent refunds would race over.
        lock: { level: Transaction.LOCK.UPDATE, of: Booking },
      });

      if (!booking || !booking.paymentIntentId) {
        await transaction.rollback();
        return {
          success: false,
          error: 'Booking or payment intent not found',
        };
      }

      if (booking.status === BookingStatus.CANCELLED) {
        await transaction.rollback();
        return {
          success: false,
          error: 'This booking has already been cancelled and refunded',
        };
      }

      if (!options.allowAfterDeparture) {
        const departure = booking.ride?.departureTime;
        if (departure && new Date(departure).getTime() <= Date.now()) {
          await transaction.rollback();
          return {
            success: false,
            error: 'This ride has already departed. Contact support to request a refund.',
          };
        }
      }

      const bookingTotal = Number(booking.totalAmount);

      if (amount !== undefined) {
        if (!Number.isFinite(amount) || amount <= 0) {
          await transaction.rollback();
          return { success: false, error: 'Refund amount must be greater than zero' };
        }
        // Compared in cents so a value like 40.005 cannot creep past the total
        // through float representation and reach Stripe rounded up.
        if (Math.round(amount * 100) > Math.round(bookingTotal * 100)) {
          await transaction.rollback();
          return {
            success: false,
            error: `Refund amount exceeds the booking total of ${bookingTotal}`,
          };
        }
      }

      const refundCents = Math.round((amount ?? bookingTotal) * 100);

      if (!this.stripe) {
        await transaction.rollback();
        if (process.env['NODE_ENV'] !== 'development') {
          return { success: false, error: 'Payment processing is not configured. Contact support.' };
        }
        // Dev-only mock
        return {
          success: true,
          data: {
            id: `re_mock_${Date.now()}`,
            amount: refundCents,
            status: 'succeeded',
          },
        };
      }

      // The Stripe call sits inside the transaction, so a commit failure after
      // a successful refund would leave the booking open and refundable again.
      // The idempotency key makes the retry safe: Stripe returns the refund it
      // already created rather than issuing a second one. Keyed on the booking
      // and the exact amount, so a later *different* partial refund by an admin
      // is still allowed through as its own operation.
      const refund = await this.stripe.refunds.create(
        {
          payment_intent: booking.paymentIntentId,
          ...(amount !== undefined && { amount: refundCents }), // Full refund if no amount specified
          // Stripe's `reason` only accepts a fixed enum; the human-readable reason
          // is preserved in metadata.refundReason below.
          reason: 'requested_by_customer',
          metadata: {
            bookingId: booking.id,
            rideId: booking.rideId,
            refundReason: reason || 'Booking cancellation',
            requestedBy: options.requestedBy ?? 'system',
          },
        },
        { idempotencyKey: `refund:${booking.id}:${refundCents}` },
      );

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
        requestedBy: options.requestedBy ?? 'system',
        afterDeparture: Boolean(options.allowAfterDeparture),
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
