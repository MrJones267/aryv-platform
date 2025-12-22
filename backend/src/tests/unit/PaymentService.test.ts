/**
 * @fileoverview Unit tests for PaymentService
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import { PaymentService } from '../../services/PaymentService';
import Booking from '../../models/Booking';
import Ride from '../../models/Ride';
import User from '../../models/User';
import { BookingStatus } from '../../types';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

// Mock models
jest.mock('../../models/Booking');
jest.mock('../../models/Ride');
jest.mock('../../models/User');
jest.mock('../../config/database', () => ({
  sequelize: {
    transaction: jest.fn().mockResolvedValue({
      commit: jest.fn(),
      rollback: jest.fn(),
    }),
  },
}));

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockStripe: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create PaymentService instance
    paymentService = new PaymentService();
    
    // Get mocked Stripe instance
    const Stripe = require('stripe');
    mockStripe = new Stripe();
    
    // Mock environment variable
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_123456789';
  });

  afterEach(() => {
    delete process.env['STRIPE_SECRET_KEY'];
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent with Stripe when API key is available', async () => {
      const mockBooking = {
        id: 'booking-123',
        rideId: 'ride-123',
        passengerId: 'passenger-123',
        totalAmount: 50.00,
        platformFee: 2.50,
        ride: {
          originAddress: '123 Start St',
          destinationAddress: '456 End Ave',
          driver: { id: 'driver-123', firstName: 'John', lastName: 'Driver' },
        },
        passenger: {
          id: 'passenger-123',
          firstName: 'Jane',
          lastName: 'Passenger',
          email: 'jane@test.com',
        },
      };

      const mockPaymentIntent = {
        id: 'pi_1234567890',
        client_secret: 'pi_1234567890_secret_abc123',
        amount: 5000,
        currency: 'usd',
        status: 'requires_payment_method',
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);
      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const result = await paymentService.createPaymentIntent({
        bookingId: 'booking-123',
        amount: 50.00,
        currency: 'usd',
        description: 'Test ride',
        receiptEmail: 'jane@test.com',
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('pi_1234567890');
      expect(result.data.client_secret).toBe('pi_1234567890_secret_abc123');
      expect(result.data.amount).toBe(5000);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'usd',
        metadata: {
          bookingId: 'booking-123',
          rideId: 'ride-123',
          passengerId: 'passenger-123',
          platformFee: 250,
          environment: 'test',
        },
        description: 'Test ride',
        receipt_email: 'jane@test.com',
        automatic_payment_methods: { enabled: true },
        application_fee_amount: 250,
      });
    });

    it('should return mock payment intent when Stripe API key is not available', async () => {
      delete process.env['STRIPE_SECRET_KEY'];
      paymentService = new PaymentService();

      const result = await paymentService.createPaymentIntent({
        bookingId: 'booking-123',
        amount: 50.00,
        currency: 'usd',
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toMatch(/^pi_mock_/);
      expect(result.data.client_secret).toMatch(/^pi_mock_.*_secret_/);
      expect(result.data.amount).toBe(5000);
      expect(result.data.currency).toBe('usd');
    });

    it('should handle booking not found error', async () => {
      (Booking.findByPk as jest.Mock).mockResolvedValue(null);

      const result = await paymentService.createPaymentIntent({
        bookingId: 'invalid-booking',
        amount: 50.00,
        currency: 'usd',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking not found');
    });

    it('should handle Stripe API errors', async () => {
      const mockBooking = {
        id: 'booking-123',
        platformFee: 2.50,
        passenger: { email: 'jane@test.com' },
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);
      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Stripe API error'));

      const result = await paymentService.createPaymentIntent({
        bookingId: 'booking-123',
        amount: 50.00,
        currency: 'usd',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stripe API error');
    });
  });

  describe('verifyPaymentIntent', () => {
    it('should verify payment intent with Stripe', async () => {
      const mockPaymentIntent = {
        id: 'pi_1234567890',
        status: 'succeeded',
        amount: 5000,
        currency: 'usd',
        metadata: { bookingId: 'booking-123' },
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      const result = await paymentService.verifyPaymentIntent('pi_1234567890');

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('succeeded');
      expect(result.data.amount).toBe(5000);
      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_1234567890');
    });

    it('should return mock verification when Stripe API key is not available', async () => {
      delete process.env['STRIPE_SECRET_KEY'];
      paymentService = new PaymentService();

      const result = await paymentService.verifyPaymentIntent('pi_mock_123');

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('succeeded');
    });

    it('should handle invalid payment intent ID', async () => {
      delete process.env['STRIPE_SECRET_KEY'];
      paymentService = new PaymentService();

      const result = await paymentService.verifyPaymentIntent('pi_invalid_123');

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('failed');
    });

    it('should handle Stripe API errors', async () => {
      mockStripe.paymentIntents.retrieve.mockRejectedValue(new Error('Payment intent not found'));

      const result = await paymentService.verifyPaymentIntent('pi_invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment intent not found');
    });
  });

  describe('processRefund', () => {
    it('should process refund successfully', async () => {
      const mockBooking = {
        id: 'booking-123',
        paymentIntentId: 'pi_1234567890',
        totalAmount: 50.00,
        rideId: 'ride-123',
        update: jest.fn(),
      };

      const mockRefund = {
        id: 're_1234567890',
        amount: 5000,
        status: 'succeeded',
        currency: 'usd',
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);
      mockStripe.refunds.create.mockResolvedValue(mockRefund);

      const result = await paymentService.processRefund('booking-123', 50.00, 'Customer request');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('re_1234567890');
      expect(result.data.amount).toBe(5000);
      expect(result.data.status).toBe('succeeded');

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_1234567890',
        amount: 5000,
        reason: 'requested_by_customer',
        metadata: {
          bookingId: 'booking-123',
          rideId: 'ride-123',
          refundReason: 'Customer request',
        },
      });

      expect(mockBooking.update).toHaveBeenCalledWith({
        status: BookingStatus.CANCELLED,
        cancelReason: 'Customer request',
      }, { transaction: expect.any(Object) });
    });

    it('should process full refund when no amount specified', async () => {
      const mockBooking = {
        id: 'booking-123',
        paymentIntentId: 'pi_1234567890',
        totalAmount: 50.00,
        rideId: 'ride-123',
        update: jest.fn(),
      };

      const mockRefund = {
        id: 're_1234567890',
        amount: 5000,
        status: 'succeeded',
        currency: 'usd',
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);
      mockStripe.refunds.create.mockResolvedValue(mockRefund);

      const result = await paymentService.processRefund('booking-123', undefined, 'Full refund');

      expect(result.success).toBe(true);
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_1234567890',
        amount: undefined, // Full refund
        reason: 'requested_by_customer',
        metadata: {
          bookingId: 'booking-123',
          rideId: 'ride-123',
          refundReason: 'Full refund',
        },
      });
    });

    it('should return mock refund when Stripe API key is not available', async () => {
      delete process.env['STRIPE_SECRET_KEY'];
      paymentService = new PaymentService();

      const mockBooking = {
        id: 'booking-123',
        paymentIntentId: 'pi_mock_123',
        totalAmount: 50.00,
        update: jest.fn(),
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);

      const result = await paymentService.processRefund('booking-123', 25.00, 'Partial refund');

      expect(result.success).toBe(true);
      expect(result.data.id).toMatch(/^re_mock_/);
      expect(result.data.amount).toBe(2500);
      expect(result.data.status).toBe('succeeded');
    });

    it('should handle booking not found', async () => {
      (Booking.findByPk as jest.Mock).mockResolvedValue(null);

      const result = await paymentService.processRefund('invalid-booking');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking or payment intent not found');
    });

    it('should handle booking without payment intent', async () => {
      const mockBooking = {
        id: 'booking-123',
        paymentIntentId: null,
        totalAmount: 50.00,
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);

      const result = await paymentService.processRefund('booking-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking or payment intent not found');
    });
  });

  describe('handleWebhookEvent', () => {
    it('should handle payment_intent.succeeded event', async () => {
      const mockEvent = {
        id: 'evt_1234567890',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            metadata: { bookingId: 'booking-123' },
            amount: 5000,
          },
        },
      };

      const mockBooking = {
        id: 'booking-123',
        status: BookingStatus.PENDING,
        update: jest.fn(),
        ride: { id: 'ride-123', status: 'pending' },
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);

      const result = await paymentService.handleWebhookEvent(mockEvent as any);

      expect(result.success).toBe(true);
      expect(mockBooking.update).toHaveBeenCalledWith(
        { status: BookingStatus.CONFIRMED },
        { transaction: expect.any(Object) }
      );
    });

    it('should handle payment_intent.payment_failed event', async () => {
      const mockEvent = {
        id: 'evt_1234567890',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_1234567890',
            metadata: { bookingId: 'booking-123' },
            last_payment_error: { message: 'Card declined' },
          },
        },
      };

      const mockBooking = {
        id: 'booking-123',
        update: jest.fn(),
      };

      (Booking.findByPk as jest.Mock).mockResolvedValue(mockBooking);

      const result = await paymentService.handleWebhookEvent(mockEvent as any);

      expect(result.success).toBe(true);
      expect(mockBooking.update).toHaveBeenCalledWith(
        { cancelReason: 'Payment failed' },
        { transaction: expect.any(Object) }
      );
    });

    it('should handle charge.dispute.created event', async () => {
      const mockEvent = {
        id: 'evt_1234567890',
        type: 'charge.dispute.created',
        data: {
          object: {
            id: 'dp_1234567890',
            payment_intent: 'pi_1234567890',
            amount: 5000,
            reason: 'fraudulent',
            status: 'needs_response',
          },
        },
      };

      const mockBooking = {
        id: 'booking-123',
        paymentIntentId: 'pi_1234567890',
      };

      (Booking.findOne as jest.Mock).mockResolvedValue(mockBooking);

      const result = await paymentService.handleWebhookEvent(mockEvent as any);

      expect(result.success).toBe(true);
      // Should log dispute but not fail
    });

    it('should handle unknown event types gracefully', async () => {
      const mockEvent = {
        id: 'evt_1234567890',
        type: 'customer.created',
        data: { object: {} },
      };

      const result = await paymentService.handleWebhookEvent(mockEvent as any);

      expect(result.success).toBe(true);
    });

    it('should handle events without booking metadata', async () => {
      const mockEvent = {
        id: 'evt_1234567890',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            metadata: {}, // No bookingId
            amount: 5000,
          },
        },
      };

      const result = await paymentService.handleWebhookEvent(mockEvent as any);

      expect(result.success).toBe(true);
      expect(Booking.findByPk).not.toHaveBeenCalled();
    });
  });

  describe('constructWebhookEvent', () => {
    it('should construct webhook event successfully', () => {
      const mockEvent = { id: 'evt_123', type: 'payment_intent.succeeded' };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = paymentService.constructWebhookEvent('payload', 'signature');

      expect(result).toEqual(mockEvent);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        undefined // No webhook secret in test
      );
    });

    it('should return null when Stripe is not available', () => {
      delete process.env['STRIPE_SECRET_KEY'];
      paymentService = new PaymentService();

      const result = paymentService.constructWebhookEvent('payload', 'signature');

      expect(result).toBeNull();
    });

    it('should return null on webhook construction error', () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = paymentService.constructWebhookEvent('payload', 'invalid-signature');

      expect(result).toBeNull();
    });
  });
});