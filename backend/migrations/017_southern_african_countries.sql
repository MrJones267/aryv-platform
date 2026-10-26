-- =====================================================================
-- Migration 017: Southern African countries
-- Author: Oabona-Majoko
-- Created: 2026-08-23
--
-- Purpose:
--   Botswana was not in the countries table. ARYV operates from Botswana, so a
--   user could not select their own country, could not be offered +267 as a
--   dialing prefix, and had no country row for anything derived from one —
--   including the default currency introduced in migration 016.
--
--   Migration 006 seeded 39 countries: North America, Europe, East and South
--   East Asia, Australasia, and from Africa only South Africa, Nigeria, Kenya,
--   Egypt, Morocco and Ghana. Nothing from the region this platform serves.
--
--   Phone prefixes here are what makes a locally-written number resolvable:
--   people type 71234567, not +26771234567.
-- =====================================================================

INSERT INTO countries (code, name, name_official, flag, continent, region, sub_region, capital, phone_prefix, timezones, languages) VALUES
    ('BW', 'Botswana',     'Republic of Botswana',        '🇧🇼', 'Africa', 'Africa', 'Southern Africa', 'Gaborone',  '+267', ARRAY['Africa/Gaborone'],     ARRAY['en', 'tn']),
    ('NA', 'Namibia',      'Republic of Namibia',         '🇳🇦', 'Africa', 'Africa', 'Southern Africa', 'Windhoek',  '+264', ARRAY['Africa/Windhoek'],     ARRAY['en', 'af']),
    ('ZM', 'Zambia',       'Republic of Zambia',          '🇿🇲', 'Africa', 'Africa', 'Eastern Africa',  'Lusaka',    '+260', ARRAY['Africa/Lusaka'],       ARRAY['en']),
    ('ZW', 'Zimbabwe',     'Republic of Zimbabwe',        '🇿🇼', 'Africa', 'Africa', 'Eastern Africa',  'Harare',    '+263', ARRAY['Africa/Harare'],       ARRAY['en', 'sn', 'nd']),
    ('SZ', 'Eswatini',     'Kingdom of Eswatini',         '🇸🇿', 'Africa', 'Africa', 'Southern Africa', 'Mbabane',   '+268', ARRAY['Africa/Mbabane'],      ARRAY['en', 'ss']),
    ('LS', 'Lesotho',      'Kingdom of Lesotho',          '🇱🇸', 'Africa', 'Africa', 'Southern Africa', 'Maseru',    '+266', ARRAY['Africa/Maseru'],       ARRAY['en', 'st']),
    ('MW', 'Malawi',       'Republic of Malawi',          '🇲🇼', 'Africa', 'Africa', 'Eastern Africa',  'Lilongwe',  '+265', ARRAY['Africa/Blantyre'],     ARRAY['en', 'ny']),
    ('MZ', 'Mozambique',   'Republic of Mozambique',      '🇲🇿', 'Africa', 'Africa', 'Eastern Africa',  'Maputo',    '+258', ARRAY['Africa/Maputo'],       ARRAY['pt']),
    ('AO', 'Angola',       'Republic of Angola',          '🇦🇴', 'Africa', 'Africa', 'Middle Africa',   'Luanda',    '+244', ARRAY['Africa/Luanda'],       ARRAY['pt']),
    ('TZ', 'Tanzania',     'United Republic of Tanzania', '🇹🇿', 'Africa', 'Africa', 'Eastern Africa',  'Dodoma',    '+255', ARRAY['Africa/Dar_es_Salaam'], ARRAY['sw', 'en'])
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_official = EXCLUDED.name_official,
    flag = EXCLUDED.flag,
    continent = EXCLUDED.continent,
    region = EXCLUDED.region,
    sub_region = EXCLUDED.sub_region,
    capital = EXCLUDED.capital,
    phone_prefix = EXCLUDED.phone_prefix,
    timezones = EXCLUDED.timezones,
    languages = EXCLUDED.languages;
