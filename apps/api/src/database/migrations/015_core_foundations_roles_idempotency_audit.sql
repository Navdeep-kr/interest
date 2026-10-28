-- ============================================================================
-- Migration: 015_core_foundations_roles_idempotency_audit.sql
-- Project: "Interest" - Backend & Database Foundations
-- Scope: User RBAC Roles, Idempotency Ledger, Schema Migration Registry
-- STRICT ARCHITECTURAL INVARIANT: ZERO-LOCATION COMPLIANT.
-- Absolutely NO IP address, NO GPS coordinates, NO geocoding columns.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. User Roles & RBAC (Broken Function Level Authorization Defense)
-- ----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'USER';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_role
            CHECK (role IN ('USER', 'CREATOR', 'MODERATOR', 'ADMIN', 'SUPERADMIN'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ----------------------------------------------------------------------------
-- 2. Idempotency Keys Ledger (Financial & Mutating Request Deduplication)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(128) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status_code INT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_user ON idempotency_keys(user_id);

-- ----------------------------------------------------------------------------
-- 3. Schema Migrations Ledger (Repeatable, Ordered, Checksum-Verified Migrations)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    checksum VARCHAR(64) NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    execution_time_ms INT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(name);
