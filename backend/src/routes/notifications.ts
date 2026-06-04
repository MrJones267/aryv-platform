/**
 * @fileoverview Notification API routes
 * @author Oabona-Majoko
 * @created 2026-03-27
 * @lastModified 2026-03-27
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { NotificationController } from '../controllers/NotificationController';
import { validateInput } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const notificationController = new NotificationController();

const notifRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many notification requests, please try again later',
  store: makeStore('notifications'),
});

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications with pagination
 * @access  Private
 */
router.get(
  '/',
  notifRateLimit,
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('unreadOnly').optional().isBoolean().withMessage('unreadOnly must be boolean'),
  ],
  validateInput,
  notificationController.getNotifications.bind(notificationController),
);

/**
 * @route   PUT /api/notifications/read
 * @desc    Mark notifications as read
 * @access  Private
 */
router.put(
  '/read',
  notifRateLimit,
  authenticateToken,
  [
    body('notificationIds').optional().isArray().withMessage('notificationIds must be an array'),
    body('markAll').optional().isBoolean().withMessage('markAll must be boolean'),
  ],
  validateInput,
  notificationController.markAsRead.bind(notificationController),
);

/**
 * @route   POST /api/notifications/push-token
 * @desc    Register FCM/APNs push token for this device
 * @access  Private
 */
router.post(
  '/push-token',
  notifRateLimit,
  authenticateToken,
  [
    body('token').isLength({ min: 10 }).withMessage('Push token is required'),
    body('platform').optional().isIn(['android', 'ios', 'web']).withMessage('Platform must be android, ios, or web'),
  ],
  validateInput,
  notificationController.registerPushToken.bind(notificationController),
);

/**
 * @route   GET /api/notifications/settings
 * @desc    Get notification preference settings
 * @access  Private
 */
router.get(
  '/settings',
  notifRateLimit,
  authenticateToken,
  notificationController.getNotificationSettings.bind(notificationController),
);

/**
 * @route   PUT /api/notifications/settings
 * @desc    Update notification preference settings
 * @access  Private
 */
router.put(
  '/settings',
  notifRateLimit,
  authenticateToken,
  [
    body('push').optional().isBoolean().withMessage('push must be boolean'),
    body('email').optional().isBoolean().withMessage('email must be boolean'),
    body('sms').optional().isBoolean().withMessage('sms must be boolean'),
    body('rideUpdates').optional().isBoolean().withMessage('rideUpdates must be boolean'),
    body('promotions').optional().isBoolean().withMessage('promotions must be boolean'),
    body('chat').optional().isBoolean().withMessage('chat must be boolean'),
    body('security').optional().isBoolean().withMessage('security must be boolean'),
  ],
  validateInput,
  notificationController.updateNotificationSettings.bind(notificationController),
);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete(
  '/:id',
  notifRateLimit,
  authenticateToken,
  [param('id').isUUID().withMessage('Notification ID must be a valid UUID')],
  validateInput,
  notificationController.deleteNotification.bind(notificationController),
);

export default router;
