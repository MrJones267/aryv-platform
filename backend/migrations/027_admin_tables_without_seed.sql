-- =====================================================================
-- Migration 027: Create the admin tables, with no seeded accounts
-- Author: Oabona-Majoko
-- Created: 2026-09-01
--
-- Purpose:
--   The admin panel cannot work in production: `admin_users` does not exist
--   there, so every sign-in fails. Migrations 001-012 were recorded as applied
--   by `db:migrate baseline` without ever running, and migration 003 — which
--   creates these tables — is one of them.
--
--   Applying 003 now is not the answer, and that is the whole reason this
--   migration exists. 003 ends with an unconditional INSERT seeding
--   `admin@aryv-app.com` and `moderator@aryv-app.com` with the bcrypt hash of
--   `admin123`, a password named in a comment on the line above it, in a
--   public repository. Migration 026 disables exactly those rows — but 026 is
--   already recorded as applied and the runner never re-runs an applied file
--   (`pending = files.filter(f => !applied.has(f))`). So running 003 today
--   would create the seeded super-administrator and leave nothing to disable
--   it.
--
--   This creates the same schema 003 does, minus the seed. Administrators are
--   created deliberately instead:
--
--     ADMIN_EMAIL=you@aryv-app.com ADMIN_ROLE=super_admin \
--       npm run admin:create --workspace backend
--
-- Idempotent throughout:
--   Every object is guarded, so this is a no-op on any database that already
--   ran 003 for real. It does not touch existing rows, and it does not undo
--   026 — an account 026 disabled stays disabled.
--
-- Deliberately excludes the cash wallet tables. Migration 004 was baselined
-- the same way, and creating `cash_wallet_transactions` has its own trap: the
-- load-idempotency index from migration 025 would be absent (025 is already
-- recorded as applied), and the startup check requires that index once the
-- table exists — the API would refuse to boot. If the wallet is ever wanted,
-- its tables and that index must be created together.
-- =====================================================================

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

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_users_lockout ON admin_users(lockout_until) WHERE lockout_until IS NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_resource ON admin_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);

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

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions(is_active) WHERE is_active = true;

-- `updated_at` maintenance. CREATE OR REPLACE is already idempotent; the
-- trigger is dropped first because CREATE TRIGGER has no IF NOT EXISTS before
-- PostgreSQL 14, and this must run on whatever version is deployed.
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_admin_users_updated_at ON admin_users;
CREATE TRIGGER trigger_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_users_updated_at();

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

COMMENT ON TABLE admin_users IS 'Admin users with role-based permissions. Created only by npm run admin:create — never seeded, because a seeded password in version control is a published credential.';
COMMENT ON TABLE admin_audit_logs IS 'Audit trail for all admin actions performed in the system';
COMMENT ON TABLE admin_sessions IS 'Active admin sessions for JWT token management';

COMMENT ON COLUMN admin_users.role IS 'Admin role: super_admin (full access), admin (standard access), moderator (limited access)';
COMMENT ON COLUMN admin_users.permissions IS 'JSON array of specific permissions for granular access control';
COMMENT ON COLUMN admin_users.failed_login_attempts IS 'Counter for failed login attempts, reset on successful login';
COMMENT ON COLUMN admin_users.lockout_until IS 'Account lockout timestamp after multiple failed attempts';

-- Belt and braces. If this ever runs on a database that did apply 003 for real
-- before 026, those rows are already disabled and this changes nothing. If the
-- ordering were ever different, it closes the seeded accounts again rather
-- than trusting that 026 got there first.
UPDATE admin_users
SET is_active = false,
    password_hash = '$2a$12$Fh2DRm.L5KyZKZVS8cryBuMtPul5aztfW6Aje8.kvzsMmRnON3pvq',
    updated_at = NOW()
WHERE password_hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm';
