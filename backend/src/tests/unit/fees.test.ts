/**
 * @fileoverview Converting a capped fee between currencies.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * A percentage travels between currencies without trouble. A cap does not: the
 * cash commission cap was a bare `10.00`, which meant ten Pula in Botswana and
 * ten dollars in South Africa — roughly thirteen times the value — with
 * nothing in the code or the data saying which.
 */

import {
  convertFromPlatformCurrency,
  CASH_COMMISSION_CAP_IN_PLATFORM_CURRENCY,
  CASH_COMMISSION_RATE,
  round2,
} from '../../utils/fees';
import { CurrencyService } from '../../services/CurrencyService';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

describe('fee constants', () => {
  it('states the cap in the platform currency, not as a bare number', () => {
    // The name is the fix: the value is meaningless without it.
    expect(CASH_COMMISSION_CAP_IN_PLATFORM_CURRENCY).toBe(10);
    expect(CASH_COMMISSION_RATE).toBe(0.1);
  });
});

describe('convertFromPlatformCurrency', () => {
  it('returns the amount unchanged for the platform currency', async () => {
    const convert = jest.spyOn(CurrencyService, 'convertCurrency');

    await expect(convertFromPlatformCurrency(10, 'BWP')).resolves.toBe(10);
    // No lookup needed, so none is made.
    expect(convert).not.toHaveBeenCalled();
  });

  it('converts into another currency', async () => {
    jest.spyOn(CurrencyService, 'convertCurrency').mockResolvedValue({
      convertedAmount: 13.6,
    } as any);

    await expect(convertFromPlatformCurrency(10, 'ZAR')).resolves.toBe(13.6);
  });

  it('asks in the right direction: from the platform currency into the target', async () => {
    const convert = jest
      .spyOn(CurrencyService, 'convertCurrency')
      .mockResolvedValue({ convertedAmount: 1 } as any);

    await convertFromPlatformCurrency(10, 'ZAR');

    expect(convert).toHaveBeenCalledWith('BWP', 'ZAR', 10);
  });

  it('returns null when no rate is available, rather than a wrong number', async () => {
    jest.spyOn(CurrencyService, 'convertCurrency').mockRejectedValue(new Error('no rate'));

    await expect(convertFromPlatformCurrency(10, 'ZAR')).resolves.toBeNull();
  });

  it('returns null on a nonsensical conversion result', async () => {
    jest.spyOn(CurrencyService, 'convertCurrency').mockResolvedValue({
      convertedAmount: Number.NaN,
    } as any);

    await expect(convertFromPlatformCurrency(10, 'ZAR')).resolves.toBeNull();
  });

  it('handles a missing target currency as the platform currency', async () => {
    await expect(convertFromPlatformCurrency(10, '')).resolves.toBe(10);
  });
});

describe('what the cap now means in practice', () => {
  it('caps a Pula ride at the Pula cap', async () => {
    // 10% of 200 is 20, capped to 10.
    const cap = await convertFromPlatformCurrency(
      CASH_COMMISSION_CAP_IN_PLATFORM_CURRENCY,
      'BWP',
    );

    expect(round2(Math.min(200 * CASH_COMMISSION_RATE, cap!))).toBe(10);
  });

  it('caps a Rand ride at the converted cap, not at ten Rand', async () => {
    // Ten Pula is roughly 13.6 Rand. Capping a Rand fare at a bare 10 would
    // have taken a third less commission than intended.
    jest.spyOn(CurrencyService, 'convertCurrency').mockResolvedValue({
      convertedAmount: 13.6,
    } as any);

    const cap = await convertFromPlatformCurrency(
      CASH_COMMISSION_CAP_IN_PLATFORM_CURRENCY,
      'ZAR',
    );

    expect(round2(Math.min(200 * CASH_COMMISSION_RATE, cap!))).toBe(13.6);
    expect(cap).not.toBe(10);
  });
});
