-- ============================================================================
-- Migration: 017_posts_reels_and_engagement.sql
-- Posts, Reels, Pinned Content, Image Posts, and Content Hiding
-- STRICT INVARIANT: ZERO IP, ZERO GPS, ZERO LOCATION PERMISSIONS OR COLUMNS.
-- ============================================================================

-- 1. Enhance Reels Table with Pinned Content & Media Types
ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) NOT NULL DEFAULT 'VIDEO'; -- 'VIDEO', 'IMAGE'
ALTER TABLE reels ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

CREATE INDEX IF NOT EXISTS idx_reels_creator_pinned ON reels(creator_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_visibility ON reels(visibility, status);

-- 2. User Hidden Reels Table (Hiding content from viewer's feed & profile views)
CREATE TABLE IF NOT EXISTS user_hidden_reels (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, reel_id)
);

CREATE INDEX IF NOT EXISTS idx_user_hidden_reels_user ON user_hidden_reels(user_id);
