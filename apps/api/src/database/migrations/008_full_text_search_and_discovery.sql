-- ============================================================================
-- Migration: 008_full_text_search_and_discovery.sql
-- Description: Postgres Full-Text Search, pg_trgm indexes, Audio Tracks table,
--              Reels transcripts, and Trending Interests optimization.
-- Strict Zero-Location Architecture: 0% location weighting in ranking.
-- ============================================================================

-- Ensure pg_trgm extension for fuzzy & prefix matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------------------
-- 1. Audio Tracks Table (Soundtracks, Original Audio & Lo-Fi Beats)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audio_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  artist VARCHAR(200) NOT NULL,
  genre VARCHAR(100),
  audio_url TEXT NOT NULL,
  duration_seconds REAL NOT NULL DEFAULT 30.0,
  cover_url TEXT,
  reels_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigram & B-tree indexes for audio search
CREATE INDEX IF NOT EXISTS idx_audio_title_trgm ON audio_tracks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audio_artist_trgm ON audio_tracks USING gin (artist gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audio_reels_count ON audio_tracks (reels_count DESC);

-- Seed initial stock audio tracks if none exist
INSERT INTO audio_tracks (id, title, artist, genre, audio_url, duration_seconds, cover_url, reels_count)
VALUES
  ('11111111-0000-4000-a000-000000000001', 'Midnight Lo-Fi Chill', 'BeatCraft', 'Lo-Fi', 'https://cdn.interest.app/audio/lofi.mp3', 60.0, 'https://cdn.interest.app/audio/covers/lofi.jpg', 1420),
  ('11111111-0000-4000-a000-000000000002', 'Cyber Pulse Synthwave', 'NeonGrid', 'Electronic', 'https://cdn.interest.app/audio/synth.mp3', 45.0, 'https://cdn.interest.app/audio/covers/synth.jpg', 890),
  ('11111111-0000-4000-a000-000000000003', 'Deep Flow Coding', 'DevMode', 'Ambient', 'https://cdn.interest.app/audio/flow.mp3', 50.0, 'https://cdn.interest.app/audio/covers/ambient.jpg', 2340),
  ('11111111-0000-4000-a000-000000000004', 'Heavy Calisthenics Drive', 'BarBeast', 'High Energy', 'https://cdn.interest.app/audio/gym.mp3', 40.0, 'https://cdn.interest.app/audio/covers/gym.jpg', 670),
  ('11111111-0000-4000-a000-000000000005', 'Tokyo Sunset Chillhop', 'AestheticBeats', 'Lo-Fi', 'https://cdn.interest.app/audio/chillhop.mp3', 55.0, 'https://cdn.interest.app/audio/covers/sunset.jpg', 3150),
  ('11111111-0000-4000-a000-000000000006', 'Quantum Entanglement', 'SynthLab', 'Science Wave', 'https://cdn.interest.app/audio/quantum.mp3', 48.0, 'https://cdn.interest.app/audio/covers/quantum.jpg', 420)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Reels Extensions: Audio Reference & Transcripts
-- ----------------------------------------------------------------------------
ALTER TABLE reels
  ADD COLUMN IF NOT EXISTS audio_id UUID REFERENCES audio_tracks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transcript_text TEXT;

-- ----------------------------------------------------------------------------
-- 3. Full-Text Search Indexes on Reels (Captions, Titles & Transcripts)
-- ----------------------------------------------------------------------------
-- Expression-based GIN index on title + caption + transcript_text + hashtags
CREATE INDEX IF NOT EXISTS idx_reels_fulltext ON reels USING gin (
  to_tsvector('english',
    coalesce(title, '') || ' ' ||
    coalesce(caption, '') || ' ' ||
    coalesce(transcript_text, '') || ' ' ||
    array_to_string(coalesce(hashtags, '{}'::text[]), ' ')
  )
);

-- Trigram index on reels title for autocomplete / prefix matching
CREATE INDEX IF NOT EXISTS idx_reels_title_trgm ON reels USING gin (title gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 4. Full-Text Search & Trigram Indexes on Profiles (Users)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_fulltext ON profiles USING gin (
  to_tsvector('english',
    coalesce(username, '') || ' ' ||
    coalesce(display_name, '') || ' ' ||
    coalesce(bio, '')
  )
);

CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON profiles USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm ON profiles USING gin (display_name gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 5. Full-Text Search & Trigram Indexes on Interests
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_interests_fulltext ON interests USING gin (
  to_tsvector('english',
    coalesce(title, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(slug, '')
  )
);

CREATE INDEX IF NOT EXISTS idx_interests_title_trgm ON interests USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_interests_slug_trgm ON interests USING gin (slug gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 6. Hashtags Trigram Index for Autocomplete & Prefix Searching
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_hashtags_tag_trgm ON hashtags USING gin (tag gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_hashtags_reels_count ON hashtags (reels_count DESC);
