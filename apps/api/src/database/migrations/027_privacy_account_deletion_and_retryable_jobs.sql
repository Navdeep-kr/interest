-- ============================================================================
-- Migration: 027_privacy_account_deletion_and_retryable_jobs.sql
-- Project: "Interest" - Privacy Controls & Retryable Deletion Architecture
-- IMMUTABLE ZERO-LOCATION RULE: 0 GPS, 0 IP coordinates, NO geographic attributes.
-- ============================================================================

-- 1. Privacy Settings on Profiles Table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private_account BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allow_search_discovery BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS messaging_permission VARCHAR(20) NOT NULL DEFAULT 'EVERYONE';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commenting_permission VARCHAR(20) NOT NULL DEFAULT 'EVERYONE';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activity_status_visible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_private_account ON profiles(is_private_account);
CREATE INDEX IF NOT EXISTS idx_profiles_search_discovery ON profiles(allow_search_discovery);

-- 2. Retryable Account Deletion Jobs Table
CREATE TABLE IF NOT EXISTS account_deletion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES account_deletion_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
    current_step VARCHAR(40) NOT NULL DEFAULT 'INIT',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    last_error TEXT,
    step_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deletion_jobs_status ON account_deletion_jobs(status, retry_count);
CREATE INDEX IF NOT EXISTS idx_deletion_jobs_user ON account_deletion_jobs(user_id);
