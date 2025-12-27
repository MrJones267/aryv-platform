"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourierScheduledTasks = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("../utils/logger");
const PaymentReleaseService_1 = __importDefault(require("./PaymentReleaseService"));
const QRCodeService_1 = __importDefault(require("./QRCodeService"));
class CourierScheduledTasks {
    constructor() {
        this.tasks = new Map();
        this.isRunning = false;
    }
    start() {
        if (this.isRunning) {
            (0, logger_1.logInfo)('Courier scheduled tasks already running');
            return;
        }
        this.isRunning = true;
        (0, logger_1.logInfo)('Starting courier scheduled tasks');
        this.scheduleAutoPaymentRelease();
        this.scheduleQRCodeCleanup();
        this.scheduleDailyReports();
        (0, logger_1.logInfo)('All courier scheduled tasks started');
    }
    stop() {
        if (!this.isRunning) {
            (0, logger_1.logInfo)('Courier scheduled tasks not running');
            return;
        }
        (0, logger_1.logInfo)('Stopping courier scheduled tasks');
        this.tasks.forEach((_task, name) => {
            _task.destroy();
            (0, logger_1.logInfo)(`Stopped scheduled task: ${name}`);
        });
        this.tasks.clear();
        this.isRunning = false;
        (0, logger_1.logInfo)('All courier scheduled tasks stopped');
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeTasks: Array.from(this.tasks.keys()),
            taskCount: this.tasks.size,
        };
    }
    scheduleAutoPaymentRelease() {
        const taskName = 'auto-payment-release';
        const task = node_cron_1.default.schedule('*/30 * * * *', async () => {
            try {
                (0, logger_1.logInfo)('Starting auto-payment release task');
                const results = await PaymentReleaseService_1.default.processEligibleAutoReleases();
                const successful = results.filter(r => r.success).length;
                const failed = results.filter(r => !r.success).length;
                (0, logger_1.logInfo)('Auto-payment release task completed', {
                    processed: results.length,
                    successful,
                    failed,
                });
                if (failed > 0) {
                    (0, logger_1.logError)('Some auto-payment releases failed', new Error('Batch processing errors'), {
                        failed,
                        errors: results.filter(r => !r.success).map(r => r.error),
                    });
                }
            }
            catch (error) {
                (0, logger_1.logError)('Auto-payment release task failed', error);
            }
        }, {
            timezone: 'UTC',
        });
        task.start();
        this.tasks.set(taskName, task);
        (0, logger_1.logInfo)(`Scheduled task started: ${taskName} (every 30 minutes)`);
    }
    scheduleQRCodeCleanup() {
        const taskName = 'qr-code-cleanup';
        const task = node_cron_1.default.schedule('0 * * * *', async () => {
            try {
                (0, logger_1.logInfo)('Starting QR code cleanup task');
                const expiredCount = await QRCodeService_1.default.expireOldQRCodes();
                (0, logger_1.logInfo)('QR code cleanup task completed', {
                    expiredCodes: expiredCount,
                });
            }
            catch (error) {
                (0, logger_1.logError)('QR code cleanup task failed', error);
            }
        }, {
            timezone: 'UTC',
        });
        task.start();
        this.tasks.set(taskName, task);
        (0, logger_1.logInfo)(`Scheduled task started: ${taskName} (every hour)`);
    }
    scheduleDailyReports() {
        const taskName = 'daily-reports';
        const task = node_cron_1.default.schedule('0 0 * * *', async () => {
            try {
                (0, logger_1.logInfo)('Starting daily reports task');
                const paymentStats = await PaymentReleaseService_1.default.getPaymentReleaseStats();
                const qrStats = await QRCodeService_1.default.getQRCodeStats();
                (0, logger_1.logInfo)('Daily courier service report', {
                    date: new Date().toISOString().split('T')[0],
                    payments: paymentStats,
                    qrCodes: qrStats,
                });
            }
            catch (error) {
                (0, logger_1.logError)('Daily reports task failed', error);
            }
        }, {
            timezone: 'UTC',
        });
        task.start();
        this.tasks.set(taskName, task);
        (0, logger_1.logInfo)(`Scheduled task started: ${taskName} (daily at midnight)`);
    }
    async triggerTask(taskName) {
        try {
            (0, logger_1.logInfo)(`Manually triggering task: ${taskName}`);
            switch (taskName) {
                case 'auto-payment-release':
                    const results = await PaymentReleaseService_1.default.processEligibleAutoReleases();
                    (0, logger_1.logInfo)('Manual auto-payment release completed', {
                        processed: results.length,
                        successful: results.filter(r => r.success).length,
                    });
                    return true;
                case 'qr-code-cleanup':
                    const expiredCount = await QRCodeService_1.default.expireOldQRCodes();
                    (0, logger_1.logInfo)('Manual QR code cleanup completed', {
                        expiredCodes: expiredCount,
                    });
                    return true;
                case 'daily-reports':
                    const paymentStats = await PaymentReleaseService_1.default.getPaymentReleaseStats();
                    const qrStats = await QRCodeService_1.default.getQRCodeStats();
                    (0, logger_1.logInfo)('Manual daily report generated', {
                        payments: paymentStats,
                        qrCodes: qrStats,
                    });
                    return true;
                default:
                    (0, logger_1.logError)('Unknown task name for manual trigger', new Error('Invalid task'), {
                        taskName,
                        availableTasks: Array.from(this.tasks.keys()),
                    });
                    return false;
            }
        }
        catch (error) {
            (0, logger_1.logError)(`Failed to manually trigger task: ${taskName}`, error);
            return false;
        }
    }
    getNextRunTimes() {
        const nextRuns = {};
        this.tasks.forEach((_task, name) => {
            try {
                const now = new Date();
                switch (name) {
                    case 'auto-payment-release':
                        const nextAutoRelease = new Date(now);
                        nextAutoRelease.setMinutes(Math.ceil(nextAutoRelease.getMinutes() / 30) * 30, 0, 0);
                        nextRuns[name] = nextAutoRelease.toISOString();
                        break;
                    case 'qr-code-cleanup':
                        const nextCleanup = new Date(now);
                        nextCleanup.setHours(nextCleanup.getHours() + 1, 0, 0, 0);
                        nextRuns[name] = nextCleanup.toISOString();
                        break;
                    case 'daily-reports':
                        const nextReport = new Date(now);
                        nextReport.setDate(nextReport.getDate() + 1);
                        nextReport.setHours(0, 0, 0, 0);
                        nextRuns[name] = nextReport.toISOString();
                        break;
                    default:
                        nextRuns[name] = null;
                }
            }
            catch (error) {
                nextRuns[name] = null;
            }
        });
        return nextRuns;
    }
}
exports.CourierScheduledTasks = CourierScheduledTasks;
exports.default = new CourierScheduledTasks();
//# sourceMappingURL=CourierScheduledTasks.js.map