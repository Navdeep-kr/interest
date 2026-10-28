-- ============================================================================
-- Migration: 006_social_collections_and_remix.sql
-- Social Interactions: Collections, Comment Likes, Moderation, Remix & Duet
-- IMMUTABLE RULE: NO LOCATION, NO IP, NO GPS, NO PROXIMITY.
-- ============================================================================

-- 1. Comment Likes Table (User likes on specific comments)
CREATE TABLE IF NOT EXISTS comment_likes (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON comment_likes(user_id);

-- 2. Moderation flag on comments (Creator moderation: hiding offensive or spam comments)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_comments_moderation ON comments(reel_id, is_hidden, is_pinned);

-- 3. Collections Table (Custom user folders for organizing saved reels)
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    reels_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_user_created ON collections(user_id, created_at DESC);

-- 4. Collection Reels Mapping Table
CREATE TABLE IF NOT EXISTS collection_reels (
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_id, reel_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_reels_reel ON collection_reels(reel_id);
CREATE INDEX IF NOT EXISTS idx_collection_reels_collection_created ON collection_reels(collection_id, created_at DESC);

-- 5. Remix & Duet Lineage Columns on Reels Table
ALTER TABLE reels ADD COLUMN IF NOT EXISTS remix_of_reel_id UUID REFERENCES reels(id) ON DELETE SET NULL;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS remix_type VARCHAR(20) DEFAULT NULL; -- 'DUET', 'REMIX', 'AUDIO_USE'
ALTER TABLE reels ADD COLUMN IF NOT EXISTS allow_duet BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS allow_remix BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_reels_remix_of ON reels(remix_of_reel_id) WHERE remix_of_reel_id IS NOT NULL;
