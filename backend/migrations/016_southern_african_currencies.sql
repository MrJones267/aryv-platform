-- =====================================================================
-- Migration 016: Southern African currencies
-- Author: Oabona-Majoko
-- Created: 2026-08-23
--
-- Purpose:
--   BWP was never seeded. The Botswana Pula is the platform's home currency —
--   the settings default is 'BWP', the promo codes are described in BWP, the
--   payment fallback is BWP — and there has been no row for it in the
--   currencies table, so no user could hold it as a preference and every
--   lookup for it failed.
--
--   Migration 005 seeded a generic global list: yen, rupee, real, yuan, peso,
--   Swiss franc. None of those is relevant to the region ARYV serves, and
--   offering them as choices invites a user to price a Gaborone ride in yen.
--   They are deactivated rather than deleted, because users may already
--   reference them and is_active is what the service filters on.
--
--   Exchange rates below are indicative and only seed the column; they are
--   refreshed by CurrencyService.updateExchangeRates from a rate provider.
--   Do not treat them as accurate.
-- =====================================================================

INSERT INTO currencies (code, name, symbol, decimal_places, is_active, exchange_rate, country_code, flag) VALUES
    ('BWP', 'Botswana Pula',        'P',    2, true, 13.600000,   'BW', '🇧🇼'),
    ('NAD', 'Namibian Dollar',      'N$',   2, true, 18.500000,   'NA', '🇳🇦'),
    ('ZMW', 'Zambian Kwacha',       'ZK',   2, true, 26.500000,   'ZM', '🇿🇲'),
    ('ZWL', 'Zimbabwean Dollar',    'Z$',   2, true, 32.000000,   'ZW', '🇿🇼'),
    ('SZL', 'Eswatini Lilangeni',   'E',    2, true, 18.500000,   'SZ', '🇸🇿'),
    ('LSL', 'Lesotho Loti',         'L',    2, true, 18.500000,   'LS', '🇱🇸'),
    ('MWK', 'Malawian Kwacha',      'MK',   2, true, 1735.000000, 'MW', '🇲🇼'),
    ('MZN', 'Mozambican Metical',   'MT',   2, true, 63.900000,   'MZ', '🇲🇿'),
    ('AOA', 'Angolan Kwanza',       'Kz',   2, true, 912.000000,  'AO', '🇦🇴'),
    ('TZS', 'Tanzanian Shilling',   'TSh',  2, true, 2680.000000, 'TZ', '🇹🇿')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    decimal_places = EXCLUDED.decimal_places,
    country_code = EXCLUDED.country_code,
    flag = EXCLUDED.flag,
    is_active = true;

-- Keep USD (the reference currency and a common quote for cross-border work)
-- and the regional set. Everything else from migration 005's global list is
-- switched off: deactivated, not deleted, so existing references survive.
UPDATE currencies
   SET is_active = false
 WHERE code NOT IN (
     'USD',
     'BWP', 'ZAR', 'NAD', 'ZMW', 'ZWL', 'SZL', 'LSL', 'MWK', 'MZN', 'AOA', 'TZS'
 );

-- ZAR was seeded by 005 and stays active; make sure it was not caught above.
UPDATE currencies SET is_active = true WHERE code IN ('USD', 'ZAR');
