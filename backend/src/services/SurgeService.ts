/**
 * @fileoverview Dated demand multipliers for predictable peaks.
 * @author Oabona-Majoko
 * @created 2026-08-24
 * @lastModified 2026-08-24
 *
 * Demand around public holidays is real and predictable — the Thursday before
 * Christmas out of Gaborone is not an ordinary Thursday — so surge here is an
 * explicit dated calendar rather than something inferred per request. That is
 * what makes it auditable: anyone can see which period applied, why, and to
 * which dates, before it happens rather than after a complaint.
 *
 * This is deliberately not the surge model the app used to carry. That one
 * derived a multiplier from a demand score seeded with Math.random(), applied
 * it to the passenger's quoted price, and produced a different number for two
 * people looking at the same ride at the same moment.
 *
 * The multiplier here is advisory. It raises the price *suggested* to a driver
 * and is labelled where a passenger can see it; it never silently changes what
 * is charged, because the driver sets the fare and the server charges exactly
 * that. Keeping the displayed and billed price identical is the property that
 * was broken before, and it is worth more than automatic pricing.
 */

import { sequelize } from '../config/database';
import { QueryTypes } from 'sequelize';
import { logWarning } from '../utils/logger';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface SurgeWindow {
  id: string;
  name: string;
  multiplier: number;
  startsAt: Date;
  endsAt: Date;
}

export interface SurgeResult {
  /** 1 when nothing applies. Never below 1. */
  multiplier: number;
  /** What to show as the reason. Null when no period applies. */
  reason: string | null;
  /** Every period that matched, for transparency and for admin review. */
  windows: SurgeWindow[];
}

const NO_SURGE: SurgeResult = { multiplier: 1, reason: null, windows: [] };

/**
 * Nothing above this applies however the calendar is configured. The database
 * caps a single period at 3; this caps the combined effect, since overlapping
 * periods could otherwise compound into something indefensible.
 */
export const MAX_SURGE_MULTIPLIER = 2.0;

export class SurgeService {
  /**
   * The multiplier in force at a moment, optionally at a place.
   *
   * Where several periods overlap the highest wins rather than the product:
   * a Christmas period inside a December period should give 1.5, not 1.95.
   */
  async getSurge(at: Date, location?: Coordinates): Promise<SurgeResult> {
    try {
      const rows = await sequelize.query<{
        id: string;
        name: string;
        multiplier: string;
        starts_at: Date;
        ends_at: Date;
      }>(
        `SELECT id, name, multiplier, starts_at, ends_at
           FROM surge_periods
          WHERE is_active
            AND starts_at <= :at
            AND ends_at   >= :at
            AND (
              centre IS NULL
              OR (
                :lng::float8 IS NOT NULL
                AND ST_DWithin(
                      centre::geography,
                      ST_SetSRID(ST_MakePoint(:lng::float8, :lat::float8), 4326)::geography,
                      radius_metres)
              )
            )
          ORDER BY multiplier DESC`,
        {
          replacements: {
            at,
            lng: location?.longitude ?? null,
            lat: location?.latitude ?? null,
          },
          type: QueryTypes.SELECT,
        },
      );

      if (rows.length === 0) {
        return NO_SURGE;
      }

      const windows: SurgeWindow[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        multiplier: Number(row.multiplier),
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      }));

      const highest = windows[0]!;
      const multiplier = Math.min(MAX_SURGE_MULTIPLIER, Math.max(1, highest.multiplier));

      return {
        multiplier,
        reason: highest.name,
        windows,
      };
    } catch (error) {
      // No surge is the safe failure. Guessing a multiplier when the calendar
      // cannot be read would raise prices for a reason nobody could explain.
      logWarning('Could not read surge periods', {
        error: error instanceof Error ? error.message : String(error),
      });

      return NO_SURGE;
    }
  }

  /**
   * Periods starting within the next `days`, so a driver can be told that
   * next weekend is a holiday while they still have time to plan for it.
   */
  async getUpcoming(days = 30): Promise<SurgeWindow[]> {
    try {
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const rows = await sequelize.query<{
        id: string; name: string; multiplier: string; starts_at: Date; ends_at: Date;
      }>(
        `SELECT id, name, multiplier, starts_at, ends_at
           FROM surge_periods
          WHERE is_active AND ends_at >= NOW() AND starts_at <= :until
          ORDER BY starts_at ASC`,
        { replacements: { until }, type: QueryTypes.SELECT },
      );

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        multiplier: Number(row.multiplier),
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      }));
    } catch (error) {
      logWarning('Could not read upcoming surge periods', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

export const surgeService = new SurgeService();
export default surgeService;
