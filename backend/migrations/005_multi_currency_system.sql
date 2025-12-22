-- Multi-Currency System Migration
-- Created: 2025-01-25
-- Description: Add support for multiple currencies and user currency preferences

-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(3) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(5) NOT NULL,
    decimal_places INTEGER NOT NULL DEFAULT 2 CHECK (decimal_places >= 0 AND decimal_places <= 4),
    is_active BOOLEAN NOT NULL DEFAULT true,
    exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1.0 CHECK (exchange_rate > 0),
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    country_code VARCHAR(2),
    flag VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_currency_code CHECK (code ~ '^[A-Z]{3}$'),
    CONSTRAINT valid_country_code CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$')
);

-- Create indexes for currencies
CREATE INDEX IF NOT EXISTS idx_currencies_code ON currencies(code);
CREATE INDEX IF NOT EXISTS idx_currencies_active ON currencies(is_active);
CREATE INDEX IF NOT EXISTS idx_currencies_country ON currencies(country_code);

-- Create user_currencies table for user currency preferences
CREATE TABLE IF NOT EXISTS user_currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    currency_id UUID NOT NULL REFERENCES currencies(id) ON DELETE CASCADE ON UPDATE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_payment_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, currency_id)
);

-- Create indexes for user_currencies
CREATE INDEX IF NOT EXISTS idx_user_currencies_user_id ON user_currencies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_currencies_currency_id ON user_currencies(currency_id);
CREATE INDEX IF NOT EXISTS idx_user_currencies_primary ON user_currencies(user_id, is_primary);

-- Add currency columns to existing payment tables
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS currency_id UUID REFERENCES currencies(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_currency_amount DECIMAL(10,2);

ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS currency_id UUID REFERENCES currencies(id);
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS original_currency_amount DECIMAL(10,2);
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS exchange_rate_at_time DECIMAL(15,6);

-- Insert default currencies (major world currencies)
INSERT INTO currencies (code, name, symbol, decimal_places, is_active, exchange_rate, country_code, flag) VALUES
    ('USD', 'US Dollar', '$', 2, true, 1.000000, 'US', '🇺🇸'),
    ('EUR', 'Euro', '€', 2, true, 0.850000, 'EU', '🇪🇺'),
    ('GBP', 'British Pound', '£', 2, true, 0.750000, 'GB', '🇬🇧'),
    ('JPY', 'Japanese Yen', '¥', 0, true, 150.000000, 'JP', '🇯🇵'),
    ('CAD', 'Canadian Dollar', 'C$', 2, true, 1.350000, 'CA', '🇨🇦'),
    ('AUD', 'Australian Dollar', 'A$', 2, true, 1.550000, 'AU', '🇦🇺'),
    ('CHF', 'Swiss Franc', 'CHF', 2, true, 0.900000, 'CH', '🇨🇭'),
    ('CNY', 'Chinese Yuan', '¥', 2, true, 7.200000, 'CN', '🇨🇳'),
    ('INR', 'Indian Rupee', '₹', 2, true, 83.000000, 'IN', '🇮🇳'),
    ('BRL', 'Brazilian Real', 'R$', 2, true, 5.200000, 'BR', '🇧🇷'),
    ('MXN', 'Mexican Peso', '$', 2, true, 17.000000, 'MX', '🇲🇽'),
    ('ZAR', 'South African Rand', 'R', 2, true, 18.500000, 'ZA', '🇿🇦'),
    ('NGN', 'Nigerian Naira', '₦', 2, true, 800.000000, 'NG', '🇳🇬'),
    ('KES', 'Kenyan Shilling', 'KSh', 2, true, 155.000000, 'KE', '🇰🇪'),
    ('EGP', 'Egyptian Pound', 'E£', 2, true, 31.000000, 'EG', '🇪🇬')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    decimal_places = EXCLUDED.decimal_places,
    exchange_rate = EXCLUDED.exchange_rate,
    country_code = EXCLUDED.country_code,
    flag = EXCLUDED.flag,
    last_updated = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP;

-- Create function to ensure only one primary currency per user
CREATE OR REPLACE FUNCTION ensure_single_primary_currency()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting a currency as primary, unset all other primary currencies for this user
    IF NEW.is_primary = true THEN
        UPDATE user_currencies 
        SET is_primary = false, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for primary currency constraint
DROP TRIGGER IF EXISTS trigger_ensure_single_primary_currency ON user_currencies;
CREATE TRIGGER trigger_ensure_single_primary_currency
    BEFORE INSERT OR UPDATE ON user_currencies
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_currency();

-- Create function to auto-assign USD as primary currency for new users
CREATE OR REPLACE FUNCTION assign_default_currency_to_user()
RETURNS TRIGGER AS $$
DECLARE
    usd_currency_id UUID;
BEGIN
    -- Get USD currency ID
    SELECT id INTO usd_currency_id FROM currencies WHERE code = 'USD' AND is_active = true;
    
    -- If USD exists, assign it as the user's primary currency
    IF usd_currency_id IS NOT NULL THEN
        INSERT INTO user_currencies (user_id, currency_id, is_primary, is_payment_enabled)
        VALUES (NEW.id, usd_currency_id, true, true)
        ON CONFLICT (user_id, currency_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-assign default currency to new users
DROP TRIGGER IF EXISTS trigger_assign_default_currency ON users;
CREATE TRIGGER trigger_assign_default_currency
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION assign_default_currency_to_user();

-- Create function to update currency exchange rates timestamp
CREATE OR REPLACE FUNCTION update_currency_exchange_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_updated when exchange_rate changes
    IF OLD.exchange_rate != NEW.exchange_rate THEN
        NEW.last_updated = CURRENT_TIMESTAMP;
    END IF;
    
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for currency exchange rate updates
DROP TRIGGER IF EXISTS trigger_update_currency_exchange_timestamp ON currencies;
CREATE TRIGGER trigger_update_currency_exchange_timestamp
    BEFORE UPDATE ON currencies
    FOR EACH ROW
    EXECUTE FUNCTION update_currency_exchange_timestamp();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_currency_id ON bookings(currency_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_currency_id ON cash_transactions(currency_id);

-- Update existing records to use USD as default currency
DO $$
DECLARE
    usd_currency_id UUID;
BEGIN
    -- Get USD currency ID
    SELECT id INTO usd_currency_id FROM currencies WHERE code = 'USD';
    
    IF usd_currency_id IS NOT NULL THEN
        -- Update existing bookings to use USD
        UPDATE bookings SET currency_id = usd_currency_id WHERE currency_id IS NULL;
        
        -- Update existing cash transactions to use USD
        UPDATE cash_transactions SET 
            currency_id = usd_currency_id,
            exchange_rate_at_time = 1.0
        WHERE currency_id IS NULL;
        
        -- Add USD as primary currency for existing users who don't have any currency preferences
        INSERT INTO user_currencies (user_id, currency_id, is_primary, is_payment_enabled)
        SELECT u.id, usd_currency_id, true, true
        FROM users u
        WHERE NOT EXISTS (
            SELECT 1 FROM user_currencies uc WHERE uc.user_id = u.id
        );
    END IF;
END $$;

COMMENT ON TABLE currencies IS 'Supported currencies for the platform';
COMMENT ON TABLE user_currencies IS 'User currency preferences and settings';
COMMENT ON COLUMN currencies.exchange_rate IS 'Exchange rate relative to USD (1 USD = exchange_rate of this currency)';
COMMENT ON COLUMN user_currencies.is_primary IS 'Primary currency for display - only one per user';
COMMENT ON COLUMN user_currencies.is_payment_enabled IS 'Whether user can make payments in this currency';