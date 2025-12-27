"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupCleanupService = exports.GroupCleanupService = void 0;
const cron = __importStar(require("node-cron"));
const GroupChatService_1 = __importDefault(require("./GroupChatService"));
const logger_1 = __importDefault(require("../utils/logger"));
class GroupCleanupService {
    constructor() {
        this.groupChatService = new GroupChatService_1.default();
    }
    startScheduler() {
        try {
            this.cleanupJob = cron.schedule('0 */6 * * *', async () => {
                try {
                    logger_1.default.info('Starting scheduled group cleanup...');
                    const cleanedCount = await this.groupChatService.cleanupInactiveGroups();
                    logger_1.default.info(`Scheduled group cleanup completed: ${cleanedCount} groups processed`);
                }
                catch (error) {
                    logger_1.default.error('Error during scheduled group cleanup:', error);
                }
            });
            this.messageCleanupJob = cron.schedule('0 * * * *', async () => {
                try {
                    logger_1.default.info('Starting scheduled message cleanup...');
                    const cleanedCount = await this.groupChatService.cleanupExpiredMessages();
                    logger_1.default.info(`Scheduled message cleanup completed: ${cleanedCount} messages processed`);
                }
                catch (error) {
                    logger_1.default.error('Error during scheduled message cleanup:', error);
                }
            });
            this.cleanupJob.start();
            this.messageCleanupJob.start();
            logger_1.default.info('Group cleanup scheduler started successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to start group cleanup scheduler:', error);
            throw error;
        }
    }
    stopScheduler() {
        try {
            if (this.cleanupJob) {
                this.cleanupJob.destroy();
                this.cleanupJob = undefined;
            }
            if (this.messageCleanupJob) {
                this.messageCleanupJob.destroy();
                this.messageCleanupJob = undefined;
            }
            logger_1.default.info('Group cleanup scheduler stopped successfully');
        }
        catch (error) {
            logger_1.default.error('Error stopping group cleanup scheduler:', error);
        }
    }
    async runManualCleanup() {
        try {
            logger_1.default.info('Running manual group cleanup...');
            const [groupsProcessed, messagesProcessed] = await Promise.all([
                this.groupChatService.cleanupInactiveGroups(),
                this.groupChatService.cleanupExpiredMessages(),
            ]);
            logger_1.default.info('Manual cleanup completed', {
                groupsProcessed,
                messagesProcessed,
            });
            return {
                groupsProcessed,
                messagesProcessed,
            };
        }
        catch (error) {
            logger_1.default.error('Error during manual cleanup:', error);
            throw error;
        }
    }
    getStatus() {
        return {
            groupCleanupRunning: this.cleanupJob !== undefined,
            messageCleanupRunning: this.messageCleanupJob !== undefined,
        };
    }
}
exports.GroupCleanupService = GroupCleanupService;
exports.groupCleanupService = new GroupCleanupService();
exports.default = exports.groupCleanupService;
//# sourceMappingURL=GroupCleanupService.js.map