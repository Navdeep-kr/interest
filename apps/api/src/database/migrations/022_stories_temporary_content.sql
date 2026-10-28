-- ============================================================================
-- Migration: 022_stories_temporary_content.sql
-- Ephemeral Stories: 24h Server-Authoritative Expiry, Audience Visibility,
-- Viewing Progress, Reactions, Close Friends, Moderation & Reporting.
-- STRICT ZERO-LOCATION: 0 GPS, 0 IP coordinates, zero location tracking.
-- ============================================================================

-- 1. Stories Table (Temporary Photo/Video Content)
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type VARCHAR(10) NOT NULL DEFAULT 'PHOTO', -- 'PHOTO' | 'VIDEO'
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds REAL NOT NULL DEFAULT 5.0,
    caption TEXT DEFAULT '',
    text_overlays JSONB DEFAULT '[]'::jsonb,
    audience VARCHAR(20) NOT NULL DEFAULT 'PUBLIC', -- 'PUBLIC' | 'FOLLOWERS_ONLY' | 'CLOSE_FRIENDS'
    allow_replies VARCHAR(20) NOT NULL DEFAULT 'ALL', -- 'ALL' | 'FOLLOWERS' | 'OFF'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Indexes for lightning-fast active story queries and expiry filters
CREATE INDEX IF NOT EXISTS idx_stories_creator_active
    ON stories(creator_id, expires_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stories_expires_at
    ON stories(expires_at)
    WHERE deleted_at IS NULL;

-- 2. Close Friends Table (For Close Friends Audience Scope)
CREATE TABLE IF NOT EXISTS close_friends (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_close_friends_user ON close_friends(user_id);

-- 3. Story Views Table (Per-Viewer Segment Viewing Progress)
CREATE TABLE IF NOT EXISTS story_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    progress_percent REAL NOT NULL DEFAULT 1.0,
    completed BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_story_viewer UNIQUE (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_viewer ON story_views(viewer_id, story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id, viewed_at DESC);

-- 4. Story Reactions Table (Quick Emoji Reactions)
CREATE TABLE IF NOT EXISTS story_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(32) NOT NULL, -- '❤️', '🔥', '😂', '👏', '😮', '😢'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_story_reaction UNIQUE (story_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_story_reactions_story ON story_reactions(story_id);

-- 5. Story Reports Table (Content Moderation & Policy Enforcement)
CREATE TABLE IF NOT EXISTS story_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL, -- 'SPAM', 'HARASSMENT', 'HATE_SPEECH', 'INAPPROPRIATE', 'COPYRIGHT', 'OTHER'
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_story_report UNIQUE (story_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_story_reports_story ON story_reports(story_id);
