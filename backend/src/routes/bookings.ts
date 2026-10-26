/**
 * @fileoverview Booking API routes
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { rateLimitKey } from '../config/rateLimitKey';
import { BookingController } from '../controllers/BookingController';
import { validateInput } from '../middleware/validation';
import { authenticateToken, authenticateAdminToken, authorizeAdminRoles } from '../middleware/auth';
import { paymentService } from '../services/PaymentService';
import Booking from '../models/Booking';
import { Request, Response } from 'express';
import logger from '../utils/logger';

const router = Router();
const bookingController = new BookingController();

// Rate limiting for booking operations
const bookingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: 'Too many booking requests from this IP, please try again later',
  store: makeStore('booking'),
  keyGenerator: rateLimitKey,
});

const cancelBookingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit cancellations to 5 per hour per IP
  message: 'Too many booking cancellation attempts, please try again later',
  store: makeStore('booking-cancel'),
  keyGenerator: rateLimitKey,
});

// Validation schemas
const updateBookingValidation = [
  param('id').isUUID().withMessage('Booking ID must be a valid UUID'),
  body('status')
    .optional()
    .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
    .withMessage('Invalid booking status'),
  body('seatsBooked')
    .optional()
    .isInt({ min: 1, max: 7 })
    .withMessage('Seats booked must be between 1 and 7'),
  body('pickupAddress')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Pickup address cannot exceed 500 characters'),
  body('dropoffAddress')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Dropoff address cannot exceed 500 characters'),
  body('specialRequests')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Special requests cannot exceed 1000 characters'),
];

const cancelBookingValidation = [
  param('id').isUUID().withMessage('Booking ID must be a valid UUID'),
  body('reason')
    .isLength({ min: 5, max: 500 })
    .withMessage('Cancel reason must be between 5 and 500 characters'),
];

const rateBookingValidation = [
  param('id').isUUID().withMessage('Booking ID must be a valid UUID'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('review')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Review cannot exceed 1000 characters'),
];

const bookingIdValidation = [
  param('id').isUUID().withMessage('Booking ID must be a valid UUID'),
];

const getUserBookingsValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
    .withMessage('Invalid status filter'),
  query('type')
    .optional()
    .isIn(['driver', 'passenger', 'both'])
    .withMessage('Type must be driver, passenger, or both'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

// Routes

/**
 * @route   GET /api/bookings/my-bookings
 * @desc    Get current user's bookings
 * @access  Private
 */
router.get(
  '/my-bookings',
  bookingRateLimit,
  authenticateToken,
  getUserBookingsValidation,
  validateInput,
  bookingController.getMyBookings.bind(bookingController),
);

/**
 * @route   GET /api/bookings/:id
 * @desc    Get booking by ID
 * @access  Private
 */
router.get(
  '/:id',
  bookingRateLimit,
  authenticateToken,
  bookingIdValidation,
  validateInput,
  bookingController.getBookingById.bind(bookingController),
);

/**
 * @route   PUT /api/bookings/:id
 * @desc    Update booking (limited fields)
 * @access  Private
 */
router.put(
  '/:id',
  bookingRateLimit,
  authenticateToken,
  updateBookingValidation,
  validateInput,
  bookingController.updateBooking.bind(bookingController),
);

/**
 * @route   POST /api/bookings/:id/cancel
 * @desc    Cancel booking
 * @access  Private
 */
router.post(
  '/:id/cancel',
  cancelBookingRateLimit,
  authenticateToken,
  cancelBookingValidation,
  validateInput,
  bookingController.cancelBooking.bind(bookingController),
);

/**
 * @route   PATCH /api/bookings/:id/reject
 * @desc    Reject a pending booking (driver only)
 * @access  Private
 */
router.patch(
  '/:id/reject',
  bookingRateLimit,
  authenticateToken,
  [
    param('id').isUUID().withMessage('Booking ID must be a valid UUID'),
    body('reason').optional().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  ],
  validateInput,
  bookingController.rejectBooking.bind(bookingController),
);

/**
 * @route   POST /api/bookings/:id/confirm
 * @desc    Confirm booking (driver only)
 * @access  Private
 */
router.post(
  '/:id/confirm',
  bookingRateLimit,
  authenticateToken,
  bookingIdValidation,
  validateInput,
  bookingController.confirmBooking.bind(bookingController),
);

