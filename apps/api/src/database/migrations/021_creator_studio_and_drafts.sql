-- ============================================================================
-- Migration: 021_creator_studio_and_drafts.sql
-- Creator Studio: Editing Recipe, Accessible Subtitles, Licensed Sounds,
-- Resilient Drafts, Duplicate Publish Prevention & Timezone-Safe Scheduling.
-- STRICT ZERO-LOCATION: 0 GPS, 0 IP coordinates.
-- ============================================================================

-- 1. Extend reel_drafts with full creator studio editing recipe
ALTER TABLE reel_drafts
  ADD COLUMN IF NOT EXISTS client_draft_id VARCHAR(128) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(16) DEFAULT '9:16',
  ADD COLUMN IF NOT EXISTS trim_start_ms INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trim_end_ms INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cover_frame_timestamp_ms INT DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS crop_rect JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subtitles JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS text_overlays JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audio_controls JSONB DEFAULT '{"originalVolume": 1.0, "soundVolume": 1.0, "isMuted": false, "soundStartOffsetMs": 0}'::jsonb,
  ADD COLUMN IF NOT EXISTS sound_id UUID REFERENCES audio_tracks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(30) NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_remix BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_commercial BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS brand_name VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_reel_drafts_client_id ON reel_drafts(user_id, client_draft_id) WHERE client_draft_id IS NOT NULL;

-- 2. Extend reels with studio controls and idempotency key
ALTER TABLE reels
  ADD COLUMN IF NOT EXISTS client_publication_id VARCHAR(128) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(16) DEFAULT '9:16',
  ADD COLUMN IF NOT EXISTS trim_start_ms INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trim_end_ms INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subtitles JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS text_overlays JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audio_controls JSONB DEFAULT '{"originalVolume": 1.0, "soundVolume": 1.0, "isMuted": false, "soundStartOffsetMs": 0}'::jsonb,
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_remix BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_commercial BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS brand_name VARCHAR(100) DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reels_client_publication_id ON reels(client_publication_id) WHERE client_publication_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reels_creator_status ON reels(creator_id, status);

-- 3. Extend audio_tracks with licensing metadata
ALTER TABLE audio_tracks
  ADD COLUMN IF NOT EXISTS is_licensed BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS license_type VARCHAR(50) DEFAULT 'CREATIVE_COMMONS',
  ADD COLUMN IF NOT EXISTS attribution_text VARCHAR(255) DEFAULT NULL;

-- 4. Creator Publishing Sessions Table (Publishing Status Recovery)
CREATE TABLE IF NOT EXISTS creator_publishing_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reel_id UUID REFERENCES reels(id) ON DELETE CASCADE,
    client_publication_id VARCHAR(128) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'UPLOADING', -- 'UPLOADING', 'PROCESSING', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'CANCELLED'
    stage VARCHAR(50) NOT NULL DEFAULT 'INIT', -- 'INIT', 'UPLOAD_PARTS', 'FINALIZING', 'TRANSCODING', 'READY'
    progress_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    error_message TEXT DEFAULT NULL,
    manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_publishing_session_client_id UNIQUE (user_id, client_publication_id)
);

CREATE INDEX IF NOT EXISTS idx_pub_sessions_user_status ON creator_publishing_sessions(user_id, status);
