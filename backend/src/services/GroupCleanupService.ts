/**
 * @fileoverview Group Chat Cleanup Service for automated maintenance
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import * as cron from 'node-cron';
import GroupChatService from './GroupChatService';
import logger from '../utils/logger';

export class GroupCleanupService {
  private groupChatService: GroupChatService;
  private cleanupJob?: cron.ScheduledTask | undefined;
  private messageCleanupJob?: cron.ScheduledTask | undefined;

  constructor() {
    this.groupChatService = new GroupChatService();
  }

  /**
   * Start the cleanup scheduler
   */
  public startScheduler(): void {
    try {
      // Every 15 minutes: this is what deletes a ride chat a day after its
      // trip, so at six-hourly it could run that much late.
      this.cleanupJob = cron.schedule('*/15 * * * *', async () => {
        try {
          const cleanedCount = await this.groupChatService.cleanupInactiveGroups();
          if (cleanedCount > 0) {
            logger.info(`Scheduled group cleanup completed: ${cleanedCount} groups processed`);
          }
        } catch (error) {
          logger.error('Error during scheduled group cleanup:', error);
        }
      });

      // Clean up expired messages every hour
      this.messageCleanupJob = cron.schedule('0 * * * *', async () => {
        try {
          logger.info('Starting scheduled message cleanup...');
          const cleanedCount = await this.groupChatService.cleanupExpiredMessages();
          logger.info(`Scheduled message cleanup completed: ${cleanedCount} messages processed`);
        } catch (error) {
          logger.error('Error during scheduled message cleanup:', error);
        }
      });

      // Start the jobs
      this.cleanupJob.start();
      this.messageCleanupJob.start();

      logger.info('Group cleanup scheduler started successfully');
    } catch (error) {
      logger.error('Failed to start group cleanup scheduler:', error);
      throw error;
    }
  }

  /**
   * Stop the cleanup scheduler
   */
  public stopScheduler(): void {
    try {
      if (this.cleanupJob) {
        this.cleanupJob.destroy();
        this.cleanupJob = undefined;
      }

      if (this.messageCleanupJob) {
        this.messageCleanupJob.destroy();
        this.messageCleanupJob = undefined;
      }

      logger.info('Group cleanup scheduler stopped successfully');
    } catch (error) {
      logger.error('Error stopping group cleanup scheduler:', error);
    }
  }

  /**
   * Run cleanup manually
   */
  public async runManualCleanup(): Promise<{
    groupsProcessed: number;
    messagesProcessed: number;
  }> {
    try {
      logger.info('Running manual group cleanup...');

      const [groupsProcessed, messagesProcessed] = await Promise.all([
        this.groupChatService.cleanupInactiveGroups(),
        this.groupChatService.cleanupExpiredMessages(),
      ]);

      logger.info('Manual cleanup completed', {
        groupsProcessed,
        messagesProcessed,
      });

      return {
        groupsProcessed,
        messagesProcessed,
      };
    } catch (error) {
      logger.error('Error during manual cleanup:', error);
      throw error;
    }
  }

  /**
   * Get cleanup status
   */
  public getStatus(): {
    groupCleanupRunning: boolean;
    messageCleanupRunning: boolean;
    nextGroupCleanup?: Date | undefined;
    nextMessageCleanup?: Date | undefined;
  } {
    return {
      groupCleanupRunning: this.cleanupJob !== undefined,
      messageCleanupRunning: this.messageCleanupJob !== undefined,
    };
  }
}

// Singleton instance
export const groupCleanupService = new GroupCleanupService();
export default groupCleanupService;
