-- Add Google Auth support to existing users table
-- Run this migration to support Google OAuth

-- Add Google ID column if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS device_info JSONB,
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en';

-- Create index for Google ID
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);

-- Update existing users to have email auth provider
UPDATE users SET 
  auth_provider = 'email',
  is_verified = true 
WHERE auth_provider IS NULL;

-- Make password_hash optional for Google users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;