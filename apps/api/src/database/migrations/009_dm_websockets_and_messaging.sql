-- ============================================================================
-- Migration: 009_dm_websockets_and_messaging.sql
-- Description: Group chats, conversation participants, voice notes,
--              reels sharing, message requests, spam filtering,
--              read receipts, and disappearing messages.
-- Strict Zero-Location Architecture: 0% location tracking in DM metadata.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend Conversations Table (Group Chats, Requests & Disappearing Messages)
-- ----------------------------------------------------------------------------
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'DIRECT', -- 'DIRECT' or 'GROUP'
  ADD COLUMN IF NOT EXISTS title VARCHAR(150),                          -- Group name
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,                             -- Group picture
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'PENDING', 'REJECTED', 'ARCHIVED'
  ADD COLUMN IF NOT EXISTS disappearing_ttl_seconds INT DEFAULT NULL;   -- NULL = off; 86400 = 24h; 604800 = 7d

-- Drop rigid constraints if they were created in 001 to permit group chats
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS chk_ordered_pair;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS uq_conversation_pair;

-- Allow participant_a_id and participant_b_id to be nullable for group conversations
ALTER TABLE conversations ALTER COLUMN participant_a_id DROP NOT NULL;
ALTER TABLE conversations ALTER COLUMN participant_b_id DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Conversation Participants Table (Multi-User Group Chats & Membership)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',               -- 'ADMIN' or 'MEMBER'
  status VARCHAR(20) NOT NULL DEFAULT 'ACCEPTED',           -- 'ACCEPTED', 'PENDING', 'REJECTED'
  last_read_at TIMESTAMPTZ,
  notifications_muted BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id, status);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id);

-- Backfill conversation_participants from legacy 1:1 direct conversations
INSERT INTO conversation_participants (conversation_id, user_id, role, status, joined_at)
SELECT id, participant_a_id, 'MEMBER', 'ACCEPTED', created_at
FROM conversations
WHERE participant_a_id IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

INSERT INTO conversation_participants (conversation_id, user_id, role, status, joined_at)
SELECT id, participant_b_id, 'MEMBER', 'ACCEPTED', created_at
FROM conversations
WHERE participant_b_id IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Extend Messages Table (Voice Notes, Shared Reels, Read Receipts & Disappearing)
-- ----------------------------------------------------------------------------
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT', -- 'TEXT', 'VOICE', 'REEL', 'SYSTEM'
  ADD COLUMN IF NOT EXISTS voice_url TEXT,
  ADD COLUMN IF NOT EXISTS voice_duration_seconds REAL,
  ADD COLUMN IF NOT EXISTS voice_waveform JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,                           -- Disappearing message expiry timestamp
  ADD COLUMN IF NOT EXISTS is_ephemeral BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_by UUID[] NOT NULL DEFAULT '{}',             -- Participant user IDs who read message
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Allow text to be nullable when message is a pure voice note or shared reel
ALTER TABLE messages ALTER COLUMN text DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_expiry ON messages(conversation_id, expires_at)
  WHERE expires_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. Extend Profiles Table (Read Receipts & Message Request Privacy Settings)
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS read_receipts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS message_requests_filter VARCHAR(20) NOT NULL DEFAULT 'STANDARD'; -- 'STANDARD', 'STRICT', 'OFF'
