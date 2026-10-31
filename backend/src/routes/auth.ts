/**
 * @fileoverview Authentication routes with validation and security
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-27
 */

import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { makeStore } from '../config/rateLimitStore';
import { rateLimitKey } from '../config/rateLimitKey';
import { AuthController } from '../controllers/AuthController';
import { validateRequest, authSchemas } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { uploadAvatar, handleMulterError } from '../middleware/upload';
import { redisClient } from '../config/redis';

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *         password:
 *           type: string
 *           minLength: 8
 *           description: User password
 *       example:
 *         email: "user@example.com"
 *         password: "password123"
 *
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *         - role
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *         password:
 *           type: string
 *           minLength: 8
 *           description: User password
 *         firstName:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: User first name
 *         lastName:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: User last name
 *         role:
 *           type: string
 *           enum: [user, driver, courier]
 *           description: User role
 *         phone:
 *           type: string
 *           description: User phone number
 *       example:
 *         email: "newuser@example.com"
 *         password: "password123"
 *         firstName: "John"
 *         lastName: "Doe"
 *         role: "user"
 *         phone: "+1234567890"
 *
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/User'
 *             tokens:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: JWT access token
 *                 refreshToken:
 *                   type: string
 *                   description: JWT refresh token
 *                 expiresIn:
 *                   type: string
 *                   description: Token expiration time
 *         message:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 */

const router = Router();

// Rate limiting for authentication endpoints
// Building an export reads every record a person has; a few an hour is plenty.
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many data exports, please try again later', code: 'EXPORT_RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('auth-export'),
  keyGenerator: rateLimitKey,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs for auth endpoints
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('auth'),
  keyGenerator: rateLimitKey,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: 'Too many login attempts, please try again later',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('login'),
  keyGenerator: rateLimitKey,
});

/**
 * Rate limit by *recipient* rather than by IP.
 *
 * The OTP endpoints are unauthenticated and name their target in the body, so
 * a per-IP limit does not protect the person being targeted at all: an
 * attacker with a handful of addresses can send an unlimited number of codes
 * to one victim's phone or inbox. This is what caps that, and it also caps the
 * SMS spend a stranger can run up on the platform's behalf.
 *
 * Keyed per 15 minutes, matching the per-code issue throttle in OtpService.
 */
