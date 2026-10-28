-- ============================================================================
-- Migration: 016_profiles_and_social_graph.sql
-- Profiles & Social Graph: Private Accounts, Follow Requests, User Restrictions,
-- Profile Privacy Controls, and Links.
-- STRICT INVARIANT: ZERO IP, ZERO GPS, ZERO LOCATION PERMISSIONS OR COLUMNS.
-- ============================================================================

-- 1. Enhance Profiles Table with Privacy Controls & Social Links
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_follower_count BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_following_count BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allow_tagging VARCHAR(20) NOT NULL DEFAULT 'EVERYONE';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allow_mentions VARCHAR(20) NOT NULL DEFAULT 'EVERYONE';

CREATE INDEX IF NOT EXISTS idx_profiles_is_private ON profiles(is_private);

-- 2. Follow Requests Table (For Private Account Ingestion)
CREATE TABLE IF NOT EXISTS follow_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'REJECTED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_follow_request UNIQUE (requester_id, target_id),
    CONSTRAINT chk_no_self_follow_request CHECK (requester_id != target_id)
);

CREATE INDEX IF NOT EXISTS idx_follow_requests_target_pending ON follow_requests(target_id, created_at DESC) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_follow_requests_requester ON follow_requests(requester_id);

-- 3. User Restricts Table (Safety Feature: Shadow Limitation on DMs/Comments)
CREATE TABLE IF NOT EXISTS user_restricts (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restricted_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, restricted_user_id),
    CONSTRAINT chk_no_self_restrict CHECK (user_id != restricted_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_restricts_user ON user_restricts(user_id);
