-- ============================================================================
-- Migration: 019_messaging_ordering_sync_and_controls.sql
-- Description: Message ordering sequence numbers, idempotency client_msg_id,
--              cross-device sync, edit/delete semantics, delivery receipts,
--              conversation archive/mute/report, and contact privacy controls.
-- Strict Zero-Location Architecture: 0% location tracking in messaging.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend Conversations with Sequence Counter & Preview
-- ----------------------------------------------------------------------------
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_seq_num BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT,
  ADD COLUMN IF NOT EXISTS last_message_sender_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_last_seq ON conversations(id, last_seq_num);

-- ----------------------------------------------------------------------------
-- 2. Extend Conversation Participants with Archive & Sync Sequence Tracking
-- ----------------------------------------------------------------------------
ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_delivered_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_read_seq BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_conversation_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conv_participants_archived ON conversation_participants(user_id, is_archived);

-- ----------------------------------------------------------------------------
-- 3. Extend Messages with Sequence Number, Idempotency, Media & Edit/Delete
-- ----------------------------------------------------------------------------
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS seq_num BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_msg_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'SENT', -- 'SENT', 'DELIVERED', 'READ'
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_to UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_for UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_deleted_for_everyone BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure unique client_msg_id per conversation to guarantee deduplication on network retries
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_conversation_client_msg_id
  ON messages(conversation_id, client_msg_id)
  WHERE client_msg_id IS NOT NULL;

-- Ordered sequence index for fast cross-device sync & pagination
CREATE INDEX IF NOT EXISTS idx_messages_conversation_seq
  ON messages(conversation_id, seq_num ASC);

-- ----------------------------------------------------------------------------
-- 4. Extend Profiles with Contact Privacy Controls
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS message_privacy VARCHAR(20) NOT NULL DEFAULT 'EVERYONE'; -- 'EVERYONE', 'FOLLOWERS_ONLY', 'NOBODY'

-- ----------------------------------------------------------------------------
-- 5. Message Reports Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL, -- 'spam', 'harassment', 'prohibited_content', 'scam'
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_reports_msg ON message_reports(message_id);
