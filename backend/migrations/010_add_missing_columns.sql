-- Add missing columns for currencies and countries
-- Created: 2026-01-22
-- Description: Add is_popular and region columns required by server-simple.js

-- Add missing columns to currencies table
ALTER TABLE currencies ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;
ALTER TABLE currencies ADD COLUMN IF NOT EXISTS region VARCHAR(50);

-- Update popular currencies
UPDATE currencies SET is_popular = true, region = 'North America' WHERE code IN ('USD', 'CAD', 'MXN');
UPDATE currencies SET is_popular = true, region = 'Europe' WHERE code IN ('EUR', 'GBP', 'CHF');
UPDATE currencies SET is_popular = true, region = 'Asia' WHERE code IN ('JPY', 'CNY', 'INR');
UPDATE currencies SET is_popular = true, region = 'Oceania' WHERE code = 'AUD';
UPDATE currencies SET is_popular = true, region = 'South America' WHERE code = 'BRL';
UPDATE currencies SET is_popular = true, region = 'Africa' WHERE code IN ('ZAR', 'NGN', 'KES', 'EGP');

-- Add is_popular column to countries if not exists
ALTER TABLE countries ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;

-- Mark popular countries
UPDATE countries SET is_popular = true WHERE code IN ('US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'ZA', 'NG', 'KE');

-- Create indexes for popular queries
CREATE INDEX IF NOT EXISTS idx_currencies_popular ON currencies(is_popular);
CREATE INDEX IF NOT EXISTS idx_countries_popular ON countries(is_popular);