/**
 * @route   POST /api/bookings/:id/rate
 * @desc    Rate and review a completed booking
 * @access  Private
 */
router.post(
  '/:id/rate',
  bookingRateLimit,
  authenticateToken,
  rateBookingValidation,
  validateInput,
  bookingController.rateBooking.bind(bookingController),
);

/**
 * @route   POST /api/bookings/:id/rate-passenger
 * @desc    Driver rates a passenger after a completed booking
 * @access  Private (driver only)
 */
router.post(
  '/:id/rate-passenger',
  bookingRateLimit,
  authenticateToken,
  rateBookingValidation,
  validateInput,
  bookingController.ratePassenger.bind(bookingController),
);

/**
 * @route   GET /api/bookings/:id/payment-intent
 * @desc    Create payment intent for booking
 * @access  Private
 */
router.get(
  '/:id/payment-intent',
  bookingRateLimit,
  authenticateToken,
  bookingIdValidation,
  validateInput,
  bookingController.createPaymentIntent.bind(bookingController),
);

/**
 * @route   POST /api/bookings/:id/payment-confirm
 * @desc    Confirm payment for booking
 * @access  Private
 */
router.post(
  '/:id/payment-confirm',
  bookingRateLimit,
  authenticateToken,
  [
    param('id').isUUID().withMessage('Booking ID must be a valid UUID'),
    body('paymentIntentId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Payment intent ID is required'),
  ],
  validateInput,
  bookingController.confirmPayment.bind(bookingController),
);

/**
 * @route   POST /api/bookings/stripe-webhook
 * @desc    Handle Stripe webhook events
 * @access  Public (Stripe only)
 */
router.post(
  '/stripe-webhook',
  // The raw body is captured by the express.json() verify hook in index.ts.
  //
  // This previously attached its own 'data'/'end' listeners here, but
  // express.json() has already consumed the stream by this point: those events
  // never fire again, next() was never called, and the request hung forever —
  // on exactly the content type Stripe sends.
  async (req: Request, res: Response): Promise<void> => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      if (!signature) {
        res.status(400).json({
          success: false,
          error: 'Missing Stripe signature',
          code: 'MISSING_SIGNATURE',
        });
        return;
      }

      const event = paymentService.constructWebhookEvent(rawBody, signature);

      if (!event) {
        res.status(400).json({
          success: false,
          error: 'Invalid webhook signature',
          code: 'INVALID_SIGNATURE',
        });
        return;
      }

      const result = await paymentService.handleWebhookEvent(event);

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: result.error,
          code: 'WEBHOOK_PROCESSING_FAILED',
        });
        return;
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Webhook error', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed',
        code: 'WEBHOOK_ERROR',
      });
    }
  },
);

/**
 * @route   POST /api/bookings/:id/refund
 * @desc    Process a refund for a booking. Staff only.
 * @access  Private (admin / super_admin)
 *
 * This was previously callable by the booking's own passenger with an amount
 * of their choosing and no check on whether the ride had happened — book, ride,
 * then claim the money back. Passengers now get their money back by cancelling
 * before departure, which refunds automatically; anything after that is a
 * support decision, which is what this endpoint is for.
 */
router.post(
  '/:id/refund',
  bookingRateLimit,
  authenticateAdminToken,
  authorizeAdminRoles('admin'),
  [
    param('id').isUUID().withMessage('Booking ID must be a valid UUID'),
    body('amount')
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage('Refund amount must be greater than 0'),
    body('reason')
      .isLength({ min: 5, max: 500 })
      .withMessage('Refund reason must be between 5 and 500 characters'),
  ],
  validateInput,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { amount, reason } = req.body;
      const adminId = (req as any).user?.id;

      const booking = await Booking.findByPk(id, { attributes: ['id'] });
      if (!booking) {
        res.status(404).json({ success: false, error: 'Booking not found', code: 'NOT_FOUND' });
        return;
      }

      // Staff are trusted to refund after departure — that is the entire point
      // of an escalation path. The amount is still capped at the booking total
      // inside processRefund.
      const result = await paymentService.processRefund(id, amount, reason, {
        allowAfterDeparture: true,
        requestedBy: `admin:${adminId}`,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
          code: 'REFUND_FAILED',
        });
        return;
      }

      res.json({
        success: true,
        data: result.data,
        message: 'Refund processed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Refund error', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to process refund',
        code: 'REFUND_PROCESSING_FAILED',
      });
    }
  },
);

export default router;
