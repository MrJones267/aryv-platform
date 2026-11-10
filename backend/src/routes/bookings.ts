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
import multer from 'multer';
import { TripPhotoController } from '../controllers/TripPhotoController';
import pickupPinService, { PickupPinError } from '../services/PickupPinService';
import { AuthenticatedRequest } from '../types';
import { handleMulterError } from '../middleware/upload';

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
  // Optional: the app's cancel button sends none, and requiring one refused
  // every cancellation made from it.
  body('reason')
    .optional({ values: 'falsy' })
    .isLength({ max: 500 })
    .withMessage('Cancel reason cannot exceed 500 characters'),
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

// ─── Face photos from today ──────────────────────────────────────────────────
// The passenger takes one when booking, the driver when accepting; each sees
// the other's once the booking is confirmed. See TripPhotoService.

const tripPhotoController = new TripPhotoController();

const tripPhotoRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many photo requests, please try again later',
  store: makeStore('trip-photo'),
  keyGenerator: rateLimitKey,
});

// Kept in memory: the service stores it (R2 or disk) only once the caller is
// known to belong to the booking.
const tripPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('photo');

const tripPhotoRoleValidation = [
  ...bookingIdValidation,
  param('role').isIn(['passenger', 'driver']).withMessage('Role must be passenger or driver'),
];

// ─── Pickup PIN ──────────────────────────────────────────────────────────────
// The passenger reads it out; the driver checks it. See PickupPinService.

const pinCheckRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many PIN checks, please try again later',
  store: makeStore('pickup-pin'),
  keyGenerator: rateLimitKey,
});

const sendPinError = (res: Response, error: unknown, action: string): void => {
  if (error instanceof PickupPinError) {
    res.status(error.status).json({ success: false, error: error.message, code: error.code, timestamp: new Date().toISOString() });
    return;
  }
  logger.error(`Pickup PIN ${action} failed`, { error: (error as Error)?.message });
  res.status(500).json({ success: false, error: 'Something went wrong', code: 'INTERNAL_ERROR', timestamp: new Date().toISOString() });
};

/**
 * @route   GET /api/bookings/:id/pickup-pin
 * @desc    The passenger's PIN for their confirmed booking
 * @access  Private (the booking's passenger)
 */
router.get(
  '/:id/pickup-pin',
  bookingRateLimit,
  authenticateToken,
  bookingIdValidation,
  validateInput,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await pickupPinService.forPassenger(req.params['id']!, (req as AuthenticatedRequest).user!.id);
      res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      sendPinError(res, error, 'read');
    }
  },
);

/**
 * @route   POST /api/bookings/:id/pickup-pin/verify
 * @desc    The driver checks the PIN the passenger read out
 * @access  Private (the ride's driver)
 */
router.post(
  '/:id/pickup-pin/verify',
  pinCheckRateLimit,
  authenticateToken,
  [
    ...bookingIdValidation,
    body('pin').isString().matches(/^\d{4}$/).withMessage('The PIN is 4 digits'),
  ],
  validateInput,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await pickupPinService.verify(req.params['id']!, (req as AuthenticatedRequest).user!.id, req.body.pin);
      res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      sendPinError(res, error, 'check');
    }
  },
);

/**
 * @route   POST /api/bookings/:id/trip-photo
 * @desc    Add or retake the caller's face photo for this booking
 * @access  Private (the booking's passenger or driver)
 */
router.post(
  '/:id/trip-photo',
  tripPhotoRateLimit,
  authenticateToken,
  tripPhotoUpload,
  handleMulterError,
  bookingIdValidation,
  validateInput,
  tripPhotoController.upload.bind(tripPhotoController),
);

/**
 * @route   GET /api/bookings/:id/trip-photos
 * @desc    Which of the booking's photos the caller can see
 * @access  Private (the booking's passenger or driver)
 */
router.get(
  '/:id/trip-photos',
  tripPhotoRateLimit,
  authenticateToken,
  bookingIdValidation,
  validateInput,
  tripPhotoController.list.bind(tripPhotoController),
);

/**
 * @route   GET /api/bookings/:id/trip-photos/:role/admin
 * @desc    Either side's photo, for an admin looking into a report or SOS
 * @access  Admin
 */
router.get(
  '/:id/trip-photos/:role/admin',
  tripPhotoRateLimit,
  authenticateAdminToken,
  authorizeAdminRoles('admin'),
  tripPhotoRoleValidation,
  validateInput,
  tripPhotoController.showToAdmin.bind(tripPhotoController),
);

/**
 * @route   GET /api/bookings/:id/trip-photos/:role
 * @desc    One side's photo (own always; the other's once confirmed)
 * @access  Private (the booking's passenger or driver)
 */
router.get(
  '/:id/trip-photos/:role',
  tripPhotoRateLimit,
  authenticateToken,
  tripPhotoRoleValidation,
  validateInput,
  tripPhotoController.show.bind(tripPhotoController),
);

export default router;
