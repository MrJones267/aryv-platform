/**
 * @fileoverview Per-currency revenue for the admin dashboard.
 * @author Oabona-Majoko
 * @created 2026-10-27
 * @lastModified 2026-10-27
 *
 * The dashboard summed every completed booking into one number regardless of
 * currency and printed it under a rupee sign. The properties that matter now:
 * currencies are never added together, every currency gets a continuous run
 * of months, and the month labels do not depend on the server's time zone.
 */

const mockQuery = jest.fn();

jest.mock('../../config/database', () => ({
  sequelize: { query: (...args: unknown[]) => mockQuery(...args) },
  QueryTypes: { SELECT: 'SELECT' },
}));

import { getMonthlyRevenue, getRevenueByCurrency } from '../../services/RevenueReportService';

const NOW = new Date(Date.UTC(2026, 9, 27, 12, 0, 0)); // 27 Oct 2026

describe('RevenueReportService', () => {
  beforeEach(() => mockQuery.mockReset());

  describe('getRevenueByCurrency', () => {
    it('keeps each currency separate and converts the numeric strings Postgres returns', async () => {
      mockQuery.mockResolvedValue([
        { currency: 'BWP', total: '1520.505', this_month: '300.10', last_month: '120' },
        { currency: 'ZAR', total: '880', this_month: null, last_month: '880' },
      ]);

      const result = await getRevenueByCurrency(NOW);

      expect(result).toEqual([
        { currency: 'BWP', total: 1520.51, thisMonth: 300.1, lastMonth: 120 },
        { currency: 'ZAR', total: 880, thisMonth: 0, lastMonth: 880 },
      ]);
    });

    it('bounds this month and last month on UTC calendar months', async () => {
      mockQuery.mockResolvedValue([]);

      await getRevenueByCurrency(NOW);

      const { replacements } = mockQuery.mock.calls[0][1];
      expect(replacements.startOfMonth.toISOString()).toBe('2026-10-01T00:00:00.000Z');
      expect(replacements.startOfLastMonth.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(replacements.completed).toBe('completed');
    });

    it('counts courier deliveries as well as ride bookings', async () => {
      mockQuery.mockResolvedValue([]);

      await getRevenueByCurrency(NOW);

      const sql: string = mockQuery.mock.calls[0][0];
      expect(sql).toMatch(/FROM bookings/);
      expect(sql).toMatch(/FROM delivery_agreements/);
      expect(sql).toMatch(/GROUP BY currency/);
    });
  });

  describe('getMonthlyRevenue', () => {
    it('zero-fills every month for every currency that earned anything', async () => {
      mockQuery.mockResolvedValue([
        { month: '2026-08-01', currency: 'BWP', rides: '100', courier: '25.5' },
        { month: '2026-10-01', currency: 'ZAR', rides: null, courier: '40' },
      ]);

      const result = await getMonthlyRevenue(3, NOW);

      expect(result).toEqual([
        { month: '2026-08-01', currency: 'BWP', rides: 100, courier: 25.5, total: 125.5 },
        { month: '2026-09-01', currency: 'BWP', rides: 0, courier: 0, total: 0 },
        { month: '2026-10-01', currency: 'BWP', rides: 0, courier: 0, total: 0 },
        { month: '2026-08-01', currency: 'ZAR', rides: 0, courier: 0, total: 0 },
        { month: '2026-09-01', currency: 'ZAR', rides: 0, courier: 0, total: 0 },
        { month: '2026-10-01', currency: 'ZAR', rides: 0, courier: 40, total: 40 },
      ]);
    });

    it('starts the window on the first of the month, the current month included', async () => {
      mockQuery.mockResolvedValue([]);

      await getMonthlyRevenue(6, NOW);

      expect(mockQuery.mock.calls[0][1].replacements.since.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });

    it('formats the month in SQL rather than parsing a timestamp in the local zone', async () => {
      mockQuery.mockResolvedValue([]);

      await getMonthlyRevenue(6, NOW);

      expect(mockQuery.mock.calls[0][0]).toMatch(/to_char\(date_trunc\('month', created_at\), 'YYYY-MM-01'\)/);
    });

    it('returns nothing when there is no revenue in the window', async () => {
      mockQuery.mockResolvedValue([]);

      await expect(getMonthlyRevenue(6, NOW)).resolves.toEqual([]);
    });
  });
});
