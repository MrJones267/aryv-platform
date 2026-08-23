-- =====================================================================
-- Migration 023: USD and ZAR
-- Author: Oabona-Majoko
-- Created: 2026-08-23
--
-- Purpose:
--   Migration 016 seeded the Southern African currencies and then took care
--   to keep USD and ZAR active alongside them. That clause did nothing,
--   because neither row existed: migration 005's seed had never actually run
--   against production, so the currencies table was empty when 016 arrived.
--   The result was ten regional currencies and no reference currency.
--
--   USD matters beyond being one more option. Exchange rates are quoted
--   against it — the rates seeded in 016 are units per USD — so
--   CurrencyService has nothing to convert through without it.
--
--   ZAR matters because South Africa is the busiest cross-border corridor
--   from Botswana, and a passenger paying in rand needs the currency to
--   exist before they can select it.
--
--   Rates are indicative only and are replaced by the scheduled refresh in
--   ScheduledTasks; they exist so the column is not null on day one.
-- =====================================================================

INSERT INTO currencies (
  id, code, name, symbol, decimal_places, is_active, exchange_rate,
  country_code, flag, last_updated, created_at, updated_at
)
SELECT
  uuid_generate_v4(), v.code, v.name, v.symbol, v.decimal_places, TRUE,
  v.exchange_rate, v.country_code, v.flag, NOW(), NOW(), NOW()
FROM (VALUES
    -- The reference: one USD is one USD, so every other rate is read against
    -- this row.
    ('USD', 'US Dollar',        '$',  2, 1.000000,  'US', '🇺🇸'),
    ('ZAR', 'South African Rand', 'R', 2, 18.500000, 'ZA', '🇿🇦')
) AS v(code, name, symbol, decimal_places, exchange_rate, country_code, flag)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    decimal_places = EXCLUDED.decimal_places,
    country_code = EXCLUDED.country_code,
    flag = EXCLUDED.flag,
    is_active = TRUE,
    updated_at = NOW();

-- South Africa and the United States need country rows too, for the same
-- reason Botswana did in 017: without one there is no dialing prefix, so a
-- locally written number cannot be resolved.
INSERT INTO countries (code, name, name_official, flag, continent, region, sub_region, capital, phone_prefix, timezones, languages) VALUES
    ('ZA', 'South Africa',   'Republic of South Africa',  '🇿🇦', 'Africa',   'Africa',   'Southern Africa', 'Pretoria',         '+27', ARRAY['Africa/Johannesburg'], ARRAY['en', 'af', 'zu', 'xh']),
    ('US', 'United States',  'United States of America',  '🇺🇸', 'Americas', 'Americas', 'North America',   'Washington, D.C.', '+1',  ARRAY['America/New_York'],    ARRAY['en'])
ON CONFLICT (code) DO UPDATE SET
    phone_prefix = EXCLUDED.phone_prefix,
    flag = EXCLUDED.flag,
    is_active = TRUE;

COMMENT ON TABLE currencies IS
  'Supported currencies. exchange_rate is units per USD; the USD row is the reference and stays at 1.';
