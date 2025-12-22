-- User Country of Operation Migration
-- Created: 2025-01-25
-- Description: Add country of operation fields to users table

-- Add country-related fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);

-- Add constraints for country code
ALTER TABLE users ADD CONSTRAINT check_country_code_length 
    CHECK (country_code IS NULL OR length(country_code) = 2);

-- Add index for country-based queries
CREATE INDEX IF NOT EXISTS idx_users_country_code ON users(country_code);

-- Add comments for documentation
COMMENT ON COLUMN users.country_code IS 'ISO 3166-1 alpha-2 country code where user primarily operates';
COMMENT ON COLUMN users.country_name IS 'Full country name for display purposes';
COMMENT ON COLUMN users.timezone IS 'User timezone (e.g., America/New_York) for localization';

-- Create countries reference table for validation
CREATE TABLE IF NOT EXISTS countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(2) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    name_official VARCHAR(200),
    flag VARCHAR(10),
    continent VARCHAR(50),
    region VARCHAR(100),
    sub_region VARCHAR(100),
    capital VARCHAR(100),
    phone_prefix VARCHAR(10),
    timezones TEXT[], -- Array of timezone strings
    languages TEXT[], -- Array of language codes
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_country_code CHECK (code ~ '^[A-Z]{2}$')
);

-- Create indexes for countries table
CREATE INDEX IF NOT EXISTS idx_countries_code ON countries(code);
CREATE INDEX IF NOT EXISTS idx_countries_continent ON countries(continent);
CREATE INDEX IF NOT EXISTS idx_countries_region ON countries(region);
CREATE INDEX IF NOT EXISTS idx_countries_active ON countries(is_active);

