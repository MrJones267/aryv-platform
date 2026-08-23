/**
 * @fileoverview Platform fee rates, and converting a capped fee between
 *               currencies.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * A percentage travels between currencies without trouble. A cap does not: the
 * cash commission cap was written as a bare `10.00`, which stood for ten Pula
 * in Botswana and ten dollars in South Africa — roughly thirteen times the
 * value — with nothing in the code or the data saying which was meant.
 *
 * Caps are therefore declared in the platform currency and converted at the
 * point of use. Where no rate is available the cap is not applied at all,
 * rather than applied as though the currencies were interchangeable: an
 * unconverted cap silently under- or over-charges by the exchange rate, and a
 * wrong number is worse than an uncapped percentage.
 */

import { logWarning } from './logger';
import { PLATFORM_DEFAULT_CURRENCY } from '../services/CurrencyService';

/** Commission taken from a driver on a cash ride. */
export const CASH_COMMISSION_RATE = 0.10;

/** Ceiling on that commission, in the platform currency. */
export const CASH_COMMISSION_CAP_IN_PLATFORM_CURRENCY = 10.0;

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Convert an amount from the platform currency into another.
 *
 * Returns null when it cannot be done, so callers decide what a missing rate
 * means for them. Nothing here guesses.
 */
export const convertFromPlatformCurrency = async (
  amount: number,
  targetCurrency: string,
): Promise<number | null> => {
  if (!targetCurrency || targetCurrency === PLATFORM_DEFAULT_CURRENCY) {
    return amount;
  }

  try {
    const { CurrencyService } = await import('../services/CurrencyService');
    const result = await CurrencyService.convertCurrency(
      PLATFORM_DEFAULT_CURRENCY,
      targetCurrency,
      amount,
    );

    const converted = (result as unknown as { convertedAmount?: number })?.convertedAmount
      ?? (typeof result === 'number' ? result : undefined);

    if (typeof converted !== 'number' || !Number.isFinite(converted)) {
      return null;
    }

    return round2(converted);
  } catch (error) {
    logWarning('Currency conversion failed', {
      targetCurrency,
      error: (error as Error).message,
    });
    return null;
  }
};
