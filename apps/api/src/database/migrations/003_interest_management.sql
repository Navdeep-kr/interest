-- ============================================================================
-- Migration: 003_interest_management.sql
-- Adds mute and pause states to user_interests for fine-grained feed control.
-- ============================================================================

ALTER TABLE user_interests ADD COLUMN IF NOT EXISTS is_muted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_interests ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_interests_active ON user_interests(user_id, is_muted, is_paused);
