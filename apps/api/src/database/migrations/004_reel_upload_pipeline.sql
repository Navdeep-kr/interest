-- 004_reel_upload_pipeline.sql
-- Add upload pipeline, metadata stripping, and visibility support to reels table

ALTER TABLE reels ADD COLUMN IF NOT EXISTS hls_master_url TEXT;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS visibility VARCHAR(30) NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE reels ADD COLUMN IF NOT EXISTS error_reason TEXT;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS cover_timestamp_seconds NUMERIC(6, 2) DEFAULT 1.0;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS raw_s3_key TEXT;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS upload_id TEXT;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS hashtags TEXT[] DEFAULT '{}'::TEXT[];

-- Ensure index on status for pipeline tracking and feed queries
CREATE INDEX IF NOT EXISTS idx_reels_status_created ON reels(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_visibility ON reels(visibility);
