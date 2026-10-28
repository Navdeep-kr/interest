-- ============================================================================
-- Migration: 007_creator_tools_and_analytics.sql
-- Creator Tools: Drafts, Scheduling, and Interest-Based Analytics
-- IMMUTABLE RULE: NO LOCATION, NO IP, NO GPS, NO PROXIMITY, NO COUNTRY, NO CITY.
-- Audience analytics MUST be broken down by interest affinities ONLY.
-- ============================================================================

-- 1. Reel Drafts Table (In-App Editor state persistence)
CREATE TABLE IF NOT EXISTS reel_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) DEFAULT '',
    caption TEXT DEFAULT '',
    primary_interest_id UUID REFERENCES interests(id) ON DELETE SET NULL,
    secondary_tag_ids UUID[] DEFAULT '{}'::UUID[],
    hashtags TEXT[] DEFAULT '{}'::TEXT[],
    cover_timestamp NUMERIC(6, 2) DEFAULT 1.0,
    video_uri TEXT,
    editor_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reel_drafts_user ON reel_drafts(user_id, updated_at DESC);

-- 2. Add scheduling support and editor metadata to reels table
ALTER TABLE reels ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS editor_metadata JSONB DEFAULT '{}'::jsonb;

-- Index for cron processor to quickly find due scheduled reels
CREATE INDEX IF NOT EXISTS idx_reels_scheduled_at
ON reels(scheduled_at)
WHERE status = 'SCHEDULED' AND scheduled_at IS NOT NULL;

-- 3. Reel Engagements Table (If not already created for behavioral telemetry)
CREATE TABLE IF NOT EXISTS reel_engagements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    duration_ms INT NOT NULL,
    watched_ms INT NOT NULL,
    watch_ratio REAL NOT NULL,
    loop_count INT NOT NULL DEFAULT 0,
    action VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reel_engagements_reel_created ON reel_engagements(reel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reel_engagements_user_created ON reel_engagements(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reel_engagements_ratio ON reel_engagements(reel_id, watch_ratio);
