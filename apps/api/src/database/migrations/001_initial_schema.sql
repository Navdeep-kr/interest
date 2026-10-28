-- ============================================================================
-- Migration: 001_initial_schema.sql (Complete Production Schema)
-- Project: "Interest" - The Pure Interest-Driven Short-Video Platform
-- IMMUTABLE RULE: NO IP, NO GPS, NO LATITUDE/LONGITUDE, NO COUNTRY IN ANY TABLE.
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ----------------------------------------------------------------------------
-- 1. Users Table (Core Auth & Vector Centroid)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    birthdate DATE,
    is_minor BOOLEAN NOT NULL DEFAULT FALSE,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMPTZ,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,
    interest_vector vector(512), -- Dynamic user interest embedding centroid
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Profiles Table (Display Identity & Content Preferences)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    preferred_languages TEXT[] NOT NULL DEFAULT ARRAY['en'], -- Audio/sub preference (NOT from geo)
    reels_count INT NOT NULL DEFAULT 0,
    followers_count INT NOT NULL DEFAULT 0,
    following_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- ----------------------------------------------------------------------------
-- 3. Interests Table (Hierarchical 3-Tier Taxonomy Tree)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES interests(id) ON DELETE CASCADE,
    level INT NOT NULL DEFAULT 0, -- 0: Root Category, 1: Sub-genre, 2: Deep Niche
    icon VARCHAR(50),
    vector vector(512) NOT NULL, -- Static 512-d unit vector representing topic
    reels_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interests_parent_id ON interests(parent_id);
CREATE INDEX IF NOT EXISTS idx_interests_level ON interests(level);

