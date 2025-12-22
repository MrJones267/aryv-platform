/**
 * @fileoverview CourierScheduledTasks for automated courier service tasks
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import cron from 'node-cron';
import { logInfo, logError } from '../utils/logger';
import paymentReleaseService from './PaymentReleaseService';
import qrCodeService from './QRCodeService';

export class CourierScheduledTasks {
  private tasks: Map<string, any> = new Map();
  private isRunning = false;

  /**
   * Start all scheduled tasks
   */
  start(): void {
    if (this.isRunning) {
      logInfo('Courier scheduled tasks already running');
      return;
    }

    this.isRunning = true;
    logInfo('Starting courier scheduled tasks');

    // Auto-release payments every 30 minutes
    this.scheduleAutoPaymentRelease();

    // Expire old QR codes every hour
    this.scheduleQRCodeCleanup();

    // Generate daily reports at midnight
    this.scheduleDailyReports();

    logInfo('All courier scheduled tasks started');
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    if (!this.isRunning) {
      logInfo('Courier scheduled tasks not running');
      return;
    }

    logInfo('Stopping courier scheduled tasks');

    this.tasks.forEach((_task, name) => {
      _task.destroy();
      logInfo(`Stopped scheduled task: ${name}`);
    });

    this.tasks.clear();
    this.isRunning = false;

    logInfo('All courier scheduled tasks stopped');
  }

  /**
   * Get status of all scheduled tasks
   */
  getStatus(): {
    isRunning: boolean;
    activeTasks: string[];
    taskCount: number;
  } {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.tasks.keys()),
      taskCount: this.tasks.size,
    };
  }

  // Private task scheduling methods

  private scheduleAutoPaymentRelease(): void {
    const taskName = 'auto-payment-release';

    // Run every 30 minutes
    const task = cron.schedule('*/30 * * * *', async () => {
      try {
        logInfo('Starting auto-payment release task');

        const results = await paymentReleaseService.processEligibleAutoReleases();
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        logInfo('Auto-payment release task completed', {
          processed: results.length,
          successful,
          failed,
        });

        if (failed > 0) {
          logError('Some auto-payment releases failed', new Error('Batch processing errors'), {
            failed,
            errors: results.filter(r => !r.success).map(r => r.error),
          });
        }

      } catch (error) {
        logError('Auto-payment release task failed', error as Error);
      }
    }, {
      timezone: 'UTC',
    } as any);

    task.start();
    this.tasks.set(taskName, task);
    logInfo(`Scheduled task started: ${taskName} (every 30 minutes)`);
  }

  private scheduleQRCodeCleanup(): void {
    const taskName = 'qr-code-cleanup';

    // Run every hour
    const task = cron.schedule('0 * * * *', async () => {
      try {
        logInfo('Starting QR code cleanup task');

        const expiredCount = await qrCodeService.expireOldQRCodes();

        logInfo('QR code cleanup task completed', {
          expiredCodes: expiredCount,
        });

      } catch (error) {
        logError('QR code cleanup task failed', error as Error);
      }
    }, {
      timezone: 'UTC',
    } as any);

    task.start();
    this.tasks.set(taskName, task);
    logInfo(`Scheduled task started: ${taskName} (every hour)`);
  }

  private scheduleDailyReports(): void {
    const taskName = 'daily-reports';

    // Run at midnight UTC
    const task = cron.schedule('0 0 * * *', async () => {
      try {
        logInfo('Starting daily reports task');

        // Generate payment release statistics
        const paymentStats = await paymentReleaseService.getPaymentReleaseStats();
        const qrStats = await qrCodeService.getQRCodeStats();

        logInfo('Daily courier service report', {
          date: new Date().toISOString().split('T')[0],
          payments: paymentStats,
          qrCodes: qrStats,
        });

        // In a real implementation, this would send reports to monitoring systems
        // or generate PDF reports for admins

      } catch (error) {
        logError('Daily reports task failed', error as Error);
      }
    }, {
      timezone: 'UTC',
    } as any);

    task.start();
    this.tasks.set(taskName, task);
    logInfo(`Scheduled task started: ${taskName} (daily at midnight)`);
  }

  /**
   * Manually trigger a specific task (for testing/admin purposes)
   */
  async triggerTask(taskName: string): Promise<boolean> {
    try {
      logInfo(`Manually triggering task: ${taskName}`);

      switch (taskName) {
        case 'auto-payment-release':
          const results = await paymentReleaseService.processEligibleAutoReleases();
          logInfo('Manual auto-payment release completed', {
            processed: results.length,
            successful: results.filter(r => r.success).length,
          });
          return true;

        case 'qr-code-cleanup':
          const expiredCount = await qrCodeService.expireOldQRCodes();
          logInfo('Manual QR code cleanup completed', {
            expiredCodes: expiredCount,
          });
          return true;

        case 'daily-reports':
          const paymentStats = await paymentReleaseService.getPaymentReleaseStats();
          const qrStats = await qrCodeService.getQRCodeStats();
          logInfo('Manual daily report generated', {
            payments: paymentStats,
            qrCodes: qrStats,
          });
          return true;

        default:
          logError('Unknown task name for manual trigger', new Error('Invalid task'), {
            taskName,
            availableTasks: Array.from(this.tasks.keys()),
          });
          return false;
      }

    } catch (error) {
      logError(`Failed to manually trigger task: ${taskName}`, error as Error);
      return false;
    }
  }

  /**
   * Get next run times for all scheduled tasks
   */
  getNextRunTimes(): Record<string, string | null> {
    const nextRuns: Record<string, string | null> = {};

    this.tasks.forEach((_task, name) => {
      try {
        // Note: node-cron doesn't provide a direct way to get next run time
        // This is a simplified implementation
        const now = new Date();

        switch (name) {
          case 'auto-payment-release':
            // Every 30 minutes
            const nextAutoRelease = new Date(now);
            nextAutoRelease.setMinutes(Math.ceil(nextAutoRelease.getMinutes() / 30) * 30, 0, 0);
            nextRuns[name] = nextAutoRelease.toISOString();
            break;

          case 'qr-code-cleanup':
            // Every hour
            const nextCleanup = new Date(now);
            nextCleanup.setHours(nextCleanup.getHours() + 1, 0, 0, 0);
            nextRuns[name] = nextCleanup.toISOString();
            break;

          case 'daily-reports':
            // Daily at midnight
            const nextReport = new Date(now);
            nextReport.setDate(nextReport.getDate() + 1);
            nextReport.setHours(0, 0, 0, 0);
            nextRuns[name] = nextReport.toISOString();
            break;

          default:
            nextRuns[name] = null;
        }
      } catch (error) {
        nextRuns[name] = null;
      }
    });

    return nextRuns;
  }
}

export default new CourierScheduledTasks();
