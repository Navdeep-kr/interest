-- ============================================================================
-- Migration: 024_creator_analytics_and_scheduling.sql
-- Project: "Interest" - Creator Analytics & Verified Scheduling
-- STRICT ZERO-LOCATION: 0 GPS, 0 IP coordinates, zero location attributes.
-- ============================================================================

-- 1. Enhance reel_engagements with discovery sources and client event idempotency
ALTER TABLE reel_engagements ADD COLUMN IF NOT EXISTS discovery_source VARCHAR(30) NOT NULL DEFAULT 'FOR_YOU';
ALTER TABLE reel_engagements ADD COLUMN IF NOT EXISTS client_event_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE reel_engagements ADD COLUMN IF NOT EXISTS is_qualifying_view BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reel_engagements ADD COLUMN IF NOT EXISTS session_hash VARCHAR(64) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_engagements_client_event ON reel_engagements(client_event_id) WHERE client_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_engagements_qualifying ON reel_engagements(reel_id, is_qualifying_view, created_at);
CREATE INDEX IF NOT EXISTS idx_engagements_discovery ON reel_engagements(reel_id, discovery_source);

-- 2. Quarantined Bot / Suspicious Telemetry Events Table
CREATE TABLE IF NOT EXISTS analytics_fraud_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reel_id UUID REFERENCES reels(id) ON DELETE CASCADE,
    client_event_id VARCHAR(100),
    reason VARCHAR(50) NOT NULL, -- 'RAPID_BURST', 'ZERO_WATCH_RATIO', 'DUPLICATE_EVENT', 'BOT_SIGNATURE'
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_events_created ON analytics_fraud_events(created_at DESC);

-- 3. Daily Aggregated Creator Metrics (for fast reporting and reconciliation)
CREATE TABLE IF NOT EXISTS creator_daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    total_views INT NOT NULL DEFAULT 0,
    total_watch_seconds NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_engagements INT NOT NULL DEFAULT 0,
    total_shares INT NOT NULL DEFAULT 0,
    total_saves INT NOT NULL DEFAULT 0,
    net_followers_gained INT NOT NULL DEFAULT 0,
    gross_earnings_cents INT NOT NULL DEFAULT 0,
    net_earnings_cents INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_creator_daily_metric UNIQUE(creator_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_creator_daily_metrics_date ON creator_daily_metrics(creator_id, metric_date DESC);
