-- ============================================================================
-- Migration: 010_trust_and_safety_system.sql
-- Trust & Safety System: Pre-publish checks, Reports, Block/Mute,
-- Comment & Keyword Filters, Moderator Queue, Appeals, Minor Safety,
-- Bot/Fake Engagement, and AI-Generated Content Labeling.
-- IMMUTABLE RULE: NO IP, NO GPS, NO PROXIMITY, NO LOCATION COORDINATES.
-- ============================================================================

-- 1. Enhance Reports Table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_message_id UUID REFERENCES messages(id) ON DELETE CASCADE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'SPAM_SCAM';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS severity_level VARCHAR(20) NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS priority_score REAL NOT NULL DEFAULT 50.0;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS moderator_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS moderator_notes TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS action_taken VARCHAR(50);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority_score DESC) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_reports_target_reel ON reports(reported_reel_id) WHERE reported_reel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_target_user ON reports(reported_user_id) WHERE reported_user_id IS NOT NULL;

-- 2. User Mutes Table (Silent user muting without notifying counterparty)
CREATE TABLE IF NOT EXISTS user_mutes (
    muter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    muted_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (muter_id, muted_id),
    CONSTRAINT chk_no_self_mute CHECK (muter_id != muted_id)
);

CREATE INDEX IF NOT EXISTS idx_user_mutes_muter ON user_mutes(muter_id);

-- 3. User Keyword Filters Table (Custom keywords blocked from creator's comment sections)
CREATE TABLE IF NOT EXISTS user_keyword_filters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keyword VARCHAR(100) NOT NULL,
    is_regex BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_keyword UNIQUE (user_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_user_keyword_filters_user ON user_keyword_filters(user_id);

-- 4. Enhance Comments Table for Moderation & Synthetic Engagement Tracking
ALTER TABLE comments ADD COLUMN IF NOT EXISTS hidden_reason VARCHAR(50);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. Enhance Reels Table for Trust & Safety, Age Restriction, and AI Labeling
ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS ai_label_type VARCHAR(32) NOT NULL DEFAULT 'NONE'; -- 'NONE', 'CREATOR_DISCLOSED', 'AI_DETECTED', 'MODERATOR_ENFORCED'
ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_age_restricted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_SCAN'; -- 'PENDING_SCAN', 'APPROVED', 'FLAGGED', 'REJECTED'
ALTER TABLE reels ADD COLUMN IF NOT EXISTS moderation_scores JSONB DEFAULT '{}'::JSONB;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS moderation_rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_reels_moderation_status ON reels(moderation_status);
CREATE INDEX IF NOT EXISTS idx_reels_age_restricted ON reels(is_age_restricted);
CREATE INDEX IF NOT EXISTS idx_reels_ai_generated ON reels(is_ai_generated);

-- 6. Copyrighted Audio Registry Table (Audio fingerprints of licensed / copyrighted works)
CREATE TABLE IF NOT EXISTS copyrighted_audio_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    artist VARCHAR(200) NOT NULL,
    rights_holder VARCHAR(200) NOT NULL,
    audio_fingerprint VARCHAR(128) NOT NULL UNIQUE,
    allowed_for_remix BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copyright_fingerprint ON copyrighted_audio_registry(audio_fingerprint);

-- Seed Reference Audio Fingerprints
INSERT INTO copyrighted_audio_registry (title, artist, rights_holder, audio_fingerprint, allowed_for_remix)
VALUES
    ('Midnight Neon Symphony', 'Apex Synth Lab', 'Universal Sound Global', 'fp_apex_synth_001_a9c4', FALSE),
    ('Solar Flare Bassline', 'Vapor Grid', 'Sony Music Ent', 'fp_vapor_grid_002_d3f1', FALSE),
    ('Quantum Strings in D Minor', 'Orchestra 2099', 'Warner Chappell', 'fp_quant_orch_003_e7b2', FALSE),
    ('Lo-Fi Coffee Rain', 'Chillington Beats', 'Open Creator Collective', 'fp_chill_open_004_f1a8', TRUE)
ON CONFLICT (audio_fingerprint) DO NOTHING;

-- 7. Moderation Queue Table (Admin & Moderator triage queue)
CREATE TABLE IF NOT EXISTS moderation_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(30) NOT NULL, -- 'REEL', 'COMMENT', 'USER', 'MESSAGE'
    entity_id UUID NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'
    priority_score REAL NOT NULL DEFAULT 50.0,
    reasons TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    report_count INT NOT NULL DEFAULT 1,
    assigned_moderator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ai_moderation_scores JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_queue_status_priority ON moderation_queue(status, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_mod_queue_entity ON moderation_queue(entity_type, entity_id);

-- 8. User Strikes Table (3-Strike Policy System)
CREATE TABLE IF NOT EXISTS user_strikes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    moderation_queue_id UUID REFERENCES moderation_queue(id) ON DELETE SET NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id UUID NOT NULL,
    reason VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'STANDARD', -- 'WARNING', 'STANDARD', 'SEVERE'
    expires_at TIMESTAMPTZ NOT NULL, -- Strikes expire after 90 days
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_strikes_user ON user_strikes(user_id, expires_at);

-- 9. Moderation Appeals Table (Creator takedown & strike appeals)
CREATE TABLE IF NOT EXISTS moderation_appeals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(30) NOT NULL, -- 'REEL', 'COMMENT', 'STRIKE', 'ACCOUNT_SUSPENSION'
    entity_id UUID NOT NULL,
    statement TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED_REINSTATED', 'REJECTED'
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_appeals_status ON moderation_appeals(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_mod_appeals_user ON moderation_appeals(user_id);

-- 10. Minor Safety & Profile Defaults
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS minor_safety_enforced BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS personalized_ads_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS strict_comment_filtering BOOLEAN NOT NULL DEFAULT FALSE;

-- Automatically enforce minor defaults for users where is_minor is true
UPDATE profiles
SET minor_safety_enforced = TRUE,
    personalized_ads_enabled = FALSE,
    strict_comment_filtering = TRUE
WHERE user_id IN (SELECT id FROM users WHERE is_minor = TRUE);
