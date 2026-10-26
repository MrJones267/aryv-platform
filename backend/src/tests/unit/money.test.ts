/**
 * @fileoverview Rendering money in the reader's own currency.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Amounts were formatted with a hardcoded `$`, so a Gaborone rider was told to
 * "pay exactly $85.00 in cash to your driver" on the one screen where the
 * number has to be right.
 */

import { formatMoney, formatMoneyForUser } from '../../utils/money';
import { CurrencyService } from '../../services/CurrencyService';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

describe('formatMoney', () => {
  it('uses the currency symbol when there is one', () => {
    expect(formatMoney(85, { code: 'BWP', symbol: 'P', decimalPlaces: 2 })).toBe('P85.00');
  });

  it('falls back to the code when there is no symbol', () => {
    expect(formatMoney(85, { code: 'ZMW' })).toBe('85.00 ZMW');
  });

  it('renders a bare number rather than guessing a currency', () => {
    // A wrong currency marker on a payment instruction is worse than none.
    expect(formatMoney(85)).toBe('85.00');
  });

  it('honours currencies with no minor unit', () => {
    expect(formatMoney(1500, { code: 'JPY', symbol: '¥', decimalPlaces: 0 })).toBe('¥1500');
  });

  it('returns empty for an unusable amount rather than NaN', () => {
    expect(formatMoney(undefined as unknown as number)).toBe('');
    expect(formatMoney(Number.NaN)).toBe('');
  });
});

describe('formatMoneyForUser', () => {
  it('renders in the user\'s primary currency', async () => {
    jest.spyOn(CurrencyService, 'getUserCurrencies').mockResolvedValue({
      primaryCurrency: { code: 'BWP', symbol: 'P', decimalPlaces: 2 },
      availableCurrencies: [],
      paymentCurrencies: [],
    } as any);

    await expect(formatMoneyForUser(85, 'user-1')).resolves.toBe('P85.00');
  });

  it('never throws when the currency cannot be resolved', async () => {
    // Formatting must not take down whatever it was decorating — a delivery
    // code, a payment instruction, a notification.
    jest.spyOn(CurrencyService, 'getUserCurrencies').mockRejectedValue(new Error('no database'));

    await expect(formatMoneyForUser(85, 'user-1')).resolves.toBe('85.00');
  });

  it('returns empty for an unusable amount without consulting anything', async () => {
    const lookup = jest.spyOn(CurrencyService, 'getUserCurrencies');

    await expect(formatMoneyForUser(Number.NaN, 'user-1')).resolves.toBe('');
    expect(lookup).not.toHaveBeenCalled();
  });
});