const otpRecipientLimiter = (field: 'phone' | 'email' | 'recipient') =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const raw = req.body?.[field];
    const recipient = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
    if (!recipient) { next(); return; }

    const count = await redisClient.increment(`otp-recipient:${recipient}`, 15 * 60);

    // 0 means the counter is unavailable. These endpoints send SMS and email at
    // our own cost to an unauthenticated caller's chosen target, so an
    // uncountable request is refused rather than waved through.
    if (count === 0) {
      res.status(503).json({
        success: false,
        error: 'Verification codes are temporarily unavailable. Please try again shortly.',
        code: 'OTP_UNAVAILABLE',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (count > 10) {
      res.status(429).json({
        success: false,
        error: 'Too many verification requests for this recipient. Please try again later.',
        code: 'OTP_RECIPIENT_RATE_LIMITED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };

// Per-email rate limiter for password reset (max 3 per email per 15 min)
const emailPasswordResetLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const email = (req.body?.email as string | undefined)?.toLowerCase().trim();
  if (!email) { next(); return; }

  const count = await redisClient.increment(`pw-reset-email:${email}`, 15 * 60);
  if (count > 3) {
    res.status(429).json({
      success: false,
      error: 'Too many password reset attempts for this email. Please try again later.',
      code: 'EMAIL_RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  next();
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many registration attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/register',
  authLimiter,
  validateRequest({ body: authSchemas.register }),
  AuthController.register,
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  loginLimiter,
  validateRequest({ body: authSchemas.login }),
  AuthController.login,
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  authLimiter,
  validateRequest({ body: authSchemas.refreshToken }),
  AuthController.refreshToken,
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  authenticateToken,
  AuthController.logout,
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/profile',
  authenticateToken,
  AuthController.getProfile,
);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify token validity
 * @access  Private
 */
router.get(
  '/verify',
  authenticateToken,
  AuthController.verifyToken,
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request a password reset email
 * @access  Public
 */
router.post(
  '/forgot-password',
  authLimiter,
  emailPasswordResetLimiter,
  AuthController.forgotPassword,
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token from email
 * @access  Public
 */
router.post(
  '/reset-password',
  authLimiter,
  AuthController.resetPassword,
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 */
router.post('/change-password', authenticateToken, AuthController.changePassword);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Sign out on every device, this one included
 * @access  Private
 */
router.post('/logout-all', authenticateToken, AuthController.logoutAll);

/**
 * @route   GET /api/auth/export
 * @desc    A copy of the signed-in person's data
 * @access  Private
 */
router.get('/export', exportLimiter, authenticateToken, AuthController.exportMyData);

/**
 * @route   DELETE /api/auth/account
 * @desc    Deactivate authenticated user's account
 * @access  Private
 */
router.delete('/account', authenticateToken, AuthController.deleteAccount);

/**
 * @route   PATCH /api/auth/profile
 * @desc    Update authenticated user's profile
 * @access  Private
 */
router.patch('/profile', authenticateToken, AuthController.updateProfile);

/**
 * @route   POST /api/auth/upload-profile-picture
 * @desc    Upload profile picture
 * @access  Private
 */
router.post(
  '/upload-profile-picture',
  authenticateToken,
  uploadAvatar,
  handleMulterError,
  AuthController.uploadProfilePicture,
);

/**
 * @route   GET /api/auth/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', authenticateToken, AuthController.getUserStats);

/**
 * @route   GET /api/auth/notification-preferences
 * @desc    Get notification preferences
 * @access  Private
 */
router.get('/notification-preferences', authenticateToken, AuthController.getNotificationPreferences);

/**
 * @route   PATCH /api/auth/notification-preferences
 * @desc    Update notification preferences
 * @access  Private
 */
router.patch('/notification-preferences', authenticateToken, AuthController.updateNotificationPreferences);

/**
 * @route   POST /api/auth/send-email-verification
 * @desc    Send email verification OTP
 * @access  Private
 */
router.post('/send-email-verification', authenticateToken, AuthController.sendEmailVerification);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email with OTP
 * @access  Private
 */
router.post('/verify-email', authenticateToken, AuthController.verifyEmailToken);

/**
 * @route   POST /api/auth/send-phone-verification
 * @desc    Send phone verification OTP
 * @access  Private
 */
// Rate-limited like the public OTP routes: each request is an SMS we pay for.
router.post('/send-phone-verification', authLimiter, authenticateToken, otpRecipientLimiter('phone'), AuthController.sendPhoneVerification);

/**
 * @route   POST /api/auth/verify-phone
 * @desc    Verify phone with OTP
 * @access  Private
 */
router.post('/verify-phone', authenticateToken, AuthController.verifyPhone);

/**
 * OTP endpoints (Twilio / email OTP system)
 *
 * Three layers apply to every one of these:
 *
 *   authLimiter        per-IP, from express-rate-limit
 *   otpRecipientLimiter per-recipient, so one address or number cannot be
 *                      flooded from many IPs — the send endpoints are
 *                      unauthenticated, so without this anyone could drive
 *                      SMS cost and mail volume at a victim
 *   OtpService         per-code attempt limit and purpose binding
 *
 * Only the first existed before, and only the first is defeated by an
 * attacker with more than one IP address.
 */
router.post('/otp/sms/send', authLimiter, otpRecipientLimiter('phone'), AuthController.sendSMSOTP);
router.post('/otp/email/send', authLimiter, otpRecipientLimiter('email'), AuthController.sendEmailOTP);
router.post('/otp/verify', authLimiter, otpRecipientLimiter('recipient'), AuthController.verifyOTP);
router.get('/otp/status', authLimiter, AuthController.getOTPStatus);
router.post('/login/otp', loginLimiter, otpRecipientLimiter('recipient'), AuthController.loginWithOTP);
router.post('/register/otp', authLimiter, AuthController.registerWithOTP);
router.post(
  '/password-reset/otp',
  authLimiter,
  otpRecipientLimiter('recipient'),
  AuthController.resetPasswordWithOTP,
);

/**
 * @route   POST /api/auth/google/verify
 * @desc    Exchange a Google ID token for ARYV session tokens
 * @access  Public
 */
router.post('/google/verify', loginLimiter, AuthController.verifyGoogleToken);

export default router;
