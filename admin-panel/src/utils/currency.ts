/**
 * @fileoverview Money formatting for the admin panel
 * @author Oabona-Majoko
 * @created 2026-10-27
 * @lastModified 2026-10-27
 *
 * Amounts were printed with a hardcoded rupee sign. Symbols come from the
 * currencies table instead, because Intl's are not usable for this region:
 * it renders the Namibian dollar as a bare "$", indistinguishable from USD,
 * and has no symbol at all for the loti, lilangeni or metical.
 */

// Constants
export const PLATFORM_DEFAULT_CURRENCY = 'BWP';

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces?: number;
}

const numberFormat = (decimals: number) =>
  new Intl.NumberFormat('en', { minimumFractionDigits: 0, maximumFractionDigits: decimals });

/**
 * Formats an amount as e.g. "P 1,234.5" or "N$ 980".
 *
 * @param amount - The amount, in the currency's major unit
 * @param code - ISO 4217 code of the currency the amount is in
 * @param currencies - The currency list from the API, for the symbol
 */
export const formatMoney = (
  amount: number | null | undefined,
  code: string,
  currencies: CurrencyOption[] = []
): string => {
  const currency = currencies.find(c => c.code === code);
  const symbol = currency?.symbol || code;
  return `${symbol} ${numberFormat(currency?.decimalPlaces ?? 2).format(Number(amount) || 0)}`;
};

export default formatMoney;
