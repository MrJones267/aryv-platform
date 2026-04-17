/**
 * @fileoverview Main entry point for ARYV backend API server
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-25
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';

// Import custom modules
import { testConnection } from './models';
import { globalErrorHandler, notFound } from './middleware/errorHandler';
import { requestLogger, logInfo, logError } from './utils/logger';
import authRoutes from './routes/auth';
import rideRoutes from './routes/rides';
import bookingRoutes from './routes/bookings';
import courierRoutes from './routes/courier';
import adminRoutes from './routes/admin';
import userRoutes from './routes/users';
import locationRoutes from './routes/locations';
import cashPaymentRoutes from './routes/cashPayments';
import currencyRoutes from './routes/currencies';
import countryRoutes from './routes/countries';
import groupChatRoutes from './routes/groupChat';
import notificationRoutes from './routes/notifications';
import paymentRoutes from './routes/payments';
import rideRequestRoutes from './routes/rideRequests';
import promoRoutes from './routes/promos';
import SocketService from './services/SocketService';
import { authenticateToken } from './middleware/auth';
import { notificationService } from './services/NotificationService';
import { groupCleanupService } from './services/GroupCleanupService';
import { redisClient } from './config/redis';

// Load environment variables
dotenv.config();

// Validate required environment variables before anything else starts
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL'];
const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[STARTUP] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[STARTUP] Server cannot start. Please set these variables in your .env file.');
  process.exit(1);
}

// Constants
const PORT = process.env['PORT'] || 3001;
const NODE_ENV = process.env['NODE_ENV'] || 'development';

// Create Express app
const app = express();

// Create HTTP server
const server = createServer(app);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: NODE_ENV !== 'development',
  noSniff: true,
}));

// CORS configuration - allow mobile app (React Native), admin panel, and web clients
const corsOrigins = process.env['CORS_ORIGIN']
  ? process.env['CORS_ORIGIN'].split(',').map((o) => o.trim())
  : NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:19006']
    : [];

if (NODE_ENV === 'production' && corsOrigins.length === 0) {
  console.error('[STARTUP] CORS_ORIGIN must be configured in production');
  process.exit(1);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // In development, allow all origins
    if (NODE_ENV === 'development') return callback(null, true);
    // In production, check against allowed list
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Request logging middleware
app.use(requestLogger);

// Authenticated file serving — users can only access their own files; admins can access all
app.get('/uploads/:type/:filename', authenticateToken as any, (req: any, res) => {
  const { type, filename } = req.params as { type: string; filename: string };

  // Restrict to known subdirectories
  const allowedTypes = ['avatars', 'documents', 'vehicles'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ success: false, error: 'Invalid file type', code: 'INVALID_FILE_TYPE' });
  }

  // Sanitise filename — no path traversal
  const safe = path.basename(filename);
  if (safe !== filename || safe.startsWith('.')) {
    return res.status(400).json({ success: false, error: 'Invalid filename', code: 'INVALID_FILENAME' });
  }

  // Ownership check: filename starts with userId (e.g. "abc123-1234567890.jpg")
  const fileOwner = safe.split('-')[0];
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
  if (!isAdmin && req.user?.id !== fileOwner) {
    return res.status(403).json({ success: false, error: 'Access denied', code: 'FORBIDDEN' });
  }

  const filePath = path.resolve('./uploads', type, safe);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found', code: 'FILE_NOT_FOUND' });
  }

  return res.sendFile(filePath);
});

// Body parsing middleware
app.use(express.json({
  limit: '10mb',
  type: 'application/json',
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb',
  type: 'application/x-www-form-urlencoded',
}));

// Health check endpoint - both with and without /api prefix for compatibility
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'ARYV Backend API is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '1.0.0',
    database: 'connected',
    uptime: process.uptime(),
  });
});

// Health check endpoint with /api prefix for mobile app compatibility
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'ARYV Backend API is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '1.0.0',
    database: 'connected',
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to ARYV API',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      rides: '/api/rides',
      bookings: '/api/bookings',
      courier: '/api/courier',
      admin: '/api/admin',
      users: '/api/users',
      locations: '/api/locations',
      cashPayments: '/api/payments/cash',
      currencies: '/api/currencies',
      countries: '/api/countries',
      groupChats: '/api/group-chats',
      notifications: '/api/notifications',
      payments: '/api/payments',
      rideRequests: '/api/ride-requests',
      docs: '/api/docs',
    },
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/courier', courierRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/payments/cash', cashPaymentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/currencies', currencyRoutes);
app.use('/api/countries', countryRoutes);
app.use('/api/group-chats', groupChatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ride-requests', rideRequestRoutes);
app.use('/api/promos', promoRoutes);

// API Documentation
if (NODE_ENV !== 'production' || process.env['ENABLE_DOCS'] === 'true') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const docsRoutes = require('./routes/docs').default;
    app.use('/docs', docsRoutes);
  } catch (e) {
    console.warn('[STARTUP] API docs unavailable (swagger dependencies missing):', (e as Error).message);
  }
}

// 404 handler
app.use('*', notFound);

// Global error handler
app.use(globalErrorHandler);

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  logError('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  logError('Unhandled Rejection', reason as Error);
  process.exit(1);
});

// Initialize database and start server
const startServer = async (): Promise<void> => {
  try {
    // Test database connection (skip in dev if DB not available)
    if (NODE_ENV === 'development') {
      logInfo('Development mode: skipping database connection check...');
    } else {
      logInfo('Testing database connection...');
      await testConnection();
    }
    
    // Skip database sync since tables already exist
    logInfo('Database tables already exist, skipping sync...');

    // Connect to Redis (non-fatal if unavailable)
    await redisClient.connect();

    // Initialize Socket.io service
    logInfo('Initializing Socket.io service...');
    const socketService = new SocketService(server);
    logInfo('Socket.io service initialized');
    
    // Initialize notification service with Socket.io
    notificationService.setSocketIO(socketService['io']);
    logInfo('Notification service integrated with Socket.io');
    
    // Start group cleanup scheduler
    groupCleanupService.startScheduler();
    logInfo('Group cleanup scheduler started');
    
    // Make services available globally
    app.set('socketService', socketService);
    app.set('notificationService', notificationService);
    app.set('groupCleanupService', groupCleanupService);
    
    // Start server
    const httpServer = server.listen(PORT, () => {
      logInfo(`🚀 ARYV Backend API server started`);
      console.log(`🚀 ARYV Backend API server running on port ${PORT}`);
      console.log(`📖 Environment: ${NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
      console.log(`🚗 Ride endpoints: http://localhost:${PORT}/api/rides`);
      console.log(`📋 Booking endpoints: http://localhost:${PORT}/api/bookings`);
      console.log(`📦 Courier endpoints: http://localhost:${PORT}/api/courier`);
      console.log(`👨‍💼 Admin endpoints: http://localhost:${PORT}/api/admin`);
      console.log(`👤 User endpoints: http://localhost:${PORT}/api/users`);
      console.log(`📍 Location endpoints: http://localhost:${PORT}/api/locations`);
      console.log(`⚡ Socket.io real-time features enabled`);
      console.log(`📊 Connected users: ${socketService.getConnectedUsersCount()}`);
      console.log(`🚙 Active rides: ${socketService.getActiveRidesCount()}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal: string) => {
      logInfo(`${signal} received, shutting down gracefully`);
      
      // Stop cleanup scheduler
      groupCleanupService.stopScheduler();
      logInfo('Group cleanup scheduler stopped');
      
      httpServer.close(() => {
        logInfo('Server closed successfully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logError('Failed to start server', error as Error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;