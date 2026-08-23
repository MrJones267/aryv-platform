/**
 * @fileoverview The scheduler, and the tasks it runs.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * CourierScheduledTasks already existed with three tasks on it, and nothing
 * ever imported it — so none of them ran. The failure mode of a scheduler is
 * silence, which is why these tests check that it registers work and that a
 * failing task does not stop the rest.
 */

import cron from 'node-cron';
import { ScheduledTasks } from '../../services/ScheduledTasks';
import { CurrencyService } from '../../services/CurrencyService';
import verificationService from '../../services/VerificationService';
import deliveryHandoverService from '../../services/DeliveryHandoverService';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

describe('ScheduledTasks', () => {
  let tasks: ScheduledTasks;
  let scheduled: Array<{ expression: string; handler: () => void }>;

  beforeEach(() => {
    tasks = new ScheduledTasks();
    scheduled = [];

    jest.spyOn(cron, 'schedule').mockImplementation(((expression: string, handler: any) => {
      scheduled.push({ expression, handler });
      return { stop: jest.fn(), start: jest.fn() } as any;
    }) as any);

    jest.spyOn(CurrencyService, 'updateExchangeRates').mockResolvedValue({
      updated: 11,
      errors: [],
    });
    jest.spyOn(CurrencyService, 'getActiveCurrencies').mockResolvedValue([
      { code: 'BWP', lastUpdated: new Date() },
    ] as any);
    jest.spyOn(verificationService, 'expireLapsedDocuments').mockResolvedValue({
      expired: 0,
      demoted: 0,
    });
    jest.spyOn(deliveryHandoverService, 'expireStaleCodes').mockResolvedValue(0);
  });

  afterEach(() => tasks.stop());

  describe('starting', () => {
    it('registers the exchange rate refresh and the expiry sweep', () => {
      tasks.start();

      expect(scheduled).toHaveLength(2);
      expect(tasks.status().map((t) => t.name)).toEqual(['exchange-rates', 'expiry-sweep']);
    });

    it('schedules them daily rather than continuously', () => {
      tasks.start();

      // Providers quote daily; polling harder spends quota for nothing.
      for (const { expression } of scheduled) {
        expect(expression).toMatch(/^\d+ \d+ \* \* \*$/);
      }
    });

    it('does not register twice if started again', () => {
      tasks.start();
      tasks.start();

      expect(scheduled).toHaveLength(2);
    });

    it('stops everything it started', () => {
      tasks.start();
      tasks.stop();

      expect(tasks.status()).toEqual([]);
    });
  });

  describe('exchange rates at startup', () => {
    it('refreshes when the stored rates are stale', async () => {
      // Seeded rates are indicative placeholders, so a fresh database would
      // otherwise convert against fictional numbers until 03:00.
      jest.spyOn(CurrencyService, 'getActiveCurrencies').mockResolvedValue([
        { code: 'BWP', lastUpdated: new Date(Date.now() - 90 * 60 * 60 * 1000) },
      ] as any);

      await tasks.refreshExchangeRatesIfStale();

      expect(CurrencyService.updateExchangeRates).toHaveBeenCalled();
    });

    it('refreshes when nothing has ever been updated', async () => {
      jest.spyOn(CurrencyService, 'getActiveCurrencies').mockResolvedValue([
        { code: 'BWP', lastUpdated: null },
      ] as any);

      await tasks.refreshExchangeRatesIfStale();

      expect(CurrencyService.updateExchangeRates).toHaveBeenCalled();
    });

    it('leaves fresh rates alone, so restarts do not hammer the provider', async () => {
      await tasks.refreshExchangeRatesIfStale();

      expect(CurrencyService.updateExchangeRates).not.toHaveBeenCalled();
    });

    it('survives a failure to check freshness', async () => {
      jest.spyOn(CurrencyService, 'getActiveCurrencies').mockRejectedValue(new Error('no database'));

      await expect(tasks.refreshExchangeRatesIfStale()).resolves.toBeUndefined();
    });
  });

  describe('expiry sweeps', () => {
    it('runs both sweeps', async () => {
      await tasks.runExpirySweeps();

      expect(verificationService.expireLapsedDocuments).toHaveBeenCalled();
      expect(deliveryHandoverService.expireStaleCodes).toHaveBeenCalled();
    });

    it('still runs the second sweep when the first fails', async () => {
      // One failing task must not silently cancel the rest of the night's work.
      jest
        .spyOn(verificationService, 'expireLapsedDocuments')
        .mockRejectedValue(new Error('database unavailable'));

      await expect(tasks.runExpirySweeps()).resolves.toBeUndefined();
      expect(deliveryHandoverService.expireStaleCodes).toHaveBeenCalled();
    });
  });

  describe('a failing task does not escape', () => {
    it('catches a rejection rather than letting it reach the process', async () => {
      jest
        .spyOn(CurrencyService, 'updateExchangeRates')
        .mockRejectedValue(new Error('provider down'));

      tasks.start();
      const rateTask = scheduled.find((s) => s.expression === '0 3 * * *')!;

      // Invoking the registered handler is what cron does; it must not throw.
      expect(() => rateTask.handler()).not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));
    });
  });
});
