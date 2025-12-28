"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const models_1 = require("./models");
const errorHandler_1 = require("./middleware/errorHandler");
const logger_1 = require("./utils/logger");
const auth_1 = __importDefault(require("./routes/auth"));
const rides_1 = __importDefault(require("./routes/rides"));
const bookings_1 = __importDefault(require("./routes/bookings"));
const courier_1 = __importDefault(require("./routes/courier"));
const admin_1 = __importDefault(require("./routes/admin"));
const users_1 = __importDefault(require("./routes/users"));
const locations_1 = __importDefault(require("./routes/locations"));
const cashPayments_1 = __importDefault(require("./routes/cashPayments"));
const currencies_1 = __importDefault(require("./routes/currencies"));
const groupChat_1 = __importDefault(require("./routes/groupChat"));
const SocketService_1 = __importDefault(require("./services/SocketService"));
const NotificationService_1 = require("./services/NotificationService");
const GroupCleanupService_1 = require("./services/GroupCleanupService");
dotenv_1.default.config();
const PORT = process.env['PORT'] || 3001;
const NODE_ENV = process.env['NODE_ENV'] || 'development';
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
}));
app.use((0, cors_1.default)({
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
app.use(logger_1.requestLogger);
app.use(express_1.default.json({
    limit: '10mb',
    type: 'application/json',
}));
app.use(express_1.default.urlencoded({
    extended: true,
    limit: '10mb',
    type: 'application/x-www-form-urlencoded',
}));
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
app.use('/api/auth', auth_1.default);
app.use('/api/rides', rides_1.default);
app.use('/api/bookings', bookings_1.default);
app.use('/api/courier', courier_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/users', users_1.default);
app.use('/api/locations', locations_1.default);
app.use('/api/payments/cash', cashPayments_1.default);
app.use('/api/currencies', currencies_1.default);
app.use('/api/group-chats', groupChat_1.default);
if (NODE_ENV !== 'production' || process.env['ENABLE_DOCS'] === 'true') {
    const docsRoutes = require('./routes/docs');
    app.use('/docs', docsRoutes);
}
app.use('*', errorHandler_1.notFound);
app.use(errorHandler_1.globalErrorHandler);
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    console.error('Stack:', error.stack);
    (0, logger_1.logError)('Uncaught Exception', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    (0, logger_1.logError)('Unhandled Rejection', reason);
    process.exit(1);
});
const startServer = async () => {
    try {
        (0, logger_1.logInfo)('Testing database connection...');
        try {
            await (0, models_1.testConnection)();
            (0, logger_1.logInfo)('Database connection successful!');
        }
        catch (dbError) {
            (0, logger_1.logError)('Database connection failed', dbError);
            if (NODE_ENV === 'production') {
                (0, logger_1.logInfo)('Retrying database connection in 5 seconds...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                try {
                    await (0, models_1.testConnection)();
                    (0, logger_1.logInfo)('Database connection successful on retry!');
                }
                catch (retryError) {
                    (0, logger_1.logError)('Database connection failed after retry', retryError);
                    console.error('🚨 CRITICAL: Cannot connect to database in production mode');
                    console.error('🔧 Please check DATABASE_URL environment variable');
                    process.exit(1);
                }
            }
            else {
                (0, logger_1.logInfo)('Development mode: continuing without database connection...');
            }
        }
        (0, logger_1.logInfo)('Database tables already exist, skipping sync...');
        (0, logger_1.logInfo)('Initializing Socket.io service...');
        const socketService = new SocketService_1.default(server);
        (0, logger_1.logInfo)('Socket.io service initialized');
        NotificationService_1.notificationService.setSocketIO(socketService['io']);
        (0, logger_1.logInfo)('Notification service integrated with Socket.io');
        GroupCleanupService_1.groupCleanupService.startScheduler();
        (0, logger_1.logInfo)('Group cleanup scheduler started');
        app.set('socketService', socketService);
        app.set('notificationService', NotificationService_1.notificationService);
        app.set('groupCleanupService', GroupCleanupService_1.groupCleanupService);
        const httpServer = server.listen(PORT, () => {
            (0, logger_1.logInfo)(`🚀 ARYV Backend API server started`);
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
        const gracefulShutdown = (signal) => {
            (0, logger_1.logInfo)(`${signal} received, shutting down gracefully`);
            GroupCleanupService_1.groupCleanupService.stopScheduler();
            (0, logger_1.logInfo)('Group cleanup scheduler stopped');
            httpServer.close(() => {
                (0, logger_1.logInfo)('Server closed successfully');
                process.exit(0);
            });
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
    catch (error) {
        (0, logger_1.logError)('Failed to start server', error);
        process.exit(1);
    }
};
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map