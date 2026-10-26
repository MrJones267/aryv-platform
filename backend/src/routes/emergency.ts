/**
 * @fileoverview Emergency alert and contact endpoints.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * There was no emergency router. The one endpoint that existed lived under
 * /locations/emergency-alert, while the app posted to /locations/emergency —
 * so every SOS 404'd — and it stored nothing, so there was nothing to resolve,
 * track or review.
 *
 * Rate limits here are deliberately looser than elsewhere. Throttling someone
 * pressing a panic button is the wrong failure: the limits exist only to stop
 * a runaway client, and are well above what a person in trouble would produce.
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { rateLimitKey } from '../config/rateLimitKey';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { EmergencyController } from '../controllers/EmergencyController';

const router = Router();
const controller = new EmergencyController();

/**
 * Raising an alert. High enough that repeated presses, a retrying client, or a
 * user hitting SOS several times in panic all get through.
 */
const raiseAlertRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Too many emergency alerts from this device. If this is a real emergency, call 999.',
  store: makeStore('emergency-raise'),
  keyGenerator: rateLimitKey,
});

/** Location pings while an alert is open — one every few seconds is normal. */
const locationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many location updates',
  store: makeStore('emergency-location'),
  keyGenerator: rateLimitKey,
});

const contactsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later',
  store: makeStore('emergency-contacts'),
  keyGenerator: rateLimitKey,
});

const coordinateValidation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
];

/**
 * @route   POST /api/emergency/alerts
 * @desc    Raise an emergency alert
 * @access  Private
 */
router.post(
  '/alerts',
  raiseAlertRateLimit,
  authenticateToken,
  [
    ...coordinateValidation,
    // 'panic' and 'harassment' are first because they are what the SOS button
    // sends. The previous endpoint's list omitted both and rejected them.
    body('alertType')
      .isIn(['panic', 'harassment', 'accident', 'medical', 'breakdown', 'safety', 'other'])
      .withMessage('Unknown emergency type'),
    body('message')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Message cannot exceed 500 characters'),
    body('rideId')
      .optional()
      .isUUID()
      .withMessage('Ride ID must be a valid UUID'),
  ],
  validateInput,
  controller.raiseAlert.bind(controller),
);

/**
 * @route   GET /api/emergency/alerts/active
 * @desc    The caller's own open alert, if any
 * @access  Private
 */
router.get(
  '/alerts/active',
  contactsRateLimit,
  authenticateToken,
  controller.getActiveAlert.bind(controller),
);

/**
 * @route   PUT /api/emergency/alerts/:id/location
 * @desc    Move an open alert's last known position
 * @access  Private
 */
router.put(
  '/alerts/:id/location',
  locationRateLimit,
  authenticateToken,
  [param('id').isUUID().withMessage('Alert ID must be a valid UUID'), ...coordinateValidation],
  validateInput,
  controller.updateLocation.bind(controller),
);

/**
 * @route   PUT /api/emergency/alerts/:id/resolve
 * @desc    Stand down an alert the caller raised
 * @access  Private
 */
router.put(
  '/alerts/:id/resolve',
  contactsRateLimit,
  authenticateToken,
  [
    param('id').isUUID().withMessage('Alert ID must be a valid UUID'),
    body('falseAlarm').optional().isBoolean().withMessage('falseAlarm must be true or false'),
    body('note').optional().isLength({ max: 500 }).withMessage('Note cannot exceed 500 characters'),
  ],
  validateInput,
  controller.resolveAlert.bind(controller),
);

/**
 * @route   GET /api/emergency/contacts
 * @desc    The caller's emergency contacts
 * @access  Private
 */
router.get(
  '/contacts',
  contactsRateLimit,
  authenticateToken,
  controller.listContacts.bind(controller),
);

/**
 * @route   POST /api/emergency/contacts
 * @desc    Add an emergency contact
 * @access  Private
 */
router.post(
  '/contacts',
  contactsRateLimit,
  authenticateToken,
  [
    body('name')
      .isLength({ min: 1, max: 200 })
      .withMessage('Name is required and cannot exceed 200 characters'),
    // Accepted in any local form and normalised to E.164 in the controller —
    // asking someone to type a country code correctly is a poor gate on a
    // safety feature.
    body('phone')
      .isLength({ min: 5, max: 25 })
      .withMessage('A phone number is required'),
    body('relationship')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Relationship cannot exceed 100 characters'),
    body('isPrimary').optional().isBoolean().withMessage('isPrimary must be true or false'),
  ],
  validateInput,
  controller.addContact.bind(controller),
);

/**
 * @route   PUT /api/emergency/contacts/:id
 * @desc    Update an emergency contact
 * @access  Private
 */
router.put(
  '/contacts/:id',
  contactsRateLimit,
  authenticateToken,
  [
    param('id').isUUID().withMessage('Contact ID must be a valid UUID'),
    body('name').optional().isLength({ min: 1, max: 200 }).withMessage('Name cannot exceed 200 characters'),
    body('phone').optional().isLength({ min: 5, max: 25 }).withMessage('Invalid phone number'),
    body('relationship').optional().isLength({ max: 100 }).withMessage('Relationship cannot exceed 100 characters'),
    body('isPrimary').optional().isBoolean().withMessage('isPrimary must be true or false'),
  ],
  validateInput,
  controller.updateContact.bind(controller),
);

/**
 * @route   DELETE /api/emergency/contacts/:id
 * @desc    Remove an emergency contact
 * @access  Private
 */
router.delete(
  '/contacts/:id',
  contactsRateLimit,
  authenticateToken,
  [param('id').isUUID().withMessage('Contact ID must be a valid UUID')],
  validateInput,
  controller.deleteContact.bind(controller),
);

export default router;
