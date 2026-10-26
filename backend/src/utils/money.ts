/**
 * @fileoverview Rendering money in the currency the reader actually uses.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Amounts were formatted with a hardcoded `$` throughout — payment
 * instructions, push notifications, wallet limit messages. ARYV operates from
 * Botswana, so a rider being told to "pay exactly $85.00 in cash to your
 * driver" is being quoted in the wrong currency, on the one screen where the
 * number has to be right.
 *
 * A wrong currency marker is worse than none, so where the currency cannot be
 * resolved these fall back to a bare number rather than guessing.
 */

import { logWarning } from './logger';

export interface MoneyCurrency {
  code?: string;
  symbol?: string;
  decimalPlaces?: number;
}

/** Render an amount against a known currency. */
export const formatMoney = (amount: number, currency?: MoneyCurrency | null): string => {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return '';
  }

  const decimals = currency?.decimalPlaces ?? 2;
  const rendered = value.toFixed(decimals);

  if (currency?.symbol) return `${currency.symbol}${rendered}`;
  if (currency?.code) return `${rendered} ${currency.code}`;
  return rendered;
};

/**
 * Render an amount in the currency it is actually denominated in.
 *
 * Prefer this over formatMoneyForUser for anything read off a record. A fare
 * is in the currency the driver priced it in; rendering it in whatever the
 * reader happens to prefer puts a Pula symbol on a Rand amount, which is worse
 * than showing a bare number.
 */
export const formatMoneyInCurrency = async (
  amount: number,
  currencyCode: string | null | undefined,
): Promise<string> => {
  if (!Number.isFinite(Number(amount))) {
    return '';
  }

  if (!currencyCode) {
    return formatMoney(amount);
  }

  try {
    const { CurrencyService } = await import('../services/CurrencyService');
    const currency = await CurrencyService.getCurrencyByCode(currencyCode);
    return formatMoney(amount, currency as MoneyCurrency | null);
  } catch (error) {
    logWarning('Could not resolve a currency by code; rendering the amount bare', {
      currencyCode,
      error: (error as Error).message,
    });
    return formatMoney(amount);
  }
};

/**
 * Render an amount in a user's own primary currency.
 *
 * Only correct where the amount has no currency of its own — a wallet limit, a
 * threshold. For anything read off a record, use formatMoneyInCurrency.
 *
 * Never throws: a formatting problem must not take down whatever it was
 * decorating — a delivery code, a payment instruction, a notification.
 */
export const formatMoneyForUser = async (
  amount: number,
  userId: string,
): Promise<string> => {
  if (!Number.isFinite(Number(amount))) {
    return '';
  }

  try {
    const { CurrencyService } = await import('../services/CurrencyService');
    const preferences = await CurrencyService.getUserCurrencies(userId);
    return formatMoney(amount, preferences?.primaryCurrency as MoneyCurrency | undefined);
  } catch (error) {
    logWarning('Could not resolve a currency for an amount; rendering it bare', {
      userId,
      error: (error as Error).message,
    });
    return formatMoney(amount);
  }
};

export default formatMoney;