-- Insert comprehensive country data
INSERT INTO countries (code, name, name_official, flag, continent, region, sub_region, capital, phone_prefix, timezones, languages) VALUES
    -- North America
    ('US', 'United States', 'United States of America', '🇺🇸', 'North America', 'Americas', 'Northern America', 'Washington D.C.', '+1', ARRAY['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'], ARRAY['en']),
    ('CA', 'Canada', 'Canada', '🇨🇦', 'North America', 'Americas', 'Northern America', 'Ottawa', '+1', ARRAY['America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax'], ARRAY['en', 'fr']),
    ('MX', 'Mexico', 'United Mexican States', '🇲🇽', 'North America', 'Americas', 'Central America', 'Mexico City', '+52', ARRAY['America/Mexico_City', 'America/Tijuana', 'America/Mazatlan'], ARRAY['es']),
    
    -- Europe
    ('GB', 'United Kingdom', 'United Kingdom of Great Britain and Northern Ireland', '🇬🇧', 'Europe', 'Europe', 'Northern Europe', 'London', '+44', ARRAY['Europe/London'], ARRAY['en']),
    ('DE', 'Germany', 'Federal Republic of Germany', '🇩🇪', 'Europe', 'Europe', 'Western Europe', 'Berlin', '+49', ARRAY['Europe/Berlin'], ARRAY['de']),
    ('FR', 'France', 'French Republic', '🇫🇷', 'Europe', 'Europe', 'Western Europe', 'Paris', '+33', ARRAY['Europe/Paris'], ARRAY['fr']),
    ('IT', 'Italy', 'Italian Republic', '🇮🇹', 'Europe', 'Europe', 'Southern Europe', 'Rome', '+39', ARRAY['Europe/Rome'], ARRAY['it']),
    ('ES', 'Spain', 'Kingdom of Spain', '🇪🇸', 'Europe', 'Europe', 'Southern Europe', 'Madrid', '+34', ARRAY['Europe/Madrid'], ARRAY['es']),
    ('NL', 'Netherlands', 'Kingdom of the Netherlands', '🇳🇱', 'Europe', 'Europe', 'Western Europe', 'Amsterdam', '+31', ARRAY['Europe/Amsterdam'], ARRAY['nl']),
    ('CH', 'Switzerland', 'Swiss Confederation', '🇨🇭', 'Europe', 'Europe', 'Western Europe', 'Bern', '+41', ARRAY['Europe/Zurich'], ARRAY['de', 'fr', 'it']),
    ('SE', 'Sweden', 'Kingdom of Sweden', '🇸🇪', 'Europe', 'Europe', 'Northern Europe', 'Stockholm', '+46', ARRAY['Europe/Stockholm'], ARRAY['sv']),
    ('NO', 'Norway', 'Kingdom of Norway', '🇳🇴', 'Europe', 'Europe', 'Northern Europe', 'Oslo', '+47', ARRAY['Europe/Oslo'], ARRAY['no']),
    
    -- Asia
    ('JP', 'Japan', 'Japan', '🇯🇵', 'Asia', 'Asia', 'Eastern Asia', 'Tokyo', '+81', ARRAY['Asia/Tokyo'], ARRAY['ja']),
    ('CN', 'China', 'People''s Republic of China', '🇨🇳', 'Asia', 'Asia', 'Eastern Asia', 'Beijing', '+86', ARRAY['Asia/Shanghai'], ARRAY['zh']),
    ('IN', 'India', 'Republic of India', '🇮🇳', 'Asia', 'Asia', 'Southern Asia', 'New Delhi', '+91', ARRAY['Asia/Kolkata'], ARRAY['hi', 'en']),
    ('KR', 'South Korea', 'Republic of Korea', '🇰🇷', 'Asia', 'Asia', 'Eastern Asia', 'Seoul', '+82', ARRAY['Asia/Seoul'], ARRAY['ko']),
    ('SG', 'Singapore', 'Republic of Singapore', '🇸🇬', 'Asia', 'Asia', 'South-Eastern Asia', 'Singapore', '+65', ARRAY['Asia/Singapore'], ARRAY['en', 'ms', 'zh', 'ta']),
    ('TH', 'Thailand', 'Kingdom of Thailand', '🇹🇭', 'Asia', 'Asia', 'South-Eastern Asia', 'Bangkok', '+66', ARRAY['Asia/Bangkok'], ARRAY['th']),
    ('VN', 'Vietnam', 'Socialist Republic of Vietnam', '🇻🇳', 'Asia', 'Asia', 'South-Eastern Asia', 'Hanoi', '+84', ARRAY['Asia/Ho_Chi_Minh'], ARRAY['vi']),
    ('MY', 'Malaysia', 'Malaysia', '🇲🇾', 'Asia', 'Asia', 'South-Eastern Asia', 'Kuala Lumpur', '+60', ARRAY['Asia/Kuala_Lumpur'], ARRAY['ms', 'en']),
    ('ID', 'Indonesia', 'Republic of Indonesia', '🇮🇩', 'Asia', 'Asia', 'South-Eastern Asia', 'Jakarta', '+62', ARRAY['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'], ARRAY['id']),
    ('PH', 'Philippines', 'Republic of the Philippines', '🇵🇭', 'Asia', 'Asia', 'South-Eastern Asia', 'Manila', '+63', ARRAY['Asia/Manila'], ARRAY['en', 'tl']),
    
    -- Oceania
    ('AU', 'Australia', 'Commonwealth of Australia', '🇦🇺', 'Oceania', 'Oceania', 'Australia and New Zealand', 'Canberra', '+61', ARRAY['Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth'], ARRAY['en']),
    ('NZ', 'New Zealand', 'New Zealand', '🇳🇿', 'Oceania', 'Oceania', 'Australia and New Zealand', 'Wellington', '+64', ARRAY['Pacific/Auckland'], ARRAY['en']),
    
    -- Africa
    ('ZA', 'South Africa', 'Republic of South Africa', '🇿🇦', 'Africa', 'Africa', 'Southern Africa', 'Cape Town', '+27', ARRAY['Africa/Johannesburg'], ARRAY['af', 'en', 'zu', 'xh']),
    ('NG', 'Nigeria', 'Federal Republic of Nigeria', '🇳🇬', 'Africa', 'Africa', 'Western Africa', 'Abuja', '+234', ARRAY['Africa/Lagos'], ARRAY['en']),
    ('KE', 'Kenya', 'Republic of Kenya', '🇰🇪', 'Africa', 'Africa', 'Eastern Africa', 'Nairobi', '+254', ARRAY['Africa/Nairobi'], ARRAY['en', 'sw']),
    ('EG', 'Egypt', 'Arab Republic of Egypt', '🇪🇬', 'Africa', 'Africa', 'Northern Africa', 'Cairo', '+20', ARRAY['Africa/Cairo'], ARRAY['ar']),
    ('MA', 'Morocco', 'Kingdom of Morocco', '🇲🇦', 'Africa', 'Africa', 'Northern Africa', 'Rabat', '+212', ARRAY['Africa/Casablanca'], ARRAY['ar', 'fr']),
    ('GH', 'Ghana', 'Republic of Ghana', '🇬🇭', 'Africa', 'Africa', 'Western Africa', 'Accra', '+233', ARRAY['Africa/Accra'], ARRAY['en']),
    
    -- South America
    ('BR', 'Brazil', 'Federative Republic of Brazil', '🇧🇷', 'South America', 'Americas', 'South America', 'Brasília', '+55', ARRAY['America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza'], ARRAY['pt']),
    ('AR', 'Argentina', 'Argentine Republic', '🇦🇷', 'South America', 'Americas', 'South America', 'Buenos Aires', '+54', ARRAY['America/Argentina/Buenos_Aires'], ARRAY['es']),
    ('CL', 'Chile', 'Republic of Chile', '🇨🇱', 'South America', 'Americas', 'South America', 'Santiago', '+56', ARRAY['America/Santiago'], ARRAY['es']),
    ('CO', 'Colombia', 'Republic of Colombia', '🇨🇴', 'South America', 'Americas', 'South America', 'Bogotá', '+57', ARRAY['America/Bogota'], ARRAY['es']),
    ('PE', 'Peru', 'Republic of Peru', '🇵🇪', 'South America', 'Americas', 'South America', 'Lima', '+51', ARRAY['America/Lima'], ARRAY['es']),
    
    -- Middle East
    ('AE', 'United Arab Emirates', 'United Arab Emirates', '🇦🇪', 'Asia', 'Asia', 'Western Asia', 'Abu Dhabi', '+971', ARRAY['Asia/Dubai'], ARRAY['ar', 'en']),
    ('SA', 'Saudi Arabia', 'Kingdom of Saudi Arabia', '🇸🇦', 'Asia', 'Asia', 'Western Asia', 'Riyadh', '+966', ARRAY['Asia/Riyadh'], ARRAY['ar']),
    ('IL', 'Israel', 'State of Israel', '🇮🇱', 'Asia', 'Asia', 'Western Asia', 'Jerusalem', '+972', ARRAY['Asia/Jerusalem'], ARRAY['he', 'ar']),
    ('TR', 'Turkey', 'Republic of Turkey', '🇹🇷', 'Asia', 'Asia', 'Western Asia', 'Ankara', '+90', ARRAY['Europe/Istanbul'], ARRAY['tr'])
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
    languages = EXCLUDED.languages,
    updated_at = CURRENT_TIMESTAMP;

-- Add foreign key constraint to users table
ALTER TABLE users ADD CONSTRAINT fk_users_country_code 
    FOREIGN KEY (country_code) REFERENCES countries(code) 
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Update currency service to be aware of countries
-- This will be handled in application logic to auto-suggest currencies based on user's country

COMMENT ON TABLE countries IS 'Reference table for countries with comprehensive metadata';
COMMENT ON COLUMN countries.timezones IS 'Array of IANA timezone identifiers for the country';
COMMENT ON COLUMN countries.languages IS 'Array of ISO 639-1 language codes spoken in the country';