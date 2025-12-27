/**
 * @fileoverview Authentication routes with validation and security
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-27
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import { validateRequest, authSchemas } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

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
});

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

export default router;
