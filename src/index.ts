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
import groupChatRoutes from './routes/groupChat';
import SocketService from './services/SocketService';
import { notificationService } from './services/NotificationService';
import { groupCleanupService } from './services/GroupCleanupService';

// Load environment variables
dotenv.config();

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
  contentSecurityPolicy: false, // Disable for development
}));

// CORS configuration
app.use(cors({
  origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

// Health check endpoint
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
      groupChats: '/api/group-chats',
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
app.use('/api/currencies', currencyRoutes);
app.use('/api/group-chats', groupChatRoutes);

// API Documentation
if (NODE_ENV !== 'production' || process.env['ENABLE_DOCS'] === 'true') {
  const docsRoutes = require('./routes/docs');
  app.use('/docs', docsRoutes);
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
    // Test database connection
    logInfo('Testing database connection...');
    try {
      await testConnection();
      logInfo('Database connection successful!');
    } catch (dbError) {
      logError('Database connection failed', dbError as Error);
      
      if (NODE_ENV === 'production') {
        // In production, wait a bit and retry once more
        logInfo('Retrying database connection in 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        try {
          await testConnection();
          logInfo('Database connection successful on retry!');
        } catch (retryError) {
          logError('Database connection failed after retry', retryError as Error);
          console.error('🚨 CRITICAL: Cannot connect to database in production mode');
          console.error('🔧 Please check DATABASE_URL environment variable');
          process.exit(1);
        }
      } else {
        logInfo('Development mode: continuing without database connection...');
      }
    }
    
    // Skip database sync since tables already exist
    logInfo('Database tables already exist, skipping sync...');
    
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