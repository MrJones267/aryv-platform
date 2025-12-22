-- Migration: Create admin_users table
-- Author: Claude-Code
-- Created: 2025-01-25
-- Description: Create admin users table with role-based permissions

-- Create admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'moderator')),
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE NULL,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    lockout_until TIMESTAMP WITH TIME ZONE NULL,
    two_factor_secret VARCHAR(255) NULL,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_active ON admin_users(is_active);
CREATE INDEX idx_admin_users_lockout ON admin_users(lockout_until) WHERE lockout_until IS NOT NULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_users_updated_at();

-- Insert default admin users
INSERT INTO admin_users (
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role, 
    permissions,
    is_active
) VALUES 
(
    'admin@aryv-app.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', -- bcrypt hash for 'admin123'
    'Super',
    'Admin',
    'super_admin',
    '["*"]'::jsonb,
    true
),
(
    'moderator@aryv-app.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', -- bcrypt hash for 'admin123'
    'Platform',
    'Moderator',
    'moderator',
    '["users.read", "users.block", "disputes.manage", "analytics.read"]'::jsonb,
    true
)
ON CONFLICT (email) DO NOTHING;

-- Create admin audit log table for tracking admin actions
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NULL,
    details JSONB NULL,
    ip_address INET NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for audit log performance
CREATE INDEX idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_user_id);
CREATE INDEX idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX idx_admin_audit_logs_resource ON admin_audit_logs(resource_type, resource_id);
CREATE INDEX idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);

-- Create admin sessions table for token management
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    refresh_token_hash VARCHAR(255) NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    ip_address INET NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for sessions
CREATE INDEX idx_admin_sessions_admin_id ON admin_sessions(admin_user_id);
CREATE INDEX idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);
CREATE INDEX idx_admin_sessions_active ON admin_sessions(is_active) WHERE is_active = true;

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_admin_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM admin_sessions 
    WHERE expires_at < NOW() OR is_active = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE admin_users IS 'Admin users with role-based permissions for platform management';
COMMENT ON TABLE admin_audit_logs IS 'Audit trail for all admin actions performed in the system';
COMMENT ON TABLE admin_sessions IS 'Active admin sessions for JWT token management';

COMMENT ON COLUMN admin_users.role IS 'Admin role: super_admin (full access), admin (standard access), moderator (limited access)';
COMMENT ON COLUMN admin_users.permissions IS 'JSON array of specific permissions for granular access control';
COMMENT ON COLUMN admin_users.failed_login_attempts IS 'Counter for failed login attempts, reset on successful login';
COMMENT ON COLUMN admin_users.lockout_until IS 'Account lockout timestamp after multiple failed attempts';

-- Grant necessary permissions (adjust based on your database user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON admin_users TO aryv_backend;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON admin_audit_logs TO aryv_backend;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON admin_sessions TO aryv_backend;