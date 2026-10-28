-- ============================================================================
-- Migration: 020_notifications_deep_links_and_privacy.sql
-- Notification Center, Deep Link Routing, Deduplication, and Preview Privacy
-- STRICT ZERO-LOCATION INVARIANT: 0 GPS, 0 IP coordinates, 0 location tracking
-- ============================================================================

-- 1. Notification Preferences: Preview Privacy Toggle
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS hide_notification_previews BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Notifications: Deep Link Routing & Deduplication
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS deep_link_url VARCHAR(500);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_notifications_dedup
  ON notifications(user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

-- 3. Device Tokens: App Version & Push Provider Info for Multi-Platform
ALTER TABLE user_device_tokens
  ADD COLUMN IF NOT EXISTS app_version VARCHAR(32);

ALTER TABLE user_device_tokens
  ADD COLUMN IF NOT EXISTS push_provider VARCHAR(32) DEFAULT 'FCM';

-- 4. Deep Link Audit & Resolution Log (Safe, anonymized routing verification)
CREATE TABLE IF NOT EXISTS deep_link_resolutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    url VARCHAR(500) NOT NULL,
    target_screen VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128),
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    access_granted BOOLEAN NOT NULL DEFAULT TRUE,
    fallback_reason VARCHAR(64),
    resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deep_link_resolutions_user
  ON deep_link_resolutions(user_id, resolved_at DESC);
