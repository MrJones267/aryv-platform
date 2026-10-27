/**
 * @fileoverview Revenue figures for the admin dashboard, kept per currency
 * @author Oabona-Majoko
 * @created 2026-10-27
 * @lastModified 2026-10-27
 *
 * Bookings and delivery agreements each carry their own currency: a ride in
 * Gaborone is in pula, one in Johannesburg in rand. The dashboard used to
 * `SUM(total_amount)` across all of them and print the result under a single
 * symbol, which is meaningless as soon as two currencies exist. Nothing here
 * converts between currencies; every figure is reported in the currency it
 * was charged in, and the caller chooses which one to show.
 */

import { sequelize, QueryTypes } from '../config/database';

// Constants
const COMPLETED = 'completed';

export interface CurrencyRevenue {
  currency: string;
  total: number;
  thisMonth: number;
  lastMonth: number;
}

export interface MonthlyRevenue {
  /** First day of the month, YYYY-MM-01. */
  month: string;
  currency: string;
  rides: number;
  courier: number;
  total: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const monthKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;

/**
 * Completed ride bookings and completed deliveries, summed per currency for
 * all time, the current calendar month and the previous one.
 */
export async function getRevenueByCurrency(now: Date = new Date()): Promise<CurrencyRevenue[]> {
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const rows = await sequelize.query<{
    currency: string;
    total: string | null;
    this_month: string | null;
    last_month: string | null;
  }>(
    `SELECT currency,
            SUM(amount) AS total,
            SUM(amount) FILTER (WHERE created_at >= :startOfMonth) AS this_month,
            SUM(amount) FILTER (WHERE created_at >= :startOfLastMonth AND created_at < :startOfMonth) AS last_month
       FROM (
         SELECT currency, total_amount AS amount, created_at FROM bookings WHERE status = :completed
         UNION ALL
         SELECT currency, agreed_price AS amount, created_at FROM delivery_agreements WHERE status = :completed
       ) revenue
      GROUP BY currency
      ORDER BY SUM(amount) DESC`,
    {
      type: QueryTypes.SELECT,
      replacements: { completed: COMPLETED, startOfMonth, startOfLastMonth },
    },
  );

  return rows.map((r) => ({
    currency: r.currency,
    total: round2(Number(r.total) || 0),
    thisMonth: round2(Number(r.this_month) || 0),
    lastMonth: round2(Number(r.last_month) || 0),
  }));
}

/**
 * Month-by-month revenue for the last `months` calendar months, the current
 * one included, split into rides and courier. Every currency that earned
 * anything in the window gets a row for every month, zero-filled, so a chart
 * draws a continuous line instead of joining the months that had sales.
 */
export async function getMonthlyRevenue(months = 6, now: Date = new Date()): Promise<MonthlyRevenue[]> {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const rows = await sequelize.query<{
    month: string;
    currency: string;
    rides: string | null;
    courier: string | null;
  }>(
    // Formatted in SQL: a bare date_trunc() comes back as a timestamp, which
    // node-postgres reads in the server's local zone and can shift by a month.
    `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM-01') AS month,
            currency,
            SUM(amount) FILTER (WHERE source = 'rides') AS rides,
            SUM(amount) FILTER (WHERE source = 'courier') AS courier
       FROM (
         SELECT 'rides' AS source, currency, total_amount AS amount, created_at
           FROM bookings WHERE status = :completed AND created_at >= :since
         UNION ALL
         SELECT 'courier' AS source, currency, agreed_price AS amount, created_at
           FROM delivery_agreements WHERE status = :completed AND created_at >= :since
       ) revenue
      GROUP BY 1, 2`,
    {
      type: QueryTypes.SELECT,
      replacements: { completed: COMPLETED, since },
    },
  );

  const found = new Map<string, { rides: number; courier: number }>();
  const currencies = new Set<string>();
  for (const r of rows) {
    const key = `${r.month}|${r.currency}`;
    found.set(key, { rides: Number(r.rides) || 0, courier: Number(r.courier) || 0 });
    currencies.add(r.currency);
  }

  const result: MonthlyRevenue[] = [];
  for (const currency of [...currencies].sort()) {
    for (let i = 0; i < months; i++) {
      const month = monthKey(new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1)));
      const { rides, courier } = found.get(`${month}|${currency}`) ?? { rides: 0, courier: 0 };
      result.push({
        month,
        currency,
        rides: round2(rides),
        courier: round2(courier),
        total: round2(rides + courier),
      });
    }
  }
  return result;
}

// Exports
export default { getRevenueByCurrency, getMonthlyRevenue };
