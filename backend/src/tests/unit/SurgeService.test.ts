/**
 * @fileoverview Dated demand multipliers.
 * @author Oabona-Majoko
 * @created 2026-08-24
 * @lastModified 2026-08-24
 *
 * The app used to derive a surge multiplier from a demand score seeded with
 * Math.random(), apply it to the passenger's quoted price, and show two people
 * looking at the same ride at the same moment different numbers.
 *
 * Surge is now a dated, named calendar. The properties that matter: the same
 * moment always gives the same multiplier, overlapping periods do not compound,
 * and a failure to read the calendar produces no surge rather than a guess.
 */

import { SurgeService, MAX_SURGE_MULTIPLIER } from '../../services/SurgeService';
import { sequelize } from '../../config/database';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

const CHRISTMAS = new Date('2026-12-24T10:00:00+02:00');
const GABORONE = { latitude: -24.65, longitude: 25.92 };

const period = (name: string, multiplier: number) => ({
  id: `sp-${name}`,
  name,
  multiplier: String(multiplier),
  starts_at: new Date('2026-12-23T12:00:00+02:00'),
  ends_at: new Date('2026-12-26T23:59:00+02:00'),
});

describe('SurgeService', () => {
  let service: SurgeService;

  beforeEach(() => {
    service = new SurgeService();
  });

  const withPeriods = (rows: unknown[]) => {
    jest.spyOn(sequelize, 'query').mockResolvedValue(rows as any);
  };

  describe('when a period is in force', () => {
    it('returns its multiplier', async () => {
      withPeriods([period('Christmas 2026', 1.5)]);

      const result = await service.getSurge(CHRISTMAS, GABORONE);

      expect(result.multiplier).toBe(1.5);
    });

    it('names the reason, so a multiplier is never unexplained', async () => {
      withPeriods([period('Christmas 2026', 1.5)]);

      expect((await service.getSurge(CHRISTMAS)).reason).toBe('Christmas 2026');
    });

    it('gives the same answer every time for the same moment', async () => {
      // The property the previous model could not have.
      withPeriods([period('Christmas 2026', 1.5)]);

      const a = await service.getSurge(CHRISTMAS);
      const b = await service.getSurge(CHRISTMAS);

      expect(a.multiplier).toBe(b.multiplier);
    });

    it('takes the highest of overlapping periods rather than multiplying them', async () => {
      // A Christmas period inside a December period should give 1.5, not 1.95.
      // The query returns them highest-first.
      withPeriods([period('Christmas 2026', 1.5), period('December 2026', 1.3)]);

      expect((await service.getSurge(CHRISTMAS)).multiplier).toBe(1.5);
    });

    it('reports every period that matched, for review', async () => {
      withPeriods([period('Christmas 2026', 1.5), period('December 2026', 1.3)]);

      expect((await service.getSurge(CHRISTMAS)).windows).toHaveLength(2);
    });

    it('caps the multiplier however the calendar is configured', async () => {
      // An uncapped holiday multiplier is how a platform ends up in the news.
      withPeriods([period('Misconfigured', 3.0)]);

      expect((await service.getSurge(CHRISTMAS)).multiplier).toBe(MAX_SURGE_MULTIPLIER);
    });

    it('never returns less than 1', async () => {
      // Surge raises prices or does nothing; it does not discount them here.
      withPeriods([period('Bad data', 0.5)]);

      expect((await service.getSurge(CHRISTMAS)).multiplier).toBe(1);
    });
  });

  describe('when no period applies', () => {
    it('returns no surge', async () => {
      withPeriods([]);

      const result = await service.getSurge(new Date('2026-07-15T10:00:00+02:00'));

      expect(result.multiplier).toBe(1);
      expect(result.reason).toBeNull();
      expect(result.windows).toEqual([]);
    });
  });

  describe('when the calendar cannot be read', () => {
    it('returns no surge rather than guessing', async () => {
      // Raising prices for a reason nobody could explain is the worst outcome.
      jest.spyOn(sequelize, 'query').mockRejectedValue(new Error('database down'));

      const result = await service.getSurge(CHRISTMAS);

      expect(result.multiplier).toBe(1);
      expect(result.reason).toBeNull();
    });
  });

  describe('the upcoming calendar', () => {
    it('lists periods so a driver can plan around them', async () => {
      withPeriods([period('Christmas 2026', 1.5)]);

      const upcoming = await service.getUpcoming(60);

      expect(upcoming).toHaveLength(1);
      expect(upcoming[0]!.name).toBe('Christmas 2026');
      expect(upcoming[0]!.multiplier).toBe(1.5);
    });

    it('returns nothing rather than failing when the calendar is unreadable', async () => {
      jest.spyOn(sequelize, 'query').mockRejectedValue(new Error('database down'));

      expect(await service.getUpcoming()).toEqual([]);
    });
  });
});
