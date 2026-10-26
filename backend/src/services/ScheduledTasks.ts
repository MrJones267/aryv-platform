/**
 * @fileoverview The platform's scheduled work, and the thing that starts it.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * CourierScheduledTasks already existed, with auto-payment release, QR cleanup
 * and daily reports — and nothing ever imported it, so none of it ran. This
 * owns the schedule and is started from the server entry point, which is the
 * part that was missing.
 *
 * Everything here is periodic maintenance, so every task is written to be safe
 * to run twice and safe to miss: a failure logs and the next tick tries again.
 * A scheduled task that throws must never take the process down.
 */

import cron, { ScheduledTask } from 'node-cron';
import { CurrencyService } from './CurrencyService';
import verificationService from './VerificationService';
import deliveryHandoverService from './DeliveryHandoverService';
import { logInfo, logError, logWarning } from '../utils/logger';

/**
 * Rates are quoted daily by the providers used, so refreshing more often buys
 * nothing and spends request quota. Run in the small hours, Botswana time.
 */
const EXCHANGE_RATE_SCHEDULE = '0 3 * * *';

/** Documents and codes expire on a date, so a daily sweep is timely enough. */
const EXPIRY_SWEEP_SCHEDULE = '30 3 * * *';

const TIMEZONE = 'Africa/Gaborone';

/**
 * Rates older than this are treated as not worth trusting. Seeded rates are
 * indicative placeholders, so a fresh deployment needs a refresh before any
 * converted figure means anything.
 */
const STALE_AFTER_HOURS = 36;

export class ScheduledTasks {
  private tasks = new Map<string, ScheduledTask>();
  private running = false;

  start(): void {
    if (this.running) {
      logInfo('Scheduled tasks already running');
      return;
    }

    this.schedule('exchange-rates', EXCHANGE_RATE_SCHEDULE, async () => {
      await this.refreshExchangeRates();
    });
    this.schedule('expiry-sweep', EXPIRY_SWEEP_SCHEDULE, () => this.runExpirySweeps());

    this.running = true;
    logInfo('Scheduled tasks started', { tasks: [...this.tasks.keys()], timezone: TIMEZONE });

    // Rates are seeded as placeholders, so a deployment that never reaches
    // 03:00 — or a fresh database — would convert against fictional numbers.
    // Checked rather than always refreshed, so restarts do not hammer the
    // provider.
    void this.refreshExchangeRatesIfStale();
  }

  stop(): void {
    for (const [name, task] of this.tasks) {
      task.stop();
      logInfo('Stopped scheduled task', { name });
    }
    this.tasks.clear();
    this.running = false;
  }

  status(): Array<{ name: string; running: boolean }> {
    return [...this.tasks.keys()].map((name) => ({ name, running: this.running }));
  }

  private schedule(name: string, expression: string, run: () => Promise<void>): void {
    const task = cron.schedule(
      expression,
      () => {
        // Deliberately not awaited by cron, and every path inside catches: an
        // unhandled rejection from a scheduled task would otherwise reach the
        // process handler.
        void run().catch((error) => {
          logError(`Scheduled task failed: ${name}`, error as Error);
        });
      },
      { timezone: TIMEZONE },
    );

    this.tasks.set(name, task);
  }

  /**
   * Pull fresh exchange rates.
   *
   * Rates matter wherever an amount is shown in a currency other than the one
   * it was recorded in. Fees no longer depend on them — the commission is a
   * flat percentage — but conversion for display still does.
   */
  async refreshExchangeRates(): Promise<{ updated: number; errors: string[] }> {
    logInfo('Refreshing exchange rates');

    const result = await CurrencyService.updateExchangeRates();

    if (result.updated > 0) {
      logInfo('Exchange rates refreshed', { updated: result.updated });
    } else {
      // Not an error in itself — every provider may have been unreachable —
      // but silence here means stale rates, which is worth seeing.
      logWarning('Exchange rate refresh updated nothing', { errors: result.errors });
    }

    if (result.errors.length > 0) {
      logWarning('Some exchange rate providers failed', { errors: result.errors });
    }

    return result;
  }

  /** Refresh only when the stored rates have gone stale. */
  async refreshExchangeRatesIfStale(): Promise<void> {
    try {
      const currencies = await CurrencyService.getActiveCurrencies();

      const newest = currencies
        .map((c) => (c.lastUpdated ? new Date(c.lastUpdated).getTime() : 0))
        .reduce((a, b) => Math.max(a, b), 0);

      const ageHours = (Date.now() - newest) / (60 * 60 * 1000);

      if (newest === 0 || ageHours > STALE_AFTER_HOURS) {
        logInfo('Exchange rates are stale; refreshing at startup', {
          ageHours: Number.isFinite(ageHours) ? Math.round(ageHours) : null,
        });
        await this.refreshExchangeRates();
      }
    } catch (error) {
      logError('Could not check exchange rate freshness', error as Error);
    }
  }

  /**
   * Expire things that lapse on a date.
   *
   * Both sweeps exist because approval is not permanent: a licence expires
   * while its driver is still marked verified, and a handover code has to stop
   * working eventually.
   */
  async runExpirySweeps(): Promise<void> {
    try {
      const documents = await verificationService.expireLapsedDocuments();
      if (documents.expired > 0) {
        logInfo('Expired lapsed driver documents', documents);
      }
    } catch (error) {
      logError('Driver document expiry sweep failed', error as Error);
    }

    try {
      const codes = await deliveryHandoverService.expireStaleCodes();
      if (codes > 0) {
        logInfo('Expired stale handover codes', { count: codes });
      }
    } catch (error) {
      logError('Handover code expiry sweep failed', error as Error);
    }
  }
}

export const scheduledTasks = new ScheduledTasks();
export default scheduledTasks;
