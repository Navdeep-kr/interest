-- ============================================================================
-- Migration: 011_notifications_preferences_and_devices.sql
-- Notification System: Push (FCM/APNs), In-App, Email, Preferences,
-- Quiet Hours, Batching, and Smart Throttling.
-- STRICT ZERO-LOCATION INVARIANT: Absolutely no GPS, IP geolocation,
-- proximity triggers, or location-based notifications.
-- ============================================================================

-- 1. User Device Tokens Table (FCM & APNs token registry)
CREATE TABLE IF NOT EXISTS user_device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(16) NOT NULL DEFAULT 'FCM', -- 'FCM', 'APNS', 'WEB'
    device_id VARCHAR(128),
    device_name VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_token UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON user_device_tokens(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON user_device_tokens(token);

-- 2. Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- In-App Notification Toggles
    in_app_likes BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_comments BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_mentions BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_follows BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_dms BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_interests BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_milestones BOOLEAN NOT NULL DEFAULT TRUE,
    -- Push Notification Toggles
    push_likes BOOLEAN NOT NULL DEFAULT TRUE,
    push_comments BOOLEAN NOT NULL DEFAULT TRUE,
    push_mentions BOOLEAN NOT NULL DEFAULT TRUE,
    push_follows BOOLEAN NOT NULL DEFAULT TRUE,
    push_dms BOOLEAN NOT NULL DEFAULT TRUE,
    push_interests BOOLEAN NOT NULL DEFAULT TRUE,
    push_milestones BOOLEAN NOT NULL DEFAULT TRUE,
    -- Email Notification Toggles
    email_digest BOOLEAN NOT NULL DEFAULT TRUE,
    email_security_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    email_milestones BOOLEAN NOT NULL DEFAULT TRUE,
    -- Quiet Hours (User-configured schedule, STRICTLY NO location or IP used)
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_start VARCHAR(5) NOT NULL DEFAULT '22:00', -- 'HH:mm' format
    quiet_hours_end VARCHAR(5) NOT NULL DEFAULT '08:00',   -- 'HH:mm' format
    client_timezone_offset_minutes INT NOT NULL DEFAULT 0, -- User clock offset from UTC
    -- Throttling & Batching Configuration
    max_pushes_per_hour INT NOT NULL DEFAULT 10,
    batching_window_seconds INT NOT NULL DEFAULT 300, -- 5-minute aggregation buffer
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enhance Existing Notifications Table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_ids UUID[] DEFAULT '{}'::UUID[];
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_count INT NOT NULL DEFAULT 1;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'IN_APP'; -- 'IN_APP', 'PUSH', 'EMAIL'
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(16) NOT NULL DEFAULT 'NORMAL'; -- 'URGENT', 'HIGH', 'NORMAL', 'LOW'
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_batched BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS batched_into_id UUID REFERENCES notifications(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created ON notifications(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_batched ON notifications(user_id, entity_id, is_batched, created_at DESC);

-- 4. Notification Batch Buffer Table (for holding rapid events before rollup aggregation)
CREATE TABLE IF NOT EXISTS notification_batch_buffer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_buffer_user_entity ON notification_batch_buffer(user_id, type, entity_id, created_at);