-- ----------------------------------------------------------------------------
-- 4. User Interests Table (Personal Affinities with Dynamic Weights)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_interests (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
    affinity_weight REAL NOT NULL DEFAULT 1.0, -- Shifts continuously via watch telemetry
    is_muted BOOLEAN NOT NULL DEFAULT FALSE,   -- Completely hides topic from feed
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,  -- Freezes weight adaptation
    interaction_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, interest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_interests_user_weight ON user_interests(user_id, affinity_weight DESC);

-- ----------------------------------------------------------------------------
-- 5. Reels Table (Video Content & Multimodal Embeddings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    caption TEXT,
    hls_master_url TEXT,
    thumbnail_url TEXT,
    audio_url TEXT,
    visibility VARCHAR(30) NOT NULL DEFAULT 'PUBLIC',
    error_reason TEXT,
    cover_timestamp_seconds NUMERIC(6, 2) DEFAULT 1.0,
    raw_s3_key TEXT,
    upload_id TEXT,
    hashtags TEXT[] DEFAULT '{}'::TEXT[],
    duration_seconds NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
    embedding vector(512), -- Multimodal 512-d embedding (Vision + Whisper audio)
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_UPLOAD',
    view_count BIGINT NOT NULL DEFAULT 0,
    like_count BIGINT NOT NULL DEFAULT 0,
    comment_count BIGINT NOT NULL DEFAULT 0,
    save_count BIGINT NOT NULL DEFAULT 0,
    share_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. Reel Interests Mapping (Topic Tagging)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reel_interests (
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (reel_id, interest_id)
);

CREATE INDEX IF NOT EXISTS idx_reel_interests_interest ON reel_interests(interest_id, is_primary);

-- ----------------------------------------------------------------------------
-- 7. Reel Media Table (Multi-Bitrate HLS Assets)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reel_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    raw_s3_key TEXT NOT NULL,
    hls_master_url TEXT,
    thumbnail_url TEXT,
    variants JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"1080p": "url", "720p": "url", "480p": "url"}
    width INT NOT NULL DEFAULT 1080,
    height INT NOT NULL DEFAULT 1920,
    aspect_ratio VARCHAR(10) NOT NULL DEFAULT '9:16',
    bitrate_kbps INT,
    codec VARCHAR(30) NOT NULL DEFAULT 'h264',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reel_media_reel_id ON reel_media(reel_id);

-- ----------------------------------------------------------------------------
-- 8. Likes Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS likes (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, reel_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_reel_created ON likes(reel_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 9. Comments Table (Threaded Discussions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    text VARCHAR(1000) NOT NULL,
    like_count INT NOT NULL DEFAULT 0,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_reel_created ON comments(reel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- ----------------------------------------------------------------------------
-- 10. Saves / Bookmarks Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saves (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, reel_id)
);

CREATE INDEX IF NOT EXISTS idx_saves_user_created ON saves(user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 11. Shares Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL DEFAULT 'internal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shares_reel ON shares(reel_id);

-- ----------------------------------------------------------------------------
-- 12. Follows Table (Subscription Graph)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT chk_no_self_follow CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ----------------------------------------------------------------------------
-- 13. Watch Events Table (Behavioral Telemetry - Zero Location Logged)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS watch_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    duration_ms INT NOT NULL,
    watched_ms INT NOT NULL,
    watch_ratio REAL NOT NULL,
    loop_count INT NOT NULL DEFAULT 0,
    action VARCHAR(30) NOT NULL, -- 'QUICK_SKIP', 'WATCH_PARTIAL', 'WATCH_COMPLETE', 'LOOP'
    session_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watch_events_user_created ON watch_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_events_reel_action ON watch_events(reel_id, action);

-- ----------------------------------------------------------------------------
-- 14. Hashtags & Reel Hashtags Mapping
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hashtags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag VARCHAR(100) UNIQUE NOT NULL,
    reels_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reel_hashtags (
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    hashtag_id UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
    PRIMARY KEY (reel_id, hashtag_id)
);

CREATE INDEX IF NOT EXISTS idx_reel_hashtags_tag ON reel_hashtags(hashtag_id);

-- ----------------------------------------------------------------------------
-- 15. Reports Table (Content Moderation & Spam Detection)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_reel_id UUID REFERENCES reels(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL, -- 'spam', 'nsfw', 'tag_manipulation', 'violence', 'harassment'
    details TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- ----------------------------------------------------------------------------
-- 16. Blocks Table (User-Level Trust & Safety)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blocks (
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT chk_no_self_block CHECK (blocker_id != blocked_id)
);

-- ----------------------------------------------------------------------------
-- 17. Notifications Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'LIKE', 'COMMENT', 'FOLLOW', 'REEL_PUBLISHED', 'INTEREST_DISCOVERY'
    entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;

-- ----------------------------------------------------------------------------
-- 18. Conversations Table (1-on-1 Direct Messaging)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ordered_pair CHECK (participant_a_id < participant_b_id),
    CONSTRAINT uq_conversation_pair UNIQUE (participant_a_id, participant_b_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON conversations(participant_a_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON conversations(participant_b_id, last_message_at DESC);

-- ----------------------------------------------------------------------------
-- 19. Messages Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    attached_reel_id UUID REFERENCES reels(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 20. Subscriptions Table (Niche Patronage & Creator Series)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscriber_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_id UUID REFERENCES interests(id) ON DELETE SET NULL,
    stripe_subscription_id VARCHAR(100) UNIQUE,
    amount_cents INT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    current_period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_creator ON subscriptions(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id, status);

-- ----------------------------------------------------------------------------
-- 21. User Sessions Table (Device and Session Management - Zero Location)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    device_name VARCHAR(100),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, revoked);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- ----------------------------------------------------------------------------
-- 22. Payouts Table (Creator Earnings & Payout Runs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payout_id VARCHAR(100) UNIQUE,
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payouts_creator ON payouts(creator_id, initiated_at DESC);

-- ============================================================================
-- HIGH-PERFORMANCE INDEXES & PGVECTOR HNSW COSINE SEARCH
-- ============================================================================

-- 1. HNSW Vector Cosine Indexes (512 Dimensions)
-- Parameters: m=16 (bidirectional link density), ef_construction=64 (build quality)
CREATE INDEX IF NOT EXISTS idx_reels_embedding_hnsw 
ON reels 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_users_interest_vector_hnsw 
ON users 
USING hnsw (interest_vector vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_interests_vector_hnsw 
ON interests 
USING hnsw (vector vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 2. Feed Query Optimization Indexes
-- Compound index to filter published reels instantly
CREATE INDEX IF NOT EXISTS idx_reels_published_feed 
ON reels (status, created_at DESC) 
WHERE status = 'PUBLISHED';

-- Compound index for creator studio views
CREATE INDEX IF NOT EXISTS idx_reels_creator_status 
ON reels (creator_id, status, created_at DESC);

-- Engagement index for trending exploration ranking
CREATE INDEX IF NOT EXISTS idx_reels_exploration_ranking 
ON reels (status, like_count DESC, view_count DESC) 
WHERE status = 'PUBLISHED';
