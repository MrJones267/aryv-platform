-- =====================================================
-- Cash Payment System Migration
-- Created: 2025-01-25
-- Description: Add cash payment support with trust system
-- =====================================================

-- Cash payment status enum
CREATE TYPE cash_payment_status AS ENUM (
    'pending_verification',
    'driver_confirmed', 
    'rider_confirmed',
    'both_confirmed',
    'disputed',
    'completed',
    'failed',
    'expired'
);

-- Verification level enum
CREATE TYPE verification_level AS ENUM (
    'basic',
    'verified',
    'premium'
);

-- Cash transactions table
CREATE TABLE cash_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Amount details
    amount DECIMAL(8,2) NOT NULL CHECK (amount >= 0.01 AND amount <= 10000.00),
    platform_fee DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    expected_amount DECIMAL(8,2) NOT NULL,
    actual_amount_claimed DECIMAL(8,2),
    
    -- Status and verification
    status cash_payment_status NOT NULL DEFAULT 'pending_verification',
    rider_confirmed_at TIMESTAMP WITH TIME ZONE,
    driver_confirmed_at TIMESTAMP WITH TIME ZONE,
    
    -- Verification codes
    rider_confirmation_code VARCHAR(6) NOT NULL,
    driver_confirmation_code VARCHAR(6) NOT NULL,
    
    -- Security features
    verification_photo VARCHAR(500),
    gps_location_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    transaction_location JSONB,
    
    -- Dispute handling
    dispute_reason TEXT,
    dispute_resolved_at TIMESTAMP WITH TIME ZONE,
    dispute_resolution VARCHAR(20) CHECK (dispute_resolution IN ('rider_favor', 'driver_favor', 'split')),
    
    -- Risk assessment
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    fraud_flags JSONB,
    
    -- Metadata
    metadata JSONB,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User wallets table for trust system
CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Wallet balances (for future digital wallet features)
    available_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    pending_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    escrow_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    
    -- Cash transaction limits
    daily_cash_limit DECIMAL(8,2) NOT NULL DEFAULT 100.00,
    weekly_cash_limit DECIMAL(8,2) NOT NULL DEFAULT 500.00,
    monthly_cash_limit DECIMAL(8,2) NOT NULL DEFAULT 2000.00,
    
    -- Current usage tracking
    daily_cash_used DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    weekly_cash_used DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    monthly_cash_used DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Verification levels
    verification_level verification_level NOT NULL DEFAULT 'basic',
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    id_verified BOOLEAN NOT NULL DEFAULT FALSE,
    address_verified BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Trust score (0-100)
    trust_score INTEGER NOT NULL DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
    completed_cash_transactions INTEGER NOT NULL DEFAULT 0,
    disputed_transactions INTEGER NOT NULL DEFAULT 0,
    successful_transactions INTEGER NOT NULL DEFAULT 0,
    
    -- Risk tracking
    total_transaction_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    average_transaction_value DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    last_trust_score_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Security flags
    is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    suspension_reason TEXT,
    suspended_until TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trust holds table for temporary restrictions during transactions
CREATE TABLE trust_holds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES cash_transactions(id) ON DELETE CASCADE,
    amount DECIMAL(8,2) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Cash disputes table
CREATE TABLE cash_disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES cash_transactions(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    evidence JSONB,
    priority INTEGER NOT NULL DEFAULT 50,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    assigned_to UUID REFERENCES users(id), -- Admin user
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_cash_transactions_booking_id ON cash_transactions(booking_id);
CREATE INDEX idx_cash_transactions_rider_id ON cash_transactions(rider_id);
CREATE INDEX idx_cash_transactions_driver_id ON cash_transactions(driver_id);
CREATE INDEX idx_cash_transactions_status ON cash_transactions(status);
CREATE INDEX idx_cash_transactions_created_at ON cash_transactions(created_at);
CREATE INDEX idx_cash_transactions_expires_at ON cash_transactions(expires_at);
CREATE INDEX idx_cash_transactions_risk_score ON cash_transactions(risk_score);

CREATE UNIQUE INDEX idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX idx_user_wallets_trust_score ON user_wallets(trust_score);
CREATE INDEX idx_user_wallets_verification_level ON user_wallets(verification_level);
CREATE INDEX idx_user_wallets_is_suspended ON user_wallets(is_suspended);

CREATE INDEX idx_trust_holds_user_id ON trust_holds(user_id);
CREATE INDEX idx_trust_holds_expires_at ON trust_holds(expires_at);

CREATE INDEX idx_cash_disputes_transaction_id ON cash_disputes(transaction_id);
CREATE INDEX idx_cash_disputes_status ON cash_disputes(status);
CREATE INDEX idx_cash_disputes_priority ON cash_disputes(priority);

-- Add cash payment method to existing payment_method enum
ALTER TYPE payment_method ADD VALUE 'cash';

-- Update bookings table to support cash payments
ALTER TABLE bookings ADD COLUMN cash_transaction_id UUID REFERENCES cash_transactions(id);
CREATE INDEX idx_bookings_cash_transaction_id ON bookings(cash_transaction_id);

-- Add trust score to users table for easy access
ALTER TABLE users ADD COLUMN trust_score INTEGER DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100);
CREATE INDEX idx_users_trust_score ON users(trust_score);

-- Create function to automatically create wallet for new users
CREATE OR REPLACE FUNCTION create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_wallets (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create wallet when user is created
CREATE TRIGGER trigger_create_user_wallet
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_wallet();

-- Create function to update user trust score from wallet
CREATE OR REPLACE FUNCTION sync_user_trust_score()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET trust_score = NEW.trust_score 
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync trust score changes
CREATE TRIGGER trigger_sync_trust_score
    AFTER UPDATE OF trust_score ON user_wallets
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_trust_score();

-- Create function to clean up expired transactions
CREATE OR REPLACE FUNCTION cleanup_expired_cash_transactions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE cash_transactions 
    SET status = 'expired'
    WHERE status = 'pending_verification' 
    AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE cash_transactions IS 'Cash payment transactions with dual verification system';
COMMENT ON TABLE user_wallets IS 'User trust scores and transaction limits for cash payments';
COMMENT ON TABLE trust_holds IS 'Temporary holds on user trust during active transactions';
COMMENT ON TABLE cash_disputes IS 'Disputes related to cash payment transactions';

COMMENT ON COLUMN cash_transactions.rider_confirmation_code IS 'Unique code rider uses to confirm payment';
COMMENT ON COLUMN cash_transactions.driver_confirmation_code IS 'Unique code driver uses to confirm receipt';
COMMENT ON COLUMN cash_transactions.risk_score IS 'Fraud risk score (0-100, higher is riskier)';
COMMENT ON COLUMN user_wallets.trust_score IS 'User trust score (0-100, higher is more trustworthy)';

-- Success message
SELECT 'Cash Payment System migration completed successfully' as result;