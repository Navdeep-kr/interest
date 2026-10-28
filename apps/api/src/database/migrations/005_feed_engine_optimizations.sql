-- ============================================================================
-- Migration: 005_feed_engine_optimizations.sql
-- Optimizations for Interest-Based Multi-Source Feed Engine & Test Audience
-- IMMUTABLE RULE: NO LOCATION, NO IP, NO GPS, NO PROXIMITY.
-- ============================================================================

-- 1. Add quick skip tracking and test audience delivery counters to reels
ALTER TABLE reels ADD COLUMN IF NOT EXISTS quick_skip_count INT NOT NULL DEFAULT 0;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS test_audience_delivered INT NOT NULL DEFAULT 0;

-- 2. Partial index for fast retrieval of emerging reels in the guaranteed test audience pool (< 500 views)
CREATE INDEX IF NOT EXISTS idx_reels_test_audience_pool
ON reels(status, test_audience_delivered, created_at DESC)
WHERE status = 'PUBLISHED' AND test_audience_delivered < 500;

-- 3. Composite index for trending candidate generation by interest
CREATE INDEX IF NOT EXISTS idx_reel_interests_trending
ON reel_interests(interest_id, is_primary);

-- 4. Composite index for fast following feed retrieval
CREATE INDEX IF NOT EXISTS idx_follows_feed
ON follows(follower_id, following_id);

-- 5. Fast lookup for user-level blocks in feed filtering
CREATE INDEX IF NOT EXISTS idx_blocks_filter
ON blocks(blocker_id, blocked_id);

-- 6. Fast lookup for muted and paused interests during candidate filtering
CREATE INDEX IF NOT EXISTS idx_user_interests_status
ON user_interests(user_id, is_muted, is_paused);
